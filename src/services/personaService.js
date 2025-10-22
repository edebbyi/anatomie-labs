const pineconeService = require('./pineconeService');
const db = require('./database');
const logger = require('../utils/logger');

/**
 * Stage 3: Persona Profile Service
 * Manages user style personas, matches prompts to user preferences,
 * and maintains style consistency through CLIP embeddings
 */
class PersonaService {
  constructor() {
    this.defaultPersonas = [
      {
        name: 'Minimalist Tailoring',
        description: 'Clean lines, monochromatic palettes, precision construction',
        keywords: ['minimalist', 'tailored', 'structured', 'monochrome', 'clean lines']
      },
      {
        name: 'Fluid Evening',
        description: 'Flowing silhouettes, dramatic fabrics, evening elegance',
        keywords: ['fluid', 'evening', 'dramatic', 'silk', 'flowing', 'elegant']
      },
      {
        name: 'Avant-Garde Experimental',
        description: 'Deconstructed forms, unconventional materials, artistic expression',
        keywords: ['avant-garde', 'experimental', 'deconstructed', 'artistic', 'unconventional']
      },
      {
        name: 'Soft Romantic',
        description: 'Delicate fabrics, soft colors, feminine details',
        keywords: ['romantic', 'soft', 'delicate', 'feminine', 'pastel', 'lace']
      },
      {
        name: 'Urban Streetwear',
        description: 'Contemporary casual, bold graphics, street culture',
        keywords: ['urban', 'streetwear', 'casual', 'contemporary', 'bold']
      }
    ];
  }

  /**
   * Create a new persona for a user
   * @param {string} userId - User ID
   * @param {Object} personaData - Persona configuration
   * @returns {Promise<Object>}
   */
  async createPersona(userId, personaData) {
    try {
      const {
        name,
        description,
        keywords = [],
        stylePreferences = {},
        examplePrompts = []
      } = personaData;

      logger.info('Creating persona', { userId, name });

      // Store in database
      const persona = await db.query(
        `INSERT INTO user_personas 
         (user_id, name, description, keywords, style_preferences, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [userId, name, description, JSON.stringify(keywords), JSON.stringify(stylePreferences)]
      );

      const personaId = persona.rows[0].id;

      // Generate and store embeddings if example prompts provided
      if (examplePrompts.length > 0) {
        const result = await pineconeService.storePersonaEmbedding(
          userId,
          name,
          examplePrompts,
          {
            personaId,
            description,
            keywords
          }
        );

        // Store embedding reference in database
        await db.query(
          `UPDATE user_personas 
           SET embedding_id = $1, embedding_dimension = $2
           WHERE id = $3`,
          [result.vectorId, result.embedding.length, personaId]
        );
      }

      logger.info('Persona created successfully', {
        userId,
        personaId,
        name,
        hasEmbeddings: examplePrompts.length > 0
      });

      return persona.rows[0];

    } catch (error) {
      logger.error('Failed to create persona', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get user's personas
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>}
   */
  async getUserPersonas(userId) {
    try {
      const result = await db.query(
        `SELECT * FROM user_personas 
         WHERE user_id = $1 
         ORDER BY is_active DESC, created_at DESC`,
        [userId]
      );

      return result.rows;

    } catch (error) {
      logger.error('Failed to get user personas', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get active persona for user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  async getActivePersona(userId) {
    try {
      const result = await db.query(
        `SELECT * FROM user_personas 
         WHERE user_id = $1 AND is_active = true 
         LIMIT 1`,
        [userId]
      );

      return result.rows[0] || null;

    } catch (error) {
      logger.error('Failed to get active persona', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Set active persona for user
   * @param {string} userId - User ID
   * @param {number} personaId - Persona ID to activate
   * @returns {Promise<Object>}
   */
  async setActivePersona(userId, personaId) {
    try {
      // Deactivate all personas
      await db.query(
        `UPDATE user_personas 
         SET is_active = false 
         WHERE user_id = $1`,
        [userId]
      );

      // Activate selected persona
      const result = await db.query(
        `UPDATE user_personas 
         SET is_active = true 
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [personaId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Persona not found or access denied');
      }

      logger.info('Active persona updated', {
        userId,
        personaId,
        personaName: result.rows[0].name
      });

      return result.rows[0];

    } catch (error) {
      logger.error('Failed to set active persona', {
        userId,
        personaId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Match prompt to user's style persona
   * @param {string} userId - User ID
   * @param {Object} enhancedPrompt - Enhanced prompt from Stage 2
   * @param {Object} options - Matching options
   * @returns {Promise<Object>}
   */
  async matchToPersona(userId, enhancedPrompt, options = {}) {
    try {
      const {
        useActivePersona = true,
        similarityThreshold = 0.7
      } = options;

      logger.info('Matching prompt to persona', {
        userId,
        useActivePersona
      });

      // Get user's persona
      let persona;
      if (useActivePersona) {
        persona = await this.getActivePersona(userId);
      }

      if (!persona) {
        // Use default matching if no active persona
        logger.info('No active persona found, using default matching');
        return this.applyDefaultMatching(enhancedPrompt);
      }

      // Generate embedding for the enhanced prompt
      const promptText = enhancedPrompt.enhanced?.mainPrompt || enhancedPrompt.mainPrompt;
      const promptEmbedding = await pineconeService.generateTextEmbedding(promptText);

      // Find similar personas (for style consistency check)
      const similarPersonas = await pineconeService.findSimilarPersonas(
        promptEmbedding,
        userId,
        5
      );

      // Check if prompt matches user's style
      const matchScore = this.calculateMatchScore(
        persona,
        enhancedPrompt,
        similarPersonas
      );

      // Apply persona-specific adjustments
      const adjusted = this.applyPersonaAdjustments(
        enhancedPrompt,
        persona,
        matchScore
      );

      logger.info('Persona matching completed', {
        userId,
        personaName: persona.name,
        matchScore: matchScore.toFixed(3),
        adjusted: adjusted.wasAdjusted
      });

      return {
        originalPrompt: enhancedPrompt,
        matchedPersona: {
          id: persona.id,
          name: persona.name,
          description: persona.description
        },
        matchScore,
        similarPersonas: similarPersonas.slice(0, 3),
        adjustedPrompt: adjusted.prompt,
        adjustments: adjusted.adjustments,
        recommendation: this.generateRecommendation(matchScore, similarPersonas)
      };

    } catch (error) {
      logger.error('Failed to match prompt to persona', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate match score between prompt and persona
   * @param {Object} persona - User persona
   * @param {Object} enhancedPrompt - Enhanced prompt
   * @param {Array} similarPersonas - Similar personas from vector search
   * @returns {number}
   */
  calculateMatchScore(persona, enhancedPrompt, similarPersonas) {
    let score = 0;
    let factors = 0;

    // Factor 1: Keyword overlap
    const promptKeywords = enhancedPrompt.enhanced?.keywords || [];
    const personaKeywords = persona.keywords || [];
    
    if (promptKeywords.length > 0 && personaKeywords.length > 0) {
      const overlap = promptKeywords.filter(k => 
        personaKeywords.includes(k)
      ).length;
      score += (overlap / personaKeywords.length) * 0.4;
      factors += 0.4;
    }

    // Factor 2: Similar persona match (from Pinecone)
    if (similarPersonas.length > 0) {
      const topMatch = similarPersonas[0];
      if (topMatch.personaName === persona.name) {
        score += topMatch.similarity * 0.6;
        factors += 0.6;
      } else {
        // Use average similarity of top 3
        const avgSimilarity = similarPersonas
          .slice(0, 3)
          .reduce((sum, p) => sum + p.similarity, 0) / 3;
        score += avgSimilarity * 0.6;
        factors += 0.6;
      }
    }

    return factors > 0 ? score / factors : 0.5;
  }

  /**
   * Apply persona-specific adjustments to prompt
   * @param {Object} enhancedPrompt - Enhanced prompt
   * @param {Object} persona - User persona
   * @param {number} matchScore - Match score
   * @returns {Object}
   */
  applyPersonaAdjustments(enhancedPrompt, persona, matchScore) {
    const adjustments = [];
    let prompt = enhancedPrompt.enhanced?.mainPrompt || enhancedPrompt.mainPrompt;
    let wasAdjusted = false;

    // Low match score - inject persona keywords
    if (matchScore < 0.6) {
      const personaKeywords = persona.keywords || [];
      const keywordsToAdd = personaKeywords.slice(0, 3);
      
      if (keywordsToAdd.length > 0) {
        prompt += `, emphasizing ${keywordsToAdd.join(', ')} aesthetic`;
        adjustments.push({
          type: 'keyword_injection',
          keywords: keywordsToAdd,
          reason: 'Low match score - reinforcing persona style'
        });
        wasAdjusted = true;
      }
    }

    // Apply style preferences
    const stylePrefs = persona.style_preferences || {};
    
    if (stylePrefs.lightingPreference) {
      prompt = prompt.replace(/studio lighting/gi, stylePrefs.lightingPreference);
      adjustments.push({
        type: 'lighting_override',
        value: stylePrefs.lightingPreference
      });
      wasAdjusted = true;
    }

    if (stylePrefs.compositionStyle) {
      prompt += `, ${stylePrefs.compositionStyle} composition`;
      adjustments.push({
        type: 'composition_addition',
        value: stylePrefs.compositionStyle
      });
      wasAdjusted = true;
    }

    return {
      prompt: {
        ...enhancedPrompt,
        enhanced: {
          ...(enhancedPrompt.enhanced || {}),
          mainPrompt: prompt
        }
      },
      adjustments,
      wasAdjusted
    };
  }

  /**
   * Apply default matching (no persona)
   * @param {Object} enhancedPrompt - Enhanced prompt
   * @returns {Object}
   */
  applyDefaultMatching(enhancedPrompt) {
    return {
      originalPrompt: enhancedPrompt,
      matchedPersona: null,
      matchScore: 1.0,
      similarPersonas: [],
      adjustedPrompt: enhancedPrompt,
      adjustments: [],
      recommendation: 'Consider creating a persona for better style consistency'
    };
  }

  /**
   * Generate recommendation based on matching results
   * @param {number} matchScore - Match score
   * @param {Array} similarPersonas - Similar personas
   * @returns {string}
   */
  generateRecommendation(matchScore, similarPersonas) {
    if (matchScore >= 0.8) {
      return 'Excellent match! This prompt aligns well with your style persona.';
    } else if (matchScore >= 0.6) {
      return 'Good match. Minor adjustments applied to better fit your style.';
    } else if (similarPersonas.length > 0) {
      const topMatch = similarPersonas[0];
      return `This prompt might be better suited for "${topMatch.personaName}" persona (${(topMatch.similarity * 100).toFixed(1)}% match).`;
    } else {
      return 'This prompt diverges from your usual style. Consider creating a new persona for this aesthetic.';
    }
  }

  /**
   * Update persona based on user feedback
   * @param {string} userId - User ID
   * @param {number} personaId - Persona ID
   * @param {Object} feedbackData - Feedback data
   * @returns {Promise<Object>}
   */
  async updatePersonaFromFeedback(userId, personaId, feedbackData) {
    try {
      const {
        likedPrompts = [],
        dislikedPrompts = [],
        imageIds = []
      } = feedbackData;

      logger.info('Updating persona from feedback', {
        userId,
        personaId,
        likedCount: likedPrompts.length,
        imageCount: imageIds.length
      });

      // Get current persona
      const personaResult = await db.query(
        `SELECT * FROM user_personas WHERE id = $1 AND user_id = $2`,
        [personaId, userId]
      );

      if (personaResult.rows.length === 0) {
        throw new Error('Persona not found');
      }

      const persona = personaResult.rows[0];

      // If we have liked prompts, regenerate embedding
      if (likedPrompts.length > 0) {
        const result = await pineconeService.storePersonaEmbedding(
          userId,
          persona.name,
          likedPrompts,
          {
            personaId,
            updatedFrom: 'user_feedback',
            feedbackCount: likedPrompts.length
          }
        );

        await db.query(
          `UPDATE user_personas 
           SET embedding_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [result.vectorId, personaId]
        );
      }

      // Store feedback history
      if (imageIds.length > 0) {
        await db.query(
          `INSERT INTO style_history 
           (user_id, persona_id, image_ids, feedback_type, created_at)
           VALUES ($1, $2, $3, 'persona_update', NOW())`,
          [userId, personaId, JSON.stringify(imageIds)]
        );
      }

      logger.info('Persona updated from feedback', {
        userId,
        personaId
      });

      return { success: true, personaId };

    } catch (error) {
      logger.error('Failed to update persona from feedback', {
        userId,
        personaId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze user's style evolution
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>}
   */
  async analyzeStyleEvolution(userId, options = {}) {
    try {
      const { daysBack = 30, personaId = null } = options;

      logger.info('Analyzing style evolution', { userId, daysBack });

      // Get style history
      const query = personaId
        ? `SELECT * FROM style_history 
           WHERE user_id = $1 AND persona_id = $2 
           AND created_at >= NOW() - INTERVAL '${daysBack} days'
           ORDER BY created_at DESC`
        : `SELECT * FROM style_history 
           WHERE user_id = $1 
           AND created_at >= NOW() - INTERVAL '${daysBack} days'
           ORDER BY created_at DESC`;

      const params = personaId ? [userId, personaId] : [userId];
      const history = await db.query(query, params);

      // Analyze patterns
      const analysis = {
        totalGenerations: history.rows.length,
        timeRange: {
          start: daysBack + ' days ago',
          end: 'now'
        },
        personaUsage: {},
        trends: []
      };

      // Count persona usage
      history.rows.forEach(record => {
        const pid = record.persona_id || 'no_persona';
        analysis.personaUsage[pid] = (analysis.personaUsage[pid] || 0) + 1;
      });

      // Identify trends (simplified)
      const recentHalf = history.rows.slice(0, Math.floor(history.rows.length / 2));
      const olderHalf = history.rows.slice(Math.floor(history.rows.length / 2));

      if (recentHalf.length > 0 && olderHalf.length > 0) {
        // Compare persona preferences
        analysis.trends.push('Style preferences tracked over time');
      }

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze style evolution', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize default personas for new user
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>}
   */
  async initializeDefaultPersonas(userId) {
    try {
      logger.info('Initializing default personas', { userId });

      const created = [];
      
      for (const defaultPersona of this.defaultPersonas) {
        const persona = await this.createPersona(userId, {
          ...defaultPersona,
          examplePrompts: defaultPersona.keywords.map(
            keyword => `professional fashion photography featuring ${keyword} aesthetic`
          )
        });
        created.push(persona);
      }

      // Set first persona as active
      if (created.length > 0) {
        await this.setActivePersona(userId, created[0].id);
      }

      logger.info('Default personas initialized', {
        userId,
        count: created.length
      });

      return created;

    } catch (error) {
      logger.error('Failed to initialize default personas', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PersonaService();
