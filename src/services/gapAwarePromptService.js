const logger = require('../utils/logger');
const db = require('./database');

/**
 * Gap-Aware Prompt Adjustment Service
 * Integrates with Stage 4 to automatically boost underrepresented attributes
 * based on coverage gaps identified in Stage 9
 */
class GapAwarePromptService {
  constructor() {
    // Default weight multipliers
    this.baseWeights = {
      garmentType: 1.0,
      silhouette: 1.0,
      fabrication: 1.0,
      neckline: 0.8,
      sleeves: 0.8,
      length: 0.8
    };
  }

  /**
   * Get active gaps and calculate adjusted weights
   * @returns {Promise<Object>} Adjusted weights and gap information
   */
  async getAdjustedWeights() {
    try {
      const client = await db.getClient();
      try {
        // Get active gaps ordered by severity
        const result = await client.query(`
          SELECT 
            attribute,
            severity,
            recommended_boost,
            missing_values,
            current_coverage,
            target_coverage,
            gap_percentage,
            recent_occurrence_count
          FROM active_attribute_gaps
          ORDER BY 
            CASE severity
              WHEN 'critical' THEN 4
              WHEN 'high' THEN 3
              WHEN 'medium' THEN 2
              ELSE 1
            END DESC,
            gap_percentage DESC
          LIMIT 20
        `);

        const gaps = result.rows;
        const adjustedWeights = { ...this.baseWeights };
        const appliedBoosts = [];

        // Apply boosts based on gaps
        gaps.forEach(gap => {
          const { attribute, recommended_boost, severity, missing_values } = gap;

          if (adjustedWeights.hasOwnProperty(attribute)) {
            // Apply boost
            const oldWeight = adjustedWeights[attribute];
            const newWeight = oldWeight * recommended_boost;
            adjustedWeights[attribute] = Math.min(newWeight, 3.0); // Cap at 3x

            appliedBoosts.push({
              attribute,
              oldWeight,
              newWeight: adjustedWeights[attribute],
              boost: recommended_boost,
              severity,
              missingValues: missing_values,
              reason: `Coverage gap: ${gap.current_coverage}% (target: ${gap.target_coverage}%)`
            });

            logger.info('Applied weight boost for gap', {
              attribute,
              oldWeight,
              newWeight: adjustedWeights[attribute],
              severity
            });
          }
        });

        return {
          weights: adjustedWeights,
          appliedBoosts,
          gapCount: gaps.length,
          hasGaps: gaps.length > 0
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get adjusted weights', { error: error.message });
      // Return base weights on error
      return {
        weights: this.baseWeights,
        appliedBoosts: [],
        gapCount: 0,
        hasGaps: false,
        error: error.message
      };
    }
  }

  /**
   * Adjust prompt to emphasize gap attributes
   * @param {Object} prompt - Enhanced prompt
   * @param {Object} vltSpec - VLT specification
   * @returns {Promise<Object>} Adjusted prompt
   */
  async adjustPromptForGaps(prompt, vltSpec) {
    try {
      const { weights, appliedBoosts, hasGaps } = await this.getAdjustedWeights();

      if (!hasGaps) {
        logger.info('No active gaps, using original prompt');
        return {
          adjusted: false,
          prompt,
          weights,
          boosts: []
        };
      }

      // Extract main prompt
      const mainPrompt = prompt.enhanced?.mainPrompt || prompt.mainPrompt || '';
      
      // Build emphasis additions based on gaps
      const emphasisPhrases = [];
      appliedBoosts.forEach(boost => {
        if (boost.severity === 'critical' || boost.severity === 'high') {
          // Add strong emphasis for critical/high severity gaps
          const missingValues = boost.missingValues.slice(0, 3); // Top 3 missing
          if (missingValues.length > 0) {
            emphasisPhrases.push(`especially ${missingValues.join(', ')} ${boost.attribute}`);
          }
        }
      });

      // Adjust prompt
      let adjustedPrompt = mainPrompt;
      if (emphasisPhrases.length > 0) {
        const emphasisText = emphasisPhrases.join(', ');
        adjustedPrompt = `${mainPrompt}. Focus on diversity: ${emphasisText}.`;
      }

      logger.info('Prompt adjusted for gaps', {
        boostsApplied: appliedBoosts.length,
        emphasisAdded: emphasisPhrases.length
      });

      return {
        adjusted: true,
        prompt: {
          ...prompt,
          mainPrompt: adjustedPrompt,
          gapAdjusted: true,
          originalPrompt: mainPrompt
        },
        weights,
        boosts: appliedBoosts,
        emphasisPhrases
      };

    } catch (error) {
      logger.error('Failed to adjust prompt for gaps', { error: error.message });
      return {
        adjusted: false,
        prompt,
        weights: this.baseWeights,
        boosts: [],
        error: error.message
      };
    }
  }

  /**
   * Get gap-aware generation recommendations
   * @returns {Promise<Object>} Recommendations
   */
  async getGenerationRecommendations() {
    try {
      const { weights, appliedBoosts, gapCount } = await this.getAdjustedWeights();

      const recommendations = [];

      if (gapCount === 0) {
        recommendations.push({
          type: 'info',
          message: 'No coverage gaps detected. Generation diversity is optimal.'
        });
      } else {
        const critical = appliedBoosts.filter(b => b.severity === 'critical');
        const high = appliedBoosts.filter(b => b.severity === 'high');

        if (critical.length > 0) {
          recommendations.push({
            type: 'warning',
            message: `${critical.length} critical coverage gap(s) detected`,
            gaps: critical.map(b => ({
              attribute: b.attribute,
              missingValues: b.missingValues,
              recommendedFocus: 'Generate images specifically featuring these attributes'
            }))
          });
        }

        if (high.length > 0) {
          recommendations.push({
            type: 'info',
            message: `${high.length} high-priority gap(s) identified`,
            gaps: high.map(b => b.attribute)
          });
        }

        recommendations.push({
          type: 'action',
          message: 'Weight adjustments have been automatically applied to address gaps',
          adjustedAttributes: appliedBoosts.map(b => b.attribute)
        });
      }

      return {
        recommendations,
        weights,
        appliedBoosts,
        gapCount
      };

    } catch (error) {
      logger.error('Failed to get recommendations', { error: error.message });
      return {
        recommendations: [{
          type: 'error',
          message: 'Failed to analyze coverage gaps'
        }],
        weights: this.baseWeights,
        appliedBoosts: [],
        gapCount: 0
      };
    }
  }

  /**
   * Mark weight boost as applied to gap
   * @param {string} attribute - Attribute name
   * @param {number} appliedBoost - Applied boost multiplier
   */
  async markBoostApplied(attribute, appliedBoost) {
    try {
      const client = await db.getClient();
      try {
        await client.query(`
          UPDATE attribute_gaps
          SET 
            applied_boost = $2,
            boost_applied_at = NOW(),
            status = 'in_progress',
            updated_at = NOW()
          WHERE attribute = $1
            AND status = 'identified'
        `, [attribute, appliedBoost]);

        logger.info('Marked boost as applied', { attribute, appliedBoost });

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to mark boost as applied', {
        attribute,
        error: error.message
      });
      // Non-critical, don't throw
    }
  }

  /**
   * Get gap statistics for monitoring
   * @returns {Promise<Object>} Gap statistics
   */
  async getGapStatistics() {
    try {
      const client = await db.getClient();
      try {
        const result = await client.query(`
          SELECT 
            COUNT(*) as total_gaps,
            SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
            SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
            SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
            SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low,
            SUM(CASE WHEN applied_boost IS NOT NULL THEN 1 ELSE 0 END) as boosts_applied,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
          FROM attribute_gaps
          WHERE status IN ('identified', 'in_progress')
        `);

        const stats = result.rows[0];

        return {
          totalGaps: parseInt(stats.total_gaps),
          bySeverity: {
            critical: parseInt(stats.critical),
            high: parseInt(stats.high),
            medium: parseInt(stats.medium),
            low: parseInt(stats.low)
          },
          boostsApplied: parseInt(stats.boosts_applied),
          resolved: parseInt(stats.resolved),
          resolutionRate: stats.total_gaps > 0 
            ? ((stats.resolved / stats.total_gaps) * 100).toFixed(1)
            : 0
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get gap statistics', { error: error.message });
      return {
        totalGaps: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        boostsApplied: 0,
        resolved: 0,
        resolutionRate: 0,
        error: error.message
      };
    }
  }
}

module.exports = new GapAwarePromptService();
