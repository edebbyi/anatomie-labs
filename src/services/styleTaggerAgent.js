/**
 * Style Tagger Agent
 * 
 * Analyzes style profile attributes and generates meaningful style tags
 * that describe the designer's aesthetic and brand identity.
 */

const logger = require('../utils/logger');

class StyleTaggerAgent {
  constructor() {
    // Style tag vocabulary organized by category
    this.styleVocabulary = {
      aesthetics: [
        'minimalist', 'maximalist', 'contemporary', 'vintage', 'retro',
        'modern', 'classic', 'timeless', 'avant-garde', 'experimental',
        'traditional', 'innovative', 'eclectic', 'refined', 'sophisticated',
        'bohemian', 'urban', 'rustic', 'industrial', 'architectural'
      ],
      moods: [
        'elegant', 'casual', 'romantic', 'edgy', 'bold', 'subtle',
        'dramatic', 'serene', 'playful', 'serious', 'luxurious',
        'comfortable', 'powerful', 'feminine', 'masculine', 'androgynous'
      ],
      techniques: [
        'tailored', 'structured', 'deconstructed', 'draped', 'layered',
        'sculptural', 'flowing', 'geometric', 'organic', 'asymmetric',
        'oversized', 'fitted', 'relaxed', 'body-conscious'
      ],
      influences: [
        'art-deco', 'bauhaus', 'japanese', 'scandinavian', 'mediterranean',
        'futuristic', 'streetwear', 'haute-couture', 'ready-to-wear',
        'sustainable', 'luxury', 'artisanal', 'handcrafted'
      ]
    };
    
    logger.info('StyleTaggerAgent initialized');
  }
  
  /**
   * Analyze and enrich style profile with tags and garment analysis
   * 
   * @param {Object} styleProfile - Complete style profile from Visual Analyst
   * @returns {Object} Enriched profile with style_tags, garment_types, and style_description
   */
  analyzeAndEnrich(styleProfile) {
    const styleTags = this.generateStyleTags(styleProfile);
    const garmentTypes = this.extractGarmentTypes(styleProfile);
    const styleDescription = this.generateStyleDescription(styleTags);
    
    return {
      style_tags: styleTags,
      garment_types: garmentTypes,
      style_description: styleDescription
    };
  }
  
  /**
   * Generate style tags from style profile
   * 
   * @param {Object} styleProfile - Complete style profile from Visual Analyst
   * @returns {Array<string>} Array of relevant style tags
   */
  generateStyleTags(styleProfile) {
    logger.info('Generating style tags from profile', {
      hasColors: !!(styleProfile.color_palette?.length),
      hasSilhouettes: !!(styleProfile.silhouettes?.length),
      hasMaterials: !!(styleProfile.materials?.length),
      hasDesignElements: !!(styleProfile.design_elements?.length)
    });
    
    const tags = new Set();
    
    // Analyze color palette for aesthetic tags
    if (styleProfile.color_palette && styleProfile.color_palette.length > 0) {
      const colorTags = this._analyzeColors(styleProfile.color_palette);
      colorTags.forEach(tag => tags.add(tag));
    }
    
    // Analyze silhouettes for technique tags
    if (styleProfile.silhouettes && styleProfile.silhouettes.length > 0) {
      const silhouetteTags = this._analyzeSilhouettes(styleProfile.silhouettes);
      silhouetteTags.forEach(tag => tags.add(tag));
    }
    
    // Analyze materials for quality/mood tags
    if (styleProfile.materials && styleProfile.materials.length > 0) {
      const materialTags = this._analyzeMaterials(styleProfile.materials);
      materialTags.forEach(tag => tags.add(tag));
    }
    
    // Analyze design elements for style tags
    if (styleProfile.design_elements && styleProfile.design_elements.length > 0) {
      const designTags = this._analyzeDesignElements(styleProfile.design_elements);
      designTags.forEach(tag => tags.add(tag));
    }
    
    // If profile has NO data at all, log warning and return empty
    if (tags.size === 0) {
      logger.warn('Style profile has no analyzable attributes - returning empty tags. This should not happen if Visual Analyst worked correctly.');
      return [];
    }
    
    // Use only actual tags from analysis, max 8 tags
    const tagArray = Array.from(tags);
    const maxTags = 8;
    
    // If we have more than max, take the most relevant ones
    const finalTags = tagArray.slice(0, maxTags);
    
    logger.info(`Generated ${finalTags.length} style tags:`, finalTags);
    
    return finalTags;
  }
  
  /**
   * Analyze color palette to infer aesthetic tags
   * @private
   */
  _analyzeColors(colors) {
    const tags = [];
    const colorLower = colors.map(c => c.toLowerCase());
    
    // Neutral/minimal palette
    const neutralColors = ['black', 'white', 'gray', 'grey', 'beige', 'cream', 'ivory'];
    const neutralCount = colorLower.filter(c => neutralColors.some(n => c.includes(n))).length;
    
    if (neutralCount >= colors.length * 0.6) {
      tags.push('minimalist');
      tags.push('modern');
    }
    
    // Bold/vibrant colors
    const boldColors = ['red', 'orange', 'yellow', 'bright', 'neon', 'electric'];
    const hasBold = colorLower.some(c => boldColors.some(b => c.includes(b)));
    
    if (hasBold) {
      tags.push('bold');
      tags.push('vibrant');
    }
    
    // Pastel/soft colors
    const pastelColors = ['pastel', 'soft', 'light', 'pale', 'blush', 'lavender'];
    const hasPastel = colorLower.some(c => pastelColors.some(p => c.includes(p)));
    
    if (hasPastel) {
      tags.push('romantic');
      tags.push('soft');
    }
    
    // Dark/moody colors
    const darkColors = ['black', 'charcoal', 'navy', 'dark', 'deep'];
    const darkCount = colorLower.filter(c => darkColors.some(d => c.includes(d))).length;
    
    if (darkCount >= colors.length * 0.5) {
      tags.push('sophisticated');
      tags.push('dramatic');
    }
    
    // Earth tones
    const earthColors = ['brown', 'tan', 'olive', 'rust', 'terracotta', 'ochre'];
    const hasEarth = colorLower.some(c => earthColors.some(e => c.includes(e)));
    
    if (hasEarth) {
      tags.push('organic');
      tags.push('natural');
    }
    
    return tags;
  }
  
  /**
   * Analyze silhouettes to infer technique tags
   * @private
   */
  _analyzeSilhouettes(silhouettes) {
    const tags = [];
    const silhouettesLower = silhouettes.map(s => s.toLowerCase());
    
    // Structured silhouettes
    if (silhouettesLower.some(s => s.includes('structured') || s.includes('tailored'))) {
      tags.push('tailored');
      tags.push('architectural');
    }
    
    // Flowing silhouettes
    if (silhouettesLower.some(s => s.includes('flowing') || s.includes('draped') || s.includes('fluid'))) {
      tags.push('flowing');
      tags.push('elegant');
    }
    
    // Fitted/body-conscious
    if (silhouettesLower.some(s => s.includes('fitted') || s.includes('slim') || s.includes('bodycon'))) {
      tags.push('fitted');
      tags.push('contemporary');
    }
    
    // Oversized/relaxed
    if (silhouettesLower.some(s => s.includes('oversized') || s.includes('relaxed') || s.includes('loose'))) {
      tags.push('relaxed');
      tags.push('urban');
    }
    
    // Asymmetric
    if (silhouettesLower.some(s => s.includes('asymmetric') || s.includes('deconstructed'))) {
      tags.push('avant-garde');
      tags.push('experimental');
    }
    
    return tags;
  }
  
  /**
   * Analyze materials to infer quality and mood tags
   * @private
   */
  _analyzeMaterials(materials) {
    const tags = [];
    const materialsLower = materials.map(m => m.toLowerCase());
    
    // Luxury materials
    const luxuryMaterials = ['silk', 'cashmere', 'leather', 'velvet', 'satin', 'suede'];
    const hasLuxury = materialsLower.some(m => luxuryMaterials.some(l => m.includes(l)));
    
    if (hasLuxury) {
      tags.push('luxury');
      tags.push('sophisticated');
    }
    
    // Natural/sustainable materials
    const naturalMaterials = ['cotton', 'linen', 'wool', 'hemp', 'bamboo', 'organic'];
    const hasNatural = materialsLower.some(m => naturalMaterials.some(n => m.includes(n)));
    
    if (hasNatural) {
      tags.push('natural');
      tags.push('sustainable');
    }
    
    // Technical/modern materials
    const technicalMaterials = ['technical', 'performance', 'neoprene', 'mesh', 'synthetic'];
    const hasTechnical = materialsLower.some(m => technicalMaterials.some(t => m.includes(t)));
    
    if (hasTechnical) {
      tags.push('modern');
      tags.push('innovative');
    }
    
    return tags;
  }
  
  /**
   * Analyze design elements to infer style tags
   * @private
   */
  _analyzeDesignElements(elements) {
    const tags = [];
    const elementsLower = elements.map(e => e.toLowerCase());
    
    // Minimal/clean design
    if (elementsLower.some(e => e.includes('minimal') || e.includes('clean') || e.includes('simple'))) {
      tags.push('minimalist');
      tags.push('refined');
    }
    
    // Detailed/ornate
    if (elementsLower.some(e => e.includes('detailed') || e.includes('ornate') || e.includes('embellished'))) {
      tags.push('detailed');
      tags.push('luxurious');
    }
    
    // Geometric
    if (elementsLower.some(e => e.includes('geometric') || e.includes('angular') || e.includes('linear'))) {
      tags.push('geometric');
      tags.push('architectural');
    }
    
    // Organic shapes
    if (elementsLower.some(e => e.includes('organic') || e.includes('curved') || e.includes('flowing'))) {
      tags.push('organic');
      tags.push('fluid');
    }
    
    return tags;
  }
  
  /**
   * Generate style description from tags
   * 
   * @param {Array<string>} tags - Style tags
   * @returns {string} Human-readable style description
   */
  generateStyleDescription(tags) {
    if (!tags || tags.length === 0) {
      return 'Contemporary fashion design';
    }
    
    // Create a natural sentence from tags
    if (tags.length === 1) {
      return `${this._capitalize(tags[0])} style`;
    }
    
    if (tags.length === 2) {
      return `${this._capitalize(tags[0])} and ${tags[1]} style`;
    }
    
    // For 3+ tags, create a more sophisticated description
    const primary = tags.slice(0, 2).join(' and ');
    const secondary = tags.slice(2, 4).join(', ');
    
    if (tags.length <= 4) {
      return `${this._capitalize(primary)} style with ${secondary} elements`;
    }
    
    return `${this._capitalize(primary)} aesthetic featuring ${secondary} and ${tags.slice(4, 6).join(', ')} design`;
  }
  
  /**
   * Extract and normalize garment types from style profile
   * 
   * @param {Object} styleProfile - Style profile from Visual Analyst
   * @returns {Array<string>} Array of garment types
   */
  extractGarmentTypes(styleProfile) {
    const garmentTypes = new Set();
    
    // Check if Visual Analyst already provided garment types
    if (styleProfile.garment_types && Array.isArray(styleProfile.garment_types)) {
      styleProfile.garment_types.forEach(g => garmentTypes.add(g));
    }
    
    // If we found types, normalize and return
    if (garmentTypes.size > 0) {
      const normalized = Array.from(garmentTypes).map(g => this._normalizeGarmentType(g));
      logger.info(`Extracted ${normalized.length} garment types:`, normalized);
      return normalized;
    }
    
    // Fallback: infer from design elements or provide defaults
    const defaults = [
      'dress', 'jacket', 'blazer', 'coat', 'top', 'blouse',
      'skirt', 'pants', 'suit', 'gown', 'ensemble', 'cardigan'
    ];
    
    logger.info('No garment types in profile, using defaults');
    return defaults;
  }
  
  /**
   * Normalize garment type names
   * @private
   */
  _normalizeGarmentType(garmentType) {
    const normalized = garmentType.toLowerCase().trim();
    
    // Map variations to standard types
    const mappings = {
      'two-piece': 'ensemble',
      'two piece': 'ensemble',
      'suit set': 'suit',
      'jacket and skirt': 'suit',
      'crop top': 'top',
      'midi dress': 'dress',
      'maxi dress': 'gown',
      'mini dress': 'dress',
      't-shirt': 'top',
      'tshirt': 'top',
      'trousers': 'pants',
      'slacks': 'pants'
    };
    
    return mappings[normalized] || normalized;
  }
  
  /**
   * Capitalize first letter
   * @private
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Export singleton instance
module.exports = new StyleTaggerAgent();
