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

    // Keyword dictionaries
    this.vagueKeywords = [
      'surprise', 'random', 'varied', 'diverse', 'explore', 'discover',
      'different', 'mix', 'variety', 'some', 'any', 'whatever'
    ];

    this.preciseKeywords = [
      'exactly', 'specifically', 'must have', 'needs to be', 'should be',
      'precisely', 'definitely', 'only', 'just', 'particular'
    ];

    this.technicalFabrics = [
      'cashmere', 'merino', 'twill', 'gabardine', 'double-faced',
      'bias cut', 'pleated', 'darted', 'princess seams', 'french seams',
      'topstitched', 'raw hem', 'selvage', 'interlined'
    ];

    this.constructionTerms = [
      'structured', 'unstructured', 'oversized', 'fitted', 'slim fit',
      'relaxed fit', 'tailored', 'draped', 'gathered', 'ruched',
      'asymmetric', 'wrap', 'a-line', 'shift', 'empire waist'
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