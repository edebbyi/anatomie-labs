/**
 * Prompt Builder Agent
 * 
 * Builds prompts from user style profiles with epsilon-greedy bandit strategy.
 * Reads from prompt history to mine success patterns.
 */

const db = require('./database');
const logger = require('../utils/logger');

class PromptBuilderAgent {
  constructor() {
    this.EPSILON = 0.1; // 10% exploration, 90% exploitation
  }

  /**
   * Generate prompt from style profile
   * @param {string} userId - User ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Prompt record
   */
  async generatePrompt(userId, options = {}) {
    const { mode = 'exploratory', constraints = {} } = options;
    
    logger.info('Prompt Builder Agent: Generating prompt', { userId, mode });

    // Get user style profile (optional - can generate without it)
    const profile = await this.getStyleProfile(userId);
    
    if (!profile) {
      logger.warn('Prompt Builder Agent: No style profile found, using defaults', { userId });
      // Generate generic fashion prompt without style profile
      return this.generateDefaultPrompt(userId, mode, constraints);
    }

    // Get prompt history for bandit strategy
    const history = await this.getPromptHistory(userId);

    // Decide exploration vs exploitation
    const isExploration = Math.random() < this.EPSILON;

    // Generate prompt
    const promptSpec = await this.buildPromptSpec(
      profile,
      mode,
      constraints,
      isExploration,
      history
    );

    // Render text prompt
    const text = this.renderPrompt(promptSpec);

    // Save prompt
    const prompt = await this.savePrompt(userId, {
      text,
      json_spec: promptSpec,
      mode,
      weights: promptSpec.weights,
      is_exploration: isExploration
    });

    logger.info('Prompt Builder Agent: Prompt generated', { 
      promptId: prompt.id,
      mode,
      isExploration
    });

    return prompt;
  }

  /**
   * Generate default prompt without style profile
   */
  async generateDefaultPrompt(userId, mode, constraints) {
    const defaultGarments = ['dress', 'jacket', 'skirt', 'blouse', 'pants', 'coat'];
    const defaultColors = ['black', 'white', 'navy', 'beige'];
    const defaultFabrics = ['cotton', 'silk', 'wool', 'linen'];
    const defaultSilhouettes = ['fitted', 'oversized', 'tailored', 'flowing'];

    const spec = {
      style_mode: 'contemporary fashion',
      garment_type: constraints.garment_type || defaultGarments[Math.floor(Math.random() * defaultGarments.length)],
      silhouette: constraints.silhouette || defaultSilhouettes[Math.floor(Math.random() * defaultSilhouettes.length)],
      colors: constraints.colors || [defaultColors[Math.floor(Math.random() * defaultColors.length)]],
      fabric: constraints.fabric || defaultFabrics[Math.floor(Math.random() * defaultFabrics.length)],
      
      lighting: { type: 'soft', direction: '45deg' },
      camera: { angle: '3/4 front', height: 'eye level' },
      background: 'clean studio background',
      
      finish: 'polished',
      details: 'modern editorial style',
      
      weights: {
        cluster: 0.5,
        garment: 0.5,
        color: 0.5,
        fabric: 0.5,
        silhouette: 0.5
      }
    };

    const text = this.renderPrompt(spec);

    const prompt = await this.savePrompt(userId, {
      text,
      json_spec: spec,
      mode,
      weights: spec.weights,
      is_exploration: true
    });

    logger.info('Prompt Builder Agent: Default prompt generated', { 
      promptId: prompt.id,
      mode
    });

    return prompt;
  }

  /**
   * Build prompt specification
   */
  async buildPromptSpec(profile, mode, constraints, isExploration, history) {
    const clusters = profile.clusters || [];
    const garmentDist = profile.garment_distribution || {};
    const colorDist = profile.color_distribution || {};
    const fabricDist = profile.fabric_distribution || {};
    const silhouetteDist = profile.silhouette_distribution || {};

    // Log profile data for debugging
    logger.info('Prompt Builder Agent: Building prompt from profile', { 
      userId: profile.user_id,
      totalImages: profile.total_images,
      garmentDist: Object.keys(garmentDist).slice(0, 3),
      colorDist: Object.keys(colorDist).slice(0, 3),
      fabricDist: Object.keys(fabricDist).slice(0, 3)
    });

    // Initialize weights based on profile confidence
    const weights = {
      cluster: 1.0,
      garment: 0.8,
      color: 0.7,
      fabric: 0.6,
      silhouette: 0.5,
      finish: 0.4
    };

    // Apply successful patterns from history
    if (history.length > 0 && !isExploration) {
      const successPatterns = this.extractSuccessPatterns(history);
      this.applySuccessPatterns(weights, successPatterns);
    }

    // Exploration: randomize weights slightly
    if (isExploration) {
      this.randomizeWeights(weights);
    }

    // Select primary cluster
    const primaryCluster = clusters[0] || { 
      name: 'signature style', 
      signature_attributes: {} 
    };

    // Build spec with proper weighting and variation
    const spec = {
      style_mode: primaryCluster.name,
      garment_type: constraints.garment_type || this.weightedSelect(garmentDist),
      silhouette: constraints.silhouette || primaryCluster.signature_attributes.silhouette || this.weightedSelect(silhouetteDist),
      colors: constraints.colors || this.selectTopN(colorDist, 2),
      fabric: constraints.fabric || this.weightedSelect(fabricDist),
      
      // Photography attributes (from profile or defaults)
      lighting: { type: 'soft', direction: '45deg' },
      camera: { angle: '3/4 front', height: 'eye level' },
      background: 'clean studio background',
      
      // Additional details
      finish: 'sheen',
      details: 'modern editorial style',
      
      weights
    };

    logger.info('Prompt Builder Agent: Generated prompt spec', { 
      styleMode: spec.style_mode,
      garmentType: spec.garment_type,
      colors: spec.colors,
      fabric: spec.fabric
    });

    return spec;
  }

  /**
   * Render text prompt from spec with weights and brackets
   */
  renderPrompt(spec) {
    const parts = [];

    // Add style mode with weight
    parts.push(`in the user's signature '${spec.style_mode}' mode:`);
    
    // Add garment with weight brackets for importance
    if (spec.silhouette && spec.garment_type) {
      const garmentWeight = spec.weights?.garment || 1.0;
      if (garmentWeight > 0.8) {
        parts.push(`[${spec.silhouette} ${spec.garment_type}]`);
      } else if (garmentWeight > 0.6) {
        parts.push(`(${spec.silhouette} ${spec.garment_type})`);
      } else {
        parts.push(`${spec.silhouette} ${spec.garment_type}`);
      }
    } else if (spec.garment_type) {
      const garmentWeight = spec.weights?.garment || 1.0;
      if (garmentWeight > 0.8) {
        parts.push(`[${spec.garment_type}]`);
      } else if (garmentWeight > 0.6) {
        parts.push(`(${spec.garment_type})`);
      } else {
        parts.push(spec.garment_type);
      }
    }

    // Add fabric with weight
    if (spec.fabric) {
      const fabricWeight = spec.weights?.fabric || 0.6;
      if (fabricWeight > 0.8) {
        parts.push(`[in ${spec.fabric}]`);
      } else if (fabricWeight > 0.6) {
        parts.push(`(in ${spec.fabric})`);
      } else {
        parts.push(`in ${spec.fabric}`);
      }
    }

    // Add finish
    if (spec.finish) {
      const finishWeight = spec.weights?.finish || 0.5;
      if (finishWeight > 0.8) {
        parts.push(`[with ${spec.finish} finish]`);
      } else if (finishWeight > 0.6) {
        parts.push(`(with ${spec.finish} finish)`);
      } else {
        parts.push(`with ${spec.finish} finish`);
      }
    }

    // Add colors with weight
    if (spec.colors && spec.colors.length > 0) {
      const colorWeight = spec.weights?.color || 0.7;
      const colorText = `${spec.colors.join(' and ')} palette`;
      if (colorWeight > 0.8) {
        parts.push(`[${colorText}]`);
      } else if (colorWeight > 0.6) {
        parts.push(`(${colorText})`);
      } else {
        parts.push(colorText);
      }
    }

    // Add lighting
    if (spec.lighting) {
      parts.push(`${spec.lighting.type} lighting from ${spec.lighting.direction}`);
    }

    // Add camera angle
    if (spec.camera) {
      parts.push(`${spec.camera.angle} angle at ${spec.camera.height}`);
    }

    // Add background
    if (spec.background) {
      parts.push(spec.background);
    }

    // Add details
    if (spec.details) {
      parts.push(spec.details);
    }

    return parts.join(', ');
  }

  /**
   * Weighted selection from distribution
   */
  weightedSelect(distribution) {
    const items = Object.keys(distribution);
    if (items.length === 0) return null;

    const weights = Object.values(distribution);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    return items[0];
  }

  /**
   * Select top N items
   */
  selectTopN(distribution, n) {
    return Object.keys(distribution).slice(0, n);
  }

  /**
   * Extract success patterns from history
   */
  extractSuccessPatterns(history) {
    const patterns = {
      garment_type: {},
      colors: {},
      fabrics: {}
    };

    for (const record of history) {
      if (record.was_liked) {
        const spec = record.prompt.json_spec || {};
        
        if (spec.garment_type) {
          patterns.garment_type[spec.garment_type] = 
            (patterns.garment_type[spec.garment_type] || 0) + 1;
        }

        if (spec.colors) {
          for (const color of spec.colors) {
            patterns.colors[color] = (patterns.colors[color] || 0) + 1;
          }
        }

        if (spec.fabric) {
          patterns.fabrics[spec.fabric] = (patterns.fabrics[spec.fabric] || 0) + 1;
        }
      }
    }

    return patterns;
  }

  /**
   * Apply success patterns to weights
   */
  applySuccessPatterns(weights, patterns) {
    // Boost weights based on successful patterns
    const totalLikes = Object.values(patterns.garment_type).reduce((sum, v) => sum + v, 0);
    
    if (totalLikes > 5) {
      weights.garment = Math.min(1.0, weights.garment + 0.1);
      weights.color = Math.min(1.0, weights.color + 0.1);
    }
  }

  /**
   * Randomize weights for exploration
   */
  randomizeWeights(weights) {
    for (const key of Object.keys(weights)) {
      weights[key] = Math.max(0.3, Math.min(1.0, weights[key] + (Math.random() - 0.5) * 0.4));
    }
  }

  /**
   * Save prompt to database
   */
  async savePrompt(userId, promptData) {
    const query = `
      INSERT INTO prompts (user_id, text, json_spec, mode, weights)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      promptData.text,
      JSON.stringify(promptData.json_spec),
      promptData.mode,
      JSON.stringify(promptData.weights)
    ]);

    return result.rows[0];
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
   * Get prompt history
   */
  async getPromptHistory(userId, limit = 50) {
    const query = `
      SELECT ph.*, p.json_spec, p.text as prompt_text
      FROM prompt_history ph
      JOIN prompts p ON ph.prompt_id = p.id
      WHERE ph.user_id = $1
      ORDER BY ph.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);
    return result.rows.map(row => ({
      ...row,
      prompt: {
        json_spec: row.json_spec,
        text: row.prompt_text
      }
    }));
  }

  /**
   * Get prompt by ID
   */
  async getPrompt(promptId) {
    const query = `SELECT * FROM prompts WHERE id = $1`;
    const result = await db.query(query, [promptId]);
    return result.rows[0] || null;
  }
}

module.exports = new PromptBuilderAgent();
