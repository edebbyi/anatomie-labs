const logger = require('../utils/logger');
const db = require('./database');

/**
 * Stage 10: User Feedback Service
 * Captures user feedback, calculates CLIP scores, and implements reward modeling
 */
class UserFeedbackService {
  constructor() {
    // CLIP scoring configuration (placeholder - integrate actual CLIP model)
    this.clipEnabled = process.env.CLIP_SCORING_ENABLED === 'true';
    this.clipModel = null; // Would be initialized with actual CLIP model
    
    // Outlier threshold
    this.outlierThreshold = {
      clipScore: 0.75,
      userRating: 4
    };
  }

  /**
   * Submit user feedback for a generated image
   * @param {Object} params - Feedback parameters
   * @returns {Promise<Object>} Feedback record
   */
  async submitFeedback(params) {
    const {
      userId,
      generationId,
      assetId,
      feedbackType,
      userRating,
      comment,
      tags,
      sessionId,
      feedbackSource = 'web'
    } = params;

    try {
      logger.info('Submitting user feedback', {
        userId,
        generationId,
        assetId,
        feedbackType
      });

      // Get VLT attributes and generation details
      const assetDetails = await this.getAssetDetails(assetId, generationId);
      
      // Calculate CLIP score if image available
      let clipScore = null;
      if (this.clipEnabled && assetDetails.imageUrl) {
        clipScore = await this.calculateCLIPScore(
          assetDetails.imageUrl,
          assetDetails.prompt
        );
      }

      // Determine if this is an outlier
      const isOutlier = this.isOutlierGeneration(feedbackType, userRating, clipScore);

      // Store feedback
      const client = await db.getClient();
      try {
        const result = await client.query(`
          INSERT INTO user_feedback (
            user_id,
            generation_id,
            asset_id,
            feedback_type,
            user_rating,
            clip_score,
            is_outlier,
            comment,
            tags,
            vlt_attributes,
            feedback_source,
            session_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          RETURNING *
        `, [
          userId,
          generationId,
          assetId,
          feedbackType,
          userRating,
          clipScore,
          isOutlier,
          comment,
          tags,
          JSON.stringify(assetDetails.vltAttributes),
          feedbackSource,
          sessionId
        ]);

        const feedback = result.rows[0];

        logger.info('Feedback submitted successfully', {
          feedbackId: feedback.id,
          isOutlier,
          clipScore
        });

        // If outlier, trigger learning updates
        if (isOutlier) {
          await this.processOutlier(feedback, assetDetails);
        }

        return {
          success: true,
          feedback,
          isOutlier,
          clipScore
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to submit feedback', {
        userId,
        assetId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get asset details including VLT attributes
   * @param {string} assetId - Asset ID
   * @param {string} generationId - Generation ID
   * @returns {Promise<Object>} Asset details
   */
  async getAssetDetails(assetId, generationId) {
    try {
      const client = await db.getClient();
      try {
        const result = await client.query(`
          SELECT 
            ga.id,
            ga.image_url,
            ga.prompt,
            ga.negative_prompt,
            ga.provider_id,
            mp.name as provider_name,
            g.vlt_spec,
            vr.vlt_specs,
            vr.overall_score as validation_score
          FROM generation_assets ga
          JOIN generations g ON ga.generation_id = g.id
          LEFT JOIN model_providers mp ON ga.provider_id = mp.id
          LEFT JOIN validation_results vr ON ga.id = vr.asset_id
          WHERE ga.id = $1 AND g.id = $2
        `, [assetId, generationId]);

        if (result.rows.length === 0) {
          throw new Error('Asset not found');
        }

        const row = result.rows[0];
        
        return {
          assetId: row.id,
          imageUrl: row.image_url,
          prompt: row.prompt,
          negativePrompt: row.negative_prompt,
          provider: row.provider_name,
          vltAttributes: row.vlt_specs || row.vlt_spec,
          validationScore: row.validation_score
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get asset details', { assetId, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate CLIP score for image-text alignment
   * @param {string} imageUrl - Image URL
   * @param {string} text - Text prompt
   * @returns {Promise<number>} CLIP score (0-1)
   */
  async calculateCLIPScore(imageUrl, text) {
    try {
      // Placeholder for actual CLIP implementation
      // In production, this would call a CLIP model service
      
      if (!this.clipEnabled) {
        return null;
      }

      // TODO: Integrate actual CLIP model
      // Example:
      // const clipService = require('./clipService');
      // const score = await clipService.calculateSimilarity(imageUrl, text);
      // return score;

      // For now, return a mock score based on simple heuristics
      logger.warn('CLIP scoring not fully implemented, returning mock score');
      return this.mockCLIPScore();

    } catch (error) {
      logger.error('CLIP scoring failed', { error: error.message });
      return null;
    }
  }

  /**
   * Mock CLIP score (placeholder)
   * @returns {number} Mock score
   */
  mockCLIPScore() {
    // Return random score between 0.6 and 0.95 for testing
    return 0.6 + Math.random() * 0.35;
  }

  /**
   * Determine if feedback qualifies as outlier (successful generation)
   * @param {string} feedbackType - Type of feedback
   * @param {number} userRating - User rating (1-5)
   * @param {number} clipScore - CLIP score
   * @returns {boolean} Is outlier
   */
  isOutlierGeneration(feedbackType, userRating, clipScore) {
    // Explicit outlier/favorite marking
    if (feedbackType === 'outlier' || feedbackType === 'favorite') {
      return true;
    }

    // High user rating
    if (userRating && userRating >= this.outlierThreshold.userRating) {
      return true;
    }

    // High CLIP score
    if (clipScore && clipScore >= this.outlierThreshold.clipScore) {
      return true;
    }

    return false;
  }

  /**
   * Process outlier and trigger learning updates
   * @param {Object} feedback - Feedback record
   * @param {Object} assetDetails - Asset details
   */
  async processOutlier(feedback, assetDetails) {
    try {
      logger.info('Processing outlier for learning', {
        feedbackId: feedback.id,
        assetId: feedback.asset_id
      });

      // This will be handled by triggers, but we can add additional processing here
      // For example, triggering immediate RLHF updates or style profile updates

      // Log the learning opportunity
      logger.info('Outlier identified for continuous learning', {
        userId: feedback.user_id,
        vltAttributes: Object.keys(assetDetails.vltAttributes || {}),
        provider: assetDetails.provider,
        clipScore: feedback.clip_score,
        userRating: feedback.user_rating
      });

    } catch (error) {
      logger.error('Failed to process outlier', {
        feedbackId: feedback.id,
        error: error.message
      });
      // Non-critical, don't throw
    }
  }

  /**
   * Get outlier rate by VLT attribute
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Outlier rates
   */
  async getOutlierRateByAttribute(options = {}) {
    const { attribute, minSampleSize = 5 } = options;

    try {
      const client = await db.getClient();
      try {
        let query = `
          SELECT *
          FROM outlier_rate_by_attribute
          WHERE total_occurrences >= $1
        `;
        const params = [minSampleSize];

        if (attribute) {
          query += ' AND attribute_name = $2';
          params.push(attribute);
        }

        query += ' ORDER BY outlier_rate DESC LIMIT 50';

        const result = await client.query(query, params);

        return result.rows.map(row => ({
          attribute: row.attribute_name,
          value: row.attribute_value,
          totalOccurrences: parseInt(row.total_occurrences),
          outlierCount: parseInt(row.outlier_count),
          outlierRate: parseFloat(row.outlier_rate),
          avgClipScore: row.avg_clip_score ? parseFloat(row.avg_clip_score) : null,
          avgUserRating: row.avg_user_rating ? parseFloat(row.avg_user_rating) : null,
          lastSeen: row.last_seen_at
        }));

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get outlier rates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get top performing style profiles
   * @returns {Promise<Array>} Top profiles
   */
  async getTopStyleProfiles() {
    try {
      const client = await db.getClient();
      try {
        const result = await client.query(`
          SELECT *
          FROM top_style_profiles
          LIMIT 20
        `);

        return result.rows.map(row => ({
          styleProfile: row.style_profile,
          userCount: parseInt(row.user_count),
          totalGenerations: parseInt(row.total_generations),
          totalOutliers: parseInt(row.total_outliers),
          outlierRate: parseFloat(row.avg_outlier_rate),
          avgClipScore: row.avg_clip_score ? parseFloat(row.avg_clip_score) : null
        }));

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get top style profiles', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's feedback history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Feedback history
   */
  async getUserFeedbackHistory(userId, options = {}) {
    const { limit = 50, feedbackType } = options;

    try {
      const client = await db.getClient();
      try {
        let query = `
          SELECT 
            uf.*,
            ga.image_url,
            ga.prompt,
            g.created_at as generation_created_at
          FROM user_feedback uf
          JOIN generation_assets ga ON uf.asset_id = ga.id
          JOIN generations g ON uf.generation_id = g.id
          WHERE uf.user_id = $1
        `;
        const params = [userId];

        if (feedbackType) {
          params.push(feedbackType);
          query += ` AND uf.feedback_type = $${params.length}`;
        }

        query += ' ORDER BY uf.created_at DESC LIMIT $' + (params.length + 1);
        params.push(limit);

        const result = await client.query(query, params);

        // Get summary stats
        const statsResult = await client.query(`
          SELECT 
            COUNT(*) as total_feedback,
            SUM(CASE WHEN is_outlier THEN 1 ELSE 0 END) as total_outliers,
            AVG(user_rating) as avg_rating,
            AVG(clip_score) as avg_clip_score
          FROM user_feedback
          WHERE user_id = $1
        `, [userId]);

        const stats = statsResult.rows[0];

        return {
          feedback: result.rows,
          stats: {
            totalFeedback: parseInt(stats.total_feedback),
            totalOutliers: parseInt(stats.total_outliers),
            avgRating: stats.avg_rating ? parseFloat(stats.avg_rating) : null,
            avgClipScore: stats.avg_clip_score ? parseFloat(stats.avg_clip_score) : null,
            outlierRate: stats.total_feedback > 0 
              ? ((stats.total_outliers / stats.total_feedback) * 100).toFixed(1)
              : 0
          }
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get user feedback history', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent feedback summary
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Feedback summary
   */
  async getRecentFeedbackSummary(days = 30) {
    try {
      const client = await db.getClient();
      try {
        const result = await client.query(`
          SELECT *
          FROM recent_feedback_summary
          WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
          ORDER BY date DESC, feedback_type
        `);

        return result.rows.map(row => ({
          date: row.date,
          feedbackType: row.feedback_type,
          count: parseInt(row.count),
          avgClipScore: row.avg_clip_score ? parseFloat(row.avg_clip_score) : null,
          avgRating: row.avg_rating ? parseFloat(row.avg_rating) : null,
          outlierCount: parseInt(row.outlier_count)
        }));

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get feedback summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Get outliers for training data
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Outliers ready for training
   */
  async getOutliersForTraining(options = {}) {
    const { limit = 100, notUsedForTraining = true } = options;

    try {
      const client = await db.getClient();
      try {
        let query = `
          SELECT 
            o.*,
            ga.image_url,
            ga.prompt,
            ga.negative_prompt
          FROM outliers o
          JOIN generation_assets ga ON o.asset_id = ga.id
        `;

        if (notUsedForTraining) {
          query += ' WHERE o.used_for_training = FALSE';
        }

        query += ' ORDER BY o.created_at DESC LIMIT $1';

        const result = await client.query(query, [limit]);

        return result.rows;

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get outliers for training', { error: error.message });
      throw error;
    }
  }

  /**
   * Mark outliers as used for training
   * @param {Array<string>} outlierIds - Outlier IDs
   */
  async markOutliersAsUsedForTraining(outlierIds) {
    try {
      const client = await db.getClient();
      try {
        await client.query(`
          UPDATE outliers
          SET 
            used_for_training = TRUE,
            training_added_at = NOW()
          WHERE id = ANY($1::uuid[])
        `, [outlierIds]);

        logger.info('Marked outliers as used for training', {
          count: outlierIds.length
        });

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to mark outliers as used', { error: error.message });
      throw error;
    }
  }

  /**
   * Update outlier threshold settings
   * @param {Object} thresholds - New thresholds
   */
  updateOutlierThresholds(thresholds) {
    this.outlierThreshold = {
      ...this.outlierThreshold,
      ...thresholds
    };
    
    logger.info('Updated outlier thresholds', {
      thresholds: this.outlierThreshold
    });
  }
}

module.exports = new UserFeedbackService();
