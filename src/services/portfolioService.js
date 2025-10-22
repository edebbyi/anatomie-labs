const db = require('./database');
const logger = require('../utils/logger');

class PortfolioService {
  /**
   * Save VLT batch analysis results to database
   * Creates records in vlt_specifications table for each analyzed image
   * 
   * @param {string} userId - User UUID
   * @param {Object} vltResult - VLT analysis result
   * @param {Object} options - Optional metadata
   * @returns {Promise<Object>} Save result with statistics
   */
  async saveBatchAnalysis(userId, vltResult, options = {}) {
    if (!vltResult || !vltResult.records || vltResult.records.length === 0) {
      throw new Error('Invalid VLT result: no records found');
    }

    logger.info('Saving VLT batch analysis to database', {
      userId,
      recordCount: vltResult.records.length,
      jobId: vltResult.jobId
    });

    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      const savedRecords = [];
      const errors = [];

      // Insert each VLT record into vlt_specifications table
      for (const record of vltResult.records) {
        try {
          const result = await client.query(
            `INSERT INTO vlt_specifications (
              user_id,
              garment_type,
              silhouette,
              fabric,
              colors,
              construction,
              style,
              prompt_text,
              confidence,
              attributes,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            RETURNING id`,
            [
              userId,
              record.garmentType || null,
              record.silhouette || null,
              JSON.stringify(typeof record.fabric === 'object' && record.fabric !== null ? record.fabric : {}),
              JSON.stringify(typeof record.colors === 'object' && record.colors !== null ? record.colors : {}),
              JSON.stringify(typeof record.construction === 'object' && record.construction !== null ? record.construction : {}),
              JSON.stringify(typeof record.style === 'object' && record.style !== null ? record.style : {}),
              record.promptText || null,
              typeof record.confidence === 'number' ? record.confidence : null,
              JSON.stringify({
                imageId: record.imageId,
                model: vltResult.model,
                backend: vltResult.backend,
                jobId: vltResult.jobId,
                timestamp: vltResult.timestamp,
                modelSpecs: record.modelSpecs || {},
                neckline: record.neckline,
                sleeveLength: record.sleeveLength,
                length: record.length,
                ...(typeof record.attributes === 'object' && record.attributes !== null ? record.attributes : {})
              })
            ]
          );

          savedRecords.push({
            id: result.rows[0].id,
            imageId: record.imageId,
            garmentType: record.garmentType
          });

        } catch (error) {
          logger.error('Failed to save individual VLT record', {
            userId,
            imageId: record.imageId,
            error: error.message
          });
          errors.push({
            imageId: record.imageId,
            error: error.message
          });
          // Rollback and rethrow to abort the entire transaction
          // Once a query fails in Postgres, all subsequent queries in the transaction fail
          await client.query('ROLLBACK');
          throw new Error(`Failed to save VLT record for image ${record.imageId}: ${error.message}`);
        }
      }

      await client.query('COMMIT');

      logger.info('VLT batch analysis saved successfully', {
        userId,
        savedCount: savedRecords.length,
        errorCount: errors.length,
        jobId: vltResult.jobId
      });

      return {
        success: true,
        savedCount: savedRecords.length,
        totalCount: vltResult.records.length,
        records: savedRecords,
        errors: errors.length > 0 ? errors : undefined,
        summary: vltResult.summary
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to save VLT batch analysis', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's portfolio from vlt_specifications
   * 
   * @param {string} userId - User UUID
   * @param {Object} options - Query options (limit, offset, filters)
   * @returns {Promise<Array>} Portfolio items
   */
  async getUserPortfolio(userId, options = {}) {
    const {
      limit = 100,
      offset = 0,
      garmentType = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    try {
      let query = `
        SELECT 
          id,
          garment_type,
          silhouette,
          fabric,
          colors,
          construction,
          style,
          prompt_text,
          confidence,
          attributes,
          created_at
        FROM vlt_specifications
        WHERE user_id = $1
      `;

      const params = [userId];

      if (garmentType) {
        query += ` AND garment_type = $${params.length + 1}`;
        params.push(garmentType);
      }

      query += ` ORDER BY ${sortBy} ${sortOrder}`;
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await db.query(query, params);

      logger.info('Retrieved user portfolio', {
        userId,
        count: result.rows.length,
        garmentType,
        limit,
        offset
      });

      return result.rows;

    } catch (error) {
      logger.error('Failed to retrieve user portfolio', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get portfolio summary statistics
   * 
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Portfolio statistics
   */
  async getPortfolioSummary(userId) {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(*) as total_images,
          COUNT(DISTINCT garment_type) as unique_garment_types,
          AVG(confidence) as average_confidence,
          MIN(created_at) as first_upload,
          MAX(created_at) as last_upload
        FROM vlt_specifications
        WHERE user_id = $1`,
        [userId]
      );

      // Get garment type distribution
      const typeDistribution = await db.query(
        `SELECT 
          garment_type,
          COUNT(*) as count
        FROM vlt_specifications
        WHERE user_id = $1 AND garment_type IS NOT NULL
        GROUP BY garment_type
        ORDER BY count DESC
        LIMIT 10`,
        [userId]
      );

      return {
        totalImages: parseInt(result.rows[0].total_images) || 0,
        uniqueGarmentTypes: parseInt(result.rows[0].unique_garment_types) || 0,
        averageConfidence: parseFloat(result.rows[0].average_confidence) || 0,
        firstUpload: result.rows[0].first_upload,
        lastUpload: result.rows[0].last_upload,
        garmentTypeDistribution: typeDistribution.rows.map(row => ({
          type: row.garment_type,
          count: parseInt(row.count)
        }))
      };

    } catch (error) {
      logger.error('Failed to get portfolio summary', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete user's entire portfolio
   * 
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Deletion result
   */
  async deletePortfolio(userId) {
    try {
      const result = await db.query(
        `DELETE FROM vlt_specifications WHERE user_id = $1`,
        [userId]
      );

      logger.info('Portfolio deleted', {
        userId,
        deletedCount: result.rowCount
      });

      return {
        success: true,
        deletedCount: result.rowCount
      };

    } catch (error) {
      logger.error('Failed to delete portfolio', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PortfolioService();
