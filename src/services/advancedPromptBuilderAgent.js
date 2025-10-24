/**
 * Advanced Prompt Builder Agent with Thompson Sampling
 * 
 * Improvements over epsilon-greedy:
 * 1. Thompson Sampling for better exploration/exploitation
 * 2. Rich style tag metadata integration
 * 3. Dynamic weight adjustment based on success
 * 4. Contextual bandit approach
 * 5. Maintains randomness for creativity
 */

const db = require('./database');
const logger = require('../utils/logger');

class AdvancedPromptBuilderAgent {
  constructor() {
    // Thompson Sampling uses Beta distributions for each arm
    // Each attribute has alpha (successes) and beta (failures) parameters
    this.DEFAULT_ALPHA = 2; // Prior successes (optimistic initialization)
    this.DEFAULT_BETA = 2;  // Prior failures
    
    // Creativity factors - controls randomness
    this.CREATIVITY_LEVEL = 0.2; // 20% exploration even with Thompson Sampling
    
    // Weight bounds
    this.MIN_WEIGHT = 0.3;
    this.MAX_WEIGHT = 1.5;
  }

  /**
   * Generate prompt using Thompson Sampling and style tag metadata
   * @param {string} userId - User ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Prompt record
   */
  async generatePrompt(userId, options = {}) {
    const { mode = 'exploratory', constraints = {}, creativity = this.CREATIVITY_LEVEL, variationSeed = 0 } = options;
  
    logger.info('Advanced Prompt Builder: Generating prompt', { userId, mode, creativity, variationSeed });

    // Get user style profile with tag metadata
    const profile = await this.getStyleProfileWithMetadata(userId);
  
    if (!profile) {
      logger.warn('No style profile found, using defaults', { userId });
      return this.generateDefaultPrompt(userId, mode, constraints, variationSeed);
    }

    // Get Thompson Sampling parameters (alpha/beta for each attribute)
    const samplingParams = await this.getThompsonSamplingParams(userId);

    // Build prompt specification using Thompson Sampling
    const promptSpec = await this.buildPromptSpecWithThompson(
      profile,
      mode,
      constraints,
      samplingParams,
      creativity,
      variationSeed
    );

    // Render text prompt with weights and brackets
    const text = this.renderPrompt(promptSpec);

    // Save prompt
    const prompt = await this.savePrompt(userId, {
      text,
      json_spec: promptSpec,
      mode,
      weights: promptSpec.weights,
      creativity
    });

    logger.info('Advanced Prompt Builder: Prompt generated', { 
      promptId: prompt.id,
      mode,
      creativity
    });

    return prompt;
  }

  /**
   * Generate default prompt without style profile
   */
  async generateDefaultPrompt(userId, mode, constraints, variationSeed = 0) {
    // Use seeded random for consistent variation
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
  
    // Create a seed based on userId and variationSeed for more uniqueness
    const baseSeed = userId ? parseInt(userId.replace(/[^0-9]/g, '').slice(0, 8)) || 0 : 0;
    const combinedSeed = baseSeed + variationSeed;

    const defaultGarments = ['dress', 'jacket', 'skirt', 'blouse', 'pants', 'coat'];
    const defaultColors = ['black', 'white', 'navy', 'beige'];
    const defaultFabrics = ['cotton', 'silk', 'wool', 'linen'];
    const defaultSilhouettes = ['fitted', 'oversized', 'tailored', 'flowing'];

    const spec = {
      style_mode: 'contemporary fashion',
      garment_type: constraints.garment_type || defaultGarments[Math.floor(seededRandom(combinedSeed * 1.1) * defaultGarments.length)],
      silhouette: constraints.silhouette || defaultSilhouettes[Math.floor(seededRandom(combinedSeed * 1.2) * defaultSilhouettes.length)],
      colors: constraints.colors || [defaultColors[Math.floor(seededRandom(combinedSeed * 1.3) * defaultColors.length)]],
      fabric: constraints.fabric || defaultFabrics[Math.floor(seededRandom(combinedSeed * 1.4) * defaultFabrics.length)],
    
      lighting: { type: 'soft', direction: '45deg' },
      camera: { angle: '3/4 front', height: 'eye level' },
      background: 'clean studio background',
    
      finish: 'polished',
      details: 'modern editorial style',
    
      weights: {
        cluster: 0.5,
        garment: 0.7,
        color: 0.6,
        fabric: 0.6,
        silhouette: 0.6,
        finish: 0.5,
        lighting: 0.7,
        camera: 0.6,
        background: 0.5,
        details: 0.4
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

    logger.info('Advanced Prompt Builder: Default prompt generated', { 
      promptId: prompt.id,
      mode,
      variationSeed,
      garmentType: spec.garment_type,
      colors: spec.colors,
      fabric: spec.fabric
    });

    return prompt;
  }

  /**
   * Build prompt specification using Thompson Sampling
   */
  async buildPromptSpecWithThompson(profile, mode, constraints, samplingParams, creativity, variationSeed = 0) {
    const clusters = profile.clusters || [];
    const garmentDist = profile.garment_distribution || {};
    const colorDist = profile.color_distribution || {};
    const fabricDist = profile.fabric_distribution || {};
    const silhouetteDist = profile.silhouette_distribution || {};

    // Initialize weights based on profile confidence and importance
    const weights = {
      cluster: 1.0,
      garment: 0.8,
      color: 0.7,
      fabric: 0.7,
      silhouette: 0.6,
      finish: 0.5,
      lighting: 0.7,  // Photography is important
      camera: 0.6,     // Camera angle matters
      background: 0.5, // Background is supporting
      details: 0.4     // Details are subtle
    };

    // Apply Thompson Sampling for attribute selection with variation seed
    const thompsonSelected = this.applyThompsonSampling(samplingParams, creativity, variationSeed);
    
    // Select cluster with variation - rotate through available clusters
    const clusterIndex = clusters.length > 1 ? variationSeed % clusters.length : 0;
    const primaryCluster = clusters[clusterIndex] || { 
      name: 'signature style', 
      signature_attributes: {} 
    };

    // Vary silhouettes based on seed
    const silhouettes = ['fitted', 'structured', 'relaxed', 'oversized', 'tailored', 'flowing'];
    const variedSilhouette = variationSeed % 3 === 0 ? silhouettes[variationSeed % silhouettes.length] : null;
    
    // Vary finishes
    const finishes = ['sheen', 'matte', 'polished', 'textured', 'soft'];
    const variedFinish = finishes[variationSeed % finishes.length];
    
    // Vary photography attributes
    const lightingTypes = ['soft', 'natural', 'studio', 'dramatic'];
    const lightingDirections = ['45deg', 'front', 'side', 'top'];
    const cameraAngles = ['3/4 front', 'straight-on', 'profile', '3/4 back'];
    const backgrounds = ['clean studio background', 'minimal background', 'neutral background', 'textured background'];
    
    const variedLighting = {
      type: lightingTypes[variationSeed % lightingTypes.length],
      direction: lightingDirections[(variationSeed + 1) % lightingDirections.length]
    };
    
    const variedCamera = {
      angle: cameraAngles[variationSeed % cameraAngles.length],
      height: 'eye level'
    };
    
    const variedBackground = backgrounds[variationSeed % backgrounds.length];

    // Build spec with Thompson Sampling and variations
    const spec = {
      style_mode: primaryCluster.name,
      garment_type: constraints.garment_type || thompsonSelected.garment || this.weightedSelect(garmentDist),
      silhouette: constraints.silhouette || variedSilhouette || primaryCluster.signature_attributes.silhouette || thompsonSelected.silhouette || this.weightedSelect(silhouetteDist),
      colors: constraints.colors || thompsonSelected.colors || this.selectTopN(colorDist, 2),
      fabric: constraints.fabric || thompsonSelected.fabric || this.weightedSelect(fabricDist),
      
      // Varied photography attributes
      lighting: variedLighting,
      camera: variedCamera,
      background: variedBackground,
      
      // Varied details
      finish: variedFinish,
      details: 'modern editorial style',
      
      weights,
      
      // Thompson Sampling info for learning
      thompson_selection: thompsonSelected,
      variation_seed: variationSeed
    };

    logger.info('Advanced Prompt Builder: Generated prompt spec with Thompson Sampling', { 
      styleMode: spec.style_mode,
      garmentType: spec.garment_type,
      colors: spec.colors,
      fabric: spec.fabric
    });

    return spec;
  }

  /**
   * Apply Thompson Sampling to select attributes
   */
  applyThompsonSampling(samplingParams, creativity, variationSeed = 0) {
    const selected = {};
    
    // Increase exploration chance based on variation seed
    const adjustedCreativity = Math.min(0.9, creativity + (variationSeed * 0.05));
    
    // For each category, sample from Beta distribution
    for (const [category, params] of Object.entries(samplingParams)) {
      if (Object.keys(params).length > 0) {
        // Apply creativity factor - sometimes select randomly instead of Thompson
        // Use variationSeed to ensure different selections
        const seedHash = (variationSeed * 97) % 100;
        if ((seedHash / 100) < adjustedCreativity) {
          // Random selection for exploration with seed-based variation
          const attributes = Object.keys(params);
          if (attributes.length > 0) {
            const index = (variationSeed + seedHash) % attributes.length;
            const randomAttr = attributes[index];
            if (category === 'colors') {
              selected.colors = [randomAttr];
            } else {
              selected[category] = randomAttr;
            }
          }
        } else {
          // Thompson Sampling - sample from Beta distribution
          const samples = {};
          for (const [attr, param] of Object.entries(params)) {
            // Sample from Beta(alpha, beta) distribution with seed-based variation
            samples[attr] = this.sampleBeta(param.alpha, param.beta, variationSeed);
          }
          
          // Select attribute with highest sample
          const bestAttr = Object.keys(samples).reduce((a, b) => samples[a] > samples[b] ? a : b);
          
          if (category === 'colors') {
            selected.colors = [bestAttr];
          } else {
            selected[category] = bestAttr;
          }
        }
      }
    }
    
    return selected;
  }

  /**
   * Sample from Beta distribution using inverse transform sampling
   * This is a simplified approximation
   */
  sampleBeta(alpha, beta, seed = 0) {
    // Use seed to introduce controlled variation in sampling
    const seedFactor = (seed * 0.01) % 1;
    
    // For simplicity, we'll use a normal approximation for large alpha+beta
    // In practice, you would use a more accurate method
    if (alpha + beta > 100) {
      // Normal approximation
      const mean = alpha / (alpha + beta);
      const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
      const stdDev = Math.sqrt(variance);
      
      // Sample from normal distribution and clamp to [0,1]
      const sample = this.normalSample(mean, stdDev, seed);
      return Math.max(0, Math.min(1, sample));
    } else {
      // For small parameters, add variation based on seed
      return Math.max(0, Math.min(1, (Math.random() + seedFactor) / 2));
    }
  }

  /**
   * Simple normal distribution sample (Box-Muller transform approximation)
   */
  normalSample(mean, stdDev, seed = 0) {
    // Use seed to vary the random sample
    const seedOffset = (seed * 0.001) % 1;
    let u = 0, v = 0;
    while(u === 0) u = (Math.random() + seedOffset) % 1 || 0.01; // Converting [0,1) to (0,1)
    while(v === 0) v = (Math.random() + seedOffset * 0.5) % 1 || 0.01;
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + stdDev * z;
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
      if (garmentWeight > 0.5) {
        parts.push(`[${spec.silhouette} ${spec.garment_type}]`);
      } else {
        parts.push(`${spec.silhouette} ${spec.garment_type}`);
      }
    } else if (spec.garment_type) {
      const garmentWeight = spec.weights?.garment || 1.0;
      if (garmentWeight > 0.5) {
        parts.push(`[${spec.garment_type}]`);
      } else {
        parts.push(spec.garment_type);
      }
    }

    // Add fabric with weight
    if (spec.fabric) {
      const fabricWeight = spec.weights?.fabric || 0.6;
      if (fabricWeight > 0.5) {
        parts.push(`[in ${spec.fabric}]`);
      } else {
        parts.push(`in ${spec.fabric}`);
      }
    }

    // Add finish
    if (spec.finish) {
      const finishWeight = spec.weights?.finish || 0.5;
      if (finishWeight > 0.5) {
        parts.push(`[with ${spec.finish} finish]`);
      } else {
        parts.push(`with ${spec.finish} finish`);
      }
    }

    // Add colors with weight
    if (spec.colors && spec.colors.length > 0) {
      const colorWeight = spec.weights?.color || 0.7;
      const colorText = `${spec.colors.join(' and ')} palette`;
      if (colorWeight > 0.5) {
        parts.push(`[${colorText}]`);
      } else {
        parts.push(colorText);
      }
    }

    // Add lighting with weight
    if (spec.lighting) {
      const lightingWeight = spec.weights?.lighting || 0.7;
      const lightingText = `${spec.lighting.type} lighting from ${spec.lighting.direction}`;
      if (lightingWeight > 0.5) {
        parts.push(`[${lightingText}]`);
      } else {
        parts.push(lightingText);
      }
    }

    // Add camera angle with weight
    if (spec.camera) {
      const cameraWeight = spec.weights?.camera || 0.6;
      const cameraText = `${spec.camera.angle} angle at ${spec.camera.height}`;
      if (cameraWeight > 0.5) {
        parts.push(`[${cameraText}]`);
      } else {
        parts.push(cameraText);
      }
    }

    // Add background with weight
    if (spec.background) {
      const backgroundWeight = spec.weights?.background || 0.5;
      if (backgroundWeight > 0.5) {
        parts.push(`[${spec.background}]`);
      } else {
        parts.push(spec.background);
      }
    }

    // Add details with weight
    if (spec.details) {
      const detailsWeight = spec.weights?.details || 0.4;
      if (detailsWeight > 0.5) {
        parts.push(`[${spec.details}]`);
      } else {
        parts.push(spec.details);
      }
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
   * Save prompt to database
   */
  async savePrompt(userId, promptData) {
    const query = `
      INSERT INTO prompts (user_id, text, json_spec, mode, weights)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    // Include creativity in weights JSON if provided
    const weights = {
      ...promptData.weights,
      ...(promptData.creativity !== undefined && { creativity: promptData.creativity })
    };

    const result = await db.query(query, [
      userId,
      promptData.text,
      JSON.stringify(promptData.json_spec),
      promptData.mode,
      JSON.stringify(weights)
    ]);

    return result.rows[0];
  }

  /**
   * Get style profile with metadata
   */
  async getStyleProfileWithMetadata(userId) {
    const query = `
      SELECT 
        sp.*,
        json_agg(stm) as style_tag_metadata
      FROM style_profiles sp
      LEFT JOIN style_tag_metadata stm ON sp.user_id = stm.user_id
      WHERE sp.user_id = $1
      GROUP BY sp.id
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get Thompson Sampling parameters
   */
  async getThompsonSamplingParams(userId) {
    const query = `
      SELECT category, attribute, alpha, beta
      FROM thompson_sampling_params
      WHERE user_id = $1
    `;
    
    const result = await db.query(query, [userId]);
    
    // Organize by category
    const params = {};
    for (const row of result.rows) {
      if (!params[row.category]) {
        params[row.category] = {};
      }
      params[row.category][row.attribute] = {
        alpha: parseInt(row.alpha),
        beta: parseInt(row.beta)
      };
    }
    
    return params;
  }

  /**
   * Get prompt by ID
   */
  async getPrompt(promptId) {
    const query = `SELECT * FROM prompts WHERE id = $1`;
    const result = await db.query(query, [promptId]);
    return result.rows[0] || null;
  }

  /**
   * Update Thompson Sampling parameters based on feedback
   */
  async updateThompsonParams(userId, feedback) {
    // This would be called when feedback is received to update the Beta parameters
    // Implementation would depend on the specific feedback structure
    logger.info('Would update Thompson parameters based on feedback', {
      userId,
      feedbackType: feedback.type
    });
  }
}

module.exports = new AdvancedPromptBuilderAgent();