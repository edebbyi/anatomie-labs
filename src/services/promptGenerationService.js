const logger = require('../utils/logger');

/**
 * Prompt Generation Service for Fashion Images
 * Transforms VLT analysis and style profiles into detailed prompts for Imagen-4-Ultra
 * Based on Designer BFF Stage 6 specifications
 */
class PromptGenerationService {
  /**
   * Generate a detailed fashion prompt from VLT metadata
   * @param {Object} vltSpec - VLT analysis specification
   * @param {Object} options - Generation options
   * @param {Object} options.styleProfile - User's style profile (from Stage 2)
   * @param {string} options.persona - Active persona preferences
   * @param {Object} options.context - Additional context (occasion, season, etc.)
   * @returns {Object} Generated prompt with main and negative prompts
   */
  generatePrompt(vltSpec, options = {}) {
    try {
      logger.info('Generating fashion prompt from VLT', {
        hasVltSpec: !!vltSpec,
        hasStyleProfile: !!options.styleProfile
      });

      // Extract core elements from VLT
      const garmentDetails = this.extractGarmentDetails(vltSpec);
      const styleAttributes = this.extractStyleAttributes(vltSpec);
      const colorPalette = this.extractColorPalette(vltSpec);
      const composition = this.buildComposition(vltSpec, options);
      const lighting = this.determineLighting(vltSpec, options);
      const quality = this.buildQualityModifiers();

      // Build main prompt
      const mainPrompt = this.assembleMainPrompt({
        garmentDetails,
        styleAttributes,
        colorPalette,
        composition,
        lighting,
        quality,
        context: options.context
      });

      // Build negative prompt
      const negativePrompt = this.buildNegativePrompt(vltSpec, options);

      logger.info('Fashion prompt generated', {
        mainPromptLength: mainPrompt.length,
        negativePromptLength: negativePrompt.length
      });

      return {
        mainPrompt,
        negativePrompt,
        metadata: {
          garmentType: garmentDetails.type,
          style: styleAttributes.overall,
          colors: colorPalette.primary,
          vltSource: vltSpec.id || 'unknown'
        }
      };

    } catch (error) {
      logger.error('Prompt generation failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Extract garment details from VLT analysis
   */
  extractGarmentDetails(vltSpec) {
    const attributes = vltSpec.attributes || {};
    
    return {
      type: vltSpec.garmentType || 'dress',
      silhouette: attributes.silhouette || 'fitted',
      neckline: attributes.neckline || 'round',
      sleeveLength: attributes.sleeveLength || 'sleeveless',
      length: attributes.length || 'midi',
      waistline: attributes.waistline || 'natural',
      fabrication: attributes.fabrication || 'smooth',
      details: attributes.details || []
    };
  }

  /**
   * Extract style attributes
   */
  extractStyleAttributes(vltSpec) {
    const style = vltSpec.style || {};
    
    return {
      overall: style.overall || 'elegant',
      formality: style.formality || 'formal',
      aesthetic: style.aesthetic || 'modern',
      mood: style.mood || 'sophisticated',
      keywords: style.keywords || []
    };
  }

  /**
   * Extract color palette
   */
  extractColorPalette(vltSpec) {
    const colors = vltSpec.colors || {};
    
    return {
      primary: colors.primary || 'black',
      secondary: colors.secondary || null,
      accent: colors.accent || null,
      neutrals: colors.neutrals || [],
      finish: colors.finish || 'matte'
    };
  }

  /**
   * Build composition instructions
   */
  buildComposition(vltSpec, options) {
    const styleProfile = options.styleProfile || {};
    
    // All shots are front-facing full body
    const shotType = 'full body';

    return {
      shot: shotType,
      angle: 'front view, straight on',
      background: 'clean minimal background, soft gray or white',
      model: 'professional fashion model, confident pose',
      framing: 'centered, well-balanced composition, full body visible'
    };
  }

  /**
   * Determine lighting setup
   */
  determineLighting(vltSpec, options) {
    const style = vltSpec.style?.overall || 'elegant';
    
    // Map styles to lighting preferences
    const lightingMap = {
      'minimalist': 'soft diffused studio lighting, even illumination',
      'dramatic': 'dramatic side lighting with deep shadows',
      'romantic': 'soft natural window light, gentle shadows',
      'modern': 'clean studio lighting, bright and even',
      'elegant': 'sophisticated studio lighting, subtle shadows',
      'casual': 'natural daylight, soft and flattering'
    };

    return lightingMap[style.toLowerCase()] || 'professional studio lighting, well-balanced';
  }

  /**
   * Build quality modifiers for high-end fashion photography
   */
  buildQualityModifiers() {
    return [
      'high fashion photography',
      'professional product shot',
      'studio quality',
      '8k resolution',
      'sharp focus',
      'perfect fabric texture',
      'detailed materials',
      'magazine editorial quality',
      'commercial fashion photography'
    ];
  }

  /**
   * Assemble the main prompt
   */
  assembleMainPrompt(components) {
    const parts = [];

    // Start with quality and context
    parts.push(components.quality.join(', '));

    // Add composition
    parts.push(`${components.composition.shot}, ${components.composition.angle}`);
    parts.push(components.composition.model);

    // Add garment description
    const garment = components.garmentDetails;
    let garmentDesc = `${garment.type}`;
    
    if (garment.silhouette) garmentDesc += `, ${garment.silhouette} silhouette`;
    if (garment.neckline) garmentDesc += `, ${garment.neckline} neckline`;
    if (garment.sleeveLength) garmentDesc += `, ${garment.sleeveLength}`;
    if (garment.length) garmentDesc += `, ${garment.length} length`;
    
    parts.push(garmentDesc);

    // Add colors
    const colors = components.colorPalette;
    if (colors.primary) {
      let colorDesc = `${colors.primary} color`;
      if (colors.secondary) colorDesc += ` with ${colors.secondary} accents`;
      if (colors.finish) colorDesc += `, ${colors.finish} finish`;
      parts.push(colorDesc);
    }

    // Add fabric and texture
    if (garment.fabrication) {
      parts.push(`${garment.fabrication} fabric, detailed texture`);
    }

    // Add style attributes
    const style = components.styleAttributes;
    parts.push(`${style.overall} style, ${style.mood} mood`);
    if (style.keywords.length > 0) {
      parts.push(style.keywords.slice(0, 3).join(', '));
    }

    // Add lighting
    parts.push(components.lighting);

    // Add background and framing
    parts.push(components.composition.background);
    parts.push(components.composition.framing);

    // Add context if provided
    if (components.context?.occasion) {
      parts.push(`suitable for ${components.context.occasion}`);
    }
    if (components.context?.season) {
      parts.push(`${components.context.season} collection`);
    }

    return parts.join(', ');
  }

  /**
   * Build negative prompt to avoid unwanted elements
   */
  buildNegativePrompt(vltSpec, options) {
    const negatives = [
      // Quality issues
      'blurry', 'low quality', 'pixelated', 'distorted', 'deformed',
      'poorly rendered', 'amateur', 'unprofessional',
      
      // Anatomical issues
      'bad anatomy', 'extra limbs', 'missing limbs', 'floating limbs',
      'disconnected limbs', 'malformed hands', 'bad proportions',
      
      // Fashion-specific issues
      'wrinkled fabric', 'stained', 'torn', 'damaged clothing',
      'ill-fitting', 'cheap looking', 'synthetic looking',
      
      // Lighting and color issues
      'overexposed', 'underexposed', 'wrong white balance',
      'color bleeding', 'posterization',
      
      // Composition issues
      'cropped awkwardly', 'bad framing', 'cluttered background',
      'distracting elements', 'busy background',
      
      // General unwanted elements
      'watermark', 'text', 'logo', 'signature',
      'multiple people', 'duplicate', 'collage'
    ];

    return negatives.join(', ');
  }

  /**
   * Generate multiple prompt variations for diverse outputs
   * @param {Object} vltSpec - VLT specification
   * @param {number} count - Number of variations to generate
   * @param {Object} options - Generation options
   * @returns {Array} Array of prompt variations
   */
  generateVariations(vltSpec, count = 3, options = {}) {
    const variations = [];
    
    // Create base prompt
    const basePrompt = this.generatePrompt(vltSpec, options);
    variations.push(basePrompt);

    // Generate variations with different lighting/angles
    const lightingVariations = [
      'dramatic side lighting',
      'soft natural window light',
      'bright studio lighting',
      'moody atmospheric lighting'
    ];

    const angleVariations = [
      'front view, straight on',
      '3/4 front angle view',
      'straight-on front view',
      'front-facing position'
    ]; // All front-facing views only

    for (let i = 1; i < count; i++) {
      const variantOptions = {
        ...options,
        lighting: lightingVariations[i % lightingVariations.length],
        angle: angleVariations[i % angleVariations.length]
      };

      // Modify the base prompt with variations
      const variant = {
        ...basePrompt,
        mainPrompt: basePrompt.mainPrompt
          .replace(/studio lighting[^,]*/, variantOptions.lighting)
          .replace(/straight on[^,]*/, variantOptions.angle),
        metadata: {
          ...basePrompt.metadata,
          variation: i + 1
        }
      };

      variations.push(variant);
    }

    return variations;
  }

  /**
   * Optimize prompt for specific image generation model
   * @param {Object} prompt - Generated prompt
   * @param {string} model - Target model (imagen-4-ultra, stable-diffusion, dalle-3)
   * @returns {Object} Optimized prompt for the model
   */
  optimizeForModel(prompt, model = 'imagen-4-ultra') {
    logger.info('Optimizing prompt for model', { model });

    switch (model.toLowerCase()) {
      case 'imagen-4-ultra':
        // Imagen prefers natural language, detailed descriptions
        return {
          ...prompt,
          mainPrompt: prompt.mainPrompt,
          negativePrompt: prompt.negativePrompt
        };

      case 'stable-diffusion-xl':
        // Stable Diffusion works well with weighted keywords
        return {
          ...prompt,
          mainPrompt: this.addSDXLWeighting(prompt.mainPrompt),
          negativePrompt: prompt.negativePrompt
        };

      case 'dalle-3':
        // DALL-E 3 prefers concise, natural descriptions
        return {
          ...prompt,
          mainPrompt: this.simplifyForDALLE(prompt.mainPrompt),
          negativePrompt: '' // DALL-E 3 doesn't support negative prompts
        };

      default:
        return prompt;
    }
  }

  /**
   * Add Stable Diffusion XL style weighting to important keywords
   */
  addSDXLWeighting(prompt) {
    // Add (keyword:1.2) style weighting to important terms
    const importantTerms = [
      'high fashion', 'professional', 'studio quality',
      'elegant', 'sophisticated', 'detailed'
    ];

    let weightedPrompt = prompt;
    importantTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      weightedPrompt = weightedPrompt.replace(regex, `(${term}:1.2)`);
    });

    return weightedPrompt;
  }

  /**
   * Simplify prompt for DALL-E 3
   */
  simplifyForDALLE(prompt) {
    // Remove technical terms and quality modifiers that DALL-E 3 handles automatically
    const removeTerms = ['8k resolution', 'sharp focus', 'high quality', 'professional'];
    let simplified = prompt;

    removeTerms.forEach(term => {
      const regex = new RegExp(`${term}[,\\s]*`, 'gi');
      simplified = simplified.replace(regex, '');
    });

    // Clean up extra commas and spaces
    simplified = simplified.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();

    return simplified;
  }
}

module.exports = new PromptGenerationService();
