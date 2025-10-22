const logger = require('../utils/logger');
const db = require('./database');

/**
 * Stage 4: Model Routing Service
 * Intelligently routes prompts to optimal image generation models
 * based on characteristics, cost, quality requirements, and historical performance
 */
class ModelRoutingService {
  constructor() {
    // Model provider configurations
    this.providers = {
      'google-imagen': {
        id: 'google-imagen',
        name: 'Google Imagen 4 Ultra',
        costPerImage: 0.04,
        avgQuality: 0.90,
        avgLatency: 8000, // ms
        maxResolution: { width: 1024, height: 1024 },
        strengths: ['photorealism', 'fashion', 'complex-compositions', 'color-accuracy'],
        weaknesses: ['abstract-art', 'text-in-image'],
        supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        rateLimit: 100, // per minute
        available: !!process.env.GOOGLE_CLOUD_PROJECT_ID
      },
      'openai-dalle3': {
        id: 'openai-dalle3',
        name: 'DALL-E 3',
        costPerImage: 0.08,
        avgQuality: 0.88,
        avgLatency: 12000,
        maxResolution: { width: 1024, height: 1024 },
        strengths: ['artistic', 'creative-concepts', 'text-in-image', 'diverse-styles'],
        weaknesses: ['photorealism', 'specific-fashion-details'],
        supportedAspectRatios: ['1:1', '16:9', '9:16'],
        rateLimit: 50,
        available: !!process.env.OPENAI_API_KEY
      },
      'midjourney-v6': {
        id: 'midjourney-v6',
        name: 'Midjourney v6',
        costPerImage: 0.06,
        avgQuality: 0.92,
        avgLatency: 25000,
        maxResolution: { width: 2048, height: 2048 },
        strengths: ['artistic', 'fashion', 'editorial', 'style-consistency'],
        weaknesses: ['speed', 'api-access'],
        supportedAspectRatios: ['1:1', '2:3', '3:2', '16:9', '9:16'],
        rateLimit: 20,
        available: !!process.env.MIDJOURNEY_API_KEY
      },
      'stable-diffusion-xl': {
        id: 'stable-diffusion-xl',
        name: 'Stable Diffusion XL',
        costPerImage: 0.02,
        avgQuality: 0.82,
        avgLatency: 6000,
        maxResolution: { width: 1024, height: 1024 },
        strengths: ['cost-effective', 'fast', 'customizable', 'flexibility'],
        weaknesses: ['quality-consistency', 'fashion-accuracy'],
        supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
        rateLimit: 200,
        available: !!process.env.REPLICATE_API_TOKEN
      }
    };

    // Routing strategies
    this.strategies = {
      QUALITY_FIRST: 'quality_first',
      COST_OPTIMIZED: 'cost_optimized',
      BALANCED: 'balanced',
      SPEED_OPTIMIZED: 'speed_optimized',
      CUSTOM: 'custom'
    };
  }

  /**
   * Route prompt to optimal model
   * @param {Object} enhancedPrompt - Enhanced prompt from Stage 2
   * @param {Object} options - Routing options
   * @returns {Promise<Object>}
   */
  async routePrompt(enhancedPrompt, options = {}) {
    const {
      strategy = this.strategies.BALANCED,
      constraints = {},
      userId = null,
      personaData = null
    } = options;

    logger.info('Starting model routing', {
      strategy,
      userId,
      hasPersona: !!personaData
    });

    try {
      // Extract prompt features
      const features = this.extractPromptFeatures(enhancedPrompt);
      
      // Get available providers
      const availableProviders = this.getAvailableProviders();
      
      if (availableProviders.length === 0) {
        throw new Error('No image generation providers configured');
      }

      // Score each provider
      const scores = await this.scoreProviders(
        availableProviders,
        features,
        strategy,
        constraints,
        userId
      );

      // Select best provider
      const selectedProvider = this.selectProvider(scores, strategy);

      // Log routing decision
      await this.logRoutingDecision(
        userId,
        enhancedPrompt,
        selectedProvider,
        scores,
        features
      );

      logger.info('Model routing completed', {
        selectedModel: selectedProvider.provider.name,
        score: selectedProvider.totalScore.toFixed(3),
        strategy
      });

      return {
        provider: selectedProvider.provider,
        score: selectedProvider.totalScore,
        reasoning: selectedProvider.reasoning,
        alternatives: scores.slice(1, 3).map(s => ({
          provider: s.provider.name,
          score: s.totalScore,
          reason: this.generateAlternativeReason(s, selectedProvider)
        })),
        features,
        metadata: {
          strategy,
          availableProviders: availableProviders.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Model routing failed', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  /**
   * Extract features from enhanced prompt
   * @param {Object} enhancedPrompt - Enhanced prompt
   * @returns {Object}
   */
  extractPromptFeatures(enhancedPrompt) {
    const mainPrompt = enhancedPrompt.enhanced?.mainPrompt || enhancedPrompt.mainPrompt || '';
    let keywords = enhancedPrompt.enhanced?.keywords || [];
    // Handle keywords being an object or array
    if (keywords && typeof keywords === 'object' && !Array.isArray(keywords)) {
      keywords = Object.values(keywords).flat();
    }
    if (!Array.isArray(keywords)) {
      keywords = [];
    }
    const photographyStyle = enhancedPrompt.enhanced?.photographyStyle || 'unknown';

    // Analyze prompt characteristics
    const features = {
      complexity: this.assessComplexity(mainPrompt, keywords),
      styleType: this.determineStyleType(mainPrompt, keywords),
      realismLevel: this.assessRealismLevel(mainPrompt, photographyStyle),
      detailLevel: this.assessDetailLevel(mainPrompt),
      colorComplexity: this.assessColorComplexity(mainPrompt),
      hasText: /\b(text|word|letter|label|sign)\b/i.test(mainPrompt),
      isFashion: /\b(dress|suit|garment|fabric|clothing|fashion)\b/i.test(mainPrompt),
      isEditorial: /\b(editorial|magazine|professional|studio)\b/i.test(mainPrompt),
      promptLength: mainPrompt.length,
      keywordCount: keywords.length
    };

    return features;
  }

  /**
   * Assess prompt complexity (0-1)
   */
  assessComplexity(prompt, keywords) {
    let score = 0;
    
    // Length-based
    if (prompt.length > 200) score += 0.3;
    else if (prompt.length > 100) score += 0.2;
    else score += 0.1;
    
    // Keyword count
    if (keywords.length > 10) score += 0.3;
    else if (keywords.length > 5) score += 0.2;
    else score += 0.1;
    
    // Complexity indicators
    const complexityIndicators = [
      'intricate', 'detailed', 'complex', 'multiple', 'layered',
      'varied', 'diverse', 'elaborate', 'sophisticated'
    ];
    const hasComplexityWords = complexityIndicators.some(word => 
      prompt.toLowerCase().includes(word)
    );
    if (hasComplexityWords) score += 0.4;
    
    return Math.min(score, 1.0);
  }

  /**
   * Determine style type
   */
  determineStyleType(prompt, keywords) {
    const lowerPrompt = prompt.toLowerCase();
    // Filter and convert keywords to strings
    const keywordStrings = keywords
      .filter(k => k && (typeof k === 'string' || typeof k === 'number'))
      .map(k => String(k).toLowerCase());
    const allTerms = [...keywordStrings, lowerPrompt];
    
    const stylePatterns = {
      photorealistic: ['photorealistic', 'realistic', 'photo', 'photography', 'real'],
      artistic: ['artistic', 'art', 'painting', 'illustration', 'stylized'],
      editorial: ['editorial', 'magazine', 'fashion', 'professional'],
      abstract: ['abstract', 'conceptual', 'surreal', 'avant-garde'],
      minimalist: ['minimalist', 'simple', 'clean', 'minimal']
    };

    for (const [style, patterns] of Object.entries(stylePatterns)) {
      if (patterns.some(pattern => allTerms.some(term => term.includes(pattern)))) {
        return style;
      }
    }

    return 'general';
  }

  /**
   * Assess realism level (0-1)
   */
  assessRealismLevel(prompt, photographyStyle) {
    let score = 0.5; // Default

    const realisticTerms = ['photorealistic', 'realistic', 'real', 'photography', 'photo'];
    const artisticTerms = ['artistic', 'stylized', 'illustration', 'painted', 'abstract'];
    
    const lowerPrompt = prompt.toLowerCase();
    
    if (realisticTerms.some(term => lowerPrompt.includes(term))) {
      score += 0.3;
    }
    
    if (artisticTerms.some(term => lowerPrompt.includes(term))) {
      score -= 0.3;
    }

    if (photographyStyle === 'studio' || photographyStyle === 'editorial') {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Assess detail level (0-1)
   */
  assessDetailLevel(prompt) {
    const detailWords = ['detailed', 'intricate', 'precise', 'specific', 'exact', 'fine'];
    const lowerPrompt = prompt.toLowerCase();
    
    let score = 0.3; // Base
    
    detailWords.forEach(word => {
      if (lowerPrompt.includes(word)) score += 0.15;
    });

    // Length as proxy for detail
    if (prompt.length > 150) score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Assess color complexity (0-1)
   */
  assessColorComplexity(prompt) {
    const colorWords = prompt.match(/\b(color|colour|hue|shade|tone|tint|vibrant|muted|pastel|bright|dark)\b/gi);
    const specificColors = prompt.match(/\b(red|blue|green|yellow|orange|purple|pink|black|white|gray|grey|brown|beige|navy|teal|crimson|emerald|sapphire)\b/gi);
    
    let score = 0.2; // Base
    
    if (colorWords) score += Math.min(colorWords.length * 0.1, 0.3);
    if (specificColors) score += Math.min(specificColors.length * 0.15, 0.5);
    
    return Math.min(score, 1.0);
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.values(this.providers).filter(p => p.available);
  }

  /**
   * Score providers based on features and strategy
   */
  async scoreProviders(providers, features, strategy, constraints, userId) {
    const scores = [];

    for (const provider of providers) {
      const score = await this.scoreProvider(provider, features, strategy, constraints, userId);
      scores.push({
        provider,
        ...score
      });
    }

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    return scores;
  }

  /**
   * Score individual provider
   */
  async scoreProvider(provider, features, strategy, constraints, userId) {
    const scores = {
      qualityScore: 0,
      costScore: 0,
      speedScore: 0,
      suitabilityScore: 0,
      historicalScore: 0
    };

    // Quality score (base quality + feature matching)
    scores.qualityScore = provider.avgQuality;
    
    // Suitability score based on strengths/weaknesses
    scores.suitabilityScore = this.calculateSuitability(provider, features);

    // Cost score (inverse - lower cost = higher score)
    const maxCost = Math.max(...Object.values(this.providers).map(p => p.costPerImage));
    scores.costScore = 1 - (provider.costPerImage / maxCost);

    // Speed score (inverse - lower latency = higher score)
    const maxLatency = Math.max(...Object.values(this.providers).map(p => p.avgLatency));
    scores.speedScore = 1 - (provider.avgLatency / maxLatency);

    // Historical performance (from database if available)
    if (userId) {
      scores.historicalScore = await this.getHistoricalPerformance(provider.id, userId);
    } else {
      scores.historicalScore = 0.5; // neutral
    }

    // Apply strategy weights
    const weights = this.getStrategyWeights(strategy, constraints);
    
    const totalScore = 
      scores.qualityScore * weights.quality +
      scores.costScore * weights.cost +
      scores.speedScore * weights.speed +
      scores.suitabilityScore * weights.suitability +
      scores.historicalScore * weights.historical;

    return {
      ...scores,
      totalScore,
      weights,
      reasoning: this.generateReasoning(provider, scores, features, strategy)
    };
  }

  /**
   * Calculate suitability score based on provider strengths/weaknesses
   */
  calculateSuitability(provider, features) {
    let score = 0.5; // neutral base

    // Check strengths
    if (features.realismLevel > 0.7 && provider.strengths.includes('photorealism')) {
      score += 0.2;
    }
    if (features.isFashion && provider.strengths.includes('fashion')) {
      score += 0.2;
    }
    if (features.isEditorial && provider.strengths.includes('editorial')) {
      score += 0.15;
    }
    if (features.styleType === 'artistic' && provider.strengths.includes('artistic')) {
      score += 0.2;
    }
    if (features.hasText && provider.strengths.includes('text-in-image')) {
      score += 0.25;
    }
    if (features.complexity > 0.7 && provider.strengths.includes('complex-compositions')) {
      score += 0.15;
    }

    // Check weaknesses
    if (features.realismLevel > 0.7 && provider.weaknesses.includes('photorealism')) {
      score -= 0.2;
    }
    if (features.isFashion && provider.weaknesses.includes('fashion-accuracy')) {
      score -= 0.2;
    }
    if (features.hasText && provider.weaknesses.includes('text-in-image')) {
      score -= 0.25;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get strategy weights
   */
  getStrategyWeights(strategy, constraints = {}) {
    const baseWeights = {
      quality: 0.3,
      cost: 0.2,
      speed: 0.15,
      suitability: 0.25,
      historical: 0.1
    };

    switch (strategy) {
      case this.strategies.QUALITY_FIRST:
        return { quality: 0.45, cost: 0.05, speed: 0.1, suitability: 0.3, historical: 0.1 };
      
      case this.strategies.COST_OPTIMIZED:
        return { quality: 0.15, cost: 0.45, speed: 0.1, suitability: 0.2, historical: 0.1 };
      
      case this.strategies.SPEED_OPTIMIZED:
        return { quality: 0.2, cost: 0.1, speed: 0.45, suitability: 0.15, historical: 0.1 };
      
      case this.strategies.BALANCED:
        return baseWeights;
      
      case this.strategies.CUSTOM:
        return {
          quality: constraints.qualityWeight || 0.3,
          cost: constraints.costWeight || 0.2,
          speed: constraints.speedWeight || 0.15,
          suitability: constraints.suitabilityWeight || 0.25,
          historical: constraints.historicalWeight || 0.1
        };
      
      default:
        return baseWeights;
    }
  }

  /**
   * Get historical performance from database
   */
  async getHistoricalPerformance(providerId, userId) {
    try {
      const result = await db.query(
        `SELECT AVG(success_rate) as avg_success, AVG(quality_score) as avg_quality
         FROM model_performance_metrics
         WHERE provider_id = $1 AND user_id = $2
         AND created_at >= NOW() - INTERVAL '30 days'`,
        [providerId, userId]
      );

      if (result.rows.length > 0 && result.rows[0].avg_success) {
        const avgSuccess = parseFloat(result.rows[0].avg_success) || 0.5;
        const avgQuality = parseFloat(result.rows[0].avg_quality) || 0.5;
        return (avgSuccess + avgQuality) / 2;
      }

      return 0.5; // neutral if no data
    } catch (error) {
      logger.warn('Failed to fetch historical performance', {
        providerId,
        userId,
        error: error.message
      });
      return 0.5;
    }
  }

  /**
   * Select provider from scores
   */
  selectProvider(scores, strategy) {
    // For most strategies, just return top score
    if (scores.length === 0) {
      throw new Error('No providers available');
    }

    return scores[0];
  }

  /**
   * Generate reasoning for selection
   */
  generateReasoning(provider, scores, features, strategy) {
    const reasons = [];

    if (scores.qualityScore > 0.85) {
      reasons.push(`High quality provider (${(scores.qualityScore * 100).toFixed(0)}%)`);
    }

    if (scores.suitabilityScore > 0.7) {
      reasons.push('Strong match for prompt characteristics');
    }

    if (features.isFashion && provider.strengths.includes('fashion')) {
      reasons.push('Specialized in fashion imagery');
    }

    if (features.realismLevel > 0.7 && provider.strengths.includes('photorealism')) {
      reasons.push('Excellent photorealism capabilities');
    }

    if (strategy === this.strategies.COST_OPTIMIZED && scores.costScore > 0.6) {
      reasons.push(`Cost-effective ($${provider.costPerImage}/image)`);
    }

    if (strategy === this.strategies.SPEED_OPTIMIZED && scores.speedScore > 0.6) {
      reasons.push(`Fast generation (~${(provider.avgLatency / 1000).toFixed(1)}s)`);
    }

    if (scores.historicalScore > 0.7) {
      reasons.push('Strong historical performance');
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Best overall match';
  }

  /**
   * Generate alternative reason
   */
  generateAlternativeReason(altScore, selectedScore) {
    const scoreDiff = selectedScore.totalScore - altScore.totalScore;
    
    if (scoreDiff < 0.05) {
      return 'Very close alternative';
    } else if (altScore.costScore > selectedScore.costScore) {
      return 'More cost-effective option';
    } else if (altScore.speedScore > selectedScore.speedScore) {
      return 'Faster generation time';
    } else {
      return 'Alternative option';
    }
  }

  /**
   * Log routing decision to database
   */
  async logRoutingDecision(userId, prompt, selected, allScores, features) {
    try {
      await db.query(
        `INSERT INTO routing_decisions 
         (user_id, provider_id, prompt_text, score, features, all_scores, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          selected.provider.id,
          prompt.enhanced?.mainPrompt || prompt.mainPrompt,
          selected.totalScore,
          JSON.stringify(features),
          JSON.stringify(allScores.map(s => ({
            provider: s.provider.id,
            score: s.totalScore
          })))
        ]
      );
    } catch (error) {
      // Non-critical, just log
      logger.warn('Failed to log routing decision', {
        error: error.message
      });
    }
  }

  /**
   * Get routing statistics
   */
  async getRoutingStatistics(userId = null, daysBack = 30) {
    try {
      const query = userId
        ? `SELECT provider_id, COUNT(*) as count, AVG(score) as avg_score
           FROM routing_decisions
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${daysBack} days'
           GROUP BY provider_id
           ORDER BY count DESC`
        : `SELECT provider_id, COUNT(*) as count, AVG(score) as avg_score
           FROM routing_decisions
           WHERE created_at >= NOW() - INTERVAL '${daysBack} days'
           GROUP BY provider_id
           ORDER BY count DESC`;

      const params = userId ? [userId] : [];
      const result = await db.query(query, params);

      return {
        statistics: result.rows,
        period: `${daysBack} days`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get routing statistics', {
        error: error.message
      });
      return { statistics: [], error: error.message };
    }
  }
}

module.exports = new ModelRoutingService();
