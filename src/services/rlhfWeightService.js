/**
 * RLHF Weight Management Service
 * 
 * Learns user preferences through feedback and adjusts prompt token weights
 * Implements online learning with exploration/exploitation balance
 */

const db = require('./database');
const logger = require('../utils/logger');

class RLHFWeightService {
  constructor() {
    // Default weights for different token categories
    this.defaultWeights = {
      lighting: {
        'cinematic lighting': 1.0,
        'soft box lighting': 1.0,
        'natural window light': 1.0,
        'dramatic side lighting': 1.0,
        'golden hour lighting': 1.0,
        'studio lighting': 1.0,
        'rim lighting': 1.0,
        'backlighting': 1.0
      },
      composition: {
        'full body shot': 1.0,
        '3/4 body': 1.0,
        'upper body': 1.0,
        'detail shot': 1.0,
        'flat lay': 1.0,
        'overhead shot': 1.0,
        'low angle': 1.0,
        'eye level': 1.0
      },
      style: {
        'minimalist': 1.0,
        'elegant': 1.0,
        'romantic': 1.0,
        'edgy': 1.0,
        'casual': 1.0,
        'formal': 1.0,
        'bohemian': 1.0,
        'streetwear': 1.0,
        'avant-garde': 1.0
      },
      quality: {
        'professional photography': 1.0,
        'high resolution': 1.0,
        '8k': 1.0,
        '4k': 1.0,
        'sharp focus': 1.0,
        'detailed textures': 1.0,
        'studio quality': 1.0
      },
      mood: {
        'sophisticated': 1.0,
        'playful': 1.0,
        'dramatic': 1.0,
        'serene': 1.0,
        'bold': 1.0,
        'subtle': 1.0,
        'luxurious': 1.0
      },
      modelPose: {
        'standing pose': 1.0,
        'seated pose': 1.0,
        'walking pose': 1.0,
        'dynamic pose': 1.0,
        'relaxed pose': 1.0,
        'confident pose': 1.0
      }
    };

    // Learning rate for weight updates
    this.learningRate = 0.1;
    
    // Exploration rate (epsilon-greedy)
    this.explorationRate = 0.15; // 15% random exploration
    
    logger.info('RLHF Weight Service initialized');
  }

  /**
   * Get weights for a user (or global if no user-specific data)
   * @param {string} userId - User UUID
   * @param {string} category - Token category (lighting, style, etc.)
   * @returns {Promise<Object>} Token weights
   */
  async getWeights(userId, category = null) {
    try {
      let query = `
        SELECT category, token, weight, usage_count, positive_feedback, negative_feedback
        FROM rlhf_token_weights
        WHERE user_id = $1
      `;
      
      const params = [userId];
      
      if (category) {
        query += ` AND category = $2`;
        params.push(category);
      }
      
      const result = await db.query(query, params);
      
      if (result.rows.length === 0) {
        // Return default weights if no user-specific data
        return category ? this.defaultWeights[category] : this.defaultWeights;
      }
      
      // Organize by category
      const weights = {};
      result.rows.forEach(row => {
        if (!weights[row.category]) {
          weights[row.category] = {};
        }
        weights[row.category][row.token] = parseFloat(row.weight);
      });
      
      return category ? weights[category] : weights;
      
    } catch (error) {
      logger.error('Failed to get RLHF weights', { userId, category, error: error.message });
      return category ? this.defaultWeights[category] : this.defaultWeights;
    }
  }

  /**
   * Select best tokens using learned weights with epsilon-greedy exploration
   * @param {string} userId - User UUID
   * @param {string} category - Token category
   * @param {number} count - Number of tokens to select
   * @returns {Promise<Array>} Selected tokens
   */
  async selectTokens(userId, category, count = 3) {
    try {
      const weights = await this.getWeights(userId, category);
      
      if (!weights || Object.keys(weights).length === 0) {
        // Fallback to random selection from defaults
        const defaultTokens = Object.keys(this.defaultWeights[category] || {});
        return this._randomSelect(defaultTokens, count);
      }
      
      // Epsilon-greedy: explore vs exploit
      if (Math.random() < this.explorationRate) {
        // Exploration: random selection
        const tokens = Object.keys(weights);
        return this._randomSelect(tokens, count);
      } else {
        // Exploitation: select highest weighted tokens
        const sortedTokens = Object.entries(weights)
          .sort(([, a], [, b]) => b - a)
          .map(([token]) => token);
        
        return sortedTokens.slice(0, count);
      }
      
    } catch (error) {
      logger.error('Token selection failed', { userId, category, error: error.message });
      const defaultTokens = Object.keys(this.defaultWeights[category] || {});
      return this._randomSelect(defaultTokens, count);
    }
  }

  /**
   * Process user feedback and update token weights
   * @param {Object} feedback - Feedback data
   */
  async processFeedback(feedback) {
    const {
      userId,
      imageId,
      generationId,
      feedbackType, // 'save', 'share', 'generate_similar', 'like', 'dislike', 'delete'
      tokensUsed, // { lighting: ['cinematic lighting'], style: ['elegant'], ... }
      timeViewed // milliseconds
    } = feedback;

    try {
      // Compute reward signal based on feedback type
      const reward = this._computeReward(feedbackType, timeViewed);
      
      logger.info('Processing RLHF feedback', {
        userId,
        imageId,
        feedbackType,
        reward
      });

      // Update weights for all tokens used in the generation
      for (const [category, tokens] of Object.entries(tokensUsed)) {
        for (const token of tokens) {
          await this._updateTokenWeight(userId, category, token, reward);
        }
      }

      // Log feedback for batch learning
      await this._logFeedback(feedback, reward);
      
    } catch (error) {
      logger.error('Failed to process RLHF feedback', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Compute reward signal from feedback type
   * @private
   */
  _computeReward(feedbackType, timeViewed = 0) {
    const rewardMap = {
      'save': 1.0,           // Strong positive signal
      'share': 1.2,          // Very strong positive signal
      'generate_similar': 1.5, // Strongest positive signal
      'like': 0.8,           // Moderate positive signal
      'remix': 0.7,          // Moderate positive (wants to modify)
      'dislike': -0.5,       // Negative signal
      'delete': -1.0,        // Strong negative signal
      'irrelevant': -0.8     // Strong negative signal
    };

    let baseReward = rewardMap[feedbackType] || 0;

    // Bonus for time spent viewing (engagement signal)
    if (timeViewed > 5000) { // More than 5 seconds
      baseReward *= 1.2;
    }

    return baseReward;
  }

  /**
   * Update weight for a specific token using online learning
   * @private
   */
  async _updateTokenWeight(userId, category, token, reward) {
    try {
      const client = await db.getClient();
      
      try {
        // Check if record exists
        const existing = await client.query(
          `SELECT weight, usage_count, positive_feedback, negative_feedback
           FROM rlhf_token_weights
           WHERE user_id = $1 AND category = $2 AND token = $3`,
          [userId, category, token]
        );

        if (existing.rows.length > 0) {
          // Update existing weight using exponential moving average
          const currentWeight = parseFloat(existing.rows[0].weight);
          const newWeight = currentWeight + this.learningRate * (reward - currentWeight);
          
          // Clamp weight between 0 and 2
          const clampedWeight = Math.max(0, Math.min(2, newWeight));
          
          await client.query(
            `UPDATE rlhf_token_weights
             SET weight = $1,
                 usage_count = usage_count + 1,
                 positive_feedback = positive_feedback + $2,
                 negative_feedback = negative_feedback + $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $4 AND category = $5 AND token = $6`,
            [
              clampedWeight,
              reward > 0 ? 1 : 0,
              reward < 0 ? 1 : 0,
              userId,
              category,
              token
            ]
          );
        } else {
          // Insert new record with initial weight influenced by reward
          const initialWeight = 1.0 + (this.learningRate * reward);
          const clampedWeight = Math.max(0, Math.min(2, initialWeight));
          
          await client.query(
            `INSERT INTO rlhf_token_weights (
               user_id, category, token, weight, usage_count,
               positive_feedback, negative_feedback, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, 1, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              userId,
              category,
              token,
              clampedWeight,
              reward > 0 ? 1 : 0,
              reward < 0 ? 1 : 0
            ]
          );
        }
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to update token weight', {
        userId,
        category,
        token,
        error: error.message
      });
    }
  }

  /**
   * Log feedback for batch RLHF training
   * @private
   */
  async _logFeedback(feedback, reward) {
    try {
      await db.query(
        `INSERT INTO rlhf_feedback_log (
           user_id, image_id, generation_id, feedback_type,
           tokens_used, reward, time_viewed, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          feedback.userId,
          feedback.imageId,
          feedback.generationId,
          feedback.feedbackType,
          JSON.stringify(feedback.tokensUsed),
          reward,
          feedback.timeViewed || 0
        ]
      );
    } catch (error) {
      logger.error('Failed to log RLHF feedback', { error: error.message });
    }
  }

  /**
   * Get top performing tokens for a category
   * @param {string} userId - User UUID
   * @param {string} category - Token category
   * @param {number} limit - Number of top tokens to return
   * @returns {Promise<Array>} Top tokens with their weights
   */
  async getTopTokens(userId, category, limit = 10) {
    try {
      const result = await db.query(
        `SELECT token, weight, usage_count, positive_feedback, negative_feedback
         FROM rlhf_token_weights
         WHERE user_id = $1 AND category = $2
         ORDER BY weight DESC, positive_feedback DESC
         LIMIT $3`,
        [userId, category, limit]
      );

      return result.rows.map(row => ({
        token: row.token,
        weight: parseFloat(row.weight),
        usageCount: parseInt(row.usage_count),
        positiveFeedback: parseInt(row.positive_feedback),
        negativeFeedback: parseInt(row.negative_feedback),
        score: this._calculateScore(row)
      }));
      
    } catch (error) {
      logger.error('Failed to get top tokens', { userId, category, error: error.message });
      return [];
    }
  }

  /**
   * Calculate overall score for a token
   * @private
   */
  _calculateScore(tokenData) {
    const weight = parseFloat(tokenData.weight);
    const positive = parseInt(tokenData.positive_feedback) || 0;
    const negative = parseInt(tokenData.negative_feedback) || 0;
    const usage = parseInt(tokenData.usage_count) || 1;
    
    // Weighted score considering feedback ratio and usage
    const feedbackRatio = positive / (positive + negative + 1); // +1 to avoid division by zero
    const usageBonus = Math.log(usage + 1) / 10; // Logarithmic bonus for usage
    
    return weight * feedbackRatio + usageBonus;
  }

  /**
   * Random selection helper
   * @private
   */
  _randomSelect(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, array.length));
  }

  /**
   * Get user's learning statistics
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Learning stats
   */
  async getLearningStats(userId) {
    try {
      const result = await db.query(
        `SELECT 
           COUNT(*) as total_tokens,
           AVG(weight) as avg_weight,
           SUM(usage_count) as total_usage,
           SUM(positive_feedback) as total_positive,
           SUM(negative_feedback) as total_negative
         FROM rlhf_token_weights
         WHERE user_id = $1`,
        [userId]
      );

      const row = result.rows[0];
      
      return {
        totalTokens: parseInt(row.total_tokens) || 0,
        averageWeight: parseFloat(row.avg_weight) || 1.0,
        totalUsage: parseInt(row.total_usage) || 0,
        totalPositive: parseInt(row.total_positive) || 0,
        totalNegative: parseInt(row.total_negative) || 0,
        feedbackRatio: row.total_positive / (parseInt(row.total_positive) + parseInt(row.total_negative) + 1)
      };
      
    } catch (error) {
      logger.error('Failed to get learning stats', { userId, error: error.message });
      return null;
    }
  }
}

module.exports = new RLHFWeightService();
