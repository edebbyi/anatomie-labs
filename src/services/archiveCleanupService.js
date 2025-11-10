/**
 * Archive Cleanup Service
 * Automatically deletes archived images after 15 days
 */

const db = require('./database');
const logger = require('../utils/logger');

const ARCHIVE_RETENTION_DAYS = 15;

class ArchiveCleanupService {
  /**
   * Ensure the generations table has archive support columns and indexes.
   * This is idempotent and safe to call repeatedly.
   */
  async ensureArchiveSchema() {
    const statements = [
      `ALTER TABLE generations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE generations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE`,
      `UPDATE generations SET archived = FALSE WHERE archived IS NULL`,
      `CREATE INDEX IF NOT EXISTS idx_generations_archived ON generations(archived)`,
      `CREATE INDEX IF NOT EXISTS idx_generations_archived_at ON generations(archived_at) WHERE archived = TRUE`,
      `CREATE INDEX IF NOT EXISTS idx_generations_user_archived ON generations(user_id, archived) WHERE archived = FALSE`
    ];

    try {
      logger.info('Archive Cleanup: Ensuring archive support schema');
      for (const sql of statements) {
        await db.query(sql);
      }
      logger.info('Archive Cleanup: Archive support schema verified');
    } catch (error) {
      logger.error('Archive Cleanup: Failed to ensure archive support schema', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete archived images older than 15 days
   * Should be called periodically (e.g., daily via cron job)
   */
  async cleanupExpiredArchives() {
    try {
      logger.info('Archive Cleanup: Starting cleanup of expired archived images');

      // Calculate cutoff date (15 days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_RETENTION_DAYS);

      logger.info(`Archive Cleanup: Deleting archived images archived before ${cutoffDate.toISOString()}`);

      // Delete archived images and their associated data
      const deleteQuery = `
        DELETE FROM generations
        WHERE archived = TRUE 
        AND archived_at < $1
        AND archived_at IS NOT NULL
        RETURNING id, user_id, archived_at
      `;

      const result = await db.query(deleteQuery, [cutoffDate.toISOString()]);
      const deletedCount = result.rowCount;
      const deletedImages = result.rows;

      logger.info(`Archive Cleanup: Deleted ${deletedCount} archived images older than ${ARCHIVE_RETENTION_DAYS} days`, {
        cutoffDate: cutoffDate.toISOString(),
        deletedCount,
        deletedImages: deletedImages.map(img => ({
          id: img.id,
          userId: img.user_id,
          archivedAt: img.archived_at
        }))
      });

      return {
        success: true,
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        deletedImages
      };
    } catch (error) {
      logger.error('Archive Cleanup: Failed to cleanup expired archives', {
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Get statistics about archived images
   */
  async getArchiveStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_archived,
          COUNT(CASE WHEN archived_at < NOW() - INTERVAL '${ARCHIVE_RETENTION_DAYS} days' THEN 1 END) as expired_and_deletable,
          COUNT(CASE WHEN archived_at >= NOW() - INTERVAL '${ARCHIVE_RETENTION_DAYS} days' AND archived_at < NOW() THEN 1 END) as active_archived,
          MIN(archived_at) as oldest_archived_date,
          MAX(archived_at) as newest_archived_date
        FROM generations
        WHERE archived = TRUE
      `;

      const result = await db.query(statsQuery);
      return result.rows[0];
    } catch (error) {
      logger.error('Archive Cleanup: Failed to get archive statistics', {
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get archived images for a user
   */
  async getUserArchivedImages(userId, limit = 50) {
    try {
      const query = `
        SELECT 
          id,
          user_id,
          url,
          archived_at,
          created_at,
          created_at + INTERVAL '${ARCHIVE_RETENTION_DAYS} days' as will_delete_at,
          (EXTRACT(EPOCH FROM (created_at + INTERVAL '${ARCHIVE_RETENTION_DAYS} days' - NOW())) / 86400)::INT as days_until_deletion
        FROM generations
        WHERE user_id = $1 AND archived = TRUE
        ORDER BY archived_at DESC
        LIMIT $2
      `;

      const result = await db.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Archive Cleanup: Failed to get user archived images', {
        userId,
        error: error.message
      });

      throw error;
    }
  }
}

module.exports = new ArchiveCleanupService();
