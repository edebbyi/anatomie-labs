/**
 * Feedback Learner Agent
 * 
 * Consumes Like/Dislike/Swipe feedback and critique text.
 * Updates prompt weights and style propensity model.
 * Implements lightweight bandit updates for MVP.
 */

const db = require('./database');
const logger = require('../utils/logger');
const Replicate = require('replicate');

class FeedbackLearnerAgent {
  /**
   * Process user feedback
   * @param {string} userId - User ID
   * @param {string} generationId - Generation ID
   * @param {Object} feedbackData - Feedback data
   * @returns {Promise<Object>} Feedback record and learning event
   */
  async processFeedback(userId, generationId, feedbackData) {
    const { type, note } = feedbackData;

    logger.info('Feedback Learner Agent: Processing feedback', { 
      userId, 
      generationId, 
      type 
    });

    // Validate feedback type
    const validTypes = ['like', 'dislike', 'swipe_left', 'swipe_right'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid feedback type: ${type}`);
    }

    // Parse critique if provided
    let parsedCritique = null;
    if (note && note.trim().length > 0) {
      parsedCritique = await this.parseCritique(note);
    }

    // Save feedback
    const feedback = await this.saveFeedback(userId, generationId, {
      type,
      note,
      parsed_critique: parsedCritique
    });

    // Update prompt history
    await this.updatePromptHistory(generationId, type);

    // Update prompt scores
    await this.updatePromptScores(generationId, type);

    // Generate learning delta
    const delta = await this.generateLearningDelta(
      userId,
      generationId,
      type,
      parsedCritique
    );

    // Save learning event
    const learningEvent = await this.saveLearningEvent(userId, generationId, feedback.id, delta);

    // Apply delta to user style profile
    if (delta && Object.keys(delta).length > 0) {
      await this.applyDeltaToProfile(userId, delta);
    }

    logger.info('Feedback Learner Agent: Feedback processed', { 
      feedbackId: feedback.id,
      learningEventId: learningEvent.id
    });

    return {
      feedback,
      learningEvent,
      delta
    };
  }

  /**
   * Parse critique text using Gemini via Replicate
   */
  async parseCritique(critiqueText) {
    if (!process.env.REPLICATE_API_TOKEN) {
      logger.warn('Replicate API token not configured, skipping critique parsing');
      return null;
    }

    try {
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
      });

      const prompt = `Parse this user critique of a fashion image and extract structured attributes:

Critique: "${critiqueText}"

Return JSON with these fields (set to null if not mentioned):
{
  "color": "requested color change",
  "garment_type": "requested garment type",
  "sleeve_length": "requested sleeve length",
  "fabric": "requested fabric",
  "silhouette": "requested silhouette",
  "general_feedback": "any other feedback"
}

Return ONLY valid JSON.`;

      const output = await replicate.run(
        'openai/gpt-5',
        {
          input: {
            prompt: prompt,
            reasoning_effort: 'minimal',
            verbosity: 'low'
          }
        }
      );

      const responseText = Array.isArray(output) ? output.join('') : output;

      // Extract JSON
      let jsonText = responseText;
      if (responseText.includes('```json')) {
        jsonText = responseText.split('```json')[1].split('```')[0].trim();
      } else if (responseText.includes('```')) {
        jsonText = responseText.split('```')[1].split('```')[0].trim();
      }

      const parsed = JSON.parse(jsonText);
      
      // Filter out null values
      const filtered = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== null && value !== '') {
          filtered[key] = value;
        }
      }

      return filtered;

    } catch (error) {
      logger.error('Failed to parse critique', { error: error.message });
      return null;
    }
  }

  /**
   * Generate learning delta from feedback
   */
  async generateLearningDelta(userId, generationId, feedbackType, parsedCritique) {
    const delta = {};

    // Get generation and prompt
    const generation = await this.getGeneration(generationId);
    if (!generation || !generation.json_spec) {
      return delta;
    }

    const spec = generation.json_spec;

    // Positive feedback: boost attributes
    if (feedbackType === 'like' || feedbackType === 'swipe_right') {
      if (spec.garment_type) {
        delta[`garment.${spec.garment_type}`] = 0.1;
      }
      if (spec.colors && Array.isArray(spec.colors)) {
        for (const color of spec.colors) {
          delta[`color.${color}`] = 0.1;
        }
      }
      if (spec.fabric) {
        delta[`fabric.${spec.fabric}`] = 0.1;
      }
      if (spec.silhouette) {
        delta[`silhouette.${spec.silhouette}`] = 0.1;
      }
    }

    // Negative feedback: reduce attributes
    if (feedbackType === 'dislike' || feedbackType === 'swipe_left') {
      if (spec.garment_type) {
        delta[`garment.${spec.garment_type}`] = -0.05;
      }
      if (spec.colors && Array.isArray(spec.colors)) {
        for (const color of spec.colors) {
          delta[`color.${color}`] = -0.05;
        }
      }
    }

    // Critique-based adjustments
    if (parsedCritique) {
      if (parsedCritique.color) {
        delta[`color.${parsedCritique.color}`] = 0.3; // Strong boost for requested color
      }
      if (parsedCritique.sleeve_length) {
        delta[`sleeve_length.${parsedCritique.sleeve_length}`] = 0.2;
      }
      if (parsedCritique.fabric) {
        delta[`fabric.${parsedCritique.fabric}`] = 0.2;
      }
      if (parsedCritique.silhouette) {
        delta[`silhouette.${parsedCritique.silhouette}`] = 0.2;
      }
    }

    return delta;
  }

  /**
   * Apply delta to user style profile
   */
  async applyDeltaToProfile(userId, delta) {
    try {
      const profile = await this.getStyleProfile(userId);
      if (!profile) {
        logger.warn('No style profile found for user', { userId });
        return;
      }

      // Parse distributions
      const garmentDist = profile.garment_distribution || {};
      const colorDist = profile.color_distribution || {};
      const fabricDist = profile.fabric_distribution || {};
      const silhouetteDist = profile.silhouette_distribution || {};

      // Apply deltas
      for (const [key, value] of Object.entries(delta)) {
        const [category, attribute] = key.split('.');
        
        if (category === 'garment' && garmentDist[attribute] !== undefined) {
          garmentDist[attribute] = Math.max(0, Math.min(1, garmentDist[attribute] + value));
        } else if (category === 'color') {
          colorDist[attribute] = Math.max(0, Math.min(1, (colorDist[attribute] || 0) + value));
        } else if (category === 'fabric' && fabricDist[attribute] !== undefined) {
          fabricDist[attribute] = Math.max(0, Math.min(1, fabricDist[attribute] + value));
        } else if (category === 'silhouette' && silhouetteDist[attribute] !== undefined) {
          silhouetteDist[attribute] = Math.max(0, Math.min(1, silhouetteDist[attribute] + value));
        }
      }

      // Normalize distributions
      this.normalizeDistribution(garmentDist);
      this.normalizeDistribution(colorDist);
      this.normalizeDistribution(fabricDist);
      this.normalizeDistribution(silhouetteDist);

      // Update profile
      await db.query(`
        UPDATE style_profiles
        SET garment_distribution = $1,
            color_distribution = $2,
            fabric_distribution = $3,
            silhouette_distribution = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $5
      `, [
        JSON.stringify(garmentDist),
        JSON.stringify(colorDist),
        JSON.stringify(fabricDist),
        JSON.stringify(silhouetteDist),
        userId
      ]);

      logger.info('Applied delta to style profile', { userId, deltaKeys: Object.keys(delta).length });

    } catch (error) {
      logger.error('Failed to apply delta to profile', { userId, error: error.message });
    }
  }

  /**
   * Normalize distribution to sum to 1.0
   */
  normalizeDistribution(dist) {
    const total = Object.values(dist).reduce((sum, v) => sum + v, 0);
    if (total > 0) {
      for (const key of Object.keys(dist)) {
        dist[key] = parseFloat((dist[key] / total).toFixed(3));
      }
    }
  }

  /**
   * Save feedback
   */
  async saveFeedback(userId, generationId, data) {
    const query = `
      INSERT INTO feedback (user_id, generation_id, type, note, parsed_critique)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, generation_id) DO UPDATE
      SET type = EXCLUDED.type,
          note = EXCLUDED.note,
          parsed_critique = EXCLUDED.parsed_critique,
          created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      generationId,
      data.type,
      data.note || null,
      data.parsed_critique ? JSON.stringify(data.parsed_critique) : null
    ]);

    return result.rows[0];
  }

  /**
   * Save learning event
   */
  async saveLearningEvent(userId, generationId, feedbackId, delta) {
    const query = `
      INSERT INTO learning_events (user_id, generation_id, feedback_id, delta, event_type)
      VALUES ($1, $2, $3, $4, 'feedback_update')
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      generationId,
      feedbackId,
      JSON.stringify(delta)
    ]);

    return result.rows[0];
  }

  /**
   * Update prompt history
   */
  async updatePromptHistory(generationId, feedbackType) {
    const query = `
      INSERT INTO prompt_history (user_id, prompt_id, was_liked, was_disliked, success_score)
      SELECT g.user_id, g.prompt_id, 
             $1 = 'like' OR $1 = 'swipe_right',
             $1 = 'dislike' OR $1 = 'swipe_left',
             CASE WHEN $1 = 'like' OR $1 = 'swipe_right' THEN 1.0
                  WHEN $1 = 'dislike' OR $1 = 'swipe_left' THEN 0.0
                  ELSE 0.5 END
      FROM generations g
      WHERE g.id = $2
      ON CONFLICT (user_id, prompt_id) DO UPDATE
      SET was_liked = EXCLUDED.was_liked,
          was_disliked = EXCLUDED.was_disliked,
          success_score = EXCLUDED.success_score
    `;

    await db.query(query, [feedbackType, generationId]);
  }

  /**
   * Update prompt scores
   */
  async updatePromptScores(generationId, feedbackType) {
    const query = `
      UPDATE prompts p
      SET like_count = p.like_count + CASE WHEN $1 = 'like' OR $1 = 'swipe_right' THEN 1 ELSE 0 END,
          dislike_count = p.dislike_count + CASE WHEN $1 = 'dislike' OR $1 = 'swipe_left' THEN 1 ELSE 0 END,
          score = (p.like_count + 1.0) / NULLIF(p.like_count + p.dislike_count + 2.0, 0)
      FROM generations g
      WHERE g.prompt_id = p.id AND g.id = $2
    `;

    await db.query(query, [feedbackType, generationId]);
  }

  /**
   * Get generation with prompt
   */
  async getGeneration(generationId) {
    const query = `
      SELECT g.*, p.json_spec, p.text as prompt_text
      FROM generations g
      JOIN prompts p ON g.prompt_id = p.id
      WHERE g.id = $1
    `;

    const result = await db.query(query, [generationId]);
    return result.rows[0] || null;
  }

  /**
   * Get style profile
   */
  async getStyleProfile(userId) {
    const query = `SELECT * FROM style_profiles WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get user feedback
   */
  async getUserFeedback(userId, limit = 50) {
    const query = `
      SELECT f.*, g.url, g.prompt_id
      FROM feedback f
      JOIN generations g ON f.generation_id = g.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }
}

module.exports = new FeedbackLearnerAgent();
