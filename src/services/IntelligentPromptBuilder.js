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
   * Build detailed prompt using Thompson Sampling + Brand DNA
   * ORDER: Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera
   * 
   * @param {Array} descriptors - Ultra-detailed descriptors
   * @param {Object} thompsonParams - Thompson Sampling parameters
   * @param {number} creativity - Creativity level (0-1)
   * @param {Object} options - Additional options including brandDNA
   * @returns {Object} { positive, negative, metadata }
   */
  async buildDetailedPrompt(descriptors, thompsonParams, creativity, options = {}) {
    const { brandDNA, enforceBrandDNA = true, brandDNAStrength = 0.8 } = options;
    
    // Aggregate preferences from descriptors
    const preferences = this.aggregatePreferences(descriptors);

    // Decide: explore or exploit?
    const shouldExplore = Math.random() < creativity;

    // Build components array
    const components = [];

    // 1. STYLE CONTEXT - Use brand DNA if available
    if (brandDNA && brandDNA.primaryAesthetic && enforceBrandDNA) {
      components.push(
        this.formatToken(`in the designer's signature '${brandDNA.primaryAesthetic}' aesthetic`, 1.3)
      );
    } else if (preferences.styleContext && Object.keys(preferences.styleContext).length > 0) {
      const selectedStyle = this.sampleCategory(
        preferences.styleContext,
        thompsonParams.styleContext || {},
        shouldExplore
      );
      if (selectedStyle) {
        components.push(this.formatToken(`${selectedStyle} style`, 1.2));
      }
    }

    // 2. PRIMARY GARMENT - With brand bias
    const garmentBias = brandDNA && enforceBrandDNA 
      ? brandDNA.primaryGarments.map(g => g.type)
      : [];
    
    const selectedGarment = this.thompsonSampleWithBias(
      preferences.garments,
      thompsonParams.garments || {},
      garmentBias,
      shouldExplore,
      brandDNAStrength + 0.5 // Stronger boost for garments
    );

    if (selectedGarment) {
      // Build comprehensive garment description
      const garmentParts = [];
      
      if (selectedGarment.silhouette) {
        garmentParts.push(selectedGarment.silhouette);
      }
      
      if (selectedGarment.fit) {
        garmentParts.push(selectedGarment.fit);
      }
      
      garmentParts.push(selectedGarment.type);
      
      const garmentDesc = garmentParts.join(', ');
      components.push(this.formatToken(garmentDesc, 1.3));
      
      // Add construction details if brand DNA has signature construction
      if (brandDNA && brandDNA.signatureConstruction && enforceBrandDNA) {
        const topConstruction = brandDNA.signatureConstruction.slice(0, 2);
        topConstruction.forEach(detail => {
          components.push(this.formatToken(detail.detail, 1.1));
        });
      } else if (selectedGarment.details && selectedGarment.details.length > 0) {
        selectedGarment.details.slice(0, 2).forEach(detail => {
          components.push(this.formatToken(detail, 1.1));
        });
      }
    }

    // 3. FABRIC & MATERIAL - With brand bias
    const fabricBias = brandDNA && enforceBrandDNA
      ? brandDNA.signatureFabrics.map(f => f.name)
      : [];
    
    const selectedFabric = this.thompsonSampleWithBias(
      preferences.fabrics,
      thompsonParams.fabrics || {},
      fabricBias,
      shouldExplore,
      brandDNAStrength
    );

    if (selectedFabric) {
      const fabricDesc = selectedFabric.finish 
        ? `in ${selectedFabric.material} fabric, with ${selectedFabric.finish} finish`
        : `in ${selectedFabric.material} fabric`;
      
      components.push(this.formatToken(fabricDesc, 1.2));
    }

    // 4. COLORS - Strong brand bias
    const colorBias = brandDNA && enforceBrandDNA
      ? brandDNA.signatureColors.map(c => c.name)
      : [];
    
    const selectedColors = this.thompsonSampleMultipleWithBias(
      preferences.colors,
      thompsonParams.colors || {},
      colorBias,
      shouldExplore,
      2,
      brandDNAStrength + 0.3 // Extra strong boost for colors
    );

    if (selectedColors && selectedColors.length > 0) {
      const colorList = selectedColors.map(c => c.name || c).join(' and ');
      components.push(this.formatToken(`${colorList} palette`, 1.3));
    }

    // 5. MODEL & POSE - Use brand DNA photography preferences
    let selectedPose = null;
    
    if (brandDNA && brandDNA.preferredShotTypes && brandDNA.preferredShotTypes.length > 0 && enforceBrandDNA) {
      // Use learned shot type
      const preferredShot = brandDNA.preferredShotTypes[0];
      components.push(this.formatToken(preferredShot.type, 1.3));
      
      // Use learned facing direction or default to front
      if (brandDNA.preferredAngles && brandDNA.preferredAngles.length > 0) {
        const preferredAngle = brandDNA.preferredAngles[0].angle;
        components.push(this.formatToken(preferredAngle, 1.2));
      } else {
        components.push(this.formatToken('model facing camera', 1.3));
      }
      
      // Add confident pose
      components.push(this.formatToken('confident pose', 1.1));
      
    } else {
      // DEFAULT: Always front-facing if no learned pose data
      components.push(this.formatToken('three-quarter length shot', 1.3));
      components.push(this.formatToken('model facing camera', 1.3));
      components.push(this.formatToken('front-facing pose', 1.2));
    }

    // 6. ACCESSORIES (if any)
    const selectedAccessories = this.sampleMultiple(
      preferences.accessories,
      thompsonParams.accessories || {},
      shouldExplore,
      2
    );
    
    if (selectedAccessories && selectedAccessories.length > 0) {
      selectedAccessories.forEach(acc => {
        components.push(this.formatToken(acc, 1.0));
      });
    }

    // 7. LIGHTING - Use brand DNA or defaults
    if (brandDNA && brandDNA.preferredLighting && brandDNA.preferredLighting.length > 0 && enforceBrandDNA) {
      const preferredLighting = brandDNA.preferredLighting[0];
      components.push(this.formatToken(`${preferredLighting.type} lighting`, 1.1));
    } else {
      components.push(this.formatToken('soft lighting from front', 1.1));
    }

    // 8. CAMERA SPECS
    components.push(this.formatToken('at eye level', 1.0));
    components.push(this.formatToken('clean studio background', 1.0));

    // 9. STYLE DESCRIPTOR
    components.push(this.formatToken('professional fashion photography', 1.3));

    // 10. QUALITY MARKERS (always at end)
    components.push(this.formatToken('high detail', 1.2));
    components.push(this.formatToken('8k', 1.1));
    components.push(this.formatToken('sharp focus', 1.0));
    components.push(this.formatToken('studio quality', 1.0));

    // Join all components
    const positivePrompt = components.join(', ');

    // Build negative prompt
    const negativePrompt = this.buildNegativePrompt({});

    // Calculate brand consistency
    const selected = {
      garment: selectedGarment,
      fabric: selectedFabric,
      colors: selectedColors,
      styleContext: brandDNA?.primaryAesthetic,
      pose: selectedPose,
      photography: {
        angle: brandDNA?.preferredAngles?.[0]?.angle
      }
    };
    
    const brandConsistencyScore = brandDNA && enforceBrandDNA
      ? this.calculateBrandConsistency(selected, brandDNA)
      : 0.5;

    // Build metadata
    const metadata = {
      thompson_selection: selected,
      creativity_level: creativity,
      token_count: components.length,
      brand_dna_applied: !!brandDNA && enforceBrandDNA,
      brand_consistency_score: brandConsistencyScore,
      brand_dna_strength: brandDNAStrength,
      garment_type: selectedGarment?.type || 'unknown',
      dominant_colors: selectedColors?.map(c => c.name || c) || [],
      fabric: selectedFabric?.material || 'unknown'
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

  /**
   * Extract Brand DNA from enhanced style profile
   * This creates a distilled representation of the designer's signature
   * 
   * @param {Object} styleProfile - Enhanced style profile from TrendAnalysisAgent
   * @returns {Object} Brand DNA object
   */
  extractBrandDNA(styleProfile) {
    if (!styleProfile) {
      logger.warn('No style profile provided for brand DNA extraction');
      return null;
    }

    try {
      // 1. PRIMARY AESTHETIC
      const primaryAesthetic = styleProfile.aesthetic_themes?.[0];
      const secondaryAesthetics = styleProfile.aesthetic_themes?.slice(1, 3) || [];

      // 2. SIGNATURE COLORS (top 3, weighted by distribution)
      const signatureColors = this.extractTopDistribution(
        styleProfile.color_distribution || {}, 
        3
      ).map(c => ({
        name: c.key,
        weight: c.value,
        hex: this.getColorHex(c.key) // Helper to estimate hex
      }));

      // 3. SIGNATURE FABRICS (top 3, with properties)
      const signatureFabrics = this.extractTopDistribution(
        styleProfile.fabric_distribution || {},
        3
      ).map(f => ({
        name: f.key,
        weight: f.value,
        properties: this.getFabricProperties(f.key) // Infer from common knowledge
      }));

      // 4. SIGNATURE CONSTRUCTION (top 5 recurring details)
      const signatureConstruction = (styleProfile.construction_patterns || [])
        .slice(0, 5)
        .map(c => ({
          detail: c.name,
          frequency: parseFloat(c.frequency.replace('%', '')) / 100
        }));

      // 5. PHOTOGRAPHY PREFERENCES (CRITICAL for shot consistency)
      const preferredShotTypes = this.extractShotTypePreferences(styleProfile);
      const preferredLighting = this.extractLightingPreferences(styleProfile);
      const preferredAngles = this.extractAnglePreferences(styleProfile);

      // 6. PRIMARY GARMENTS (top 5)
      const primaryGarments = this.extractTopDistribution(
        styleProfile.garment_distribution || {},
        5
      ).map(g => ({
        type: g.key,
        weight: g.value
      }));

      // 7. CONFIDENCE METRICS
      const aestheticConfidence = primaryAesthetic?.strength || 0.5;
      const overallConfidence = parseFloat(styleProfile.avg_confidence || 0.5);

      const brandDNA = {
        // Core Identity
        primaryAesthetic: primaryAesthetic?.name || 'contemporary',
        secondaryAesthetics: secondaryAesthetics.map(a => a.name),
        aestheticConfidence,

        // Visual Signatures
        signatureColors,
        signatureFabrics,
        signatureConstruction,

        // Photography DNA (learned from portfolio)
        preferredShotTypes,
        preferredLighting,
        preferredAngles,

        // Garment Preferences
        primaryGarments,

        // Metadata
        totalImages: styleProfile.total_images || 0,
        overallConfidence,
        lastUpdated: new Date().toISOString(),
        driftScore: 0 // Will be calculated separately
      };

      logger.info('Brand DNA extracted successfully', {
        primaryAesthetic: brandDNA.primaryAesthetic,
        colorCount: signatureColors.length,
        fabricCount: signatureFabrics.length,
        constructionCount: signatureConstruction.length,
        confidence: overallConfidence
      });

      return brandDNA;

    } catch (error) {
      logger.error('Failed to extract brand DNA', { error: error.message });
      return null;
    }
  }

  /**
   * Helper: Extract top N items from distribution object
   */
  extractTopDistribution(distribution, n = 3) {
    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, value]) => ({ key, value }));
  }

  /**
   * Helper: Extract shot type preferences from style profile
   */
  extractShotTypePreferences(styleProfile) {
    // Look in ultra-detailed descriptors for photography data
    const descriptors = styleProfile.signature_pieces || [];
    const shotTypeCounts = {};

    descriptors.forEach(desc => {
      const shotType = desc.photography?.shot_composition?.type;
      if (shotType) {
        shotTypeCounts[shotType] = (shotTypeCounts[shotType] || 0) + 1;
      }
    });

    const total = Object.values(shotTypeCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(shotTypeCounts)
      .map(([type, count]) => ({
        type,
        frequency: count / total
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);
  }

  /**
   * Helper: Extract lighting preferences
   */
  extractLightingPreferences(styleProfile) {
    const descriptors = styleProfile.signature_pieces || [];
    const lightingCounts = {};

    descriptors.forEach(desc => {
      const lighting = desc.photography?.lighting?.type;
      if (lighting) {
        lightingCounts[lighting] = (lightingCounts[lighting] || 0) + 1;
      }
    });

    const total = Object.values(lightingCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(lightingCounts)
      .map(([type, count]) => ({
        type,
        frequency: count / total
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);
  }

  /**
   * Helper: Extract camera angle preferences
   */
  extractAnglePreferences(styleProfile) {
    const descriptors = styleProfile.signature_pieces || [];
    const angleCounts = {};

    descriptors.forEach(desc => {
      const angle = desc.photography?.camera_angle?.horizontal;
      if (angle) {
        angleCounts[angle] = (angleCounts[angle] || 0) + 1;
      }
    });

    const total = Object.values(angleCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(angleCounts)
      .map(([angle, count]) => ({
        angle,
        frequency: count / total
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3);
  }

  /**
   * Helper: Get estimated hex for common color names
   */
  getColorHex(colorName) {
    const colorMap = {
      'navy': '#1a2b4c',
      'black': '#000000',
      'white': '#ffffff',
      'beige': '#f5f5dc',
      'camel': '#c19a6b',
      'gray': '#808080',
      'charcoal': '#36454f',
      'cream': '#fffdd0',
      'brown': '#964b00',
      'burgundy': '#800020'
    };
    
    return colorMap[colorName.toLowerCase()] || '#808080';
  }

  /**
   * Helper: Get common fabric properties
   */
  getFabricProperties(fabricName) {
    const fabricMap = {
      'wool': { texture: 'smooth', drape: 'structured', weight: 'medium' },
      'cotton': { texture: 'crisp', drape: 'structured', weight: 'light' },
      'silk': { texture: 'smooth', drape: 'fluid', weight: 'light' },
      'linen': { texture: 'textured', drape: 'relaxed', weight: 'light' },
      'cashmere': { texture: 'soft', drape: 'fluid', weight: 'light' },
      'denim': { texture: 'rough', drape: 'stiff', weight: 'heavy' }
    };
    
    return fabricMap[fabricName.toLowerCase()] || { 
      texture: 'smooth', 
      drape: 'structured', 
      weight: 'medium' 
    };
  }

  /**
   * Get enhanced style profile for a user
   * This includes all the rich data needed for brand DNA
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Enhanced style profile
   */
  async getEnhancedStyleProfile(userId) {
    try {
      // Get the style profile with all enrichments
      const query = `
        SELECT 
          sp.*,
          (
            SELECT json_agg(
              json_build_object(
                'image_id', udd.image_id,
                'description', udd.executive_summary->>'one_sentence_description',
                'standout_detail', udd.executive_summary->>'standout_detail',
                'photography', udd.photography,
                'garment_type', (udd.garments->0->>'type'),
                'confidence', udd.overall_confidence
              )
            )
            FROM ultra_detailed_descriptors udd
            WHERE udd.user_id = sp.user_id
              AND udd.overall_confidence > 0.75
            ORDER BY udd.overall_confidence DESC
            LIMIT 10
          ) as signature_pieces
        FROM style_profiles sp
        WHERE sp.user_id = $1
      `;

      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        logger.warn('No style profile found for user', { userId });
        return null;
      }

      const profile = result.rows[0];
      
      // Parse JSON fields
      return {
        ...profile,
        garment_distribution: this.safeParseJSON(profile.garment_distribution, {}),
        color_distribution: this.safeParseJSON(profile.color_distribution, {}),
        fabric_distribution: this.safeParseJSON(profile.fabric_distribution, {}),
        silhouette_distribution: this.safeParseJSON(profile.silhouette_distribution, {}),
        aesthetic_themes: this.safeParseJSON(profile.aesthetic_themes, []),
        construction_patterns: this.safeParseJSON(profile.construction_patterns, []),
        signature_pieces: profile.signature_pieces || []
      };

    } catch (error) {
      logger.error('Failed to get enhanced style profile', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Calculate how consistent a generated prompt/image is with brand DNA
   * 
   * @param {Object} selected - Thompson sampled selections
   * @param {Object} brandDNA - Extracted brand DNA
   * @returns {number} Consistency score 0-1
   */
  calculateBrandConsistency(selected, brandDNA) {
    if (!brandDNA) return 0.5; // Neutral if no brand DNA

    let score = 0;
    let maxScore = 0;

    // 1. AESTHETIC MATCH (weight: 25%)
    maxScore += 25;
    if (selected.styleContext === brandDNA.primaryAesthetic) {
      score += 25;
    } else if (brandDNA.secondaryAesthetics.includes(selected.styleContext)) {
      score += 15;
    }

    // 2. COLOR MATCH (weight: 25%)
    maxScore += 25;
    if (selected.colors && selected.colors.length > 0) {
      const brandColors = brandDNA.signatureColors.map(c => c.name);
      const matchedColors = selected.colors.filter(c => 
        brandColors.includes(c.name)
      );
      score += (matchedColors.length / selected.colors.length) * 25;
    }

    // 3. FABRIC MATCH (weight: 15%)
    maxScore += 15;
    if (selected.fabric) {
      const brandFabrics = brandDNA.signatureFabrics.map(f => f.name);
      if (brandFabrics.includes(selected.fabric.material)) {
        score += 15;
      }
    }

    // 4. CONSTRUCTION MATCH (weight: 15%)
    maxScore += 15;
    if (selected.construction && selected.construction.length > 0) {
      const brandConstruction = brandDNA.signatureConstruction.map(c => c.detail);
      const matchedDetails = selected.construction.filter(c =>
        brandConstruction.some(bc => c.includes(bc) || bc.includes(c))
      );
      score += (matchedDetails.length / selected.construction.length) * 15;
    }

    // 5. PHOTOGRAPHY MATCH (weight: 20%)
    maxScore += 20;
    if (selected.pose && brandDNA.preferredShotTypes.length > 0) {
      const preferredShot = brandDNA.preferredShotTypes[0].type;
      if (selected.pose.shot_type === preferredShot) {
        score += 10;
      }
    }
    if (selected.photography && brandDNA.preferredAngles.length > 0) {
      const preferredAngle = brandDNA.preferredAngles[0].angle;
      if (selected.photography.angle === preferredAngle) {
        score += 10;
      }
    }

    const finalScore = maxScore > 0 ? score / maxScore : 0.5;
    
    logger.debug('Brand consistency calculated', {
      score: finalScore.toFixed(2),
      components: {
        aesthetic: selected.styleContext === brandDNA.primaryAesthetic,
        colorMatch: selected.colors?.length || 0,
        fabricMatch: !!selected.fabric,
        constructionMatch: selected.construction?.length || 0
      }
    });

    return finalScore;
  }

  /**
   * Thompson Sampling with brand DNA bias
   * Boosts selection probability for brand-aligned attributes
   * 
   * @param {Object} preferenceDict - Attribute preferences
   * @param {Object} thompsonDict - Thompson parameters
   * @param {Array} brandPreferences - Brand DNA preferred attributes
   * @param {boolean} shouldExplore - Exploration flag
   * @param {number} brandBoost - Multiplier for brand attributes (default: 1.5)
   * @returns {Object} Selected attribute
   */
  thompsonSampleWithBias(
    preferenceDict, 
    thompsonDict, 
    brandPreferences = [], 
    shouldExplore = false,
    brandBoost = 1.5
  ) {
    const items = Object.keys(preferenceDict);
    
    if (items.length === 0) return null;

    // Exploration: still random, but prefer brand attributes
    if (shouldExplore) {
      // Weight random selection toward brand preferences
      const weights = items.map(key => {
        const isBrand = brandPreferences.includes(key);
        return isBrand ? brandBoost : 1.0;
      });
      
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      let random = Math.random() * totalWeight;
      
      for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          return preferenceDict[items[i]].data;
        }
      }
      
      return preferenceDict[items[0]].data;
    }

    // Exploitation: Thompson Sampling with brand boost
    let bestKey = null;
    let bestSample = -1;

    for (const key of items) {
      const params = thompsonDict[key] || { 
        alpha: this.DEFAULT_ALPHA, 
        beta: this.DEFAULT_BETA 
      };
      
      let sample = this.betaSample(params.alpha, params.beta);
      
      // Apply brand boost if this is a brand preference
      if (brandPreferences.includes(key)) {
        sample *= brandBoost;
        logger.debug('Applied brand boost', { attribute: key, boost: brandBoost });
      }
      
      if (sample > bestSample) {
        bestSample = sample;
        bestKey = key;
      }
    }

    return bestKey ? preferenceDict[bestKey].data : null;
  }

  /**
   * Thompson Sample Multiple with Brand Bias
   */
  thompsonSampleMultipleWithBias(
    preferenceDict, 
    thompsonDict, 
    brandPreferences = [], 
    shouldExplore = false,
    n = 2,
    brandBoost = 1.5
  ) {
    const items = Object.keys(preferenceDict);
    
    if (items.length === 0) return [];

    // Exploration: random selection with brand preference
    if (shouldExplore) {
      const weights = items.map(key => {
        const isBrand = brandPreferences.includes(key);
        return isBrand ? brandBoost : 1.0;
      });
      
      // Weighted random sampling without replacement
      const selected = [];
      const availableItems = [...items];
      const availableWeights = [...weights];
      
      for (let i = 0; i < Math.min(n, items.length); i++) {
        const totalWeight = availableWeights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;
        
        for (let j = 0; j < availableItems.length; j++) {
          random -= availableWeights[j];
          if (random <= 0) {
            selected.push(preferenceDict[availableItems[j]].data);
            availableItems.splice(j, 1);
            availableWeights.splice(j, 1);
            break;
          }
        }
      }
      
      return selected;
    }

    // Exploitation: Thompson Sampling with brand boost
    const samples = items.map(key => {
      const params = thompsonDict[key] || { 
        alpha: this.DEFAULT_ALPHA, 
        beta: this.DEFAULT_BETA 
      };
      
      let sample = this.betaSample(params.alpha, params.beta);
      
      // Apply brand boost
      if (brandPreferences.includes(key)) {
        sample *= brandBoost;
      }
      
      return { key, sample };
    });

    samples.sort((a, b) => b.sample - a.sample);
    
    return samples.slice(0, n).map(s => preferenceDict[s.key].data);
  }
}

module.exports = new IntelligentPromptBuilder();
