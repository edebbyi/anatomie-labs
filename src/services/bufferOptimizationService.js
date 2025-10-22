const logger = require('../utils/logger');
const db = require('./database');

/**
 * Buffer Optimization Service
 * Dynamically calculates optimal buffer percentages based on historical performance
 * and provider-specific patterns
 */
class BufferOptimizationService {
  constructor() {
    // Default buffer percentages by provider (starting points)
    this.defaultBuffers = {
      'google-imagen': 15,      // Very consistent
      'google-gemini': 20,      // Good consistency
      'stable-diffusion-xl': 25, // More variance
      'openai-dalle3': 20       // Good consistency
    };

    // Minimum samples needed for reliable calculation
    this.minSamplesRequired = 10;

    // Target confidence level (95% = user gets N good images 95% of the time)
    this.targetConfidence = 0.95;
  }

  /**
   * Calculate optimal buffer percentage for a provider
   * @param {string} providerId - Provider ID
   * @param {number} requestedCount - Number of images requested
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Optimal buffer info
   */
  async calculateOptimalBuffer(providerId, requestedCount = 30, options = {}) {
    const {
      targetConfidence = this.targetConfidence,
      minSamples = this.minSamplesRequired
    } = options;

    try {
      logger.info('Calculating optimal buffer', {
        providerId,
        requestedCount,
        targetConfidence
      });

      // Get historical discard rate for this provider
      const discardStats = await this.getProviderDiscardStats(providerId);

      if (discardStats.sampleCount < minSamples) {
        // Not enough data, use default
        const defaultBuffer = this.defaultBuffers[providerId] || 20;
        
        logger.info('Using default buffer (insufficient data)', {
          providerId,
          defaultBuffer,
          samplesAvailable: discardStats.sampleCount,
          samplesRequired: minSamples
        });

        return {
          bufferPercent: defaultBuffer,
          isDefault: true,
          confidence: 0.5,
          reason: 'Insufficient historical data',
          stats: discardStats
        };
      }

      // Calculate optimal buffer based on historical discard rate
      const optimalBuffer = this.computeOptimalBuffer(
        discardStats.avgDiscardRate,
        discardStats.stdDevDiscardRate,
        requestedCount,
        targetConfidence
      );

      logger.info('Optimal buffer calculated', {
        providerId,
        optimalBuffer: optimalBuffer.bufferPercent,
        historicalDiscardRate: discardStats.avgDiscardRate,
        confidence: optimalBuffer.confidence
      });

      return {
        ...optimalBuffer,
        isDefault: false,
        stats: discardStats
      };

    } catch (error) {
      logger.error('Failed to calculate optimal buffer', {
        providerId,
        error: error.message
      });

      // Fall back to default
      return {
        bufferPercent: this.defaultBuffers[providerId] || 20,
        isDefault: true,
        confidence: 0.5,
        reason: 'Calculation error: ' + error.message
      };
    }
  }

  /**
   * Get provider discard statistics from historical data
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} Discard stats
   */
  async getProviderDiscardStats(providerId) {
    const client = await db.getClient();
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as sample_count,
          AVG(
            (pipeline_data->'filtering'->>'discarded')::numeric / 
            NULLIF((pipeline_data->'overGeneration'->>'generated')::numeric, 0)
          ) as avg_discard_rate,
          STDDEV(
            (pipeline_data->'filtering'->>'discarded')::numeric / 
            NULLIF((pipeline_data->'overGeneration'->>'generated')::numeric, 0)
          ) as stddev_discard_rate,
          MIN(
            (pipeline_data->'filtering'->>'discarded')::numeric / 
            NULLIF((pipeline_data->'overGeneration'->>'generated')::numeric, 0)
          ) as min_discard_rate,
          MAX(
            (pipeline_data->'filtering'->>'discarded')::numeric / 
            NULLIF((pipeline_data->'overGeneration'->>'generated')::numeric, 0)
          ) as max_discard_rate,
          AVG((pipeline_data->'filtering'->>'avgReturnedScore')::numeric) as avg_quality
        FROM generations g
        JOIN generation_assets ga ON g.id = ga.generation_id
        WHERE ga.provider_id = $1
          AND g.created_at >= NOW() - INTERVAL '30 days'
          AND g.pipeline_data->'overGeneration' IS NOT NULL
          AND g.status = 'completed'
      `, [providerId]);

      if (result.rows.length > 0 && result.rows[0].sample_count > 0) {
        return {
          sampleCount: parseInt(result.rows[0].sample_count),
          avgDiscardRate: parseFloat(result.rows[0].avg_discard_rate) || 0,
          stdDevDiscardRate: parseFloat(result.rows[0].stddev_discard_rate) || 0,
          minDiscardRate: parseFloat(result.rows[0].min_discard_rate) || 0,
          maxDiscardRate: parseFloat(result.rows[0].max_discard_rate) || 0,
          avgQuality: parseFloat(result.rows[0].avg_quality) || 0
        };
      }

      return {
        sampleCount: 0,
        avgDiscardRate: 0,
        stdDevDiscardRate: 0,
        minDiscardRate: 0,
        maxDiscardRate: 0,
        avgQuality: 0
      };

    } finally {
      client.release();
    }
  }

  /**
   * Compute optimal buffer percentage
   * @param {number} avgDiscardRate - Average discard rate (0-1)
   * @param {number} stdDev - Standard deviation of discard rate
   * @param {number} requestedCount - Number of images requested
   * @param {number} targetConfidence - Target confidence level (0-1)
   * @returns {Object} Buffer calculation result
   */
  computeOptimalBuffer(avgDiscardRate, stdDev, requestedCount, targetConfidence) {
    // Z-score for target confidence (95% = 1.96, 90% = 1.645, 99% = 2.576)
    const zScore = this.getZScore(targetConfidence);

    // Expected discard rate with confidence margin
    const expectedDiscardRate = avgDiscardRate + (zScore * stdDev);

    // Buffer percentage needed to account for discards
    // Formula: buffer% = expectedDiscardRate / (1 - expectedDiscardRate)
    let bufferPercent = (expectedDiscardRate / (1 - expectedDiscardRate)) * 100;

    // Apply safety margin (add 5%)
    bufferPercent = bufferPercent * 1.05;

    // Clamp between reasonable bounds
    bufferPercent = Math.max(10, Math.min(50, bufferPercent));

    // Round to nearest 5%
    bufferPercent = Math.round(bufferPercent / 5) * 5;

    return {
      bufferPercent,
      confidence: targetConfidence,
      expectedDiscardRate: expectedDiscardRate * 100,
      expectedGenerated: Math.ceil(requestedCount * (1 + bufferPercent / 100)),
      reasoning: {
        avgDiscardRate: (avgDiscardRate * 100).toFixed(2) + '%',
        stdDev: (stdDev * 100).toFixed(2) + '%',
        zScore,
        safetyMargin: '5%'
      }
    };
  }

  /**
   * Get Z-score for confidence level
   * @param {number} confidence - Confidence level (0-1)
   * @returns {number} Z-score
   */
  getZScore(confidence) {
    const zScores = {
      0.90: 1.282,
      0.95: 1.645,
      0.99: 2.326
    };

    // Find closest confidence level
    const confidenceLevels = Object.keys(zScores).map(parseFloat);
    const closest = confidenceLevels.reduce((prev, curr) => 
      Math.abs(curr - confidence) < Math.abs(prev - confidence) ? curr : prev
    );

    return zScores[closest];
  }

  /**
   * Get provider-specific optimization recommendations
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} Optimization recommendations
   */
  async getProviderOptimizations(providerId) {
    try {
      const client = await db.getClient();

      try {
        // Get RLHF feedback patterns for this provider
        const feedbackResult = await client.query(`
          SELECT 
            feedback_type,
            is_negative_example,
            COUNT(*) as count,
            AVG(quality_score) as avg_score
          FROM rlhf_feedback rf
          JOIN generation_assets ga ON rf.asset_id = ga.id
          WHERE ga.provider_id = $1
            AND rf.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY feedback_type, is_negative_example
        `, [providerId]);

        // Get validation stats
        const validationResult = await client.query(`
          SELECT 
            AVG(overall_score) as avg_score,
            AVG(consistency_score) as avg_consistency,
            AVG(style_consistency_score) as avg_style,
            SUM(CASE WHEN is_outlier THEN 1 ELSE 0 END)::numeric / COUNT(*) as outlier_rate
          FROM validation_results vr
          JOIN generation_assets ga ON vr.asset_id = ga.id
          WHERE ga.provider_id = $1
            AND vr.created_at >= NOW() - INTERVAL '30 days'
            AND vr.status = 'completed'
        `, [providerId]);

        const feedback = feedbackResult.rows;
        const validation = validationResult.rows[0] || {};

        // Analyze patterns
        const recommendations = [];
        const negativeCount = feedback.filter(f => f.is_negative_example).reduce((sum, f) => sum + parseInt(f.count), 0);
        const positiveCount = feedback.filter(f => !f.is_negative_example).reduce((sum, f) => sum + parseInt(f.count), 0);
        const totalCount = negativeCount + positiveCount;

        // High failure rate
        if (totalCount > 0 && negativeCount / totalCount > 0.3) {
          recommendations.push({
            type: 'HIGH_FAILURE_RATE',
            severity: 'high',
            description: `Provider has ${((negativeCount / totalCount) * 100).toFixed(1)}% failure rate`,
            suggestion: 'Increase buffer percentage or improve prompt quality',
            action: 'increase_buffer'
          });
        }

        // Low consistency
        if (validation.avg_consistency && parseFloat(validation.avg_consistency) < 75) {
          recommendations.push({
            type: 'LOW_CONSISTENCY',
            severity: 'medium',
            description: `Average consistency score is ${parseFloat(validation.avg_consistency).toFixed(1)}`,
            suggestion: 'Add more specific attributes to prompts',
            action: 'enhance_prompts'
          });
        }

        // High outlier rate
        if (validation.outlier_rate && parseFloat(validation.outlier_rate) > 0.15) {
          recommendations.push({
            type: 'HIGH_OUTLIER_RATE',
            severity: 'medium',
            description: `${(parseFloat(validation.outlier_rate) * 100).toFixed(1)}% of images are outliers`,
            suggestion: 'Review and adjust style consistency requirements',
            action: 'adjust_style_params'
          });
        }

        // Good performance
        if (totalCount > 20 && negativeCount / totalCount < 0.15 && parseFloat(validation.avg_score) > 85) {
          recommendations.push({
            type: 'EXCELLENT_PERFORMANCE',
            severity: 'info',
            description: 'Provider consistently delivers high quality',
            suggestion: 'Consider reducing buffer to optimize costs',
            action: 'decrease_buffer'
          });
        }

        return {
          providerId,
          recommendations,
          stats: {
            totalFeedback: totalCount,
            negativeCount,
            positiveCount,
            successRate: totalCount > 0 ? ((positiveCount / totalCount) * 100).toFixed(1) : 0,
            avgQuality: parseFloat(validation.avg_score) || 0,
            avgConsistency: parseFloat(validation.avg_consistency) || 0,
            outlierRate: parseFloat(validation.outlier_rate) * 100 || 0
          }
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get provider optimizations', {
        providerId,
        error: error.message
      });

      return {
        providerId,
        recommendations: [],
        stats: {},
        error: error.message
      };
    }
  }

  /**
   * Get recommended buffer for all providers
   * @returns {Promise<Object>} Buffer recommendations for all providers
   */
  async getAllProviderBuffers() {
    const providers = Object.keys(this.defaultBuffers);
    const recommendations = {};

    for (const providerId of providers) {
      recommendations[providerId] = await this.calculateOptimalBuffer(providerId);
    }

    return recommendations;
  }
}

module.exports = new BufferOptimizationService();
