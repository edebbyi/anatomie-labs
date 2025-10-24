/**
 * Intelligent Prompt Builder
 * 
 * Unified prompt generation system that:
 * - Uses ultra-detailed ingestion data (150+ attributes)
 * - Thompson Sampling for learning what works
 * - In-memory caching for performance
 * - Generates precise, weighted prompts
 * 
 * Replaces: advancedPromptBuilderAgent.js + promptGeneratorAgent.js
 */

const db = require('./database');
const logger = require('../utils/logger');

class IntelligentPromptBuilder {
  constructor() {
    // Thompson Sampling defaults
    this.DEFAULT_ALPHA = 2;
    this.DEFAULT_BETA = 2;
    
    // Creativity threshold
    this.CREATIVITY_THRESHOLD = 0.5;
    
    // Weight bounds for tokenization
    this.MIN_WEIGHT = 0.8;
    this.MAX_WEIGHT = 1.5;
    
    // In-memory cache (LRU with 1000 max entries)
    this.cache = new Map();
    this.MAX_CACHE_SIZE = 1000;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    // Negative prompt defaults
    this.DEFAULT_NEGATIVE_PROMPT = [
      'blurry', 'low quality', 'distorted', 'deformed',
      'bad anatomy', 'disfigured', 'poorly drawn', 'extra limbs',
      'missing limbs', 'floating limbs', 'disconnected limbs',
      'mutation', 'mutated', 'ugly', 'disgusting', 'amputation',
      'watermark', 'signature', 'text', 'logo'
    ].join(', ');
  }

  /**
   * Generate prompt using ultra-detailed data + Thompson Sampling
   * 
   * @param {string} userId - User ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} { positive_prompt, negative_prompt, metadata }
   */
  async generatePrompt(userId, options = {}) {
    const {
      garmentType = null,
      season = null,
      occasion = null,
      creativity = 0.3,
      useCache = true
    } = options;

    const startTime = Date.now();

    // Generate cache key
    const cacheKey = this.getCacheKey(userId, garmentType, season, occasion);

    // Check cache
    if (useCache && this.cache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.cache.get(cacheKey);
      logger.info('Prompt cache HIT', { cacheKey, hitRate: this.getCacheHitRate() });
      return cached;
    }

    this.cacheMisses++;

    // Get ultra-detailed descriptors for this user
    const descriptors = await this.getUltraDetailedDescriptors(userId, {
      garmentType,
      season,
      occasion
    });

    if (!descriptors || descriptors.length === 0) {
      logger.warn('No ultra-detailed descriptors found', { userId });
      return this.generateDefaultPrompt(userId, options);
    }

    // Get Thompson Sampling parameters
    const thompsonParams = await this.getThompsonParams(userId);

    // Build prompt using Thompson Sampling + ultra-detailed data
    const { positive, negative, metadata } = await this.buildDetailedPrompt(
      descriptors,
      thompsonParams,
      creativity,
      options
    );

    // Save to database
    const promptRecord = await this.savePrompt(userId, {
      positive_prompt: positive,
      negative_prompt: negative,
      metadata,
      creativity
    });

    const result = {
      positive_prompt: positive,
      negative_prompt: negative,
      metadata,
      prompt_id: promptRecord.id,
      generation_time_ms: Date.now() - startTime
    };

    // Cache the result
    if (useCache) {
      this.setCache(cacheKey, result);
    }

    logger.info('Prompt generated', {
      userId,
      promptId: promptRecord.id,
      tokenCount: positive.split(',').length,
      cached: false,
      timeMs: result.generation_time_ms
    });

    return result;
  }

  /**
   * Get ultra-detailed descriptors with proper filtering
   */
  async getUltraDetailedDescriptors(userId, filters = {}) {
    let query = `
      SELECT * FROM ultra_detailed_descriptors
      WHERE user_id = $1
    `;
    
    const params = [userId];
    let paramIndex = 2;

    // Add filters
    if (filters.garmentType) {
      query += ` AND primary_garment_type = $${paramIndex}`;
      params.push(filters.garmentType);
      paramIndex++;
    }

    if (filters.season) {
      query += ` AND season = $${paramIndex}`;
      params.push(filters.season);
      paramIndex++;
    }

    if (filters.occasion) {
      query += ` AND occasion = $${paramIndex}`;
      params.push(filters.occasion);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Build detailed prompt using Thompson Sampling
   */
  async buildDetailedPrompt(descriptors, thompsonParams, creativity, options) {
    // Aggregate preferences from descriptors
    const preferences = this.aggregatePreferences(descriptors);

    // Sample attributes using Thompson Sampling
    const selected = this.thompsonSample(preferences, thompsonParams, creativity);

    // Build weighted prompt components
    const components = [];

    // 1. PRIMARY GARMENT (highest weight)
    if (selected.garment) {
      components.push(this.formatToken(selected.garment.description, 1.3));
      
      // Add fit/silhouette
      if (selected.garment.fit) {
        components.push(this.formatToken(selected.garment.fit, 1.2));
      }
      
      // Add length
      if (selected.garment.length) {
        components.push(this.formatToken(selected.garment.length, 1.2));
      }
      
      // Add specific details
      if (selected.garment.details) {
        for (const detail of selected.garment.details) {
          components.push(this.formatToken(detail, 1.1));
        }
      }
    }

    // 2. FABRIC & MATERIAL (high weight)
    if (selected.fabric) {
      components.push(this.formatToken(selected.fabric.material, 1.2));
      
      if (selected.fabric.texture) {
        components.push(this.formatToken(selected.fabric.texture, 1.1));
      }
      
      if (selected.fabric.drape) {
        components.push(this.formatToken(selected.fabric.drape, 1.1));
      }
      
      if (selected.fabric.finish) {
        components.push(this.formatToken(selected.fabric.finish, 1.0));
      }
    }

    // 3. COLORS (very high weight - critical for fashion)
    if (selected.colors && selected.colors.length > 0) {
      for (const color of selected.colors) {
        // Include hex code for precision
        const colorDesc = color.hex ? `${color.name} ${color.hex}` : color.name;
        components.push(this.formatToken(colorDesc, 1.3));
        
        // Add placement if specified
        if (color.placement) {
          components.push(this.formatToken(color.placement, 1.1));
        }
      }
    }

    // 4. CONSTRUCTION DETAILS (medium-high weight)
    if (selected.construction) {
      for (const detail of selected.construction) {
        components.push(this.formatToken(detail, 1.1));
      }
    }

    // 5. LAYERING (if applicable)
    if (selected.layers && selected.layers.length > 0) {
      for (const layer of selected.layers) {
        components.push(this.formatToken(layer, 1.0));
      }
    }

    // 6. PHOTOGRAPHY STYLE (medium weight)
    if (selected.photography) {
      components.push(this.formatToken(selected.photography.shot_type || 'three-quarter length shot', 1.2));
      components.push(this.formatToken(selected.photography.lighting || 'studio lighting', 1.1));
      
      if (selected.photography.background) {
        components.push(this.formatToken(selected.photography.background, 1.0));
      }
      
      if (selected.photography.angle) {
        components.push(this.formatToken(selected.photography.angle, 1.1));
      }
    }

    // 7. QUALITY MARKERS (standard weight)
    components.push(this.formatToken('professional fashion photography', 1.3));
    components.push(this.formatToken('high detail', 1.2));
    components.push(this.formatToken('8k', 1.1));
    components.push('sharp focus');
    components.push('studio quality');

    // Join all components
    const positivePrompt = components.join(', ');

    // Build negative prompt (user preferences + defaults)
    const negativePrompt = this.buildNegativePrompt(selected);

    // Build metadata for tracking
    const metadata = {
      thompson_selection: selected,
      creativity_level: creativity,
      token_count: components.length,
      garment_type: selected.garment?.type || 'unknown',
      dominant_colors: selected.colors?.map(c => c.name) || [],
      fabric: selected.fabric?.material || 'unknown'
    };

    return {
      positive: positivePrompt,
      negative: negativePrompt,
      metadata
    };
  }

  /**
   * Aggregate preferences from descriptors
   */
  aggregatePreferences(descriptors) {
    const preferences = {
      garments: {},
      fabrics: {},
      colors: {},
      construction: {},
      photography: {},
      layers: {}
    };

    for (const desc of descriptors) {
      // Parse JSON fields
      const garments = this.safeParseJSON(desc.garment_details, []);
      const fabrics = this.safeParseJSON(desc.fabric_details, []);
      const colors = this.safeParseJSON(desc.color_details, []);
      const construction = this.safeParseJSON(desc.construction_details, []);
      const photography = this.safeParseJSON(desc.photography_details, {});

      // Aggregate garments
      for (const garment of garments) {
        const key = garment.type || garment.description;
        if (!preferences.garments[key]) {
          preferences.garments[key] = { count: 0, data: garment };
        }
        preferences.garments[key].count++;
      }

      // Aggregate fabrics
      for (const fabric of fabrics) {
        const key = fabric.material || fabric.type;
        if (!preferences.fabrics[key]) {
          preferences.fabrics[key] = { count: 0, data: fabric };
        }
        preferences.fabrics[key].count++;
      }

      // Aggregate colors
      for (const color of colors) {
        const key = color.name || color.hex;
        if (!preferences.colors[key]) {
          preferences.colors[key] = { count: 0, data: color };
        }
        preferences.colors[key].count++;
      }

      // Aggregate construction
      if (construction && construction.length > 0) {
        for (const detail of construction) {
          const key = typeof detail === 'string' ? detail : JSON.stringify(detail);
          if (!preferences.construction[key]) {
            preferences.construction[key] = { count: 0, data: detail };
          }
          preferences.construction[key].count++;
        }
      }

      // Aggregate photography
      if (photography && Object.keys(photography).length > 0) {
        const key = photography.shot_type || 'default';
        if (!preferences.photography[key]) {
          preferences.photography[key] = { count: 0, data: photography };
        }
        preferences.photography[key].count++;
      }
    }

    return preferences;
  }

  /**
   * Thompson Sampling selection
   */
  thompsonSample(preferences, thompsonParams, creativity) {
    const selected = {};

    // Decide: explore or exploit?
    const shouldExplore = Math.random() < creativity;

    // Sample garment
    selected.garment = this.sampleCategory(
      preferences.garments,
      thompsonParams.garments || {},
      shouldExplore
    );

    // Sample fabric
    selected.fabric = this.sampleCategory(
      preferences.fabrics,
      thompsonParams.fabrics || {},
      shouldExplore
    );

    // Sample colors (top 2-3)
    selected.colors = this.sampleMultiple(
      preferences.colors,
      thompsonParams.colors || {},
      shouldExplore,
      2
    );

    // Sample construction details (top 3-5)
    selected.construction = this.sampleMultiple(
      preferences.construction,
      thompsonParams.construction || {},
      shouldExplore,
      3
    );

    // Sample photography
    selected.photography = this.sampleCategory(
      preferences.photography,
      thompsonParams.photography || {},
      shouldExplore
    );

    return selected;
  }

  /**
   * Sample from a category using Thompson Sampling
   */
  sampleCategory(preferenceDict, thompsonDict, shouldExplore) {
    const items = Object.keys(preferenceDict);
    
    if (items.length === 0) return null;

    // Exploration: random selection
    if (shouldExplore) {
      const randomKey = items[Math.floor(Math.random() * items.length)];
      return preferenceDict[randomKey].data;
    }

    // Exploitation: Thompson Sampling
    let bestKey = null;
    let bestSample = -1;

    for (const key of items) {
      const params = thompsonDict[key] || { alpha: this.DEFAULT_ALPHA, beta: this.DEFAULT_BETA };
      const sample = this.betaSample(params.alpha, params.beta);
      
      if (sample > bestSample) {
        bestSample = sample;
        bestKey = key;
      }
    }

    return bestKey ? preferenceDict[bestKey].data : null;
  }

  /**
   * Sample multiple items from a category
   */
  sampleMultiple(preferenceDict, thompsonDict, shouldExplore, n = 2) {
    const items = Object.keys(preferenceDict);
    
    if (items.length === 0) return [];

    // Exploration: random selection
    if (shouldExplore) {
      const shuffled = items.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n).map(key => preferenceDict[key].data);
    }

    // Exploitation: Thompson Sampling for top N
    const samples = items.map(key => {
      const params = thompsonDict[key] || { alpha: this.DEFAULT_ALPHA, beta: this.DEFAULT_BETA };
      return {
        key,
        sample: this.betaSample(params.alpha, params.beta)
      };
    });

    samples.sort((a, b) => b.sample - a.sample);
    
    return samples.slice(0, n).map(s => preferenceDict[s.key].data);
  }

  /**
   * Beta distribution sampling (simplified)
   */
  betaSample(alpha, beta) {
    // Simplified: use mean + random variation
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
    const stdDev = Math.sqrt(variance);
    
    // Sample from normal approximation
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    const sample = mean + stdDev * z;
    return Math.max(0, Math.min(1, sample));
  }

  /**
   * Format token with weight for SD/Flux
   */
  formatToken(text, weight) {
    if (weight <= 1.0) {
      return text;
    }
    
    // Clamp weight
    weight = Math.max(this.MIN_WEIGHT, Math.min(this.MAX_WEIGHT, weight));
    
    // Format: (token:weight)
    return `(${text}:${weight.toFixed(1)})`;
  }

  /**
   * Build negative prompt
   */
  buildNegativePrompt(selected) {
    const negative = [this.DEFAULT_NEGATIVE_PROMPT];

    // Add user-specific negatives based on preferences
    // (can be extended based on what user dislikes)

    return negative.join(', ');
  }

  /**
   * Generate default prompt (fallback)
   */
  async generateDefaultPrompt(userId, options) {
    const garmentTypes = ['blazer', 'dress', 'coat', 'skirt', 'pants'];
    const colors = ['navy', 'black', 'white', 'beige', 'charcoal'];
    const fabrics = ['wool', 'cotton', 'silk', 'linen'];

    const garment = options.garmentType || garmentTypes[Math.floor(Math.random() * garmentTypes.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fabric = fabrics[Math.floor(Math.random() * fabrics.length)];

    const positive = [
      this.formatToken(`${garment}`, 1.3),
      this.formatToken(`${fabric}`, 1.2),
      this.formatToken(`${color}`, 1.3),
      this.formatToken('professional fashion photography', 1.3),
      this.formatToken('studio lighting', 1.1),
      'high detail',
      '8k',
      'sharp focus'
    ].join(', ');

    const promptRecord = await this.savePrompt(userId, {
      positive_prompt: positive,
      negative_prompt: this.DEFAULT_NEGATIVE_PROMPT,
      metadata: { default: true },
      creativity: options.creativity || 0.5
    });

    return {
      positive_prompt: positive,
      negative_prompt: this.DEFAULT_NEGATIVE_PROMPT,
      metadata: { default: true },
      prompt_id: promptRecord.id
    };
  }

  /**
   * Save prompt to database
   */
  async savePrompt(userId, data) {
    const query = `
      INSERT INTO prompts (
        user_id, 
        positive_prompt, 
        negative_prompt, 
        metadata, 
        creativity,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, created_at
    `;

    const result = await db.query(query, [
      userId,
      data.positive_prompt,
      data.negative_prompt,
      JSON.stringify(data.metadata),
      data.creativity
    ]);

    return result.rows[0];
  }

  /**
   * Get Thompson Sampling parameters
   */
  async getThompsonParams(userId) {
    const query = `
      SELECT category, attribute, alpha, beta
      FROM thompson_sampling_params
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);

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
   * Update Thompson parameters from feedback
   */
  async updateThompsonParamsFromFeedback(userId, promptId, feedback) {
    // Get the prompt
    const promptQuery = `SELECT metadata FROM prompts WHERE id = $1`;
    const promptResult = await db.query(promptQuery, [promptId]);
    
    if (promptResult.rows.length === 0) {
      logger.warn('Prompt not found for feedback update', { promptId });
      return;
    }

    const metadata = promptResult.rows[0].metadata;
    const selected = metadata.thompson_selection;

    if (!selected) {
      logger.warn('No thompson_selection in metadata', { promptId });
      return;
    }

    // Update alpha/beta based on feedback
    const success = feedback.liked || feedback.saved;

    // Update for each selected attribute
    for (const [category, value] of Object.entries(selected)) {
      if (!value) continue;

      let attributes = [];
      
      if (Array.isArray(value)) {
        attributes = value.map(v => this.extractAttributeKey(v));
      } else if (typeof value === 'object') {
        attributes = [this.extractAttributeKey(value)];
      } else {
        attributes = [String(value)];
      }

      for (const attr of attributes) {
        await this.updateThompsonParam(userId, category, attr, success);
      }
    }

    // Clear cache for this user
    this.clearCacheForUser(userId);

    logger.info('Thompson params updated', { userId, promptId, success });
  }

  /**
   * Extract attribute key from object
   */
  extractAttributeKey(obj) {
    if (typeof obj === 'string') return obj;
    return obj.type || obj.name || obj.material || obj.description || JSON.stringify(obj);
  }

  /**
   * Update single Thompson parameter
   */
  async updateThompsonParam(userId, category, attribute, success) {
    const query = `
      INSERT INTO thompson_sampling_params (user_id, category, attribute, alpha, beta)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, category, attribute)
      DO UPDATE SET
        alpha = thompson_sampling_params.alpha + $4,
        beta = thompson_sampling_params.beta + $5,
        updated_at = NOW()
    `;

    const alphaInc = success ? 1 : 0;
    const betaInc = success ? 0 : 1;

    await db.query(query, [userId, category, attribute, alphaInc, betaInc]);
  }

  /**
   * Cache helpers
   */
  getCacheKey(userId, garmentType, season, occasion) {
    return `${userId}:${garmentType || 'any'}:${season || 'any'}:${occasion || 'any'}`;
  }

  setCache(key, value) {
    // LRU eviction
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  clearCacheForUser(userId) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(userId + ':')) {
        this.cache.delete(key);
      }
    }
  }

  getCacheHitRate() {
    const total = this.cacheHits + this.cacheMisses;
    if (total === 0) return 0;
    return ((this.cacheHits / total) * 100).toFixed(1) + '%';
  }

  /**
   * Safe JSON parsing
   */
  safeParseJSON(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return defaultValue;
    }
  }
}

module.exports = new IntelligentPromptBuilder();
