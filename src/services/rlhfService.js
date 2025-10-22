const logger = require('../utils/logger');
const db = require('./database');

/**
 * Stage 5: RLHF (Reinforcement Learning with Human Feedback) Service
 * Optimizes prompts based on user feedback, generation success, and quality metrics
 * Uses reward modeling to continuously improve prompt quality
 */
class RLHFService {
  constructor() {
    // Reward weights for different feedback types
    this.rewardWeights = {
      userOutlier: 1.0,        // User marks as "outlier" (favorite)
      userComment: 0.5,        // User adds positive comment
      vltValidation: 0.7,      // VLT validation success
      generationSuccess: 0.6,  // Successful generation
      personaMatch: 0.4,       // Good persona match score
      costEfficiency: 0.3      // Cost within budget
    };

    // Learning rate for prompt optimization
    this.learningRate = 0.1;
    
    // Exploration vs exploitation balance
    this.explorationRate = 0.2;
  }

  /**
   * Optimize prompt using RLHF
   * @param {Object} prompt - Enhanced prompt to optimize
   * @param {Object} context - Context (user history, feedback, etc.)
   * @returns {Promise<Object>}
   */
  async optimizePrompt(prompt, context = {}) {
    const {
      userId,
      previousFeedback = [],
      personaData = null,
      targetQuality = 0.8
    } = context;

    logger.info('Starting RLHF prompt optimization', {
      userId,
      feedbackCount: previousFeedback.length,
      hasPersona: !!personaData
    });

    try {
      // Get historical reward data
      const historicalRewards = await this.getHistoricalRewards(userId);
      
      // Calculate current reward score
      const currentReward = this.calculateRewardScore(prompt, {
        ...context,
        historicalRewards
      });

      // Apply optimization strategies
      const optimized = await this.applyOptimizations(
        prompt,
        currentReward,
        historicalRewards,
        context
      );

      // Log optimization
      await this.logOptimization(userId, prompt, optimized, currentReward);

      logger.info('RLHF optimization completed', {
        userId,
        rewardImprovement: (optimized.expectedReward - currentReward.totalReward).toFixed(3),
        modificationsApplied: optimized.modifications.length
      });

      return {
        originalPrompt: prompt,
        optimizedPrompt: optimized.prompt,
        currentReward: currentReward.totalReward,
        expectedReward: optimized.expectedReward,
        modifications: optimized.modifications,
        confidence: optimized.confidence,
        metadata: {
          strategy: optimized.strategy,
          learningRate: this.learningRate,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('RLHF optimization failed', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate reward score for prompt
   * @param {Object} prompt - Prompt to score
   * @param {Object} context - Context data
   * @returns {Object}
   */
  calculateRewardScore(prompt, context = {}) {
    const scores = {
      baseQuality: 0,
      userFeedback: 0,
      validationScore: 0,
      personaAlignment: 0,
      costEfficiency: 0
    };

    // Base quality from prompt characteristics
    scores.baseQuality = this.assessPromptQuality(prompt);

    // User feedback score
    if (context.previousFeedback && context.previousFeedback.length > 0) {
      scores.userFeedback = this.calculateUserFeedbackScore(context.previousFeedback);
    }

    // Persona alignment
    if (context.personaData && context.personaData.matchScore) {
      scores.personaAlignment = context.personaData.matchScore;
    }

    // Historical performance
    if (context.historicalRewards && context.historicalRewards.avgReward) {
      scores.validationScore = context.historicalRewards.avgReward;
    }

    // Cost efficiency (placeholder - would use actual generation costs)
    scores.costEfficiency = 0.7;

    // Weighted total
    const totalReward = 
      scores.baseQuality * 0.3 +
      scores.userFeedback * 0.3 +
      scores.validationScore * 0.2 +
      scores.personaAlignment * 0.1 +
      scores.costEfficiency * 0.1;

    return {
      ...scores,
      totalReward,
      breakdown: scores
    };
  }

  /**
   * Assess base prompt quality
   */
  assessPromptQuality(prompt) {
    const mainPrompt = prompt.enhanced?.mainPrompt || prompt.mainPrompt || '';
    const keywords = prompt.enhanced?.keywords || [];
    
    let score = 0.5; // baseline

    // Length check (sweet spot 100-300 words)
    const wordCount = mainPrompt.split(/\s+/).length;
    if (wordCount >= 50 && wordCount <= 150) {
      score += 0.2;
    } else if (wordCount > 150 && wordCount <= 250) {
      score += 0.1;
    }

    // Keyword richness
    if (keywords.length >= 5) {
      score += 0.1;
    }
    if (keywords.length >= 10) {
      score += 0.1;
    }

    // Specificity indicators
    const specificityTerms = ['specific', 'detailed', 'precise', 'exact', 'particular'];
    if (specificityTerms.some(term => mainPrompt.toLowerCase().includes(term))) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate user feedback score
   */
  calculateUserFeedbackScore(feedbackList) {
    if (feedbackList.length === 0) return 0.5;

    let totalScore = 0;
    let weightSum = 0;

    feedbackList.forEach(feedback => {
      let feedbackScore = 0;
      let weight = 1.0;

      // Recency weight (more recent = higher weight)
      const ageInDays = feedback.ageInDays || 0;
      weight = Math.exp(-ageInDays / 30); // Exponential decay over 30 days

      switch (feedback.type) {
        case 'outlier':
          feedbackScore = 1.0;
          break;
        case 'heart':
          feedbackScore = 0.9;
          break;
        case 'positive_comment':
          feedbackScore = 0.8;
          break;
        case 'neutral_comment':
          feedbackScore = 0.5;
          break;
        case 'negative_comment':
          feedbackScore = 0.2;
          break;
        case 'dislike':
          feedbackScore = 0.1;
          break;
        default:
          feedbackScore = 0.5;
      }

      totalScore += feedbackScore * weight;
      weightSum += weight;
    });

    return weightSum > 0 ? totalScore / weightSum : 0.5;
  }

  /**
   * Apply optimizations to prompt
   */
  async applyOptimizations(prompt, currentReward, historicalRewards, context) {
    const modifications = [];
    let optimizedPrompt = JSON.parse(JSON.stringify(prompt)); // deep copy
    let expectedReward = currentReward.totalReward;

    // Strategy 1: Enhance low-performing aspects
    if (currentReward.baseQuality < 0.6) {
      const qualityMod = this.enhancePromptQuality(optimizedPrompt);
      if (qualityMod) {
        modifications.push(qualityMod);
        expectedReward += 0.1;
      }
    }

    // Strategy 2: Incorporate successful patterns from history
    if (historicalRewards && historicalRewards.successfulPatterns) {
      const patternMod = this.incorporateSuccessfulPatterns(
        optimizedPrompt,
        historicalRewards.successfulPatterns
      );
      if (patternMod) {
        modifications.push(patternMod);
        expectedReward += 0.15;
      }
    }

    // Strategy 3: Address user feedback patterns
    if (context.previousFeedback && context.previousFeedback.length > 0) {
      const feedbackMod = this.applyFeedbackLearning(
        optimizedPrompt,
        context.previousFeedback
      );
      if (feedbackMod) {
        modifications.push(feedbackMod);
        expectedReward += 0.12;
      }
    }

    // Strategy 4: Exploration (try variations)
    if (Math.random() < this.explorationRate) {
      const explorationMod = this.applyExploration(optimizedPrompt);
      if (explorationMod) {
        modifications.push(explorationMod);
        modifications.push({
          type: 'exploration',
          description: 'Applied exploration strategy for learning'
        });
      }
    }

    // Ensure expected reward doesn't exceed 1.0
    expectedReward = Math.min(expectedReward, 1.0);

    return {
      prompt: optimizedPrompt,
      expectedReward,
      modifications,
      confidence: this.calculateConfidence(modifications.length, currentReward.totalReward),
      strategy: modifications.length > 0 ? 'optimized' : 'unchanged'
    };
  }

  /**
   * Enhance prompt quality
   */
  enhancePromptQuality(prompt) {
    let mainPrompt = prompt.enhanced?.mainPrompt || prompt.mainPrompt || '';
    const keywords = prompt.enhanced?.keywords || [];

    // Add quality descriptors if missing
    const qualityTerms = ['high quality', 'professional', 'detailed', 'sharp'];
    const hasQualityTerms = qualityTerms.some(term => 
      mainPrompt.toLowerCase().includes(term)
    );

    if (!hasQualityTerms) {
      mainPrompt += ', high quality, professional photography, sharp details';
      
      if (prompt.enhanced) {
        prompt.enhanced.mainPrompt = mainPrompt;
      } else {
        prompt.mainPrompt = mainPrompt;
      }

      return {
        type: 'quality_enhancement',
        description: 'Added quality descriptors',
        impact: 'positive',
        confidence: 0.8
      };
    }

    return null;
  }

  /**
   * Incorporate successful patterns from history
   */
  incorporateSuccessfulPatterns(prompt, patterns) {
    if (!patterns || patterns.length === 0) return null;

    // Find top patterns
    const topPatterns = patterns
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3);

    let mainPrompt = prompt.enhanced?.mainPrompt || prompt.mainPrompt || '';
    let modified = false;

    topPatterns.forEach(pattern => {
      if (!mainPrompt.includes(pattern.term) && pattern.successRate > 0.7) {
        mainPrompt += `, ${pattern.term}`;
        modified = true;
      }
    });

    if (modified) {
      if (prompt.enhanced) {
        prompt.enhanced.mainPrompt = mainPrompt;
      } else {
        prompt.mainPrompt = mainPrompt;
      }

      return {
        type: 'pattern_incorporation',
        description: `Added successful patterns: ${topPatterns.map(p => p.term).join(', ')}`,
        impact: 'positive',
        confidence: 0.7
      };
    }

    return null;
  }

  /**
   * Apply feedback learning
   */
  applyFeedbackLearning(prompt, feedback) {
    // Analyze feedback for common themes
    const positiveThemes = feedback
      .filter(f => ['outlier', 'heart', 'positive_comment'].includes(f.type))
      .flatMap(f => f.keywords || []);

    const negativeThemes = feedback
      .filter(f => ['negative_comment', 'dislike'].includes(f.type))
      .flatMap(f => f.keywords || []);

    let mainPrompt = prompt.enhanced?.mainPrompt || prompt.mainPrompt || '';
    let modified = false;

    // Emphasize positive themes
    if (positiveThemes.length > 0) {
      const topPositive = this.getMostFrequent(positiveThemes, 2);
      topPositive.forEach(theme => {
        if (!mainPrompt.includes(theme)) {
          mainPrompt += `, emphasizing ${theme}`;
          modified = true;
        }
      });
    }

    // De-emphasize negative themes
    if (negativeThemes.length > 0) {
      const topNegative = this.getMostFrequent(negativeThemes, 2);
      let negativePrompt = prompt.enhanced?.negativePrompt || prompt.negativePrompt || '';
      topNegative.forEach(theme => {
        if (!negativePrompt.includes(theme)) {
          negativePrompt += `, ${theme}`;
          modified = true;
        }
      });
      
      if (prompt.enhanced) {
        prompt.enhanced.negativePrompt = negativePrompt;
      } else {
        prompt.negativePrompt = negativePrompt;
      }
    }

    if (modified) {
      if (prompt.enhanced) {
        prompt.enhanced.mainPrompt = mainPrompt;
      } else {
        prompt.mainPrompt = mainPrompt;
      }

      return {
        type: 'feedback_learning',
        description: 'Applied user feedback patterns',
        impact: 'positive',
        confidence: 0.75
      };
    }

    return null;
  }

  /**
   * Apply exploration (try variations)
   */
  applyExploration(prompt) {
    const variations = [
      'cinematic lighting',
      '8k resolution',
      'award-winning photography',
      'bokeh effect',
      'golden hour lighting',
      'dramatic composition'
    ];

    const randomVariation = variations[Math.floor(Math.random() * variations.length)];
    let mainPrompt = prompt.enhanced?.mainPrompt || prompt.mainPrompt || '';

    if (!mainPrompt.includes(randomVariation)) {
      mainPrompt += `, ${randomVariation}`;
      
      if (prompt.enhanced) {
        prompt.enhanced.mainPrompt = mainPrompt;
      } else {
        prompt.mainPrompt = mainPrompt;
      }

      return {
        type: 'exploration_variation',
        variation: randomVariation
      };
    }

    return null;
  }

  /**
   * Get most frequent items from array
   */
  getMostFrequent(arr, count) {
    const frequency = {};
    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([item]) => item);
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(modificationCount, baseReward) {
    // More modifications = lower confidence (more experimental)
    // Higher base reward = higher confidence
    
    const modConfidence = Math.max(0.5, 1.0 - (modificationCount * 0.1));
    const rewardConfidence = baseReward;
    
    return (modConfidence + rewardConfidence) / 2;
  }

  /**
   * Get historical rewards for user
   */
  async getHistoricalRewards(userId) {
    try {
      const result = await db.query(
        `SELECT 
           AVG(reward_score) as avg_reward,
           COUNT(*) as total_optimizations,
           json_agg(
             json_build_object(
               'term', successful_terms,
               'successRate', success_rate
             )
           ) FILTER (WHERE success_rate > 0.7) as successful_patterns
         FROM prompt_optimizations
         WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '60 days'
         GROUP BY user_id`,
        [userId]
      );

      if (result.rows.length > 0) {
        return {
          avgReward: parseFloat(result.rows[0].avg_reward) || 0.5,
          totalOptimizations: parseInt(result.rows[0].total_optimizations) || 0,
          successfulPatterns: result.rows[0].successful_patterns || []
        };
      }

      return { avgReward: 0.5, totalOptimizations: 0, successfulPatterns: [] };

    } catch (error) {
      logger.warn('Failed to fetch historical rewards', {
        userId,
        error: error.message
      });
      return { avgReward: 0.5, totalOptimizations: 0, successfulPatterns: [] };
    }
  }

  /**
   * Log optimization to database
   */
  async logOptimization(userId, original, optimized, reward) {
    try {
      await db.query(
        `INSERT INTO prompt_optimizations 
         (user_id, original_prompt, optimized_prompt, reward_score, 
          modifications, expected_reward, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          JSON.stringify(original),
          JSON.stringify(optimized.prompt),
          reward.totalReward,
          JSON.stringify(optimized.modifications),
          optimized.expectedReward
        ]
      );
    } catch (error) {
      logger.warn('Failed to log optimization', {
        error: error.message
      });
    }
  }

  /**
   * Record reward score after generation
   * @param {Object} data - Feedback data
   */
  async recordRewardScore(data) {
    const {
      userId,
      promptId,
      imageId,
      feedbackType,
      qualityScore,
      vltValidation,
      generationSuccess,
      personaMatchScore,
      cost
    } = data;

    try {
      // Calculate total reward
      let totalReward = 0;
      const components = {};

      if (feedbackType === 'outlier') {
        components.userFeedback = this.rewardWeights.userOutlier;
        totalReward += components.userFeedback;
      } else if (feedbackType === 'positive') {
        components.userFeedback = this.rewardWeights.userComment;
        totalReward += components.userFeedback;
      }

      if (vltValidation) {
        components.vltValidation = this.rewardWeights.vltValidation * (vltValidation.score || 0);
        totalReward += components.vltValidation;
      }

      if (generationSuccess) {
        components.generationSuccess = this.rewardWeights.generationSuccess;
        totalReward += components.generationSuccess;
      }

      if (personaMatchScore) {
        components.personaMatch = this.rewardWeights.personaMatch * personaMatchScore;
        totalReward += components.personaMatch;
      }

      // Normalize to 0-1
      totalReward = Math.min(totalReward, 1.0);

      // Store in database
      await db.query(
        `INSERT INTO reward_scores 
         (user_id, prompt_id, image_id, feedback_type, total_reward, 
          components, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [userId, promptId, imageId, feedbackType, totalReward, JSON.stringify(components)]
      );

      logger.info('Reward score recorded', {
        userId,
        promptId,
        totalReward: totalReward.toFixed(3)
      });

      return { success: true, totalReward, components };

    } catch (error) {
      logger.error('Failed to record reward score', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get optimization statistics
   */
  async getOptimizationStats(userId, daysBack = 30) {
    try {
      const result = await db.query(
        `SELECT 
           COUNT(*) as total_optimizations,
           AVG(reward_score) as avg_reward_score,
           AVG(expected_reward) as avg_expected_reward,
           AVG(expected_reward - reward_score) as avg_improvement
         FROM prompt_optimizations
         WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '${daysBack} days'`,
        [userId]
      );

      if (result.rows.length > 0) {
        return {
          ...result.rows[0],
          period: `${daysBack} days`,
          timestamp: new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get optimization stats', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * NEW: Get RLHF feedback from database
   * @param {string} userId - User ID (optional)
   * @param {string} providerId - Provider ID (optional)
   * @param {number} limit - Max results
   * @returns {Promise<Object>}
   */
  async getRLHFFeedback(userId = null, providerId = null, limit = 100) {
    try {
      const client = await db.getClient();
      try {
        const result = await client.query(`
          SELECT * FROM get_rlhf_training_data(
            p_provider_id := $1,
            p_limit := $2,
            p_negative_only := FALSE,
            p_positive_only := FALSE
          )
        `, [providerId, limit]);

        const negative = result.rows.filter(r => r.is_negative);
        const positive = result.rows.filter(r => r.is_positive);

        return {
          all: result.rows,
          negative,
          positive,
          summary: {
            total: result.rows.length,
            negativeCount: negative.length,
            positiveCount: positive.length,
            avgNegativeScore: negative.length > 0 
              ? negative.reduce((sum, r) => sum + parseFloat(r.quality_score || 0), 0) / negative.length
              : 0,
            avgPositiveScore: positive.length > 0
              ? positive.reduce((sum, r) => sum + parseFloat(r.quality_score || 0), 0) / positive.length
              : 0
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get RLHF feedback', { error: error.message });
      return { all: [], negative: [], positive: [], summary: {} };
    }
  }

  /**
   * NEW: Extract patterns from feedback examples
   * @param {Array} examples - Feedback examples
   * @returns {Object} Extracted patterns
   */
  extractPatternsFromFeedback(examples) {
    const patterns = {
      commonTerms: [],
      avgScore: 0,
      providers: {},
      feedbackTypes: {}
    };

    if (examples.length === 0) return patterns;

    // Calculate average score
    patterns.avgScore = examples.reduce((sum, ex) => 
      sum + parseFloat(ex.quality_score || 0), 0
    ) / examples.length;

    // Group by provider
    examples.forEach(ex => {
      const provider = ex.provider_name || 'unknown';
      if (!patterns.providers[provider]) {
        patterns.providers[provider] = { count: 0, avgScore: 0, scores: [] };
      }
      patterns.providers[provider].count++;
      patterns.providers[provider].scores.push(parseFloat(ex.quality_score || 0));
    });

    // Calculate provider averages
    Object.keys(patterns.providers).forEach(provider => {
      const data = patterns.providers[provider];
      data.avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      delete data.scores; // Clean up
    });

    // Group by feedback type
    examples.forEach(ex => {
      const type = ex.feedback_type || 'unknown';
      patterns.feedbackTypes[type] = (patterns.feedbackTypes[type] || 0) + 1;
    });

    // Extract common terms from prompts (if available)
    const allPromptText = examples
      .map(ex => {
        try {
          const enhanced = ex.enhanced_prompt ? JSON.parse(ex.enhanced_prompt) : null;
          return enhanced?.mainPrompt || '';
        } catch {
          return '';
        }
      })
      .join(' ');

    // Simple term extraction (words that appear frequently)
    const words = allPromptText.toLowerCase()
      .match(/\b[a-z]{4,}\b/g) || [];
    
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    patterns.commonTerms = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, freq]) => ({ word, frequency: freq }));

    return patterns;
  }

  /**
   * NEW: Apply learnings from RLHF feedback to prompt
   * @param {Object} prompt - Prompt to optimize
   * @param {Object} feedback - RLHF feedback data
   * @param {Object} context - Additional context
   * @returns {Object} Modified prompt
   */
  applyRLHFLearning(prompt, feedback, context = {}) {
    const modifications = [];
    let optimizedPrompt = JSON.parse(JSON.stringify(prompt));
    
    // Extract patterns
    const negativePatterns = this.extractPatternsFromFeedback(feedback.negative);
    const positivePatterns = this.extractPatternsFromFeedback(feedback.positive);

    let mainPrompt = optimizedPrompt.enhanced?.mainPrompt || optimizedPrompt.mainPrompt || '';
    let negativePrompt = optimizedPrompt.enhanced?.negativePrompt || optimizedPrompt.negativePrompt || '';

    // Learn from negative examples: identify poor providers
    const worstProviders = Object.entries(negativePatterns.providers)
      .filter(([, data]) => data.count >= 3) // At least 3 examples
      .sort((a, b) => a[1].avgScore - b[1].avgScore)
      .slice(0, 2)
      .map(([name]) => name);

    if (worstProviders.length > 0 && context.providerId) {
      if (worstProviders.includes(context.providerId)) {
        modifications.push({
          type: 'provider_awareness',
          description: `Provider ${context.providerId} has low quality history, adding safeguards`,
          impact: 'defensive'
        });
        
        // Add more specific quality terms for problematic providers
        mainPrompt += ', extremely high quality, professional studio photography, perfect details';
      }
    }

    // Learn from positive examples: encourage successful patterns
    const positiveTerms = positivePatterns.commonTerms
      .slice(0, 3)
      .filter(t => t.frequency >= 2)
      .map(t => t.word);

    if (positiveTerms.length > 0) {
      const termsToAdd = positiveTerms.filter(term => 
        !mainPrompt.toLowerCase().includes(term)
      );

      if (termsToAdd.length > 0) {
        mainPrompt += `, ${termsToAdd.join(', ')}`;
        modifications.push({
          type: 'positive_pattern_learning',
          description: `Added successful terms: ${termsToAdd.join(', ')}`,
          impact: 'positive',
          confidence: 0.7
        });
      }
    }

    // Learn from negative examples: avoid common failure patterns
    const negativeTerms = negativePatterns.commonTerms
      .slice(0, 3)
      .filter(t => t.frequency >= 2)
      .map(t => t.word);

    if (negativeTerms.length > 0) {
      const termsToAvoid = negativeTerms.filter(term => 
        !negativePrompt.toLowerCase().includes(term)
      );

      if (termsToAvoid.length > 0) {
        negativePrompt += negativePrompt ? `, ${termsToAvoid.join(', ')}` : termsToAvoid.join(', ');
        modifications.push({
          type: 'negative_pattern_avoidance',
          description: `Avoiding problematic terms: ${termsToAvoid.join(', ')}`,
          impact: 'defensive',
          confidence: 0.6
        });
      }
    }

    // Apply modifications
    if (optimizedPrompt.enhanced) {
      optimizedPrompt.enhanced.mainPrompt = mainPrompt;
      optimizedPrompt.enhanced.negativePrompt = negativePrompt;
    } else {
      optimizedPrompt.mainPrompt = mainPrompt;
      optimizedPrompt.negativePrompt = negativePrompt;
    }

    return {
      prompt: optimizedPrompt,
      modifications,
      learningStats: {
        negativeExamples: feedback.negative.length,
        positiveExamples: feedback.positive.length,
        patternsApplied: modifications.length,
        avgNegativeScore: negativePatterns.avgScore,
        avgPositiveScore: positivePatterns.avgScore
      }
    };
  }

  /**
   * NEW: Enhanced optimize prompt with RLHF feedback
   * @param {Object} prompt - Enhanced prompt to optimize
   * @param {Object} context - Context (user history, feedback, etc.)
   * @returns {Promise<Object>}
   */
  async optimizePromptWithRLHF(prompt, context = {}) {
    const {
      userId,
      providerId,
      previousFeedback = [],
      personaData = null,
      targetQuality = 0.8
    } = context;

    logger.info('RLHF prompt optimization with feedback learning', {
      userId,
      providerId
    });

    try {
      // Get RLHF feedback data
      const feedback = await this.getRLHFFeedback(userId, providerId, 100);

      logger.info('RLHF feedback retrieved', {
        total: feedback.summary.total,
        negative: feedback.summary.negativeCount,
        positive: feedback.summary.positiveCount
      });

      // Apply original RLHF optimization
      const baseOptimization = await this.optimizePrompt(prompt, context);

      // If we have feedback data, apply additional learning
      if (feedback.summary.total > 0) {
        const rlhfLearning = this.applyRLHFLearning(
          baseOptimization.optimizedPrompt,
          feedback,
          { providerId }
        );

        // Merge modifications
        const allModifications = [
          ...baseOptimization.modifications,
          ...rlhfLearning.modifications
        ];

        return {
          originalPrompt: prompt,
          optimizedPrompt: rlhfLearning.prompt,
          currentReward: baseOptimization.currentReward,
          expectedReward: baseOptimization.expectedReward + 0.1, // Boost from RLHF learning
          modifications: allModifications,
          confidence: baseOptimization.confidence,
          rlhfLearning: rlhfLearning.learningStats,
          metadata: {
            ...baseOptimization.metadata,
            rlhfEnabled: true,
            feedbackUsed: feedback.summary
          }
        };
      }

      // No feedback data, return base optimization
      return {
        ...baseOptimization,
        rlhfLearning: { enabled: false, reason: 'No feedback data available' }
      };

    } catch (error) {
      logger.error('RLHF optimization with feedback failed', {
        userId,
        error: error.message
      });
      // Fall back to base optimization
      return await this.optimizePrompt(prompt, context);
    }
  }
}

module.exports = new RLHFService();
