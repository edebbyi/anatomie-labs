/**
 * Prompt Generator Agent
 * 
 * Dedicated agent for generating unique, varied fashion prompts
 * based on style profile analysis.
 * 
 * Called once per image to ensure diverse prompts.
 */

const logger = require('../utils/logger');

class PromptGeneratorAgent {
  constructor() {
    // Default garment types if profile doesn't have them
    this.defaultGarmentTypes = [
      'blazer', 'dress', 'jacket', 'coat', 'top', 'blouse',
      'skirt', 'pants', 'suit', 'gown', 'ensemble', 'cardigan'
    ];
    
    // Weight priorities for different elements
    this.weights = {
      garment: 1.4,        // Very important
      silhouette: 1.3,     // Very important
      styleTag: 1.2,       // Important
      model: 1.3,          // Important for representation
      material: 1.1,       // Somewhat important
      setting: 1.0,        // Normal importance
      quality: 1.1         // Somewhat important
    };
    
    this.moods = [
      'professional', 'elegant', 'casual', 'sophisticated', 'modern',
      'feminine', 'edgy', 'powerful', 'romantic', 'artistic',
      'minimalist', 'bold', 'refined', 'confident', 'serene'
    ];
    
    this.settings = [
      'studio backdrop',
      'outdoor natural light',
      'urban street setting',
      'minimal white background',
      'architectural setting',
      'soft diffused lighting',
      'industrial backdrop',
      'dramatic lighting',
      'ethereal background',
      'creative composition',
      'natural setting',
      'clean gradient background'
    ];
    
    // Camera angles and shot types - front-facing only
    this.cameraAngles = [
      'front view',
      'straight-on angle',
      'front facing'
    ];
    
    this.shotTypes = [
      'full body shot',
      'full length shot',
      'full body portrait'
    ];
    
    this.poses = [
      'standing pose',
      'walking pose',
      'dynamic pose',
      'static pose',
      'confident stance',
      'relaxed pose',
      'movement captured',
      'natural posture'
    ];
    
    this.styleModifiers = [
      'contemporary', 'timeless', 'avant-garde', 'classic',
      'experimental', 'traditional', 'innovative', 'signature'
    ];
    
    this.qualityTerms = [
      'high fashion editorial',
      'magazine quality',
      'professional styling',
      'detailed craftsmanship',
      'luxury fashion',
      'designer quality',
      '8k resolution',
      'impeccable tailoring'
    ];
    
    logger.info('PromptGeneratorAgent initialized');
  }
  
  /**
   * Generate a unique prompt based on style profile
   * 
   * @param {Object} styleProfile - User's style profile from Visual Analyst
   * @param {Object} options - Generation options
   * @returns {Object} Generated prompt with metadata
   */
  generatePrompt(styleProfile, options = {}) {
    const {
      index = 0,
      exploreMode = false,
      userModifiers = []
    } = options;
    
    logger.info(`Generating prompt #${index + 1}`, { exploreMode });
    
    // Extract style profile attributes
    const profileColors = styleProfile.color_palette || [];
    const profileSilhouettes = styleProfile.silhouettes || [];
    const profileMaterials = styleProfile.materials || [];
    const profileStyleTags = styleProfile.style_tags || [];
    const profileDesignElements = styleProfile.design_elements || [];
    const profileGarmentTypes = styleProfile.garment_types || this.defaultGarmentTypes;
    
    // Extract model characteristics from Visual Analyst
    const modelCharacteristics = styleProfile.model_characteristics || {};
    const skinTones = modelCharacteristics.skin_tones || [];
    const genders = modelCharacteristics.genders || [];
    const ageRanges = modelCharacteristics.age_ranges || [];
    const ethnicities = modelCharacteristics.ethnicities || [];
    
    // Extract photography characteristics from Visual Analyst
    const photographyStyle = styleProfile.photography_style || {};
    const profileCameraAngles = photographyStyle.camera_angles || this.cameraAngles;
    const profileShotTypes = photographyStyle.shot_types || this.shotTypes;
    const profilePoses = photographyStyle.poses || this.poses;
    
    // Select unique attributes for this prompt using index
    // Use garment types from the profile (extracted by Style Tagger from Visual Analyst)
    const garment = this._selectWithVariation(profileGarmentTypes, index);
    const mood = this._selectWithVariation(this.moods, index);
    const setting = this._selectWithVariation(this.settings, index);
    const styleModifier = this._selectWithVariation(this.styleModifiers, index);
    
    // Select camera angle, shot type, and pose
    const cameraAngle = this._selectWithVariation(profileCameraAngles, index);
    const shotType = this._selectWithVariation(profileShotTypes, index);
    const pose = this._selectWithVariation(profilePoses, index);
    
    // Use profile data when available, otherwise use defaults
    const color = this._selectWithVariation(
      profileColors.length > 0 ? profileColors : ['neutral', 'beige', 'black', 'white', 'navy'],
      index
    );
    
    const silhouette = this._selectWithVariation(
      profileSilhouettes.length > 0 ? profileSilhouettes : ['fitted', 'relaxed', 'structured', 'flowing'],
      index
    );
    
    const material = this._selectWithVariation(
      profileMaterials.length > 0 ? profileMaterials : ['wool', 'silk', 'cotton', 'linen', 'leather'],
      index
    );
    
    const styleTag = this._selectWithVariation(
      profileStyleTags.length > 0 ? profileStyleTags : ['contemporary', 'elegant', 'minimalist'],
      index
    );
    
    // Select model characteristics for diversity
    const modelDescriptors = [];
    
    // Add skin tone if available
    if (skinTones.length > 0) {
      const skinTone = this._selectWithVariation(skinTones, index);
      if (skinTone && skinTone !== 'unknown') {
        modelDescriptors.push(`${skinTone} skin tone model`);
      }
    }
    
    // Add gender preference if available
    if (genders.length > 0) {
      const gender = this._selectWithVariation(genders, index);
      if (gender && gender !== 'unknown') {
        modelDescriptors.push(`${gender} model`);
      }
    }
    
    // Add age range if available
    if (ageRanges.length > 0) {
      const ageRange = this._selectWithVariation(ageRanges, index);
      if (ageRange && ageRange !== 'unknown') {
        modelDescriptors.push(`${ageRange} age`);
      }
    }
    
    // Add ethnicity for diversity if available
    if (ethnicities.length > 0 && !exploreMode) {
      const ethnicity = this._selectWithVariation(ethnicities, index);
      if (ethnicity && ethnicity !== 'unknown') {
        modelDescriptors.push(`${ethnicity} ethnicity`);
      }
    }
    
    // Build core prompt elements WITH WEIGHTS
    // Using (element:weight) syntax for emphasis
    const coreElements = [
      'professional fashion photography',
      `(${shotType}:1.3)`,  // Weighted shot type - very important
      `(${cameraAngle}:1.2)`,  // Weighted camera angle
      `(${garment}:${this.weights.garment})`,  // Weighted garment type
      `(${silhouette} silhouette:${this.weights.silhouette})`,  // Weighted silhouette
      `${color} tones`,
      `(${styleTag} ${mood} style:${this.weights.styleTag})`,  // Weighted style
      `${pose}`  // Natural pose
    ];
    
    // Add model characteristics early in prompt for better adherence WITH WEIGHTS
    if (modelDescriptors.length > 0) {
      const weightedModels = modelDescriptors.map(desc => `(${desc}:${this.weights.model})`);
      coreElements.push(weightedModels.join(', '));
    }
    
    // Add material if meaningful WITH WEIGHT
    if (material && material !== 'fabric') {
      coreElements.push(`(${material} material:${this.weights.material})`);
    }
    
    // Add setting
    coreElements.push(setting);
    
    // Add quality modifiers (rotate through them) WITH WEIGHT
    const qualityMod = this._selectWithVariation(this.qualityTerms, index);
    coreElements.push(`(${qualityMod}:${this.weights.quality})`);
    
    // Add style modifier
    coreElements.push(`${styleModifier} aesthetic`);
    
    // Add user modifiers if provided
    if (userModifiers && userModifiers.length > 0) {
      coreElements.push(...userModifiers);
    }
    
    // Optionally add design elements from profile WITH BRACKETS for emphasis
    if (profileDesignElements.length > 0 && index % 3 === 0) {
      const designElement = this._selectWithVariation(profileDesignElements, index);
      coreElements.push(`[${designElement}]`);  // Brackets for subtle emphasis
    }
    
    // Assemble final prompt
    const mainPrompt = coreElements.join(', ');
    
    // Generate negative prompt
    const negativePrompt = this._generateNegativePrompt();
    
    // Calculate prompt stats
    const wordCount = mainPrompt.split(/[\s,]+/).filter(w => w.length > 0).length;
    
    logger.info(`Generated prompt #${index + 1}:`, {
      garment,
      mood,
      color,
      silhouette,
      cameraAngle,
      shotType,
      pose,
      modelCharacteristics: modelDescriptors.join(', ') || 'none',
      wordCount,
      promptLength: mainPrompt.length
    });
    
    return {
      mainPrompt,
      negativePrompt,
      metadata: {
        index: index + 1,
        garment,
        mood,
        setting,
        color,
        silhouette,
        material,
        styleTag,
        styleModifier,
        cameraAngle,
        shotType,
        pose,
        modelCharacteristics: modelDescriptors,
        wordCount,
        exploreMode,
        userModifiers
      }
    };
  }
  
  /**
   * Generate multiple unique prompts in batch
   * 
   * @param {Object} styleProfile - User's style profile
   * @param {number} count - Number of prompts to generate
   * @param {Object} options - Generation options
   * @returns {Array} Array of generated prompts
   */
  generateBatch(styleProfile, count = 10, options = {}) {
    logger.info(`Generating batch of ${count} prompts from style profile`);
    
    const prompts = [];
    
    for (let i = 0; i < count; i++) {
      const prompt = this.generatePrompt(styleProfile, {
        ...options,
        index: i,
        exploreMode: i > Math.floor(count / 2) // Second half explores more
      });
      
      prompts.push(prompt);
    }
    
    logger.info(`Generated ${prompts.length} unique prompts`);
    
    return prompts;
  }
  
  /**
   * Select item from array with variation based on index
   * Uses index to cycle through options deterministically
   * 
   * @private
   */
  _selectWithVariation(array, index) {
    if (!array || array.length === 0) {
      return null;
    }
    
    // Use modulo to cycle through array based on index
    return array[index % array.length];
  }
  
  /**
   * Generate negative prompt (what to avoid)
   * 
   * @private
   */
  _generateNegativePrompt() {
    return [
      'blurry', 'low quality', 'pixelated', 'distorted',
      'bad anatomy', 'poorly rendered', 'amateur',
      'wrinkled fabric', 'stained', 'damaged clothing',
      'overexposed', 'underexposed', 'bad lighting',
      'cropped awkwardly', 'cluttered background',
      'watermark', 'text', 'logo', 'multiple views',
      'collage', 'split image'
    ].join(', ');
  }
}

// Export singleton instance
module.exports = new PromptGeneratorAgent();
