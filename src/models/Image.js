const db = require('../services/database');

class Image {
  /**
   * Create image record
   * @param {Object} imageData - Image data
   * @returns {Promise<Object>} Created image
   */
  static async create(imageData) {
    const {
      userId,
      jobId,
      vltSpecId,
      r2Key,
      r2Bucket,
      cdnUrl,
      thumbnailUrl,
      originalSize,
      enhancedSize,
      width,
      height,
      format,
      vltAnalysis,
      qualityScore,
      generationCost,
      enhancementCost
    } = imageData;

    const query = `
      INSERT INTO images (
        user_id, job_id, vlt_spec_id, r2_key, r2_bucket, cdn_url, thumbnail_url,
        original_size, enhanced_size, width, height, format, vlt_analysis, 
        quality_score, generation_cost, enhancement_cost
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      userId,
      jobId || null,
      vltSpecId || null,
      r2Key,
      r2Bucket || process.env.R2_BUCKET_NAME,
      cdnUrl,
      thumbnailUrl || null,
      originalSize || 0,
      enhancedSize || 0,
      width || null,
      height || null,
      format || 'jpg',
      vltAnalysis ? JSON.stringify(vltAnalysis) : null,
      qualityScore || null,
      generationCost || 0,
      enhancementCost || 0
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Create multiple images in batch
   * @param {Array<Object>} images - Array of image data
   * @returns {Promise<Array>} Created images
   */
  static async createBatch(images) {
    const results = await db.transaction(async (client) => {
      const createdImages = [];
      
      for (const imageData of images) {
        const query = `
          INSERT INTO images (
            user_id, job_id, vlt_spec_id, r2_key, r2_bucket, cdn_url, thumbnail_url,
            original_size, enhanced_size, width, height, format, vlt_analysis,
            quality_score, generation_cost, enhancement_cost
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `;

        const values = [
          imageData.userId,
          imageData.jobId || null,
          imageData.vltSpecId || null,
          imageData.r2Key,
          imageData.r2Bucket || process.env.R2_BUCKET_NAME,
          imageData.cdnUrl,
          imageData.thumbnailUrl || null,
          imageData.originalSize || 0,
          imageData.enhancedSize || 0,
          imageData.width || null,
          imageData.height || null,
          imageData.format || 'jpg',
          imageData.vltAnalysis ? JSON.stringify(imageData.vltAnalysis) : null,
          imageData.qualityScore || null,
          imageData.generationCost || 0,
          imageData.enhancementCost || 0
        ];

        const result = await client.query(query, values);
        createdImages.push(result.rows[0]);
      }

      return createdImages;
    });

    return results;
  }

  /**
   * Find image by ID
   * @param {string} imageId - Image ID
   * @returns {Promise<Object|null>} Image object or null
   */
  static async findById(imageId) {
    const query = `
      SELECT * FROM images
      WHERE id = $1
    `;

    const result = await db.query(query, [imageId]);
    return result.rows[0] || null;
  }

  /**
   * Find images by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Images with pagination
   */
  static async findByUserId(userId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      isOutlier = null,
      jobId = null,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = options;

    let query = `
      SELECT * FROM images
      WHERE user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (isOutlier !== null) {
      query += ` AND is_outlier = $${paramIndex}`;
      params.push(isOutlier);
      paramIndex++;
    }

    if (jobId) {
      query += ` AND job_id = $${paramIndex}`;
      params.push(jobId);
      paramIndex++;
    }

    query += ` ORDER BY ${orderBy} ${orderDirection}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM images WHERE user_id = $1
      ${isOutlier !== null ? `AND is_outlier = ${isOutlier}` : ''}
      ${jobId ? `AND job_id = '${jobId}'` : ''}
    `;
    const countResult = await db.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].count);

    return {
      images: result.rows,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    };
  }

  /**
   * Find images by job ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Array>} Array of images
   */
  static async findByJobId(jobId) {
    const query = `
      SELECT * FROM images
      WHERE job_id = $1
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [jobId]);
    return result.rows;
  }

  /**
   * Mark image as outlier
   * @param {string} imageId - Image ID
   * @param {string} reason - Reason for marking as outlier
   * @returns {Promise<Object>} Updated image
   */
  static async markAsOutlier(imageId, reason = null) {
    const query = `
      UPDATE images
      SET is_outlier = true,
          outlier_marked_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [imageId]);
    return result.rows[0];
  }

  /**
   * Unmark image as outlier
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Updated image
   */
  static async unmarkAsOutlier(imageId) {
    const query = `
      UPDATE images
      SET is_outlier = false,
          outlier_marked_at = NULL
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [imageId]);
    return result.rows[0];
  }

  /**
   * Update image VLT analysis
   * @param {string} imageId - Image ID
   * @param {Object} analysis - VLT analysis results
   * @param {number} qualityScore - Quality score
   * @returns {Promise<Object>} Updated image
   */
  static async updateVLTAnalysis(imageId, analysis, qualityScore = null) {
    const query = `
      UPDATE images
      SET vlt_analysis = $1,
          quality_score = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await db.query(query, [
      JSON.stringify(analysis),
      qualityScore,
      imageId
    ]);
    return result.rows[0];
  }

  /**
   * Delete image
   * @param {string} imageId - Image ID
   * @returns {Promise<Object>} Deleted image data
   */
  static async delete(imageId) {
    const query = `
      DELETE FROM images
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [imageId]);
    return result.rows[0];
  }

  /**
   * Get user image statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Image statistics
   */
  static async getUserStats(userId) {
    const query = `
      SELECT 
        COUNT(*) as total_images,
        COUNT(CASE WHEN is_outlier = true THEN 1 END) as outlier_images,
        SUM(original_size) as total_size,
        AVG(quality_score) as avg_quality_score,
        SUM(generation_cost + enhancement_cost) as total_cost
      FROM images
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    const stats = result.rows[0];

    return {
      totalImages: parseInt(stats.total_images),
      outlierImages: parseInt(stats.outlier_images),
      outlierRate: stats.total_images > 0 
        ? (stats.outlier_images / stats.total_images * 100).toFixed(2)
        : 0,
      totalSizeBytes: parseInt(stats.total_size || 0),
      totalSizeMB: ((stats.total_size || 0) / (1024 * 1024)).toFixed(2),
      avgQualityScore: parseFloat(stats.avg_quality_score || 0).toFixed(2),
      totalCost: parseFloat(stats.total_cost || 0).toFixed(4)
    };
  }

  /**
   * Get top outlier images
   * @param {string} userId - User ID
   * @param {number} limit - Number of images to return
   * @returns {Promise<Array>} Top outlier images
   */
  static async getTopOutliers(userId, limit = 10) {
    const query = `
      SELECT * FROM images
      WHERE user_id = $1 AND is_outlier = true
      ORDER BY quality_score DESC NULLS LAST, outlier_marked_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }
}

module.exports = Image;
