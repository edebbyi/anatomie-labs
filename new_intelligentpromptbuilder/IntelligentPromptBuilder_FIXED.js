/**
 * Intelligent Prompt Builder - FIXED VERSION
 * 
 * FIXES:
 * 1. Correct prompt order: Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera
 * 2. Learns shot types from portfolio analysis
 * 3. Ensures front-facing poses by default
 * 4. Includes model/pose information in prompts
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
      'watermark', 'signature', 'text', 'logo',
      'back view', 'rear view', 'turned away' // ADDED: Avoid non-front-facing poses
    ].join(', ');
  }

  /**
   * Generate prompt using ultra-detailed data + Thompson Sampling
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
      query += ` AND primary_garment = $${paramIndex}`;
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
   * ORDER: Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera
   */
  async buildDetailedPrompt(descriptors, thompsonParams, creativity, options) {
    // Aggregate preferences from descriptors
    const preferences = this.aggregatePreferences(descriptors);

    // Sample attributes using Thompson Sampling
    const selected = this.thompsonSample(preferences, thompsonParams, creativity);

    // Build weighted prompt components in CORRECT ORDER
    const components = [];

    // 1. STYLE CONTEXT (from cluster mode if available)
    if (selected.styleContext) {
      components.push(this.formatToken(`in the user's signature '${selected.styleContext}' mode:`, 1.2));
    }

    // 2. PRIMARY GARMENT (highest weight)
    if (selected.garment) {
      // Build comprehensive garment description
      const garmentParts = [];
      
      // Silhouette first (if available)
      if (selected.garment.silhouette) {
        garmentParts.push(selected.garment.silhouette);
      }
      
      // Fit
      if (selected.garment.fit) {
        garmentParts.push(selected.garment.fit);
      }
      
      // Garment type
      garmentParts.push(selected.garment.type);
      
      const garmentDesc = garmentParts.join(', ');
      components.push(this.formatToken(garmentDesc, 1.3));
      
      // Add specific construction details
      if (selected.garment.details && selected.garment.details.length > 0) {
        for (const detail of selected.garment.details.slice(0, 2)) {
          components.push(this.formatToken(detail, 1.1));
        }
      }
    }

    // 3. FABRIC & MATERIAL (high weight)
    if (selected.fabric) {
      const fabricDesc = selected.fabric.finish 
        ? `in ${selected.fabric.material} fabric, with ${selected.fabric.finish} finish`
        : `in ${selected.fabric.material} fabric`;
      
      components.push(this.formatToken(fabricDesc, 1.2));
    }

    // 4. COLORS (very high weight - critical for fashion)
    if (selected.colors && selected.colors.length > 0) {
      const colorList = selected.colors.map(c => c.name).join(' and ');
      components.push(this.formatToken(`${colorList} palette`, 1.3));
    }

    // 5. MODEL & POSE (NEW - CRITICAL FOR SHOT CONSISTENCY)
    if (selected.pose) {
      // Shot type (learned from portfolio)
      const shotType = selected.pose.shot_type || 'three-quarter length shot';
      components.push(this.formatToken(shotType, 1.3));
      
      // Body position - ALWAYS front-facing unless user portfolio shows otherwise
      const bodyPosition = selected.pose.body_position || 'standing front-facing';
      components.push(this.formatToken(bodyPosition, 1.2));
      
      // Pose details
      if (selected.pose.pose_style) {
        components.push(this.formatToken(selected.pose.pose_style, 1.1));
      }
    } else {
      // DEFAULT: Always front-facing if no learned pose data
      components.push(this.formatToken('three-quarter length shot', 1.3));
      components.push(this.formatToken('model facing camera', 1.3));
      components.push(this.formatToken('front-facing pose', 1.2));
    }

    // 6. ACCESSORIES (if any)
    if (selected.accessories && selected.accessories.length > 0) {
      for (const accessory of selected.accessories.slice(0, 2)) {
        components.push(this.formatToken(accessory, 1.0));
      }
    }

    // 7. LIGHTING (medium-high weight)
    if (selected.photography && selected.photography.lighting) {
      const lightingDesc = selected.photography.lighting_direction 
        ? `${selected.photography.lighting} from ${selected.photography.lighting_direction}`
        : selected.photography.lighting;
      
      components.push(this.formatToken(lightingDesc, 1.1));
    } else {
      components.push(this.formatToken('soft lighting from front', 1.1));
    }

    // 8. CAMERA SPECS (medium weight)
    if (selected.photography) {
      // Camera angle - ALWAYS PREFER FRONT ANGLES
      let angle = selected.photography.angle || '3/4 front angle';
      
      // Override side/back angles to front
      if (angle.includes('side') || angle.includes('back') || angle.includes('profile')) {
        angle = '3/4 front angle';
        logger.info('Overriding non-front angle to 3/4 front', { originalAngle: selected.photography.angle });
      }
      
      components.push(this.formatToken(angle, 1.2));
      
      // Camera height
      const height = selected.photography.height || 'eye level';
      components.push(this.formatToken(`at ${height}`, 1.0));
      
      // Background
      if (selected.photography.background) {
        components.push(this.formatToken(`${selected.photography.background} background`, 1.0));
      } else {
        components.push(this.formatToken('clean studio background', 1.0));
      }
    } else {
      // DEFAULT camera settings - ALWAYS FRONT-FACING
      components.push(this.formatToken('3/4 front angle', 1.2));
      components.push(this.formatToken('at eye level', 1.0));
      components.push(this.formatToken('clean studio background', 1.0));
    }

    // 9. STYLE DESCRIPTOR (if from contextual analysis)
    if (selected.styleDescriptor) {
      components.push(this.formatToken(selected.styleDescriptor, 1.0));
    } else {
      components.push(this.formatToken('modern editorial style', 1.0));
    }

    // 10. QUALITY MARKERS (standard weight) - ALWAYS AT END
    components.push(this.formatToken('professional fashion photography', 1.3));
    components.push(this.formatToken('high detail', 1.2));
    components.push(this.formatToken('8k', 1.1));
    components.push(this.formatToken('sharp focus', 1.0));
    components.push(this.formatToken('studio quality', 1.0));

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
      fabric: selected.fabric?.material || 'unknown',
      shot_type: selected.pose?.shot_type || 'three-quarter length shot',
      camera_angle: selected.photography?.angle || '3/4 front angle',
      pose_enforced_front_facing: !selected.pose || selected.pose.body_position?.includes('front')
    };

    return {
      positive: positivePrompt,
      negative: negativePrompt,
      metadata
    };
  }

  /**
   * Aggregate preferences from descriptors - UPDATED TO INCLUDE POSE DATA
   */
  aggregatePreferences(descriptors) {
    const preferences = {
      garments: {},
      fabrics: {},
      colors: {},
      construction: {},
      photography: {},
      poses: {}, // NEW: Track poses
      accessories: {}, // NEW: Track accessories
      styleContext: {} // NEW: Track style contexts
    };

    for (const desc of descriptors) {
      // Parse JSON fields
      const garments = this.safeParseJSON(desc.garments, []);
      const photography = this.safeParseJSON(desc.photography, {});
      const stylingContext = this.safeParseJSON(desc.styling_context, {});
      const contextual = this.safeParseJSON(desc.contextual_attributes, {});
      
      // Extract fabric, color, and construction details from garments
      const fabrics = [];
      const colors = [];
      const construction = [];
      
      for (const garment of garments) {
        if (garment.fabric) {
          fabrics.push(garment.fabric);
        }
        
        if (garment.color_palette) {
          colors.push(...garment.color_palette);
        }
        
        if (garment.construction) {
          construction.push(garment.construction);
        }
      }

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
        const key = fabric.primary_material || fabric.material || fabric.type;
        if (!preferences.fabrics[key]) {
          preferences.fabrics[key] = { 
            count: 0, 
            data: {
              material: fabric.primary_material || fabric.material || fabric.type,
              finish: fabric.sheen || fabric.finish
            }
          };
        }
        preferences.fabrics[key].count++;
      }

      // Aggregate colors
      for (const color of colors) {
        const key = color.color_name || color.name || color.hex;
        if (!preferences.colors[key]) {
          preferences.colors[key] = { count: 0, data: { name: key } };
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

      // NEW: Aggregate poses from photography data
      if (photography && photography.pose) {
        const poseKey = this.generatePoseKey(photography);
        if (!preferences.poses[poseKey]) {
          preferences.poses[poseKey] = {
            count: 0,
            data: {
              shot_type: photography.shot_composition?.type || 'three-quarter length shot',
              body_position: this.determineFacingDirection(photography.pose),
              pose_style: this.describePoseStyle(photography.pose)
            }
          };
        }
        preferences.poses[poseKey].count++;
      }

      // NEW: Aggregate accessories
      if (stylingContext && stylingContext.accessories) {
        const accessories = stylingContext.accessories;
        for (const [category, items] of Object.entries(accessories)) {
          if (items && typeof items === 'string' && items !== 'none visible') {
            const key = `${category}: ${items}`;
            if (!preferences.accessories[key]) {
              preferences.accessories[key] = { count: 0, data: items };
            }
            preferences.accessories[key].count++;
          } else if (Array.isArray(items)) {
            for (const item of items) {
              const key = `${category}: ${item}`;
              if (!preferences.accessories[key]) {
                preferences.accessories[key] = { count: 0, data: item };
              }
              preferences.accessories[key].count++;
            }
          }
        }
      }

      // NEW: Aggregate photography settings
      if (photography) {
        const photoKey = this.generatePhotographyKey(photography);
        if (!preferences.photography[photoKey]) {
          preferences.photography[photoKey] = {
            count: 0,
            data: {
              lighting: photography.lighting?.type || 'soft lighting',
              lighting_direction: photography.lighting?.direction || 'front',
              angle: this.ensureFrontAngle(photography.camera_angle?.horizontal || '3/4 front angle'),
              height: photography.camera_angle?.vertical || 'eye level',
              background: photography.background?.type || 'minimal'
            }
          };
        }
        preferences.photography[photoKey].count++;
      }

      // NEW: Aggregate style context
      if (contextual && contextual.mood_aesthetic) {
        const styleKey = contextual.mood_aesthetic;
        if (!preferences.styleContext[styleKey]) {
          preferences.styleContext[styleKey] = { count: 0, data: styleKey };
        }
        preferences.styleContext[styleKey].count++;
      }
    }

    return preferences;
  }

  /**
   * NEW: Generate pose key for aggregation
   */
  generatePoseKey(photography) {
    const shotType = photography.shot_composition?.type || 'medium';
    const facing = this.determineFacingDirection(photography.pose);
    return `${shotType}_${facing}`;
  }

  /**
   * NEW: Determine if model is facing camera (front-facing)
   */
  determineFacingDirection(pose) {
    if (!pose) return 'front-facing';
    
    const gaze = pose.gaze?.toLowerCase() || '';
    const head = pose.head?.toLowerCase() || '';
    const bodyPos = pose.body_position?.toLowerCase() || '';
    
    // Check if model is facing camera
    if (gaze.includes('camera') || head.includes('straight') || bodyPos.includes('front')) {
      return 'front-facing';
    }
    
    // Check for side/profile poses (we want to avoid these)
    if (gaze.includes('away') || head.includes('turned') || bodyPos.includes('profile')) {
      return 'profile'; // Will be overridden to front-facing in prompt building
    }
    
    // Default to front-facing
    return 'front-facing';
  }

  /**
   * NEW: Describe pose style in brief terms
   */
  describePoseStyle(pose) {
    if (!pose) return 'confident pose';
    
    const bodyLanguage = pose.body_language?.toLowerCase() || '';
    const posture = pose.posture?.toLowerCase() || '';
    
    if (bodyLanguage.includes('confident')) return 'confident pose';
    if (bodyLanguage.includes('relaxed')) return 'relaxed pose';
    if (bodyLanguage.includes('dynamic')) return 'dynamic pose';
    if (posture.includes('upright')) return 'upright confident pose';
    
    return 'confident pose';
  }

  /**
   * NEW: Generate photography key for aggregation
   */
  generatePhotographyKey(photography) {
    const lighting = photography.lighting?.type || 'soft';
    const angle = photography.camera_angle?.horizontal || 'front';
    return `${lighting}_${angle}`;
  }

  /**
   * NEW: Ensure angle is front-facing
   */
  ensureFrontAngle(angle) {
    const angleLower = angle.toLowerCase();
    
    // If it's already a front angle, keep it
    if (angleLower.includes('front') || angleLower.includes('straight-on')) {
      return angle;
    }
    
    // Override side, back, or profile angles
    if (angleLower.includes('side') || angleLower.includes('back') || angleLower.includes('profile')) {
      logger.info('Converting non-front angle to 3/4 front', { originalAngle: angle });
      return '3/4 front angle';
    }
    
    // Default to 3/4 front
    return '3/4 front angle';
  }

  /**
   * Thompson Sampling selection - UPDATED TO INCLUDE POSE
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

    // NEW: Sample pose
    selected.pose = this.sampleCategory(
      preferences.poses,
      thompsonParams.poses || {},
      shouldExplore
    );

    // NEW: Sample accessories (top 1-2)
    selected.accessories = this.sampleMultiple(
      preferences.accessories,
      thompsonParams.accessories || {},
      shouldExplore,
      2
    );

    // Sample photography
    selected.photography = this.sampleCategory(
      preferences.photography,
      thompsonParams.photography || {},
      shouldExplore
    );

    // NEW: Sample style context
    selected.styleContext = this.sampleCategory(
      preferences.styleContext,
      thompsonParams.styleContext || {},
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
    if (weight < 1.0) {
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
    const garmentTypes = ['blazer', 'dress', 'coat', 'skirt', 'pants', 'outfit']; // Added 'outfit'
    const colors = ['navy', 'black', 'white', 'beige', 'charcoal'];
    const fabrics = ['wool', 'cotton', 'silk', 'linen'];

    const garment = options.garmentType || garmentTypes[Math.floor(Math.random() * garmentTypes.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const fabric = fabrics[Math.floor(Math.random() * fabrics.length)];

    const positive = [
      this.formatToken(`${garment}`, 1.3),
      this.formatToken(`${fabric}`, 1.2),
      this.formatToken(`${color}`, 1.3),
      this.formatToken('three-quarter length shot', 1.3),
      this.formatToken('model facing camera', 1.3),
      this.formatToken('front-facing pose', 1.2),
      this.formatToken('professional fashion photography', 1.3),
      this.formatToken('studio lighting', 1.1),
      this.formatToken('3/4 front angle', 1.2),
      this.formatToken('at eye level', 1.0),
      this.formatToken('clean studio background', 1.0),
      this.formatToken('high detail', 1.2),
      this.formatToken('8k', 1.1),
      this.formatToken('sharp focus', 1.0)
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
        text, 
        json_spec, 
        mode, 
        weights,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, created_at
    `;

    const result = await db.query(query, [
      userId,
      data.positive_prompt || data.text,
      JSON.stringify(data.metadata || {}),
      'intelligent',
      JSON.stringify({ creativity: data.creativity, ...data.weights })
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
