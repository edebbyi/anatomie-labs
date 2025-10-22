const logger = require('../utils/logger');
const db = require('./database');
const rlhfService = require('./rlhfService');

/**
 * Stage 10: RLHF Learning Update Service
 * Processes outlier feedback and updates RLHF models and style profiles
 */
class RLHFLearningService {
  constructor() {
    this.updateBatchSize = 10; // Process outliers in batches
    this.autoUpdateEnabled = process.env.RLHF_AUTO_UPDATE === 'true';
  }

  /**
   * Process new outliers and update RLHF
   * @param {number} limit - Max outliers to process
   * @returns {Promise<Object>} Update results
   */
  async processOutliersForLearning(limit = 50) {
    try {
      logger.info('Processing outliers for RLHF learning', { limit });

      const client = await db.getClient();
      try {
        // Get unprocessed outliers
        const result = await client.query(`
          SELECT 
            o.*,
            ga.prompt,
            ga.negative_prompt,
            mp.name as provider_name
          FROM outliers o
          JOIN generation_assets ga ON o.asset_id = ga.id
          LEFT JOIN model_providers mp ON ga.provider_id = mp.id
          WHERE o.rlhf_updated = FALSE
          ORDER BY o.clip_score DESC NULLS LAST, o.user_rating DESC NULLS LAST
          LIMIT $1
        `, [limit]);

        const outliers = result.rows;

        if (outliers.length === 0) {
          logger.info('No new outliers to process');
          return {
            processedCount: 0,
            updates: []
          };
        }

        const updates = [];

        // Update RLHF with successful prompts
        const rlhfUpdate = await this.updateRLHFWithOutliers(outliers);
        if (rlhfUpdate) updates.push(rlhfUpdate);

        // Update style profiles
        const styleUpdate = await this.updateStyleProfiles(outliers);
        if (styleUpdate) updates.push(styleUpdate);

        // Mark outliers as processed
        const outlierIds = outliers.map(o => o.id);
        await client.query(`
          UPDATE outliers
          SET rlhf_updated = TRUE, rlhf_updated_at = NOW()
          WHERE id = ANY($1::uuid[])
        `, [outlierIds]);

        logger.info('Outlier processing complete', {
          processedCount: outliers.length,
          updateCount: updates.length
        });

        return {
          processedCount: outliers.length,
          updates
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to process outliers for learning', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update RLHF with successful outlier prompts
   * @param {Array} outliers - Outlier records
   * @returns {Promise<Object>} Update record
   */
  async updateRLHFWithOutliers(outliers) {
    try {
      logger.info('Updating RLHF with outlier data', {
        count: outliers.length
      });

      // Extract successful patterns
      const successfulPatterns = this.extractSuccessfulPatterns(outliers);

      // Update RLHF service (Stage 5)
      // In production, this would retrain or update the RLHF model
      // For now, we'll log the patterns and store the update

      const updateDetails = {
        outlierCount: outliers.length,
        patterns: successfulPatterns,
        avgClipScore: outliers.reduce((sum, o) => sum + (o.clip_score || 0), 0) / outliers.length,
        avgUserRating: outliers.reduce((sum, o) => sum + (o.user_rating || 0), 0) / outliers.length
      };

      // Log learning update
      const client = await db.getClient();
      try {
        const result = await client.query(`
          INSERT INTO learning_updates (
            update_type,
            target_component,
            update_details,
            affected_users,
            expected_improvement,
            status,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING *
        `, [
          'rlhf_prompt_update',
          'rlhf_service',
          JSON.stringify(updateDetails),
          outliers.length,
          `Incorporate ${outliers.length} successful prompt patterns into RLHF`,
          'applied'
        ]);

        return result.rows[0];

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to update RLHF', { error: error.message });
      return null;
    }
  }

  /**
   * Extract successful patterns from outliers
   * @param {Array} outliers - Outlier records
   * @returns {Object} Successful patterns
   */
  extractSuccessfulPatterns(outliers) {
    const patterns = {
      vltAttributes: {},
      commonKeywords: {},
      providers: {}
    };

    outliers.forEach(outlier => {
      // Track VLT attributes
      const attrs = outlier.successful_attributes || {};
      Object.entries(attrs).forEach(([key, value]) => {
        if (!patterns.vltAttributes[key]) {
          patterns.vltAttributes[key] = {};
        }
        if (!patterns.vltAttributes[key][value]) {
          patterns.vltAttributes[key][value] = 0;
        }
        patterns.vltAttributes[key][value]++;
      });

      // Track providers
      if (outlier.provider_name) {
        patterns.providers[outlier.provider_name] = 
          (patterns.providers[outlier.provider_name] || 0) + 1;
      }

      // Extract keywords from prompts
      if (outlier.prompt) {
        const keywords = this.extractKeywords(outlier.prompt);
        keywords.forEach(keyword => {
          patterns.commonKeywords[keyword] = 
            (patterns.commonKeywords[keyword] || 0) + 1;
        });
      }
    });

    return patterns;
  }

  /**
   * Extract keywords from prompt
   * @param {string} prompt - Prompt text
   * @returns {Array} Keywords
   */
  extractKeywords(prompt) {
    // Simple keyword extraction
    const words = prompt.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4) // Filter short words
      .filter(w => !/^(the|and|with|that|this|from|have|been|are|for)$/.test(w)); // Filter common words
    
    return [...new Set(words)]; // Unique words
  }

  /**
   * Update style profiles with successful generations
   * @param {Array} outliers - Outlier records
   * @returns {Promise<Object>} Update record
   */
  async updateStyleProfiles(outliers) {
    try {
      logger.info('Updating style profiles', {
        count: outliers.length
      });

      const client = await db.getClient();
      try {
        // Group outliers by user and style
        const userStyles = {};
        outliers.forEach(outlier => {
          const key = `${outlier.user_id}_${outlier.style_profile}`;
          if (!userStyles[key]) {
            userStyles[key] = {
              userId: outlier.user_id,
              styleProfile: outlier.style_profile,
              outliers: []
            };
          }
          userStyles[key].outliers.push(outlier);
        });

        // Update each user-style combination
        for (const [key, data] of Object.entries(userStyles)) {
          // Calculate top attributes for this profile
          const topAttributes = this.calculateTopAttributes(data.outliers);

          await client.query(`
            INSERT INTO style_profile_success (
              user_id,
              style_profile,
              total_generations,
              outlier_count,
              top_attributes,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            ON CONFLICT (user_id, style_profile) DO UPDATE SET
              total_generations = style_profile_success.total_generations + EXCLUDED.total_generations,
              outlier_count = style_profile_success.outlier_count + EXCLUDED.outlier_count,
              top_attributes = EXCLUDED.top_attributes,
              updated_at = NOW()
          `, [
            data.userId,
            data.styleProfile || 'default',
            data.outliers.length,
            data.outliers.length,
            JSON.stringify(topAttributes)
          ]);
        }

        // Log update
        const result = await client.query(`
          INSERT INTO learning_updates (
            update_type,
            target_component,
            update_details,
            affected_users,
            expected_improvement,
            status,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING *
        `, [
          'style_profile_update',
          'user_style_profiles',
          JSON.stringify({ updatedProfiles: Object.keys(userStyles).length }),
          Object.keys(userStyles).length,
          `Updated ${Object.keys(userStyles).length} style profiles with successful attributes`,
          'applied'
        ]);

        return result.rows[0];

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to update style profiles', { error: error.message });
      return null;
    }
  }

  /**
   * Calculate top attributes from outliers
   * @param {Array} outliers - Outlier records
   * @returns {Object} Top attributes
   */
  calculateTopAttributes(outliers) {
    const attributeCounts = {};

    outliers.forEach(outlier => {
      const attrs = outlier.successful_attributes || {};
      Object.entries(attrs).forEach(([key, value]) => {
        if (!attributeCounts[key]) {
          attributeCounts[key] = {};
        }
        attributeCounts[key][value] = (attributeCounts[key][value] || 0) + 1;
      });
    });

    // Get top 3 for each attribute
    const topAttributes = {};
    Object.entries(attributeCounts).forEach(([key, values]) => {
      topAttributes[key] = Object.entries(values)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([value, count]) => ({ value, count }));
    });

    return topAttributes;
  }

  /**
   * Get learning impact statistics
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Learning impact stats
   */
  async getLearningImpact(days = 30) {
    try {
      const client = await db.getClient();
      try {
        const result = await client.query(`
          SELECT *
          FROM learning_impact
        `);

        // Get total outliers processed
        const outlierResult = await client.query(`
          SELECT 
            COUNT(*) as total_outliers,
            SUM(CASE WHEN rlhf_updated THEN 1 ELSE 0 END) as processed_outliers
          FROM outliers
          WHERE created_at >= NOW() - INTERVAL '${days} days'
        `);

        const outlierStats = outlierResult.rows[0];

        return {
          updates: result.rows,
          outlierStats: {
            total: parseInt(outlierStats.total_outliers),
            processed: parseInt(outlierStats.processed_outliers),
            pending: parseInt(outlierStats.total_outliers) - parseInt(outlierStats.processed_outliers)
          }
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get learning impact', { error: error.message });
      throw error;
    }
  }

  /**
   * Get recommendations for prompt improvement
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Array>} Recommendations
   */
  async getPromptRecommendations(userId = null) {
    try {
      const client = await db.getClient();
      try {
        // Get top performing VLT attributes
        const result = await client.query(`
          SELECT *
          FROM outlier_rate_by_attribute
          WHERE total_occurrences >= 10
          ORDER BY outlier_rate DESC
          LIMIT 10
        `);

        const recommendations = result.rows.map(row => ({
          type: 'high_success_attribute',
          attribute: row.attribute_name,
          value: row.attribute_value,
          outlierRate: parseFloat(row.outlier_rate),
          avgClipScore: row.avg_clip_score ? parseFloat(row.avg_clip_score) : null,
          recommendation: `Consider using ${row.attribute_name}: ${row.attribute_value} (${row.outlier_rate}% success rate)`
        }));

        return recommendations;

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get recommendations', { error: error.message });
      throw error;
    }
  }
}

module.exports = new RLHFLearningService();
