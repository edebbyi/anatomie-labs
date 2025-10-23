/**
 * Continuous Learning Agent
 * 
 * Monitors ALL user interactions (not just explicit feedback):
 * - View duration (implicit signal of interest)
 * - Scroll patterns
 * - Generation request frequency
 * - Interaction timing
 * 
 * Continuously updates style profiles and tag metadata based on implicit + explicit signals.
 */

const db = require('./database');
const logger = require('../utils/logger');

class ContinuousLearningAgent {
  constructor() {
    // Learning rates for different signal types
    this.LEARNING_RATES = {
      explicit_like: 0.15,      // Strong positive signal
      explicit_dislike: -0.08,  // Moderate negative signal
      long_view: 0.05,          // Implicit positive (>5s view)
      quick_skip: -0.02,        // Implicit negative (<1s view)
      regenerate: -0.03,        // Mild negative (wanted different)
      save_to_board: 0.20,      // Very strong positive
      share: 0.12               // Strong positive
    };

    // Confidence decay factor (reduce weight of old data over time)
    this.TEMPORAL_DECAY = 0.95; // 5% decay per week
  }

  /**
   * Track implicit interaction signal
   * @param {string} userId - User ID
   * @param {string} generationId - Generation ID
   * @param {Object} interactionData - Interaction metadata
   */
  async trackInteraction(userId, generationId, interactionData) {
    const {
      event_type,        // 'view', 'scroll', 'regenerate', 'save', 'share'
      duration_ms,       // Time spent viewing
      scroll_depth,      // How much they scrolled (0-1)
      timestamp
    } = interactionData;

    logger.info('Continuous Learning: Tracking interaction', {
      userId, 
      generationId, 
      event_type,
      duration_ms
    });

    try {
      // 1. Store the interaction event
      await this.storeInteractionEvent(userId, generationId, interactionData);

      // 2. Calculate signal strength
      const signalStrength = this.calculateSignalStrength(interactionData);
      
      // 3. Update style tag metadata
      await this.updateStyleTagMetadata(userId, generationId, signalStrength);
      
      // 4. Update Thompson Sampling parameters
      await this.updateThompsonSamplingParams(userId, generationId, signalStrength, interactionData);
      
      // 5. Update user's overall style profile
      await this.updateUserProfile(userId, generationId, signalStrength);

      logger.info('Continuous Learning: Interaction processed', {
        userId,
        generationId,
        event_type,
        signalStrength
      });

    } catch (error) {
      logger.error('Continuous Learning: Failed to process interaction', {
        userId,
        generationId,
        event_type,
        error: error.message
      });
      // Don't throw - interaction tracking shouldn't break the main flow
    }
  }

  /**
   * Calculate signal strength from interaction data
   */
  calculateSignalStrength(interactionData) {
    const { event_type, duration_ms, scroll_depth } = interactionData;
    
    // Base signal from event type
    let signalStrength = this.LEARNING_RATES[event_type] || 0;
    
    // Adjust based on duration for view events
    if (event_type === 'view' && duration_ms) {
      if (duration_ms > 5000) { // Long view (>5s)
        signalStrength += this.LEARNING_RATES.long_view;
      } else if (duration_ms < 1000) { // Quick skip (<1s)
        signalStrength += this.LEARNING_RATES.quick_skip;
      }
    }
    
    // Adjust based on scroll depth
    if (scroll_depth && scroll_depth > 0.8) {
      // Deep scroll indicates strong interest
      signalStrength += 0.03;
    }
    
    return signalStrength;
  }

  /**
   * Store interaction event in database
   */
  async storeInteractionEvent(userId, generationId, interactionData) {
    const {
      event_type,
      duration_ms,
      scroll_depth,
      ...metadata
    } = interactionData;

    const query = `
      INSERT INTO interaction_events (
        user_id, generation_id, event_type, duration_ms, 
        scroll_depth, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;

    await db.query(query, [
      userId,
      generationId,
      event_type,
      duration_ms || null,
      scroll_depth || null,
      JSON.stringify(metadata)
    ]);
  }

  /**
   * Update style tag metadata based on signal
   */
  async updateStyleTagMetadata(userId, generationId, signalStrength) {
    try {
      // Get the generation's style tags
      const styleTags = await this.getStyleTagsForGeneration(generationId);
      
      for (const tag of styleTags) {
        // Update tag metadata
        await this.updateStyleTagConfidence(userId, tag, signalStrength);
        
        // Update signature attributes based on successful generations
        if (signalStrength > 0.1) {
          await this.updateSignatureAttributes(userId, tag, generationId, signalStrength);
        }
      }
    } catch (error) {
      logger.warn('Failed to update style tag metadata', {
        userId,
        generationId,
        error: error.message
      });
    }
  }

  /**
   * Get style tags for a generation
   */
  async getStyleTagsForGeneration(generationId) {
    try {
      const result = await db.query(`
        SELECT DISTINCT unnest(sp.style_labels) as style_tag
        FROM style_profiles sp
        JOIN portfolios p ON sp.portfolio_id = p.id
        JOIN portfolio_images pi ON p.id = pi.portfolio_id
        JOIN generations g ON pi.id = g.image_id
        WHERE g.id = $1
      `, [generationId]);
      
      return result.rows.map(row => row.style_tag);
    } catch (error) {
      logger.warn('Failed to get style tags for generation', {
        generationId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Update style tag confidence
   */
  async updateStyleTagConfidence(userId, styleTag, signalStrength) {
    const query = `
      INSERT INTO style_tag_metadata (
        user_id, style_tag, interaction_count, positive_interactions, 
        negative_interactions, confidence_score, created_at, updated_at
      )
      VALUES ($1, $2, 1, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, style_tag) DO UPDATE SET
        interaction_count = style_tag_metadata.interaction_count + 1,
        positive_interactions = style_tag_metadata.positive_interactions + $3,
        negative_interactions = style_tag_metadata.negative_interactions + $4,
        confidence_score = GREATEST(0.1, LEAST(0.99, 
          style_tag_metadata.confidence_score + $5 * (1.0 - ABS(style_tag_metadata.confidence_score - 0.5))
        )),
        updated_at = CURRENT_TIMESTAMP
    `;

    const positiveSignal = Math.max(0, signalStrength);
    const negativeSignal = Math.max(0, -signalStrength);

    await db.query(query, [
      userId,
      styleTag,
      positiveSignal > 0 ? 1 : 0,
      negativeSignal > 0 ? 1 : 0,
      signalStrength * 0.1 // Scale down the direct impact
    ]);
  }

  /**
   * Update signature attributes for a style tag
   */
  async updateSignatureAttributes(userId, styleTag, generationId, signalStrength) {
    try {
      // Get generation attributes
      const attributes = await this.getGenerationAttributes(generationId);
      
      if (attributes) {
        // Update signature attributes in style_tag_metadata
        const updateQuery = `
          INSERT INTO style_tag_metadata (
            user_id, style_tag, signature_attributes, created_at, updated_at
          )
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, style_tag) DO UPDATE SET
            signature_attributes = style_tag_metadata.signature_attributes || $3,
            updated_at = CURRENT_TIMESTAMP
        `;
        
        await db.query(updateQuery, [
          userId,
          styleTag,
          JSON.stringify(attributes)
        ]);
      }
    } catch (error) {
      logger.warn('Failed to update signature attributes', {
        userId,
        styleTag,
        error: error.message
      });
    }
  }

  /**
   * Get generation attributes
   */
  async getGenerationAttributes(generationId) {
    try {
      const result = await db.query(`
        SELECT 
          id.descriptor_data->>'garment_type' as garment_type,
          id.descriptor_data->>'color_palette' as color_palette,
          id.descriptor_data->>'fabric' as fabric,
          id.descriptor_data->>'silhouette' as silhouette
        FROM generations g
        JOIN portfolio_images pi ON g.image_id = pi.id
        JOIN image_descriptors id ON pi.id = id.image_id
        WHERE g.id = $1
      `, [generationId]);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          garment_types: row.garment_type ? {[row.garment_type]: 0.8} : {},
          colors: row.color_palette ? JSON.parse(row.color_palette) : [],
          fabrics: row.fabric ? {[row.fabric]: 0.7} : {},
          silhouettes: row.silhouette ? {[row.silhouette]: 0.6} : {}
        };
      }
      
      return null;
    } catch (error) {
      logger.warn('Failed to get generation attributes', {
        generationId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Update Thompson Sampling parameters
   */
  async updateThompsonSamplingParams(userId, generationId, signalStrength, interactionData) {
    try {
      // Get generation attributes to update Thompson parameters
      const attributes = await this.getGenerationAttributes(generationId);
      
      if (attributes) {
        // Update garment parameters
        if (attributes.garment_types) {
          for (const [garment, weight] of Object.entries(attributes.garment_types)) {
            await this.updateThompsonParam(userId, 'garments', garment, signalStrength);
          }
        }
        
        // Update fabric parameters
        if (attributes.fabrics) {
          for (const [fabric, weight] of Object.entries(attributes.fabrics)) {
            await this.updateThompsonParam(userId, 'fabrics', fabric, signalStrength);
          }
        }
        
        // Update color parameters (simplified)
        if (attributes.colors && Array.isArray(attributes.colors)) {
          for (const color of attributes.colors.slice(0, 2)) {
            await this.updateThompsonParam(userId, 'colors', color, signalStrength);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to update Thompson Sampling parameters', {
        userId,
        generationId,
        error: error.message
      });
    }
  }

  /**
   * Update a single Thompson Sampling parameter
   */
  async updateThompsonParam(userId, category, attribute, signalStrength) {
    const query = `
      INSERT INTO thompson_sampling_params (
        user_id, category, attribute, alpha, beta, total_samples, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, category, attribute) DO UPDATE SET
        alpha = thompson_sampling_params.alpha + $6,
        beta = thompson_sampling_params.beta + $7,
        total_samples = thompson_sampling_params.total_samples + 1,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Convert signal strength to alpha/beta updates
    const successIncrement = signalStrength > 0 ? Math.round(signalStrength * 10) : 0;
    const failureIncrement = signalStrength < 0 ? Math.round(Math.abs(signalStrength) * 10) : 0;

    await db.query(query, [
      userId,
      category,
      attribute,
      2 + successIncrement,  // alpha (prior + successes)
      2 + failureIncrement,  // beta (prior + failures)
      successIncrement,
      failureIncrement
    ]);
  }

  /**
   * Update user's overall style profile
   */
  async updateUserProfile(userId, generationId, signalStrength) {
    try {
      // This would update the user's overall style profile based on the signal
      // For now, we'll just log that this would happen
      logger.debug('Would update user profile based on signal', {
        userId,
        generationId,
        signalStrength
      });
    } catch (error) {
      logger.warn('Failed to update user profile', {
        userId,
        error: error.message
      });
    }
  }

  /**
   * Get user's learning statistics
   */
  async getUserLearningStats(userId) {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_interactions,
          COUNT(CASE WHEN event_type = 'view' AND duration_ms > 5000 THEN 1 END) as long_views,
          COUNT(CASE WHEN event_type = 'save' THEN 1 END) as saves,
          COUNT(CASE WHEN event_type = 'share' THEN 1 END) as shares,
          AVG(duration_ms) as avg_view_duration
        FROM interaction_events
        WHERE user_id = $1
      `, [userId]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get user learning stats', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get top performing style tags for a user
   */
  async getTopStyleTags(userId, limit = 10) {
    try {
      const result = await db.query(`
        SELECT 
          style_tag,
          confidence_score,
          interaction_count,
          signature_attributes
        FROM style_tag_metadata
        WHERE user_id = $1
        ORDER BY confidence_score DESC
        LIMIT $2
      `, [userId, limit]);
      
      return result.rows;
    } catch (error) {
      logger.error('Failed to get top style tags', {
        userId,
        error: error.message
      });
      return [];
    }
  }
}

module.exports = new ContinuousLearningAgent();