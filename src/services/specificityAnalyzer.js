/**
 * Specificity Analyzer Service
 * 
 * Analyzes voice commands to determine specificity level and maps to appropriate creativity temperature.
 * 
 * Specificity Scale (0.0 - 1.0):
 * - 0.0-0.3: Very exploratory (vague, few descriptors, high quantity)
 * - 0.4-0.6: Moderately specific (some descriptors, medium quantity)
 * - 0.7-1.0: Highly specific (many descriptors, technical terms, low quantity)
 * 
 * Creativity Temperature (0.3 - 1.2):
 * - Inverse relationship with specificity
 * - Low specificity → High creativity (explore variations)
 * - High specificity → Low creativity (precise execution)
 */

const logger = require('../utils/logger');

class SpecificityAnalyzer {
  constructor() {
    // Configuration
    this.config = {
      minCreativity: parseFloat(process.env.MIN_CREATIVITY_TEMP) || 0.3,
      maxCreativity: parseFloat(process.env.MAX_CREATIVITY_TEMP) || 1.2,
      defaultCreativity: parseFloat(process.env.DEFAULT_CREATIVITY_TEMP) || 0.7
    };

    // EXPANDED: Vague/exploratory keywords
    this.vagueKeywords = [
      'surprise', 'random', 'varied', 'diverse', 'explore', 'discover',
      'different', 'mix', 'variety', 'some', 'any', 'whatever',
      'something', 'anything', 'various', 'assorted', 'mixed',
      'eclectic', 'experimental', 'playful', 'creative', 'unique',
      'interesting', 'cool', 'nice', 'good', 'beautiful', 'pretty'
    ];

    // EXPANDED: Precise/specific keywords
    this.preciseKeywords = [
      'exactly', 'specifically', 'must have', 'needs to be', 'should be',
      'precisely', 'definitely', 'only', 'just', 'particular',
      'strictly', 'exclusively', 'solely', 'requires', 'demands',
      'insist', 'essential', 'critical', 'exact', 'specific',
      'particular', 'certain', 'determined', 'fixed', 'set'
    ];

    // MASSIVELY EXPANDED: Technical fabrics and materials (80+ items)
    this.technicalFabrics = [
      // Luxury natural fibers
      'cashmere', 'merino', 'alpaca', 'mohair', 'angora', 'vicuna', 'qiviut',
      'sea island cotton', 'pima cotton', 'supima', 'egyptian cotton',

      // Technical/performance fabrics
      'neoprene', 'scuba', 'ponte', 'double knit', 'interlock', 'rib knit',
      'techno fabric', 'technical fabric', 'performance fabric', 'moisture-wicking',
      'quick-dry', 'stretch fabric', 'four-way stretch', 'compression fabric',

      // Luxury weaves and constructions
      'twill', 'gabardine', 'herringbone', 'houndstooth', 'glen plaid', 'prince of wales',
      'double-faced', 'double cloth', 'bonded fabric', 'laminated',

      // Specialty finishes
      'boiled wool', 'felted', 'brushed', 'napped', 'sueded', 'peached',
      'coated', 'waxed', 'oiled', 'treated', 'water-resistant', 'water-repellent',

      // High-end silk types
      'silk charmeuse', 'silk crepe de chine', 'silk georgette', 'silk satin',
      'silk taffeta', 'silk organza', 'silk habotai', 'raw silk', 'wild silk',

      // Structured fabrics
      'brocade', 'jacquard', 'damask', 'matelassé', 'cloqué', 'crêpe',
      'faille', 'ottoman', 'grosgrain', 'bengaline',

      // Knits
      'milano', 'pointelle', 'cable knit', 'intarsia', 'fair isle',
      'aran knit', 'fisherman knit', 'seed stitch', 'moss stitch',

      // Luxury blends
      'silk blend', 'wool blend', 'cashmere blend', 'linen blend',
      'cotton-silk', 'wool-cashmere', 'silk-cashmere', 'linen-silk'
    ];

    // MASSIVELY EXPANDED: Construction terms and details (100+ items)
    this.constructionTerms = [
      // Fit and silhouette
      'structured', 'unstructured', 'semi-structured', 'deconstructed',
      'oversized', 'fitted', 'slim fit', 'relaxed fit', 'tailored',
      'draped', 'gathered', 'ruched', 'smocked', 'shirred',
      'asymmetric', 'wrap', 'a-line', 'shift', 'empire waist',
      'drop waist', 'natural waist', 'high-waisted', 'mid-rise', 'low-rise',
      'bodycon', 'form-fitting', 'loose', 'flowing', 'billowing',

      // Seams and construction
      'bias cut', 'on the bias', 'straight grain', 'cross grain',
      'princess seams', 'french seams', 'flat-felled seams', 'topstitched',
      'double-stitched', 'blind stitched', 'slip stitched', 'whip stitched',
      'overlock', 'serged', 'bound seams', 'piped seams',

      // Pleating and gathering
      'pleated', 'box pleats', 'knife pleats', 'accordion pleats',
      'sunray pleats', 'cartridge pleats', 'inverted pleats',
      'gathered', 'shirred', 'smocked', 'ruched', 'elasticated',

      // Closures
      'two-way zip', 'two-way zipper', 'exposed zipper', 'concealed zipper',
      'invisible zipper', 'separating zipper', 'magnetic closure',
      'snap buttons', 'snap closure', 'hook and eye', 'frog closure',
      'toggles', 'buttons', 'covered buttons', 'self-covered buttons',
      'buttonhole', 'bound buttonhole', 'ties', 'lace-up', 'buckle',

      // Lining and interfacing
      'lined', 'fully lined', 'partially lined', 'unlined', 'raw seams',
      'interlined', 'interfaced', 'bonded', 'underlined',
      'self-lined', 'contrast lining', 'silk lining', 'satin lining',

      // Details
      'quilted', 'padded', 'wadded', 'down-filled', 'insulated',
      'reversible', 'double-faced', 'double-sided',
      'darted', 'darts', 'tucks', 'pintucks', 'decorative stitching',
      'contrast stitching', 'saddle stitching', 'pick stitching',
      'raw hem', 'rolled hem', 'blind hem', 'lettuce edge',
      'scalloped edge', 'frayed', 'distressed', 'fringing',

      // Pockets
      'pockets', 'patch pockets', 'welt pockets', 'besom pockets',
      'slash pockets', 'in-seam pockets', 'hidden pockets',
      'kangaroo pocket', 'cargo pockets', 'flap pockets',

      // Collars and necklines
      'collar', 'stand collar', 'mandarin collar', 'peter pan collar',
      'notched collar', 'shawl collar', 'revere collar', 'lapels',
      'hood', 'cowl neck', 'funnel neck', 'turtleneck', 'mock neck',

      // Sleeves and cuffs
      'set-in sleeves', 'raglan sleeves', 'dolman sleeves', 'batwing',
      'bell sleeves', 'bishop sleeves', 'puff sleeves', 'leg-of-mutton',
      'cuffs', 'ribbed cuffs', 'buttoned cuffs', 'barrel cuffs',
      'french cuffs', 'elastic cuffs', 'adjustable cuffs',

      // Waistbands and fastenings
      'waistband', 'elastic waistband', 'drawstring', 'tie waist',
      'belted', 'self-belt', 'contrast belt', 'D-ring belt',
      'adjustable', 'removable', 'detachable'
    ];

    // NEW: Style modifiers dictionary (100+ items)
    this.styleModifiers = [
      // Jacket styles
      'moto', 'biker', 'bomber', 'aviator', 'flight', 'varsity', 'letterman',
      'blazer', 'boyfriend blazer', 'smoking jacket', 'tuxedo jacket',
      'trench', 'trench coat', 'parka', 'anorak', 'windbreaker',
      'peacoat', 'duffle', 'car coat', 'safari', 'field jacket', 'utility',
      'shacket', 'shirt jacket', 'chore coat', 'barn jacket',

      // Coat styles
      'cocoon', 'wrap coat', 'belted coat', 'robe coat', 'duster',
      'cape', 'poncho', 'shawl', 'cardigan coat',

      // Dress styles
      'shift', 'sheath', 'wrap', 'wrap dress', 'shirt dress', 'shirtdress',
      'maxi', 'midi', 'mini', 'bodycon', 'bandage',
      'fit and flare', 'a-line', 'empire', 'empire waist',
      'trapeze', 'swing', 'tent', 'smock',
      'slip dress', 'cami dress', 'halter', 'strapless',

      // Top styles
      'tank', 'cami', 'camisole', 'tube top', 'crop top',
      'peplum', 'basque', 'tunic', 'smock top', 'peasant',
      'off-shoulder', 'one-shoulder', 'cold shoulder', 'cut-out',
      'keyhole', 'backless', 'halter', 'racerback',

      // Bottom styles
      'pencil', 'pencil skirt', 'a-line skirt', 'circle skirt', 'pleated skirt',
      'high-waisted', 'mid-rise', 'low-rise', 'high-low',
      'asymmetric', 'wrap skirt', 'sarong',

      // Pants styles
      'skinny', 'straight leg', 'wide leg', 'palazzo', 'culottes',
      'cigarette', 'ankle pants', 'cropped', 'capri',
      'bootcut', 'flare', 'bell bottom', 'sailor pants',
      'joggers', 'cargo', 'utility pants', 'paperbag',

      // Length modifiers
      'maxi', 'midi', 'mini', 'knee-length', 'ankle-length',
      'floor-length', 'tea-length', 'cocktail length',
      'cropped', 'longline', 'duster length',

      // Sleeve modifiers
      'sleeveless', 'cap sleeve', 'short sleeve', 'elbow sleeve',
      '3/4 sleeve', 'bracelet sleeve', 'long sleeve', 'extra long',

      // Neckline modifiers
      'v-neck', 'scoop neck', 'crew neck', 'boat neck', 'bateau',
      'square neck', 'sweetheart', 'jewel neck', 'illusion',

      // Fit modifiers
      'oversized', 'relaxed', 'regular fit', 'tailored fit', 'slim fit',
      'fitted', 'tight', 'loose', 'boxy', 'slouchy'
    ];

    // NEW: Pattern and print keywords (50+ items)
    this.patternKeywords = [
      // Classic patterns
      'solid', 'plain', 'monochrome', 'single color',
      'striped', 'pinstripe', 'chalk stripe', 'bengal stripe',
      'checked', 'checkered', 'gingham', 'buffalo check', 'tartan', 'plaid',
      'houndstooth', 'glen plaid', 'prince of wales', 'windowpane',
      'polka dot', 'dot', 'spotted',

      // Prints and motifs
      'floral', 'botanical', 'flower print', 'rose print', 'garden print',
      'animal print', 'leopard', 'zebra', 'snake', 'crocodile', 'python',
      'geometric', 'abstract', 'graphic', 'digital print',
      'paisley', 'damask', 'baroque', 'rococo', 'oriental',
      'tropical', 'palm', 'jungle', 'safari',
      'nautical', 'maritime', 'anchor', 'rope',
      'camouflage', 'camo', 'military print',
      'tie-dye', 'ombre', 'gradient', 'color block',
      'jacquard', 'intarsia', 'fair isle', 'argyle'
    ];
  }

  /**
   * Main analysis function
   * @param {string} command - User's voice command
   * @param {Object} entities - Extracted entities from command
   * @returns {Object} Analysis result with specificity score and creativity temperature
   */
  analyzeCommand(command, entities = {}) {
    const commandLower = command.toLowerCase();
    let specificityScore = 0;
    const factors = [];

    // FACTOR 1: Descriptor Count
    const descriptorCount = this.countDescriptors(entities);
    const descriptorScore = Math.min(descriptorCount * 0.2, 0.6);
    specificityScore += descriptorScore;
    factors.push({
      name: 'Descriptor Count',
      value: descriptorCount,
      contribution: descriptorScore,
      explanation: `${descriptorCount} descriptors (colors, styles, fabrics, modifiers)`
    });

    // FACTOR 2: Quantity Impact
    const quantity = entities.count || entities.quantity || 1;
    let quantityScore = 0;
    if (quantity === 1) {
      quantityScore = 0.3;
    } else if (quantity <= 5) {
      quantityScore = 0.2;
    } else if (quantity <= 10) {
      quantityScore = 0.1;
    }
    specificityScore += quantityScore;
    factors.push({
      name: 'Quantity',
      value: quantity,
      contribution: quantityScore,
      explanation: `Single item is more specific than batches`
    });

    // FACTOR 3: Language Precision
    const isVague = this.vagueKeywords.some(kw => commandLower.includes(kw));
    const isPrecise = this.preciseKeywords.some(kw => commandLower.includes(kw));
    
    let languageScore = 0;
    if (isVague) {
      languageScore = -0.3;
      factors.push({
        name: 'Vague Language',
        value: true,
        contribution: languageScore,
        explanation: 'Contains exploratory keywords like "surprise", "random"'
      });
    }
    if (isPrecise) {
      languageScore = 0.3;
      factors.push({
        name: 'Precise Language',
        value: true,
        contribution: languageScore,
        explanation: 'Contains specific keywords like "exactly", "must have"'
      });
    }
    specificityScore += languageScore;

    // FACTOR 4: Technical Terms
    const hasTechnicalFabric = this.technicalFabrics.some(term => 
      commandLower.includes(term)
    );
    const hasConstructionTerm = this.constructionTerms.some(term => 
      commandLower.includes(term)
    );
    
    let technicalScore = 0;
    if (hasTechnicalFabric) {
      technicalScore += 0.15;
      factors.push({
        name: 'Technical Fabric',
        value: true,
        contribution: 0.15,
        explanation: 'Specific fabric mentioned (cashmere, merino, etc.)'
      });
    }
    if (hasConstructionTerm) {
      technicalScore += 0.15;
      factors.push({
        name: 'Construction Details',
        value: true,
        contribution: 0.15,
        explanation: 'Construction terms mentioned (fitted, structured, etc.)'
      });
    }
    specificityScore += technicalScore;

    // FACTOR 5: Detailed Modifiers
    const hasDetailedModifiers = this.hasDetailedModifiers(entities);
    if (hasDetailedModifiers) {
      specificityScore += 0.1;
      factors.push({
        name: 'Detailed Modifiers',
        value: true,
        contribution: 0.1,
        explanation: 'Multiple attribute layers specified'
      });
    }

    // Normalize score to 0-1 range
    specificityScore = Math.max(0, Math.min(1, specificityScore));

    // Map to creativity temperature (inverse relationship)
    const creativityTemp = this.mapToCreativity(specificityScore);

    // Determine mode
    const mode = specificityScore > 0.5 ? 'specific' : 'exploratory';

    // Generate explanation
    const reasoning = this.generateReasoning(specificityScore, entities, factors);

    const analysis = {
      specificityScore,
      creativityTemp,
      mode,
      reasoning,
      factors,
      metadata: {
        command: command.substring(0, 100),
        descriptorCount,
        quantity,
        hasVagueLanguage: isVague,
        hasPreciseLanguage: isPrecise,
        hasTechnicalTerms: hasTechnicalFabric || hasConstructionTerm
      }
    };

    logger.info('Specificity analysis complete', {
      specificityScore: specificityScore.toFixed(3),
      creativityTemp: creativityTemp.toFixed(3),
      mode,
      command: command.substring(0, 50)
    });

    return analysis;
  }

  /**
   * Count total descriptors from entities
   */
  countDescriptors(entities) {
    let count = 0;
    
    if (entities.colors && Array.isArray(entities.colors)) {
      count += entities.colors.length;
    }
    if (entities.styles && Array.isArray(entities.styles)) {
      count += entities.styles.length;
    }
    if (entities.fabrics && Array.isArray(entities.fabrics)) {
      count += entities.fabrics.length;
    }
    if (entities.modifiers && Array.isArray(entities.modifiers)) {
      count += entities.modifiers.length;
    }
    if (entities.occasions && Array.isArray(entities.occasions)) {
      count += entities.occasions.length;
    }

    return count;
  }

  /**
   * Check if command has detailed layered modifiers
   */
  hasDetailedModifiers(entities) {
    // Detailed means multiple attribute categories specified
    const categories = [
      entities.colors?.length > 0,
      entities.styles?.length > 0,
      entities.fabrics?.length > 0,
      entities.modifiers?.length > 0
    ];

    const categoriesSpecified = categories.filter(Boolean).length;
    return categoriesSpecified >= 3;
  }

  /**
   * Map specificity score to creativity temperature
   * Inverse relationship: high specificity = low creativity
   */
  mapToCreativity(specificityScore) {
    // Inverse linear mapping
    const creativity = this.config.maxCreativity - 
                      (specificityScore * (this.config.maxCreativity - this.config.minCreativity));
    
    return parseFloat(creativity.toFixed(2));
  }

  /**
   * Generate human-readable reasoning
   */
  generateReasoning(score, entities, factors) {
    if (score > 0.7) {
      return `Highly specific command with detailed attributes (score: ${score.toFixed(2)}). ` +
             `Using precise interpretation with low creative variation. ` +
             `Key factors: ${factors.slice(0, 3).map(f => f.name).join(', ')}.`;
    } else if (score > 0.4) {
      return `Moderately specific command (score: ${score.toFixed(2)}). ` +
             `Balancing user intent with creative variation. ` +
             `Key factors: ${factors.slice(0, 2).map(f => f.name).join(', ')}.`;
    } else {
      return `Exploratory command with minimal constraints (score: ${score.toFixed(2)}). ` +
             `Using high creativity to generate diverse options. ` +
             `Suitable for discovery and inspiration.`;
    }
  }

  /**
   * Get specificity category label
   */
  getSpecificityCategory(score) {
    if (score > 0.7) return 'Very Specific';
    if (score > 0.5) return 'Specific';
    if (score > 0.3) return 'Moderate';
    if (score > 0.1) return 'Exploratory';
    return 'Very Exploratory';
  }

  /**
   * Get creativity category label
   */
  getCreativityCategory(temperature) {
    if (temperature > 1.0) return 'Very High';
    if (temperature > 0.8) return 'High';
    if (temperature > 0.6) return 'Moderate';
    if (temperature > 0.4) return 'Low';
    return 'Very Low';
  }

  /**
   * Explain analysis to user (for debugging or transparency)
   */
  explainAnalysis(analysis) {
    return {
      summary: `This command is ${this.getSpecificityCategory(analysis.specificityScore).toLowerCase()} ` +
               `and will use ${this.getCreativityCategory(analysis.creativityTemp).toLowerCase()} creativity.`,
      specificity: {
        score: analysis.specificityScore,
        category: this.getSpecificityCategory(analysis.specificityScore),
        interpretation: analysis.reasoning
      },
      creativity: {
        temperature: analysis.creativityTemp,
        category: this.getCreativityCategory(analysis.creativityTemp),
        behavior: analysis.creativityTemp > 0.8 
          ? 'Highly creative - explores variations and interpretations'
          : analysis.creativityTemp > 0.5
          ? 'Balanced - respects intent with some creative freedom'
          : 'Precise - literal interpretation with minimal variation'
      },
      mode: {
        selected: analysis.mode,
        explanation: analysis.mode === 'exploratory'
          ? 'Exploratory mode: Stratified sampling, diverse outputs'
          : 'Specific mode: Targeted retrieval, precise matching'
      },
      factors: analysis.factors.map(f => ({
        factor: f.name,
        impact: f.contribution > 0 ? '+' + f.contribution.toFixed(2) : f.contribution.toFixed(2),
        explanation: f.explanation
      }))
    };
  }
}

module.exports = SpecificityAnalyzer;