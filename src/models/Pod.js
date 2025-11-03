const db = require('../services/database');
const logger = require('../utils/logger');
const { POSITIVE_FEEDBACK_TYPES } = require('../constants/feedback');

const ensureArray = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(Boolean)));
};

class Pod {
  static async getPodsForUser(userId) {
    const query = `
      SELECT
        p.*,
        COALESCE(
          p.cover_image_url,
          (
            SELECT g.url
            FROM pod_images pi
            JOIN generations g ON g.id = pi.image_id
            WHERE pi.pod_id = p.id
            ORDER BY COALESCE(pi.position, 2147483647), pi.added_at ASC
            LIMIT 1
          )
        ) AS resolved_cover_image_url
      FROM pods p
      WHERE p.user_id = $1
      ORDER BY p.created_at ASC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async getPodById(userId, podId, client) {
    const runner = client || db;
    const query = `
      SELECT *
      FROM pods
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const result = await runner.query(query, [podId, userId]);
    return result.rows[0] || null;
  }

  static async createPod(userId, { name, description }) {
    // First check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : null;

    const query = `
      INSERT INTO pods (user_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [userId, trimmedName, trimmedDescription]);
    return result.rows[0];
  }

  static async updatePod(userId, podId, { name, description }) {
    const fields = [];
    const params = [];
    let index = 1;

    if (typeof name === 'string') {
      fields.push(`name = $${index++}`);
      params.push(name.trim());
    }

    if (description !== undefined) {
      fields.push(`description = $${index++}`);
      params.push(description ? description.trim() : null);
    }

    if (fields.length === 0) {
      return await Pod.getPodById(userId, podId);
    }

    const query = `
      UPDATE pods
      SET ${fields.join(', ')},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $${index++} AND user_id = $${index}
      RETURNING *
    `;

    params.push(podId, userId);

    const result = await db.query(query, params);
    return result.rows[0] || null;
  }

  static async deletePod(userId, podId) {
    const query = `
      DELETE FROM pods
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [podId, userId]);
    return result.rows[0] || null;
  }

  static async addImages(userId, podId, imageIds) {
    const validImageIds = ensureArray(imageIds);
    if (validImageIds.length === 0) {
      return await Pod.getPodById(userId, podId);
    }

    return await db.transaction(async (client) => {
      const pod = await Pod.getPodById(userId, podId, client);
      if (!pod) {
        const error = new Error('Pod not found');
        error.statusCode = 404;
        throw error;
      }

      const ownedImages = await client.query(
        `
          SELECT g.id
          FROM generations g
          JOIN feedback f ON f.generation_id = g.id
          WHERE g.user_id = $1
            AND f.user_id = $1
            AND f.type = ANY($2)
            AND g.id = ANY($3::uuid[])
        `,
        [userId, POSITIVE_FEEDBACK_TYPES, validImageIds]
      );

      if (ownedImages.rowCount !== validImageIds.length) {
        const missingCount = validImageIds.length - ownedImages.rowCount;
        logger.warn('Attempt to add invalid images to pod', {
          userId,
          podId,
          requested: validImageIds.length,
          valid: ownedImages.rowCount
        });
        const error = new Error(`Unable to add ${missingCount} image(s) to this pod`);
        error.statusCode = 400;
        throw error;
      }

      const positionResult = await client.query(
        'SELECT COALESCE(MAX(position), 0) AS max_position FROM pod_images WHERE pod_id = $1',
        [podId]
      );

      let position = parseInt(positionResult.rows[0]?.max_position || 0, 10);

      for (const imageId of validImageIds) {
        position += 1;
        await client.query(
          `
            INSERT INTO pod_images (pod_id, image_id, position)
            VALUES ($1, $2, $3)
            ON CONFLICT (pod_id, image_id) DO NOTHING
          `,
          [podId, imageId, position]
        );
      }

      const [updatedPod] = await Pod.refreshMetadata([podId], client);
      return updatedPod;
    });
  }

  static async removeImage(userId, podId, imageId) {
    return await db.transaction(async (client) => {
      const pod = await Pod.getPodById(userId, podId, client);
      if (!pod) {
        const error = new Error('Pod not found');
        error.statusCode = 404;
        throw error;
      }

      await client.query(
        `
          DELETE FROM pod_images
          WHERE pod_id = $1 AND image_id = $2
        `,
        [podId, imageId]
      );

      const [updatedPod] = await Pod.refreshMetadata([podId], client);
      return updatedPod;
    });
  }

  static async getImages(userId, podId) {
    const query = `
      SELECT
        g.id,
        g.url,
        g.created_at AS created_at,
        f.created_at AS liked_at,
        p.text AS prompt_text,
        p.json_spec,
        pi.position,
        pi.added_at,
        membership.pod_ids
      FROM pod_images pi
      JOIN pods pod ON pod.id = pi.pod_id
      JOIN generations g ON g.id = pi.image_id
      LEFT JOIN feedback f ON f.generation_id = g.id AND f.user_id = pod.user_id
      LEFT JOIN prompts p ON p.id = g.prompt_id
      LEFT JOIN LATERAL (
        SELECT ARRAY_REMOVE(ARRAY_AGG(pi2.pod_id), NULL) AS pod_ids
        FROM pod_images pi2
        WHERE pi2.image_id = g.id
      ) AS membership ON true
      WHERE pod.user_id = $1 AND pod.id = $2
      ORDER BY COALESCE(pi.position, 2147483647), pi.added_at ASC
    `;

    const result = await db.query(query, [userId, podId]);
    return result.rows;
  }

  static async setImagePods(userId, imageId, podIds) {
    const validPodIds = ensureArray(podIds);

    return await db.transaction(async (client) => {
      const imageResult = await client.query(
        `
          SELECT g.id
          FROM generations g
          JOIN feedback f ON f.generation_id = g.id
          WHERE g.id = $1
            AND g.user_id = $2
            AND f.user_id = $2
            AND f.type = ANY($3)
        `,
        [imageId, userId, POSITIVE_FEEDBACK_TYPES]
      );

      if (imageResult.rowCount === 0) {
        const error = new Error('Image not found or not liked by user');
        error.statusCode = 404;
        throw error;
      }

      if (validPodIds.length > 0) {
        const podsResult = await client.query(
          `
            SELECT id
            FROM pods
            WHERE user_id = $1
              AND id = ANY($2::uuid[])
          `,
          [userId, validPodIds]
        );

        if (podsResult.rowCount !== validPodIds.length) {
          const error = new Error('One or more pods are invalid');
          error.statusCode = 400;
          throw error;
        }
      }

      const existingMembership = await client.query(
        `
          SELECT pod_id
          FROM pod_images
          WHERE image_id = $1
            AND pod_id IN (SELECT id FROM pods WHERE user_id = $2)
        `,
        [imageId, userId]
      );

      await client.query(
        `
          DELETE FROM pod_images
          WHERE image_id = $1
            AND pod_id IN (SELECT id FROM pods WHERE user_id = $2)
        `,
        [imageId, userId]
      );

      const updatedPodIds = new Set(existingMembership.rows.map((row) => row.pod_id));

      if (validPodIds.length > 0) {
        let position = 0;

        for (const podId of validPodIds) {
          const positionResult = await client.query(
            'SELECT COALESCE(MAX(position), 0) AS max_position FROM pod_images WHERE pod_id = $1',
            [podId]
          );

          position = parseInt(positionResult.rows[0]?.max_position || 0, 10) + 1;

          await client.query(
            `
              INSERT INTO pod_images (pod_id, image_id, position)
              VALUES ($1, $2, $3)
              ON CONFLICT (pod_id, image_id) DO NOTHING
            `,
            [podId, imageId, position]
          );
          updatedPodIds.add(podId);
        }
      }

      const podIdsToRefresh = Array.from(updatedPodIds);
      const updatedPods = await Pod.refreshMetadata(podIdsToRefresh, client);
      return updatedPods;
    });
  }

  static async refreshMetadata(podIds, client) {
    const ids = ensureArray(podIds);
    if (ids.length === 0) {
      return [];
    }

    const runner = client || db;

    const query = `
      WITH stats AS (
        SELECT
          p.id,
          COUNT(pi.image_id) AS image_count,
          (
            SELECT g.url
            FROM pod_images pi2
            JOIN generations g ON g.id = pi2.image_id
            WHERE pi2.pod_id = p.id
            ORDER BY COALESCE(pi2.position, 2147483647), pi2.added_at ASC
            LIMIT 1
          ) AS cover_image_url
        FROM pods p
        LEFT JOIN pod_images pi ON pi.pod_id = p.id
        WHERE p.id = ANY($1::uuid[])
        GROUP BY p.id
      )
      UPDATE pods
      SET
        image_count = stats.image_count,
        cover_image_url = stats.cover_image_url,
        updated_at = CURRENT_TIMESTAMP
      FROM stats
      WHERE pods.id = stats.id
      RETURNING pods.*;
    `;

    const result = await runner.query(query, [ids]);
    return result.rows;
  }

  static async getPodMembershipMap(userId) {
    const query = `
      SELECT image_id, ARRAY_AGG(pod_id) AS pod_ids
      FROM pod_images
      WHERE pod_id IN (SELECT id FROM pods WHERE user_id = $1)
      GROUP BY image_id
    `;

    const result = await db.query(query, [userId]);
    const membership = new Map();

    for (const row of result.rows) {
      membership.set(row.image_id, row.pod_ids || []);
    }

    return membership;
  }

  static async getPodsForImage(userId, imageId) {
    const query = `
      SELECT p.*
      FROM pod_images pi
      JOIN pods p ON p.id = pi.pod_id
      WHERE pi.image_id = $1
        AND p.user_id = $2
      ORDER BY p.created_at ASC
    `;

    const result = await db.query(query, [imageId, userId]);
    return result.rows;
  }
}

module.exports = Pod;
