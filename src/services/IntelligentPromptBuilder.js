/**
 * Intelligent Prompt Builder - FIXED VERSION
 *
 * FIXES:
 * 1. Correct prompt order: Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera
 * 2. Learns shot types from portfolio analysis
 * 3. Ensures front-facing poses by default
 * 4. Includes model/pose information in prompts
 * 5. Includes model gender weighting based on designer preferences
 */

const db = require('./database');
const logger = require('../utils/logger');
const modelGenderService = require('./modelGenderDetectionService');

const STYLE_CLUSTER_CATALOG = [
  'contemporary',
  'minimalist',
  'sporty-chic',
  'tailored luxury',
  'urban luxe',
  'modern romantic',
  'classic',
  'bohemian',
  'avant-garde',
  'futuristic',
  'resort-ready',
  'editorial glam',
  'streetwear',
  'luxury athleisure',
  'elevated basics'
];

const GARMENT_CANONICALS = {
  'bomber': { type: 'bomber jacket', defaultMaterial: 'technical nylon' },
  'bomber jacket': { type: 'bomber jacket', defaultMaterial: 'technical nylon' },
  'ma-1': { type: 'bomber jacket', defaultMaterial: 'technical nylon' },
  'flight jacket': { type: 'bomber jacket', defaultMaterial: 'technical nylon' },
  'puffer': { type: 'puffer jacket', defaultMaterial: 'technical nylon' },
  'puffer jacket': { type: 'puffer jacket', defaultMaterial: 'technical nylon' },
  'jacket': { type: 'jacket', defaultMaterial: null },
  'coat': { type: 'coat', defaultMaterial: null },
  'blazer': { type: 'blazer', defaultMaterial: 'structured wool' }
};

const DETAIL_PRIORITY_ORDER = [
  { category: 'silhouette', weight: 1.3 },
  { category: 'sleeves', weight: 1.2 },
  { category: 'closure', weight: 1.2 },
  { category: 'pockets', weight: 1.1 },
  { category: 'hardware', weight: 1.1 }
];

const WARM_RED_NEGATIVE_TERMS = [
  'red garments',
  'vivid crimson clothing',
  'warm burgundy accents',
  'deep maroon tones',
  'bright scarlet fabrics',
  'rust colored garments'
];
const DETAIL_KEYWORDS = {
  silhouette: ['silhouette', 'fit', 'shape', 'oversized', 'cropped', 'boxy', 'tailored', 'relaxed', 'fitted', 'structured'],
  sleeves: ['sleeve', 'raglan', 'drop-shoulder', 'drop shoulder', 'cuffed sleeve', 'rolled sleeve', 'bishop sleeve'],
  closure: ['zip', 'zipper', 'two-way zipper', 'double zip', 'snap', 'button', 'lapel', 'notch lapel', 'ribbed collar'],
  pockets: ['pocket', 'welt', 'flap', 'slant pocket', 'zip pocket', 'zip pockets', 'ribbed hem', 'hem'],
  hardware: ['hardware', 'stitching', 'tonal stitching', 'matte', 'matte hardware', 'polished', 'metal']
};

const BOMBER_DETAIL_DEFAULTS = ['ribbed collar', 'ribbed hem', 'zip pockets'];
const TAILORED_DETAIL_DEFAULTS = ['structured shoulders', 'notch lapel', 'welt pockets'];

class IntelligentPromptBuilder {
  constructor() {
    // Thompson Sampling defaults
    this.DEFAULT_ALPHA = 2;
    this.DEFAULT_BETA = 2;

    // Creativity threshold
    this.CREATIVITY_THRESHOLD = 0.5;

    // Weight bounds for tokenization
    this.MIN_WEIGHT = 0.8;
    this.MAX_WEIGHT = 2.0;

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
    const startTime = Date.now();

    // NEW: If parsed user prompt is provided, merge it with options
    if (options.parsedUserPrompt) {
      logger.info('Using parsed user prompt', {
        userId,
        garmentType: options.parsedUserPrompt.garmentType,
        specificity: options.parsedUserPrompt.specificity,
        modifierCount: options.parsedUserPrompt.userModifiers?.length || 0
      });

      // Override options with parsed prompt attributes
      if (options.parsedUserPrompt.garmentType && !options.garmentType) {
        options.garmentType = options.parsedUserPrompt.garmentType;
      }
      if (options.parsedUserPrompt.occasion && !options.occasion) {
        options.occasion = options.parsedUserPrompt.occasion;
      }

      // Merge user modifiers
      const mergedModifiers = [
        ...(options.parsedUserPrompt.userModifiers || []),
        ...(options.userModifiers || [])
      ];
      options.userModifiers = [...new Set(mergedModifiers)]; // Remove duplicates

      // Set respect user intent based on specificity
      if (options.parsedUserPrompt.specificity === 'high') {
        options.respectUserIntent = true;
      } else if (options.parsedUserPrompt.specificity === 'low') {
        // Low specificity = high creativity, strong brand DNA
        options.respectUserIntent = false;
        options.enforceBrandDNA = true;
      }
    }

    // Destructure options AFTER modifying them
    const {
      garmentType = null,
      season = null,
      occasion = null,
      creativity = 0.3,
      useCache = true,
      userModifiers = [],
      respectUserIntent = false,
      parsedUserPrompt = null,  // ADDED: Full interpretation from promptEnhancementService
      brandDNA = null,          // ADDED: Can pass brand DNA directly
      enforceBrandDNA = false,  // ADDED: Force brand DNA application
      brandDNAStrength = 0.7,   // ADDED: How strongly to apply brand DNA
      styleProfile: stylePreferences = null // ADDED: Enhanced style profile preferences
    } = options;

    // Generate cache key
    const cacheKey = this.getCacheKey(userId, garmentType, season, occasion);

    // Check cache (skip if using parsed prompt for uniqueness)
    if (useCache && !parsedUserPrompt && this.cache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.cache.get(cacheKey);
      logger.info('Prompt cache HIT', { cacheKey, hitRate: this.getCacheHitRate() });
      return cached;
    }

    this.cacheMisses++;

    // Get ultra-detailed descriptors for this user
    const descriptors = await this.getUltraDetailedDescriptors(userId, {
      garmentType: options.garmentType || garmentType,
      season,
      occasion: options.occasion || occasion
    });

    if (!descriptors || descriptors.length === 0) {
      logger.warn('No ultra-detailed descriptors found', { userId });
      return this.generateDefaultPrompt(userId, options);
    }

    // Get Thompson Sampling parameters
    const thompsonParams = await this.getThompsonParams(userId);

    // Build prompt using Thompson Sampling + ultra-detailed data
    const { positive, negative, metadata } = await this.buildDetailedPrompt(
      userId,
      descriptors,
      thompsonParams,
      creativity,
      {
        ...options,
        userModifiers: options.userModifiers || userModifiers,
        respectUserIntent: options.respectUserIntent !== undefined ? options.respectUserIntent : respectUserIntent,
        parsedUserPrompt,
        brandDNA,
        enforceBrandDNA,
        brandDNAStrength
      }
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

    // Cache the result (skip if using parsed prompt)
    if (useCache && !parsedUserPrompt) {
      this.setCache(cacheKey, result);
    }

    logger.info('Prompt generated', {
      userId,
      promptId: promptRecord.id,
      tokenCount: positive.split(',').length,
      cached: false,
      timeMs: result.generation_time_ms,
      usedParsedPrompt: !!parsedUserPrompt
    });

    return result;
  }

  /**
   * Get ultra-detailed descriptors with proper filtering
   */
  async getUltraDetailedDescriptors(userId, filters = {}) {
    const params = [];
    let paramIndex = 1;

    // Base query pulls highest confidence descriptors first; 1=1 keeps AND clauses simple
    let query = `
      SELECT *
      FROM ultra_detailed_descriptors
      WHERE 1=1
    `;

    if (this.isValidUUID(userId)) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (filters.garmentType) {
      query += ` AND (garments->0->>'type') ILIKE '%' || $${paramIndex} || '%'`;
      params.push(filters.garmentType);
      paramIndex++;
    }

    if (filters.season) {
      query += ` AND COALESCE(contextual_attributes->>'season', '') ILIKE '%' || $${paramIndex} || '%'`;
      params.push(filters.season);
      paramIndex++;
    }

    if (filters.occasion) {
      query += ` AND COALESCE(contextual_attributes->>'occasion', '') ILIKE '%' || $${paramIndex} || '%'`;
      params.push(filters.occasion);
      paramIndex++;
    }

    query += ` 
      ORDER BY overall_confidence DESC NULLS LAST, created_at DESC 
      LIMIT 50
    `;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Build detailed prompt using Thompson Sampling
   * ORDER: Style → Garment → Color → Model/Pose → Model Gender → Accessories → Lighting → Camera
   */
  async buildDetailedPrompt(userId, descriptors, thompsonParams, creativity, options) {
    const {
      userModifiers = [],
      respectUserIntent = false,
      parsedUserPrompt = null,  // ADDED
      brandDNA = null,          // ADDED
      enforceBrandDNA = false,  // ADDED
      brandDNAStrength = 0.7,   // ADDED
      generationIndex = 0,      // ADDED: For model gender alternation
      enablePrecisionTokens = true, // ADDED: Allow callers to disable literal interpretation tokens
      styleProfile: stylePreferences = null
    } = options;

    // NEW: If parsed prompt has specific attributes, prioritize them
    let userSpecifiedColors = [];
    let userSpecifiedFabrics = [];
    let userSpecifiedGarment = null;

    if (parsedUserPrompt) {
      userSpecifiedColors = parsedUserPrompt.colors || [];
      userSpecifiedFabrics = parsedUserPrompt.fabrics || [];
      userSpecifiedGarment = parsedUserPrompt.garmentType;

      logger.info('Applying parsed user prompt attributes', {
        colors: userSpecifiedColors.length,
        fabrics: userSpecifiedFabrics.length,
        garment: !!userSpecifiedGarment
      });
    }

    // Aggregate preferences from descriptors
    const preferences = this.aggregatePreferences(descriptors);

    if (stylePreferences) {
      this.applyStyleProfilePreferences(preferences, stylePreferences);
    }
    const primaryStyleCluster = this.getTopStyleCluster(preferences.styleContext);
    const styleDistribution = this.buildStyleContextDistribution(preferences.styleContext);

    // Sample attributes using Thompson Sampling (with brand DNA bias if enabled)
    const selected = this.thompsonSample(preferences, thompsonParams, creativity, {
      brandDNA,
      enforceBrandDNA,
      brandDNAStrength,
      userSpecifiedGarment,
      userSpecifiedColors,
      userSpecifiedFabrics
    });

    this.applyGarmentDefaults(selected, parsedUserPrompt, { userSpecifiedFabrics });
    this.ensureFabricSelection(selected, parsedUserPrompt, brandDNA);
    const colorContext = this.resolvePrimaryColorContext(parsedUserPrompt, selected);

    // Build weighted prompt components in CORRECT ORDER
    const literalDescriptors = this.pickLiteralDescriptors(parsedUserPrompt);
    const literalDescriptorSet = new Set(
      literalDescriptors.map(desc => desc.toLowerCase())
    );

    // 1. AESTHETIC THEME (highest priority - sets the tone)
    const aestheticToken = this.resolveAestheticToken(
      parsedUserPrompt,
      selected.styleContext,
      literalDescriptors,
      brandDNA,
      primaryStyleCluster,
      styleDistribution,
      stylePreferences
    );
    const sections = {
      style: [],
      garment: [],
      model: [],
      framing: [],
      lighting: [],
      quality: []
    };

    if (aestheticToken?.text) {
      sections.style.push(this.formatToken(aestheticToken.text, aestheticToken.weight));
    }

    const garmentToken = this.buildPrimaryGarmentToken(
      selected,
      parsedUserPrompt
    );
    if (garmentToken) {
      sections.garment.push(garmentToken);
    }

    const detailTokens = this.collectDesignDetailTokens(selected, parsedUserPrompt).slice(0, 4);
    if (detailTokens.length > 0) {
      sections.garment.push(...detailTokens);
    }

    if (selected.accessories && selected.accessories.length > 0) {
      const topAccessory = selected.accessories[0];
      if (topAccessory) {
        sections.garment.push(this.formatToken(topAccessory, 1.0));
      }
    }

    if (!this.hasExplicitColor(parsedUserPrompt, selected)) {
      sections.garment.push(this.formatToken('neutral palette', 1.1));
    }

    let modelGenderElement = null;
    try {
      modelGenderElement = await modelGenderService.getModelGenderPromptElement(
        userId,
        generationIndex,
        true
      );

      if (modelGenderElement?.promptElement) {
        logger.info('Evaluated model gender preference for prompt', {
          userId,
          gender: modelGenderElement.gender,
          setting: modelGenderElement.setting,
          confidence: modelGenderElement.confidence
        });
      }
    } catch (error) {
      logger.warn('Failed to evaluate model gender element for prompt', {
        userId,
        error: error.message
      });
    }

    const modelDescriptor = this.resolveModelDescriptor(modelGenderElement);
    if (modelDescriptor) {
      sections.model.push(this.formatToken(modelDescriptor, 1.3));
    }

    sections.framing.push(
      this.formatToken('full-body shot', 1.8),
      this.formatToken('standing pose', 1.6),
      this.formatToken('straight-on, facing camera', 1.3)
    );

    sections.lighting.push(
      this.formatToken('modern editorial style', 1.1),
      this.formatToken('neutral background', 1.1),
      this.formatToken('soft frontal key light', 1.2)
    );

    sections.quality.push(this.formatToken('sharp focus', 1.1));

    const components = [
      ...sections.style,
      ...sections.garment,
      ...sections.model,
      ...sections.framing,
      ...sections.lighting,
      ...sections.quality
    ];

    // ========== NEW: APPLY USER MODIFIERS WITH WEIGHTING ==========
    // If user gave specific command (high specificity), weight their terms more heavily
    const userModifierWeight = respectUserIntent ? 2.0 : 1.0;

    // Apply user modifiers
    if (userModifiers.length > 0) {
      // Remove any empty or duplicate modifiers
      const cleanedModifiers = [...new Set(
        userModifiers
          .filter(m => m && m.trim().length > 0)
          .filter(m => {
            if (literalDescriptorSet.size === 0) return true;
            return !literalDescriptorSet.has(m.toLowerCase());
          })
      )];

      if (respectUserIntent) {
        // HIGH SPECIFICITY: Strong weighting on user terms
        logger.info('Applying user modifiers with high weighting', {
          weight: userModifierWeight,
          modifiers: cleanedModifiers
        });

        const weightedModifiers = cleanedModifiers.map(modifier =>
          this.formatToken(modifier, userModifierWeight)
        );
        components.push(...weightedModifiers);

      } else {
        // LOW SPECIFICITY: Normal weighting, more creative freedom
        logger.info('Applying user modifiers with standard weighting', {
          modifiers: cleanedModifiers
        });

        const weightedModifiers = cleanedModifiers.map(modifier =>
          this.formatToken(modifier, 1.0)
        );
        components.push(...weightedModifiers);
      }
    }
    // ===================================================================

    // ========== NEW: ADD VARIATION INSTRUCTIONS ==========
    // Guide the AI on how creative vs literal to be
    const hasLiteralIntent = respectUserIntent || (parsedUserPrompt?.userModifiers?.length > 0);

    if (creativity >= 1.0) {
      components.push(this.formatToken('explore creative variations', 0.9));
      components.push(this.formatToken('interpret broadly', 0.8));
      components.push(this.formatToken('diverse interpretations', 0.8));
      logger.debug('Added high variation instructions');

    } else if (creativity >= 0.6) {
      components.push(this.formatToken('balanced interpretation', 0.9));
      components.push(this.formatToken('some creative freedom', 0.8));
      logger.debug('Added medium variation instructions');

    } else if (creativity <= 0.5 && !hasLiteralIntent && enablePrecisionTokens) {
      components.push(this.formatToken('precise execution', 1.2));
      components.push(this.formatToken('literal interpretation', 1.1));
      components.push(this.formatToken('exact specifications', 1.0));
      logger.debug('Added low variation instructions');
    }
    // ====================================================

    // 10. QUALITY MARKERS (standard weight) - ALWAYS AT END
    this.enforcePromptRules(components, { parsedUserPrompt, selected, colorContext });
    this.dedupeTokens(components);

    // Join all components
    const positivePrompt = components.join(', ');

    // Build negative prompt (user preferences + defaults)
    const negativePrompt = this.buildNegativePrompt(selected, { colorContext, parsedUserPrompt });

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
      pose_enforced_front_facing: !selected.pose || selected.pose.body_position?.includes('front'),
      user_modifiers: userModifiers,              // ADD THIS
      respect_user_intent: respectUserIntent,     // ADD THIS
      model_gender_applied: !!modelGenderElement, // ADD THIS: Track that model gender was applied
      model_gender_token: modelGenderElement?.promptElement || null,
      generation_index: generationIndex,           // ADD THIS: For batch tracking
      aesthetic_cluster: aestheticToken?.text || 'contemporary style',
      primary_color: colorContext?.color || null,
      color_source: colorContext?.source || null
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
        // VALIDATION: Ensure angle is front-facing before storing
        const validatedAngle = this.ensureFrontAngle(photography.camera_angle?.horizontal || '3/4 front angle');
        
        if (!preferences.photography[photoKey]) {
          preferences.photography[photoKey] = {
            count: 0,
            data: {
              lighting: photography.lighting?.type || 'soft lighting',
              lighting_direction: photography.lighting?.direction || 'front',
              angle: validatedAngle,
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

  applyStyleProfilePreferences(preferences = {}, stylePreferences = {}) {
    if (!preferences || !stylePreferences) {
      return;
    }

    // Ensure expected maps exist even if descriptors array was empty
    preferences.garments = preferences.garments || {};
    preferences.fabrics = preferences.fabrics || {};
    preferences.colors = preferences.colors || {};
    preferences.construction = preferences.construction || {};
    preferences.photography = preferences.photography || {};
    preferences.styleContext = preferences.styleContext || {};

    const primarySilhouette = Array.isArray(stylePreferences.silhouettePreferences)
      && stylePreferences.silhouettePreferences.length > 0
      ? this.normalizeCandidateValue(stylePreferences.silhouettePreferences[0].name)
      : null;

    const bumpCount = (collection, key, data, weight = 1) => {
      if (!collection || !key) return;
      if (!collection[key]) {
        collection[key] = {
          count: 0,
          data: data !== undefined ? data : null
        };
      }
      if (collection[key].data == null && data !== undefined) {
        collection[key].data = data;
      }
      const normalizedWeight = this.normalizeWeight(weight, 1);
      collection[key].count += normalizedWeight;
    };

    if (Array.isArray(stylePreferences.aestheticThemes)) {
      stylePreferences.aestheticThemes.forEach(theme => {
        const name = this.normalizeCandidateValue(theme?.name);
        if (!name) return;
        const key = name.toLowerCase();
        bumpCount(preferences.styleContext, key, name, theme?.weight ?? theme?.strength ?? theme?.count ?? 1);
      });
    }

    if (stylePreferences.primaryAesthetic) {
      const primary = this.normalizeCandidateValue(stylePreferences.primaryAesthetic);
      if (primary) {
        bumpCount(preferences.styleContext, primary.toLowerCase(), primary, 1.5);
      }
    }

    if (Array.isArray(stylePreferences.colors)) {
      stylePreferences.colors.forEach(color => {
        const name = this.normalizeCandidateValue(color?.name);
        if (!name) return;
        const key = name.toLowerCase();
        const data = {
          name,
          source: color?.source || 'style-profile',
          hex: color?.hex || this.getColorHex(name)
        };
        bumpCount(preferences.colors, key, data, color?.weight);
      });
    }

    if (Array.isArray(stylePreferences.fabrics)) {
      stylePreferences.fabrics.forEach(fabric => {
        const material = this.normalizeCandidateValue(fabric?.name || fabric?.material);
        if (!material) return;
        const key = material.toLowerCase();
        const data = {
          material,
          finish: fabric?.finish || fabric?.properties?.texture || null
        };
        bumpCount(preferences.fabrics, key, data, fabric?.weight);
      });
    }

    if (Array.isArray(stylePreferences.constructionDetails)) {
      stylePreferences.constructionDetails.forEach(detail => {
        const descriptor = this.normalizeCandidateValue(detail?.name || detail?.detail || detail);
        if (!descriptor) return;
        const key = descriptor.toLowerCase();
        bumpCount(preferences.construction, key, descriptor, detail?.weight);
      });
    }

    if (Array.isArray(stylePreferences.garmentTypes)) {
      stylePreferences.garmentTypes.forEach(garment => {
        const type = this.normalizeCandidateValue(garment?.type || garment);
        if (!type) return;
        const key = type.toLowerCase();
        const data = {
          type,
          silhouette: garment?.silhouette || primarySilhouette,
          details: Array.isArray(garment?.details) ? garment.details : [],
          source: garment?.source || 'style-profile'
        };
        bumpCount(preferences.garments, key, data, garment?.weight);
      });
    }

    if (Array.isArray(stylePreferences.signaturePieces)) {
      stylePreferences.signaturePieces.forEach(piece => {
        const garmentType = this.normalizeCandidateValue(piece?.garmentType);
        if (garmentType) {
          const key = garmentType.toLowerCase();
          const data = {
            type: garmentType,
            silhouette: primarySilhouette,
            details: piece?.standoutDetail ? [piece.standoutDetail] : [],
            source: 'signature-piece'
          };
          bumpCount(preferences.garments, key, data, 0.8);
        }

        const standout = this.normalizeCandidateValue(piece?.standoutDetail);
        if (standout) {
          bumpCount(preferences.construction, standout.toLowerCase(), standout, 0.6);
        }
      });
    }
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
   * Thompson Sampling selection - UPDATED TO INCLUDE POSE AND BRAND DNA BIAS
   */
  thompsonSample(preferences, thompsonParams, creativity, options = {}) {
    const {
      brandDNA = null,
      enforceBrandDNA = false,
      brandDNAStrength = 0.7,
      userSpecifiedGarment = null,
      userSpecifiedColors = [],
      userSpecifiedFabrics = []
    } = options;

    const selected = {};

    // Decide: explore or exploit?
    const shouldExplore = Math.random() < creativity;

    // NEW: Build brand preference lists for biased sampling
    const brandGarmentPrefs = brandDNA?.primaryGarments?.map(g => g.type) || [];
    const brandFabricPrefs = brandDNA?.signatureFabrics?.map(f => f.name) || [];
    const brandColorPrefs = brandDNA?.signatureColors?.map(c => c.name) || [];

    // Sample garment (with brand bias if enforced)
    if (userSpecifiedGarment) {
      // User specified a garment - use it directly
      selected.garment = { type: userSpecifiedGarment };
      logger.debug('Using user-specified garment', { garment: userSpecifiedGarment });
    } else if (enforceBrandDNA && brandDNA && brandGarmentPrefs.length > 0) {
      // Use Thompson sampling with brand bias
      selected.garment = this.sampleCategoryWithBias(
        preferences.garments,
        thompsonParams.garments || {},
        brandGarmentPrefs,
        shouldExplore,
        brandDNAStrength * 2 // Extra boost for garments
      );
    } else {
      // Standard Thompson sampling
      selected.garment = this.sampleCategory(
        preferences.garments,
        thompsonParams.garments || {},
        shouldExplore
      );
    }

    // Sample fabric (with brand bias)
    if (userSpecifiedFabrics.length > 0) {
      // User specified fabrics
      selected.fabric = { material: userSpecifiedFabrics[0] };
      logger.debug('Using user-specified fabric', { fabric: userSpecifiedFabrics[0] });
    } else if (enforceBrandDNA && brandDNA && brandFabricPrefs.length > 0) {
      selected.fabric = this.sampleCategoryWithBias(
        preferences.fabrics,
        thompsonParams.fabrics || {},
        brandFabricPrefs,
        shouldExplore,
        brandDNAStrength
      );
    } else {
      selected.fabric = this.sampleCategory(
        preferences.fabrics,
        thompsonParams.fabrics || {},
        shouldExplore
      );
    }

    // Sample colors (with brand bias)
    if (userSpecifiedColors.length > 0) {
      // User specified colors - use them
      selected.colors = userSpecifiedColors.map(c => ({ name: c }));
      logger.debug('Using user-specified colors', { colors: userSpecifiedColors });
    } else if (enforceBrandDNA && brandDNA && brandColorPrefs.length > 0) {
      selected.colors = this.sampleMultipleWithBias(
        preferences.colors,
        thompsonParams.colors || {},
        brandColorPrefs,
        shouldExplore,
        2,
        brandDNAStrength
      );
    } else {
      selected.colors = this.sampleMultiple(
        preferences.colors,
        thompsonParams.colors || {},
        shouldExplore,
        2
      );
    }

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

  resolveAestheticToken(
    parsedUserPrompt,
    selectedContext,
    literalDescriptors = [],
    brandDNA = null,
    primaryStyleCluster = null,
    styleDistribution = [],
    stylePreferences = null
  ) {
    const candidateQueue = [];

    if (parsedUserPrompt) {
      if (Array.isArray(parsedUserPrompt.styleModifiers)) {
        candidateQueue.push(...parsedUserPrompt.styleModifiers);
      }
      if (Array.isArray(parsedUserPrompt.styleAdjectives)) {
        candidateQueue.push(...parsedUserPrompt.styleAdjectives);
      }
      if (Array.isArray(parsedUserPrompt.userModifiers)) {
        candidateQueue.push(...parsedUserPrompt.userModifiers);
      }
    }

    if (Array.isArray(literalDescriptors)) {
      candidateQueue.push(...literalDescriptors);
    }

    candidateQueue.push(selectedContext, primaryStyleCluster);

    if (stylePreferences) {
      if (stylePreferences.primaryAesthetic) {
        candidateQueue.push(stylePreferences.primaryAesthetic);
      }

      if (Array.isArray(stylePreferences.secondaryAesthetics)) {
        candidateQueue.push(...stylePreferences.secondaryAesthetics);
      }

      if (Array.isArray(stylePreferences.aestheticThemes)) {
        stylePreferences.aestheticThemes.forEach(theme => {
          if (theme?.name) {
            candidateQueue.push(theme.name);
          }
        });
      }
    }

    if (brandDNA) {
      if (Array.isArray(brandDNA.secondaryAesthetics)) {
        candidateQueue.push(...brandDNA.secondaryAesthetics);
      }
      if (brandDNA.primaryAesthetic) {
        candidateQueue.push(brandDNA.primaryAesthetic);
      }
    }

    for (const candidate of candidateQueue) {
      const match = this.matchAestheticCluster(candidate);
      if (match) {
        return {
          text: this.buildClusterTokenText(match),
          weight: 1.2
        };
      }
    }

    if (Array.isArray(styleDistribution) && styleDistribution.length > 0) {
      const sampled = this.sampleClusterFromDistribution(styleDistribution);
      if (sampled) {
        return {
          text: this.buildClusterTokenText(sampled),
          weight: 1.2
        };
      }
    }

    return {
      text: this.buildClusterTokenText('contemporary'),
      weight: 1.2
    };
  }

  buildGarmentDescription(garment, parsedUserPrompt, literalDescriptors = []) {
    if (!garment) return '';

    const descriptorParts = [];

    if (literalDescriptors.length > 0) {
      descriptorParts.push(literalDescriptors.slice(0, 2).join(' '));
    } else if (parsedUserPrompt?.styleModifiers?.length) {
      descriptorParts.push(parsedUserPrompt.styleModifiers.join(' '));
    } else if (parsedUserPrompt?.styleAdjectives?.length) {
      descriptorParts.push(parsedUserPrompt.styleAdjectives[0]);
    }

    if (garment.silhouette) {
      descriptorParts.push(garment.silhouette);
    }

    if (garment.fit) {
      descriptorParts.push(garment.fit);
    }

    if (garment.type) {
      descriptorParts.push(garment.type);
    }

    return descriptorParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  matchAestheticCluster(candidate) {
    const normalized = this.normalizeCandidateValue(candidate);
    if (!normalized) return null;
    const lower = normalized.toLowerCase();

    for (const cluster of STYLE_CLUSTER_CATALOG) {
      const clusterLower = cluster.toLowerCase();
      const clusterSpaced = clusterLower.replace(/-/g, ' ');
      if (lower.includes(clusterLower) || lower.includes(clusterSpaced)) {
        return clusterLower;
      }
    }

    return null;
  }

  buildClusterTokenText(cluster) {
    if (!cluster) return 'contemporary style';
    const normalized = cluster.toLowerCase();
    const suffix =
      normalized.includes('chic') ||
      normalized.includes('glam') ||
      normalized.includes('luxe') ||
      normalized.includes('streetwear')
        ? 'aesthetic'
        : 'style';
    return `${normalized} ${suffix}`;
  }

  sampleClusterFromDistribution(distribution) {
    if (!Array.isArray(distribution) || distribution.length === 0) return null;
    const total = distribution.reduce((sum, entry) => sum + (entry.weight || 0), 0);
    if (total <= 0) return distribution[0].cluster;
    const threshold = Math.random() * total;
    let cumulative = 0;
    for (const entry of distribution) {
      cumulative += entry.weight || 0;
      if (threshold <= cumulative) {
        return entry.cluster;
      }
    }
    return distribution[0].cluster;
  }

  enforcePromptRules(components, context = {}) {
    const conflictKeywords = [
      '3/4',
      'three-quarter angle',
      'three-quarter length',
      'front angle',
      'quarter view',
      'profile',
      'over-shoulder',
      'direct eye contact',
      'head centered',
      'close-up',
      'portrait',
      'bust',
      'headshot',
      'upper body',
      'half body',
      'waist-up',
      'knee-up',
      'medium shot',
      'tight crop',
      'cropped frame',
      'crop',
      'zoom'
    ];
    this.removeTokensContaining(components, conflictKeywords);

    this.limitDetailTokens(components, [
      { text: 'sharp focus', weight: 1.1 }
    ]);
    this.removeTokensContaining(components, [
      'studio quality',
      'precise execution',
      'literal interpretation',
      'exact specifications',
      'creative freedom',
      'interpret broadly',
      'diverse interpretations',
      'some creative freedom',
      'explore creative variations',
      'balanced interpretation'
    ]);
  }

  removeTokensContaining(components, keywords = []) {
    if (!Array.isArray(keywords) || keywords.length === 0) return 0;
    const lowered = keywords
      .filter(Boolean)
      .map(keyword => keyword.toLowerCase());

    let removed = 0;
    for (let i = components.length - 1; i >= 0; i--) {
      const tokenLower = String(components[i]).toLowerCase();
      if (lowered.some(keyword => tokenLower.includes(keyword))) {
        components.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  upsertToken(components, text, weight, matchPredicate = null) {
    if (!text) return;
    const normalizedMatcher = matchPredicate
      ? matchPredicate
      : (tokenLower) => tokenLower.includes(text.toLowerCase());

    for (let i = components.length - 1; i >= 0; i--) {
      const tokenLower = String(components[i]).toLowerCase();
      if (normalizedMatcher(tokenLower)) {
        components.splice(i, 1);
      }
    }

    components.push(this.formatToken(text, weight));
  }

  limitDetailTokens(components, allowed = []) {
    const removalKeywords = ['high detail', 'sharp focus', '8k', 'studio quality'];
    let insertIndex = components.length;

    for (let i = components.length - 1; i >= 0; i--) {
      const tokenLower = String(components[i]).toLowerCase();
      if (removalKeywords.some(keyword => tokenLower.includes(keyword))) {
        insertIndex = Math.min(insertIndex, i);
        components.splice(i, 1);
      }
    }

    if (!Array.isArray(allowed) || allowed.length === 0) return;
    if (insertIndex === components.length) {
      insertIndex = components.length;
    }

    allowed.forEach((token, offset) => {
      if (token?.text) {
        components.splice(
          insertIndex + offset,
          0,
          this.formatToken(token.text, token.weight || 1.0)
        );
      }
    });
  }

  removeTokensByPredicate(components, predicate) {
    if (typeof predicate !== 'function') return;
    for (let i = components.length - 1; i >= 0; i--) {
      const tokenLower = String(components[i]).toLowerCase();
      if (predicate(tokenLower)) {
        components.splice(i, 1);
      }
    }
  }

  pickFirstValue(...sources) {
    for (const source of sources) {
      if (Array.isArray(source)) {
        for (const value of source) {
          const normalized = this.normalizeCandidateValue(value);
          if (normalized) {
            return normalized;
          }
        }
      } else {
        const normalized = this.normalizeCandidateValue(source);
        if (normalized) {
          return normalized;
        }
      }
    }
    return null;
  }

  normalizeCandidateValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
  }

  sanitizeGarmentTypeDescriptor(rawType) {
    const normalized = this.normalizeCandidateValue(rawType);
    if (!normalized) return null;

    let descriptor = normalized;

    // Remove redundant "-style" qualifiers that duplicate the base garment term
    descriptor = descriptor.replace(/\b([a-z0-9]+)-style\b/gi, '$1');
    descriptor = descriptor.replace(/\b([a-z0-9]+)\s+style\s+\1\b/gi, '$1');

    descriptor = descriptor.replace(/\s+/g, ' ').trim();
    if (!descriptor) return null;

    // Collapse immediate duplicate words (e.g. "bomber bomber jacket" → "bomber jacket")
    descriptor = descriptor.replace(/\b(\w+)(\s+\1)+\b/gi, '$1');

    return descriptor.trim();
  }

  normalizeWeight(value, fallback = 1) {
    let numeric = null;

    if (typeof value === 'number' && Number.isFinite(value)) {
      numeric = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        const isPercent = trimmed.endsWith('%');
        const cleaned = isPercent ? trimmed.slice(0, -1) : trimmed;
        const parsed = parseFloat(cleaned);
        if (!Number.isNaN(parsed)) {
          numeric = isPercent ? parsed / 100 : parsed;
        }
      }
    } else if (value !== null && value !== undefined) {
      const maybeNumber = Number(value);
      if (!Number.isNaN(maybeNumber)) {
        numeric = maybeNumber;
      }
    }

    if (numeric === null || !Number.isFinite(numeric) || numeric <= 0) {
      numeric = fallback;
    }

    return Math.max(numeric, 0.1);
  }

  ensureFabricSelection(selected, parsedUserPrompt, brandDNA) {
    if (selected.fabric) return;

    if (parsedUserPrompt?.fabrics?.length) {
      selected.fabric = { material: parsedUserPrompt.fabrics[0] };
      return;
    }

    const brandFabrics = Array.isArray(brandDNA?.signatureFabrics)
      ? brandDNA.signatureFabrics
      : [];

    if (brandFabrics.length > 0) {
      const fabric = brandFabrics[0];
      selected.fabric = {
        material: fabric.name || fabric.type || fabric,
        finish: fabric.finish || fabric.texture || null
      };
      return;
    }

    selected.fabric = { material: 'wool' };
  }

  applyGarmentDefaults(selected, parsedUserPrompt, options = {}) {
    if (!selected?.garment) return;

    const { userSpecifiedFabrics = [] } = options;
    const desiredType = this.pickFirstValue(
      parsedUserPrompt?.garmentType,
      selected.garment.type
    );

    const canonical = this.canonicalizeGarmentType(desiredType);
    if (canonical?.type) {
      selected.garment.type = canonical.type;
    }

    // Preserve user fabric overrides
    const hasUserFabric = Array.isArray(userSpecifiedFabrics) && userSpecifiedFabrics.length > 0;
    if (hasUserFabric) {
      selected.fabric = { material: userSpecifiedFabrics[0] };
      return;
    }

    if (!selected.fabric && canonical?.defaultMaterial) {
      selected.fabric = { material: canonical.defaultMaterial };
    }

    if (selected.fabric && canonical?.type === 'bomber jacket') {
      const material = (selected.fabric.material || '').toLowerCase();
      if (material.includes('wool') || material.includes('tweed')) {
        selected.fabric = { material: canonical.defaultMaterial };
      }
    }
  }

  canonicalizeGarmentType(rawType) {
    const sanitized = this.sanitizeGarmentTypeDescriptor(rawType);
    if (!sanitized) return { type: null, defaultMaterial: null };

    const key = sanitized.toLowerCase();
    if (GARMENT_CANONICALS[key]) {
      return { ...GARMENT_CANONICALS[key] };
    }

    return { type: sanitized, defaultMaterial: null };
  }

  buildPrimaryGarmentToken(selected, parsedUserPrompt) {
    const garmentCandidate = this.pickFirstValue(
      parsedUserPrompt?.garmentType,
      selected?.garment?.type
    );

    const canonical = this.canonicalizeGarmentType(garmentCandidate);
    const garmentType = canonical.type;
    if (!garmentType) return null;

    const fabric = this.pickFirstValue(
      parsedUserPrompt?.fabrics,
      selected?.fabric?.material,
      canonical.defaultMaterial
    );

    const parts = [];
    if (fabric) parts.push(String(fabric).toLowerCase());
    parts.push(String(garmentType).toLowerCase());

    const descriptor = parts
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!descriptor) return null;

    return this.formatToken(descriptor, 1.3);
  }

  resolveModelDescriptor(modelGenderElement) {
    const inferredGender = this.inferGenderFromModelElement(modelGenderElement);
    return this.buildDefaultModelDescriptor(inferredGender);
  }

  inferGenderFromModelElement(modelGenderElement) {
    const normalizedGender = this.normalizeCandidateValue(modelGenderElement?.gender);
    if (normalizedGender) {
      return normalizedGender.toLowerCase();
    }

    const promptDescriptor = this.normalizeCandidateValue(modelGenderElement?.promptElement);
    if (!promptDescriptor) return null;

    const lower = promptDescriptor.toLowerCase();
    if (lower.includes('male')) return 'male';
    if (lower.includes('female')) return 'female';
    if (lower.includes('androgynous') || lower.includes('neutral')) return 'neutral';
    if (lower.includes('models')) return 'both';
    return null;
  }

  buildDefaultModelDescriptor(gender) {
    if (!gender) {
      return 'beautiful female model facing camera';
    }

    if (gender.includes('male')) {
      return 'handsome male model facing camera';
    }

    if (gender.includes('neutral') || gender.includes('androgynous')) {
      return 'androgynous model facing camera';
    }

    if (gender.includes('both')) {
      return 'beautiful models facing camera';
    }

    return 'beautiful female model facing camera';
  }

  resolvePrimaryColorContext(parsedUserPrompt, selected) {
    const userColor = this.pickFirstValue(parsedUserPrompt?.colors);
    if (userColor) {
      const normalized = this.normalizeCandidateValue(userColor);
      return {
        color: normalized,
        normalized: normalized ? normalized.toLowerCase() : null,
        source: 'user'
      };
    }

    return { color: null, normalized: null, source: null };
  }

  buildStyleContextDistribution(styleContextPrefs = {}) {
    const distribution = [];
    for (const [key, value] of Object.entries(styleContextPrefs || {})) {
      if (!value?.count) continue;
      const match = this.matchAestheticCluster(key);
      if (match) {
        distribution.push({ cluster: match, weight: value.count });
      }
    }
    return distribution.sort((a, b) => b.weight - a.weight);
  }

  getTopStyleCluster(styleContextPrefs = {}) {
    const distribution = this.buildStyleContextDistribution(styleContextPrefs);
    return distribution.length > 0 ? distribution[0].cluster : null;
  }

  collectDesignDetailTokens(selected, parsedUserPrompt) {
    const buckets = new Map();
    DETAIL_PRIORITY_ORDER.forEach(({ category }) => buckets.set(category, []));

    const pushDetail = (category, phrase) => {
      if (!category || !phrase) return;
      const normalized = this.normalizeDetailByCategory(phrase, category);
      if (!normalized) return;
      const list = buckets.get(category);
      if (!list.includes(normalized)) {
        list.push(normalized);
      }
    };

    if (parsedUserPrompt?.silhouette) {
      pushDetail('silhouette', parsedUserPrompt.silhouette);
    }

    (parsedUserPrompt?.constructionDetails || []).forEach(detail => {
      const categorized = this.categorizeDetailCandidate(detail);
      if (categorized) {
        pushDetail(categorized.category, categorized.phrase);
      }
    });

    if (Array.isArray(selected?.garment?.details)) {
      selected.garment.details.forEach(detail => {
        const categorized = this.categorizeDetailCandidate(detail);
        if (categorized) {
          pushDetail(categorized.category, categorized.phrase);
        }
      });
    }

    const constructionDetails = Array.isArray(selected?.construction)
      ? selected.construction
      : selected?.construction
        ? [selected.construction]
        : [];

    constructionDetails.forEach(detail => {
      const categorized = this.categorizeDetailCandidate(detail);
      if (categorized) {
        pushDetail(categorized.category, categorized.phrase);
      }
    });

    const garmentType = selected?.garment?.type?.toLowerCase() || '';
    if (garmentType === 'bomber jacket') {
      BOMBER_DETAIL_DEFAULTS.forEach(detail => {
        const lower = detail.toLowerCase();
        const category = lower.includes('collar')
          ? 'closure'
          : (lower.includes('pocket') ? 'pockets'
            : (lower.includes('hem') ? 'pockets' : 'hardware'));
        pushDetail(category, detail);
      });
    } else if (['blazer', 'coat', 'jacket'].some(type => garmentType.includes(type))) {
      TAILORED_DETAIL_DEFAULTS.forEach(detail => pushDetail(
        detail.includes('lapel') ? 'closure' : detail.includes('pocket') ? 'pockets' : 'silhouette',
        detail
      ));
    }

    const tokens = [];
    const added = new Set();

    for (const { category, weight } of DETAIL_PRIORITY_ORDER) {
      const list = buckets.get(category) || [];
      if (list.length === 0) continue;
      for (const phrase of list) {
        if (tokens.length >= 3) break;
        if (added.has(phrase)) continue;
        tokens.push(this.formatToken(phrase, weight));
        added.add(phrase);
        break;
      }
    }

    if (tokens.length < 3) {
      for (const { category, weight } of DETAIL_PRIORITY_ORDER) {
        if (tokens.length >= 3) break;
        const list = buckets.get(category) || [];
        for (const phrase of list) {
          if (added.has(phrase)) continue;
          tokens.push(this.formatToken(phrase, weight));
          added.add(phrase);
          if (tokens.length >= 3) break;
        }
      }
    }

    if (tokens.length < 3) {
      const fallbackDetails = this.getFallbackDetails(garmentType);
      fallbackDetails.forEach(({ text, weight }) => {
        if (tokens.length >= 3) return;
        if (added.has(text)) return;
        tokens.push(this.formatToken(text, weight));
        added.add(text);
      });
    }

    return tokens;
  }

  categorizeDetailCandidate(detail) {
    const normalized = this.normalizeDetailCandidate(detail);
    if (!normalized) return null;

    const lower = normalized.toLowerCase();

    for (const [category, keywords] of Object.entries(DETAIL_KEYWORDS)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return {
          category,
          phrase: normalized
        };
      }
    }

    return null;
  }

  normalizeDetailCandidate(detail) {
    if (!detail) return null;
    if (typeof detail === 'string') {
      return detail.trim();
    }
    if (Array.isArray(detail)) {
      return detail.filter(Boolean).join(' ').trim();
    }
    if (typeof detail === 'object') {
      if (detail.description) return String(detail.description).trim();
      if (detail.name) return String(detail.name).trim();
      if (detail.detail) return String(detail.detail).trim();
    }
    return null;
  }

  normalizeDetailByCategory(phrase, category) {
    if (!phrase) return null;
    const trimmed = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!trimmed) return null;

    if (category === 'silhouette') {
      if (trimmed.includes('silhouette')) {
        return trimmed.replace(' silhouette silhouette', ' silhouette');
      }
      const keyword = DETAIL_KEYWORDS.silhouette.find(key => trimmed.includes(key));
      if (keyword) {
        return `${keyword} silhouette`.replace(/\s+/g, ' ');
      }
      return `${trimmed} silhouette`;
    }

    if (category === 'sleeves') {
      if (trimmed.includes('sleeve')) {
        return trimmed.replace('sleeves', 'sleeves').replace('sleeve', 'sleeves');
      }
      return `${trimmed} sleeves`;
    }

    if (category === 'pockets' && !trimmed.includes('pocket') && !trimmed.includes('hem')) {
      return `${trimmed} pockets`;
    }

    return trimmed;
  }

  getFallbackDetails(garmentType = '') {
    const lower = garmentType?.toLowerCase() || '';
    if (lower.includes('bomber')) {
      return [
        { text: 'oversized silhouette', weight: 1.3 },
        { text: 'cuffed sleeves', weight: 1.2 },
        { text: 'two-way zipper', weight: 1.2 }
      ];
    }

    if (lower.includes('blazer') || lower.includes('coat') || lower.includes('jacket')) {
      return [
        { text: 'tailored silhouette', weight: 1.3 },
        { text: 'structured shoulders', weight: 1.2 },
        { text: 'tonal stitching', weight: 1.1 }
      ];
    }

    return [
      { text: 'refined silhouette', weight: 1.3 },
      { text: 'cuffed sleeves', weight: 1.2 },
      { text: 'tonal stitching', weight: 1.1 }
    ];
  }

  dedupeTokens(components) {
    if (!Array.isArray(components)) return;
    const seen = new Set();
    for (let i = 0; i < components.length; i++) {
      const token = components[i];
      if (!token) continue;
      const normalized = String(token).toLowerCase();
      if (seen.has(normalized)) {
        components.splice(i, 1);
        i--;
        continue;
      }
      seen.add(normalized);
    }
  }

  dedupeAndJoinTokens(tokens = []) {
    const copy = Array.isArray(tokens) ? [...tokens] : [];
    this.dedupeTokens(copy);
    return copy.join(', ');
  }

  pickLiteralDescriptors(parsedUserPrompt) {
    if (!parsedUserPrompt) return [];

    const {
      styleModifiers = [],
      styleAdjectives = [],
      userModifiers = [],
      colors = [],
      fabrics = [],
      occasions = [],
      garmentType
    } = parsedUserPrompt;

    const exclusionSet = new Set(
      [
        ...(Array.isArray(colors) ? colors : []),
        ...(Array.isArray(fabrics) ? fabrics : []),
        ...(Array.isArray(occasions) ? occasions : []),
        garmentType
      ]
        .filter(Boolean)
        .map(val => String(val).toLowerCase())
    );

    const prioritizedDescriptors = [
      ...styleModifiers,
      ...styleAdjectives,
      ...userModifiers
    ];

    const literalDescriptors = [];
    for (const descriptor of prioritizedDescriptors) {
      if (!descriptor) continue;
      const normalized = String(descriptor).toLowerCase().trim();
      if (!normalized) continue;
      if (exclusionSet.has(normalized)) continue;
      if (literalDescriptors.some(existing => existing.toLowerCase() === normalized)) continue;
      // Skip camera/lighting keywords that may slip into modifiers
      if (normalized.includes('lighting') || normalized.includes('background')) continue;
      literalDescriptors.push(descriptor);
    }

    return literalDescriptors;
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
   * ADDED: Sample category with brand DNA bias
   * Boosts probability of brand-aligned options
   */
  sampleCategoryWithBias(preferenceDict, thompsonDict, brandPreferences, shouldExplore, biasStrength = 0.7) {
    if (!preferenceDict || Object.keys(preferenceDict).length === 0) {
      return null;
    }

    const samples = [];
    for (const [key, pref] of Object.entries(preferenceDict)) {
      const params = thompsonDict[key] || { alpha: this.DEFAULT_ALPHA, beta: this.DEFAULT_BETA };
      let score = this.betaSample(params.alpha, params.beta);

      // Apply brand bias if this option is in brand preferences
      const isBrandPreferred = brandPreferences.some(bp =>
        key.toLowerCase().includes(bp.toLowerCase()) || bp.toLowerCase().includes(key.toLowerCase())
      );

      if (isBrandPreferred) {
        score = score * (1 + biasStrength); // Boost score
        logger.debug('Applied brand bias', { key, originalScore: score / (1 + biasStrength), boostedScore: score });
      }

      if (shouldExplore) {
        score += Math.random() * 0.3; // Add exploration noise
      }

      samples.push({ key, score });
    }

    samples.sort((a, b) => b.score - a.score);
    return preferenceDict[samples[0].key].data;
  }

  /**
   * ADDED: Sample multiple items with brand DNA bias
   */
  sampleMultipleWithBias(preferenceDict, thompsonDict, brandPreferences, shouldExplore, n, biasStrength = 0.7) {
    if (!preferenceDict || Object.keys(preferenceDict).length === 0) {
      return [];
    }

    const samples = [];
    for (const [key, pref] of Object.entries(preferenceDict)) {
      const params = thompsonDict[key] || { alpha: this.DEFAULT_ALPHA, beta: this.DEFAULT_BETA };
      let score = this.betaSample(params.alpha, params.beta);

      // Apply brand bias
      const isBrandPreferred = brandPreferences.some(bp =>
        key.toLowerCase().includes(bp.toLowerCase()) || bp.toLowerCase().includes(key.toLowerCase())
      );

      if (isBrandPreferred) {
        score = score * (1 + biasStrength);
      }

      if (shouldExplore) {
        score += Math.random() * 0.3;
      }

      samples.push({ key, score });
    }

    samples.sort((a, b) => b.score - a.score);
    return samples.slice(0, n).map(s => preferenceDict[s.key].data);
  }

  /**
   * Format token with weight for SD/Flux
   */
  formatToken(text, weight) {
    // Always apply weighting (including < 1.0)
    const clamped = Math.max(this.MIN_WEIGHT, Math.min(this.MAX_WEIGHT, Number(weight) || 1.0));
    // Format: [token:weight] using brackets for emphasis-compatible models
    return `[${String(text)}:${clamped.toFixed(1)}]`;
  }

  /**
   * Build negative prompt
   */
  buildNegativePrompt(selected, context = {}) {
    const negative = [
      this.buildDefaultNegativePrompt(),
      this.buildFrontAngleNegativePrompt()
    ];

    if (this.shouldApplyWarmRedNegatives(context)) {
      negative.push(this.buildWarmRedNegativePrompt());
    }

    // Add user-specific negatives based on preferences
    // (can be extended based on what user dislikes)

    return negative.filter(Boolean).join(', ');
  }

  /**
   * Build default negative prompt with weights
   */
  buildDefaultNegativePrompt() {
    const NEGATIVE_WEIGHT = 1.2;
    const terms = (this.DEFAULT_NEGATIVE_PROMPT || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    if (terms.length === 0) return '';
    return terms.map(t => this.formatToken(t, NEGATIVE_WEIGHT)).join(', ');
  }

  buildFrontAngleNegativePrompt() {
    const NEGATIVE_WEIGHT = 1.5;
    const composite = 'close-up, portrait, headshot, bust, upper body, waist-up, knee-up, tight crop, cropped frame, extreme close-up, macro face, profile view, 3/4 view, quarter view, over-shoulder, gaze averted, looking away';
    return this.formatToken(composite, NEGATIVE_WEIGHT);
  }

  buildWarmRedNegativePrompt() {
    const NEGATIVE_WEIGHT = 1.6;
    return WARM_RED_NEGATIVE_TERMS
      .map(term => this.formatToken(term, NEGATIVE_WEIGHT))
      .join(', ');
  }

  shouldApplyWarmRedNegatives(context = {}) {
    const { parsedUserPrompt = null } = context;
    if (!parsedUserPrompt) return true;

    const userColors = Array.isArray(parsedUserPrompt.colors)
      ? parsedUserPrompt.colors
      : [];
    const modifiers = Array.isArray(parsedUserPrompt.userModifiers)
      ? parsedUserPrompt.userModifiers
      : [];

    return ![...userColors, ...modifiers].some(color => this.referencesWarmRed(color));
  }

  referencesWarmRed(candidate) {
    if (!candidate) return false;
    const normalized = String(candidate).toLowerCase();
    return ['red', 'burgundy', 'maroon', 'scarlet', 'crimson', 'rust', 'wine'].some(term =>
      normalized.includes(term)
    );
  }

  hasExplicitColor(parsedUserPrompt, selected) {
    if (parsedUserPrompt?.colors?.length) {
      return true;
    }

    if (Array.isArray(selected?.colors) && selected.colors.length > 0) {
      const firstColor = selected.colors[0]?.name || selected.colors[0];
      if (firstColor) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate default prompt (fallback)
   */
  async generateDefaultPrompt(userId, options) {
    const garmentTypes = ['blazer', 'dress', 'coat', 'skirt', 'pants', 'outfit']; // Added 'outfit'
    const fabrics = ['wool', 'cotton', 'silk', 'linen'];

    const garment = options.garmentType || garmentTypes[Math.floor(Math.random() * garmentTypes.length)];
    const fabric = fabrics[Math.floor(Math.random() * fabrics.length)];

    const mergedGarment = [fabric, garment]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const fallbackDetails = this.getFallbackDetails(garment).map(({ text, weight }) =>
      this.formatToken(text, weight)
    );

    const positiveTokens = [
      this.formatToken('contemporary style', 1.2),
      this.formatToken(mergedGarment, 1.3),
      ...fallbackDetails,
      this.formatToken('beautiful female model facing camera', 1.3),
      this.formatToken('full-body shot', 1.8),
      this.formatToken('standing pose', 1.6),
      this.formatToken('straight-on, facing camera', 1.3),
      this.formatToken('soft frontal key light', 1.2),
      this.formatToken('modern editorial style', 1.1),
      this.formatToken('neutral background', 1.1),
      this.formatToken('sharp focus', 1.1)
    ];

    const positive = this.dedupeAndJoinTokens(positiveTokens);

    const defaultNegativeParts = [
      this.buildDefaultNegativePrompt(),
      this.buildFrontAngleNegativePrompt()
    ];

    if (this.shouldApplyWarmRedNegatives({ parsedUserPrompt: options.parsedUserPrompt || null })) {
      defaultNegativeParts.push(this.buildWarmRedNegativePrompt());
    }

    const defaultNegative = defaultNegativeParts.filter(Boolean).join(', ');

    const promptRecord = await this.savePrompt(userId, {
      positive_prompt: positive,
      negative_prompt: defaultNegative,
      metadata: { default: true },
      creativity: options.creativity || 0.5
    });

    return {
      positive_prompt: positive,
      negative_prompt: defaultNegative,
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
  extractStylePreferences(styleProfile) {
    if (!styleProfile) {
      logger.warn('No style profile provided for preference extraction');
      return null;
    }

    try {
      const parseMaybeJSON = (value, fallback) => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed.length === 0) return fallback;
          const parsed = this.safeParseJSON(trimmed, undefined);
          return parsed !== undefined ? parsed : fallback;
        }
        return value;
      };

      const normalizeTheme = (theme, index) => {
        if (theme === null || theme === undefined) return null;
        const name = this.normalizeCandidateValue(
          typeof theme === 'string'
            ? theme
            : theme.name || theme.aesthetic || theme.label
        );
        if (!name) return null;

        const rawWeight =
          typeof theme === 'object'
            ? theme.strength ?? theme.weight ?? theme.count ?? theme.frequency
            : null;
        const weight = this.normalizeWeight(rawWeight, Math.max(1 - index * 0.2, 0.3));

        return {
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
          weight,
          strength: theme?.strength ?? null,
          description: theme?.description || null,
          examples: theme?.examples || [],
          source: 'style-profile'
        };
      };

      const toEntryTuples = (value, defaults = {}) => {
        if (!value) return [];
        if (Array.isArray(value)) {
          return value.map(item => {
            if (typeof item === 'string') {
              return [item, defaults.weight || 1, null];
            }
            if (!item) return [null, null, null];
            const key =
              item.name ||
              item.label ||
              item.type ||
              item.fabric ||
              item.material ||
              defaults.key ||
              item;
            const weight =
              item.weight ??
              item.value ??
              item.count ??
              item.frequency ??
              item.percentage ??
              defaults.weight ??
              1;
            return [key, weight, item];
          });
        }
        if (typeof value === 'object') {
          return Object.entries(value).map(([key, weight]) => [key, weight, null]);
        }
        return [];
      };

      const aestheticThemesRaw = parseMaybeJSON(styleProfile.aesthetic_themes, []);
      const aestheticThemes = Array.isArray(aestheticThemesRaw)
        ? aestheticThemesRaw
            .map((theme, index) => normalizeTheme(theme, index))
            .filter(Boolean)
        : [];

      const colorsRaw = parseMaybeJSON(styleProfile.color_distribution, {});
      const colors = toEntryTuples(colorsRaw)
        .map(([nameCandidate, weightCandidate, original]) => {
          const name = this.normalizeCandidateValue(nameCandidate);
          if (!name) return null;
          const weight = this.normalizeWeight(weightCandidate, 0.4);
          return {
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            weight,
            hex: original?.hex || this.getColorHex(name),
            source: original?.source || 'style-profile'
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.weight - a.weight);

      const fabricsRaw = parseMaybeJSON(styleProfile.fabric_distribution, {});
      const fabrics = toEntryTuples(fabricsRaw)
        .map(([nameCandidate, weightCandidate, original]) => {
          const name = this.normalizeCandidateValue(
            nameCandidate || original?.material
          );
          if (!name) return null;
          const weight = this.normalizeWeight(weightCandidate, 0.4);
          return {
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            weight,
            finish: original?.finish || original?.properties?.texture || null,
            properties: original?.properties || null,
            source: original?.source || 'style-profile'
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.weight - a.weight);

      const constructionRaw = parseMaybeJSON(styleProfile.construction_patterns, []);
      const constructionDetails = Array.isArray(constructionRaw)
        ? constructionRaw
            .map((pattern, index) => {
              if (!pattern) return null;
              const descriptor = this.normalizeCandidateValue(
                pattern.name || pattern.detail || pattern.description || pattern
              );
              if (!descriptor) return null;
              const weight = this.normalizeWeight(
                pattern.frequency ?? pattern.weight ?? pattern.count,
                Math.max(0.6 - index * 0.1, 0.2)
              );
              return {
                name: descriptor,
                weight,
                source: 'style-profile'
              };
            })
            .filter(Boolean)
        : [];

      const garmentRaw = parseMaybeJSON(styleProfile.garment_distribution, {});
      const garmentTypes = toEntryTuples(garmentRaw)
        .map(([nameCandidate, weightCandidate, original]) => {
          const type = this.normalizeCandidateValue(nameCandidate);
          if (!type) return null;
          const weight = this.normalizeWeight(weightCandidate, 0.5);
          return {
            type,
            weight,
            silhouette: original?.silhouette || null,
            details: original?.details || [],
            source: original?.source || 'style-profile'
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.weight - a.weight);

      const silhouetteRaw = parseMaybeJSON(styleProfile.silhouette_distribution, {});
      const silhouettePreferences = toEntryTuples(silhouetteRaw)
        .map(([nameCandidate, weightCandidate]) => {
          const name = this.normalizeCandidateValue(nameCandidate);
          if (!name) return null;
          const weight = this.normalizeWeight(weightCandidate, 0.4);
          return { name, weight };
        })
        .filter(Boolean)
        .sort((a, b) => b.weight - a.weight);

      const signaturePiecesRaw = parseMaybeJSON(
        styleProfile.signature_pieces,
        styleProfile.signaturePieces || []
      );
      const signaturePieces = Array.isArray(signaturePiecesRaw)
        ? signaturePiecesRaw.map(piece => ({
            id: piece?.image_id || piece?.id || null,
            garmentType: piece?.garment_type || piece?.garmentType || null,
            standoutDetail: piece?.standout_detail || piece?.standoutDetail || null,
            executiveSummary:
              piece?.executive_summary?.one_sentence_description ||
              piece?.executive_summary?.summary ||
              piece?.description ||
              null,
            confidence: piece?.confidence || null
          }))
        : [];

      const dominantStylesRaw = parseMaybeJSON(
        styleProfile.dominant_styles,
        styleProfile.style_tags || styleProfile.styleTags || []
      );
      const tags = Array.isArray(dominantStylesRaw)
        ? dominantStylesRaw
            .map(tag =>
              this.normalizeCandidateValue(
                typeof tag === 'string' ? tag : tag?.name || tag?.label || tag
              )
            )
            .filter(Boolean)
        : [];

      const primaryAesthetic = aestheticThemes.length > 0 ? aestheticThemes[0].name : null;
      const secondaryAesthetics = aestheticThemes.slice(1, 4).map(theme => theme.name);

      return {
        aestheticThemes,
        colors,
        fabrics,
        constructionDetails,
        garmentTypes,
        silhouettePreferences,
        signaturePieces,
        tags,
        primaryAesthetic,
        secondaryAesthetics,
        styleDescription: styleProfile.style_description || styleProfile.summary || null,
        metadata: {
          totalImages:
            styleProfile.total_images ||
            styleProfile.image_count ||
            styleProfile.totalImages ||
            null,
          avgConfidence: styleProfile.avg_confidence || null,
          updatedAt: styleProfile.updated_at || styleProfile.last_updated || null
        }
      };
    } catch (error) {
      logger.error('Failed to extract style preferences', { error: error.message });
      return null;
    }
  }

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
   * INCLUDES: Full-body, three-quarter, and other shot types from portfolio
   */
  extractShotTypePreferences(styleProfile) {
    // Look in ultra-detailed descriptors for photography data
    const descriptors = styleProfile.signature_pieces || [];
    const shotTypeCounts = {};

    // Normalize shot types to include both three-quarter and full-body variants
    const normalizedShotTypes = {
      'full-body': ['full body', 'full length', 'full shot', 'full figure'],
      'three-quarter': ['three-quarter', '3/4', 'waist up', 'mid-length'],
      'close-up': ['close-up', 'headshot', 'face', 'bust shot'],
      'medium': ['medium shot', 'medium']
    };

    descriptors.forEach(desc => {
      let shotType = desc.photography?.shot_composition?.type;
      if (shotType) {
        // Normalize the shot type
        const normalized = this.normalizeShotType(shotType, normalizedShotTypes);
        shotTypeCounts[normalized] = (shotTypeCounts[normalized] || 0) + 1;
      }
    });

    const total = Object.values(shotTypeCounts).reduce((sum, count) => sum + count, 0);

    // If no shot types found, return default variety (front-facing)
    if (total === 0) {
      return [
        { type: 'full-body shot', frequency: 0.5 },
        { type: 'three-quarter length shot', frequency: 0.5 }
      ];
    }

    return Object.entries(shotTypeCounts)
      .map(([type, count]) => ({
        type,
        frequency: count / total
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5); // Allow up to 5 shot type variations
  }

  /**
   * Helper: Normalize shot type to canonical forms
   */
  normalizeShotType(shotType, mapping) {
    const lower = shotType.toLowerCase();
    
    for (const [canonical, variants] of Object.entries(mapping)) {
      if (variants.some(v => lower.includes(v))) {
        return canonical === 'full-body' ? 'full-body shot' :
               canonical === 'three-quarter' ? 'three-quarter length shot' :
               canonical === 'close-up' ? 'close-up shot' :
               'medium shot';
      }
    }
    
    return 'three-quarter length shot'; // Safe default
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
   * ENFORCES: Only front-facing angles are included in brand DNA
   */
  extractAnglePreferences(styleProfile) {
    const descriptors = styleProfile.signature_pieces || [];
    const angleCounts = {};

    descriptors.forEach(desc => {
      let angle = desc.photography?.camera_angle?.horizontal;
      if (angle) {
        // VALIDATION: Filter and convert to front-facing only
        angle = this.ensureFrontAngle(angle);
        angleCounts[angle] = (angleCounts[angle] || 0) + 1;
      }
    });

    const total = Object.values(angleCounts).reduce((sum, count) => sum + count, 0);

    return Object.entries(angleCounts)
      .map(([angle, count]) => ({
        angle: this.ensureFrontAngle(angle), // Double-check all angles are front-facing
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
      // Get the style profile first
      const profileQuery = `
        SELECT * FROM style_profiles
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      const profileResult = await db.query(profileQuery, [userId]);

      if (profileResult.rows.length === 0) {
        logger.warn('No style profile found for user', { userId });
        return null;
      }

      const profile = profileResult.rows[0];

      // Get signature pieces separately to avoid GROUP BY issues
      const signaturePiecesQuery = `
        SELECT
          image_id,
          executive_summary->>'one_sentence_description' as description,
          executive_summary->>'standout_detail' as standout_detail,
          photography,
          (garments->0->>'type') as garment_type,
          overall_confidence as confidence
        FROM ultra_detailed_descriptors
        WHERE user_id = $1
          AND overall_confidence > 0.75
        ORDER BY overall_confidence DESC
        LIMIT 10
      `;

      const signaturePiecesResult = await db.query(signaturePiecesQuery, [userId]);

      // Parse JSON fields
      return {
        ...profile,
        garment_distribution: this.safeParseJSON(profile.garment_distribution, {}),
        color_distribution: this.safeParseJSON(profile.color_distribution, {}),
        fabric_distribution: this.safeParseJSON(profile.fabric_distribution, {}),
        silhouette_distribution: this.safeParseJSON(profile.silhouette_distribution, {}),
        aesthetic_themes: this.safeParseJSON(profile.aesthetic_themes, []),
        construction_patterns: this.safeParseJSON(profile.construction_patterns, []),
        signature_pieces: signaturePiecesResult.rows || []
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

  /**
   * Validate UUID strings before using them in parameterized queries.
   * Prevents errors when development fallbacks pass placeholders like "dev-test".
   */
  isValidUUID(value) {
    if (typeof value !== 'string') {
      return false;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}

module.exports = new IntelligentPromptBuilder();
