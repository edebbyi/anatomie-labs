const logger = require('../utils/logger');
const db = require('./database');

/**
 * Stage 11: Analytics & Insights Service
 * VLT-powered analytics dashboard providing actionable insights
 */
class AnalyticsInsightsService {
  constructor() {
    this.insightCache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
  }

  /**
   * Get comprehensive user insights dashboard
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete insights dashboard
   */
  async getUserInsightsDashboard(userId) {
    try {
      logger.info('Generating insights dashboard', { userId });

      const [
        styleEvolution,
        clusterPerformance,
        attributeSuccess,
        personalizedRecs
      ] = await Promise.all([
        this.getStyleEvolution(userId),
        this.getClusterPerformance(userId),
        this.getAttributeSuccessRates(userId),
        this.getPersonalizedRecommendations(userId)
      ]);

      return {
        userId,
        generatedAt: new Date(),
        styleEvolution,
        clusterPerformance,
        attributeSuccess,
        recommendations: personalizedRecs,
        summary: this.generateInsightsSummary({
          styleEvolution,
          clusterPerformance,
          attributeSuccess
        })
      };

    } catch (error) {
      logger.error('Failed to generate insights dashboard', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get style evolution tracking
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Style evolution data
   */
  async getStyleEvolution(userId) {
    try {
      const client = await db.getClient();
      try {
        // Get feedback over time with VLT attributes
        const result = await client.query(`
          SELECT 
            DATE_TRUNC('week', uf.created_at) as week,
            uf.vlt_attributes,
            COUNT(*) as total_feedback,
            SUM(CASE WHEN uf.is_outlier THEN 1 ELSE 0 END) as outlier_count,
            AVG(uf.user_rating) as avg_rating
          FROM user_feedback uf
          WHERE uf.user_id = $1
            AND uf.created_at >= NOW() - INTERVAL '90 days'
          GROUP BY DATE_TRUNC('week', uf.created_at), uf.vlt_attributes
          ORDER BY week ASC
        `, [userId]);

        // Extract attribute trends
        const attributeTrends = {};
        const weeklyData = [];

        result.rows.forEach(row => {
          const attrs = row.vlt_attributes || {};
          
          // Track weekly summary
          weeklyData.push({
            week: row.week,
            totalFeedback: parseInt(row.total_feedback),
            outlierCount: parseInt(row.outlier_count),
            outlierRate: row.total_feedback > 0 
              ? ((row.outlier_count / row.total_feedback) * 100).toFixed(1)
              : 0,
            avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(1) : null
          });

          // Track attribute frequency over time
          Object.entries(attrs).forEach(([key, value]) => {
            if (!attributeTrends[key]) {
              attributeTrends[key] = {};
            }
            if (!attributeTrends[key][value]) {
              attributeTrends[key][value] = [];
            }
            attributeTrends[key][value].push({
              week: row.week,
              count: 1
            });
          });
        });

        // Identify preference shifts
        const preferenceShifts = this.identifyPreferenceShifts(weeklyData, attributeTrends);

        return {
          weeklyData,
          attributeTrends,
          preferenceShifts,
          timeRange: '90 days'
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get style evolution', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get cluster/style performance analysis
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Cluster performance data
   */
  async getClusterPerformance(userId) {
    try {
      const client = await db.getClient();
      try {
        // Get performance by style profile
        const result = await client.query(`
          SELECT 
            style_profile,
            total_generations,
            outlier_count,
            outlier_rate,
            avg_clip_score,
            avg_user_rating,
            top_attributes
          FROM style_profile_success
          WHERE user_id = $1
          ORDER BY outlier_rate DESC
        `, [userId]);

        const profiles = result.rows.map(row => ({
          styleProfile: row.style_profile,
          totalGenerations: parseInt(row.total_generations),
          outlierCount: parseInt(row.outlier_count),
          outlierRate: parseFloat(row.outlier_rate).toFixed(1),
          avgClipScore: row.avg_clip_score ? parseFloat(row.avg_clip_score).toFixed(3) : null,
          avgUserRating: row.avg_user_rating ? parseFloat(row.avg_user_rating).toFixed(1) : null,
          topAttributes: row.top_attributes,
          performance: this.classifyPerformance(parseFloat(row.outlier_rate))
        }));

        // Compare to global averages
        const globalResult = await client.query(`
          SELECT 
            style_profile,
            ROUND(AVG(outlier_rate), 1) as global_avg_rate
          FROM style_profile_success
          GROUP BY style_profile
        `);

        const globalAverages = {};
        globalResult.rows.forEach(row => {
          globalAverages[row.style_profile] = parseFloat(row.global_avg_rate);
        });

        // Add comparison
        profiles.forEach(profile => {
          const globalAvg = globalAverages[profile.styleProfile];
          if (globalAvg) {
            profile.vsGlobalAverage = (parseFloat(profile.outlierRate) - globalAvg).toFixed(1);
            profile.performsAboveAverage = parseFloat(profile.outlierRate) > globalAvg;
          }
        });

        return {
          profiles,
          bestProfile: profiles[0] || null,
          globalAverages
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get cluster performance', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get attribute success rates
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Array>} Attribute success data
   */
  async getAttributeSuccessRates(userId = null) {
    try {
      const client = await db.getClient();
      try {
        let query = `
          SELECT 
            attribute_name,
            attribute_value,
            total_occurrences,
            outlier_count,
            outlier_rate,
            avg_clip_score,
            avg_user_rating
          FROM vlt_attribute_success
          WHERE total_occurrences >= 5
          ORDER BY outlier_rate DESC
          LIMIT 50
        `;

        const result = await client.query(query);

        const attributes = result.rows.map(row => ({
          attribute: row.attribute_name,
          value: row.attribute_value,
          totalOccurrences: parseInt(row.total_occurrences),
          outlierCount: parseInt(row.outlier_count),
          outlierRate: parseFloat(row.outlier_rate),
          avgClipScore: row.avg_clip_score ? parseFloat(row.avg_clip_score) : null,
          avgUserRating: row.avg_user_rating ? parseFloat(row.avg_user_rating) : null,
          recommendation: this.generateAttributeRecommendation(
            row.attribute_name,
            row.attribute_value,
            parseFloat(row.outlier_rate)
          )
        }));

        // Group by attribute type
        const grouped = {};
        attributes.forEach(attr => {
          if (!grouped[attr.attribute]) {
            grouped[attr.attribute] = [];
          }
          grouped[attr.attribute].push(attr);
        });

        return {
          topPerformers: attributes.slice(0, 10),
          byAttribute: grouped,
          insights: this.generateAttributeInsights(attributes)
        };

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get attribute success rates', { error: error.message });
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Personalized recommendations
   */
  async getPersonalizedRecommendations(userId) {
    try {
      const client = await db.getClient();
      try {
        const recommendations = [];

        // 1. Recommend high-performing attributes user hasn't tried
        const untried = await client.query(`
          SELECT vas.attribute_name, vas.attribute_value, vas.outlier_rate
          FROM vlt_attribute_success vas
          WHERE vas.outlier_rate >= 50
            AND vas.total_occurrences >= 10
            AND NOT EXISTS (
              SELECT 1 FROM user_feedback uf
              WHERE uf.user_id = $1
                AND uf.vlt_attributes->>vas.attribute_name = vas.attribute_value
            )
          ORDER BY vas.outlier_rate DESC
          LIMIT 5
        `, [userId]);

        untried.rows.forEach(row => {
          recommendations.push({
            type: 'try_new',
            priority: 'high',
            attribute: row.attribute_name,
            value: row.attribute_value,
            outlierRate: parseFloat(row.outlier_rate),
            message: `Try "${row.attribute_value}" ${row.attribute_name} - ${row.outlier_rate}% success rate globally`,
            confidence: 'high'
          });
        });

        // 2. Recommend improvements to underperforming styles
        const userPerformance = await client.query(`
          SELECT 
            uf.vlt_attributes,
            AVG(CASE WHEN uf.is_outlier THEN 100 ELSE 0 END) as success_rate
          FROM user_feedback uf
          WHERE uf.user_id = $1
            AND uf.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY uf.vlt_attributes
          HAVING AVG(CASE WHEN uf.is_outlier THEN 100 ELSE 0 END) < 30
          LIMIT 3
        `, [userId]);

        userPerformance.rows.forEach(row => {
          const attrs = row.vlt_attributes || {};
          Object.entries(attrs).forEach(([key, value]) => {
            recommendations.push({
              type: 'improve_style',
              priority: 'medium',
              attribute: key,
              value: value,
              currentSuccessRate: parseFloat(row.success_rate).toFixed(1),
              message: `Your "${value}" ${key} has ${row.success_rate.toFixed(1)}% success rate - consider alternatives`,
              confidence: 'medium'
            });
          });
        });

        // 3. Recommend doubling down on successful patterns
        const successful = await client.query(`
          SELECT 
            jsonb_object_keys(uf.vlt_attributes) as attr_key,
            uf.vlt_attributes->>jsonb_object_keys(uf.vlt_attributes) as attr_value,
            COUNT(*) as usage_count,
            AVG(CASE WHEN uf.is_outlier THEN 100 ELSE 0 END) as success_rate
          FROM user_feedback uf
          WHERE uf.user_id = $1
            AND uf.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY attr_key, attr_value
          HAVING AVG(CASE WHEN uf.is_outlier THEN 100 ELSE 0 END) >= 60
            AND COUNT(*) >= 3
          ORDER BY success_rate DESC
          LIMIT 3
        `, [userId]);

        successful.rows.forEach(row => {
          recommendations.push({
            type: 'double_down',
            priority: 'high',
            attribute: row.attr_key,
            value: row.attr_value,
            successRate: parseFloat(row.success_rate).toFixed(1),
            usageCount: parseInt(row.usage_count),
            message: `Your "${row.attr_value}" ${row.attr_key} is performing great (${row.success_rate.toFixed(1)}% success) - use it more!`,
            confidence: 'high'
          });
        });

        // Sort by priority
        recommendations.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });

        return recommendations.slice(0, 10); // Top 10 recommendations

      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Failed to get personalized recommendations', {
        userId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Generate insights summary
   * @param {Object} data - Dashboard data
   * @returns {Object} Summary insights
   */
  generateInsightsSummary(data) {
    const insights = [];
    const { styleEvolution, clusterPerformance, attributeSuccess } = data;

    // Style evolution insight
    if (styleEvolution.preferenceShifts && styleEvolution.preferenceShifts.length > 0) {
      const shift = styleEvolution.preferenceShifts[0];
      insights.push({
        type: 'style_shift',
        message: shift.message,
        importance: 'high'
      });
    }

    // Cluster performance insight
    if (clusterPerformance.bestProfile) {
      const best = clusterPerformance.bestProfile;
      insights.push({
        type: 'best_style',
        message: `Your '${best.styleProfile}' style generates ${best.outlierRate}% outlier rate`,
        importance: 'high',
        data: best
      });
    }

    // Attribute success insight
    if (attributeSuccess.insights && attributeSuccess.insights.length > 0) {
      insights.push(...attributeSuccess.insights.slice(0, 3));
    }

    return {
      insights,
      overallHealth: this.calculateOverallHealth(data),
      actionableItems: insights.filter(i => i.importance === 'high').length
    };
  }

  /**
   * Identify preference shifts over time
   * @param {Array} weeklyData - Weekly feedback data
   * @param {Object} attributeTrends - Attribute trend data
   * @returns {Array} Identified shifts
   */
  identifyPreferenceShifts(weeklyData, attributeTrends) {
    const shifts = [];

    // Analyze trend changes
    if (weeklyData.length >= 4) {
      const recent = weeklyData.slice(-4);
      const older = weeklyData.slice(0, 4);

      const recentAvgRate = recent.reduce((sum, w) => sum + parseFloat(w.outlierRate), 0) / recent.length;
      const olderAvgRate = older.reduce((sum, w) => sum + parseFloat(w.outlierRate), 0) / older.length;

      if (recentAvgRate > olderAvgRate + 10) {
        shifts.push({
          type: 'improving',
          message: `Your preferences are improving! Recent success rate (${recentAvgRate.toFixed(1)}%) is up from ${olderAvgRate.toFixed(1)}%`,
          change: `+${(recentAvgRate - olderAvgRate).toFixed(1)}%`
        });
      } else if (recentAvgRate < olderAvgRate - 10) {
        shifts.push({
          type: 'declining',
          message: `Success rate declining. Recent: ${recentAvgRate.toFixed(1)}% vs. earlier: ${olderAvgRate.toFixed(1)}%`,
          change: `${(recentAvgRate - olderAvgRate).toFixed(1)}%`
        });
      }
    }

    return shifts;
  }

  /**
   * Classify performance level
   * @param {number} outlierRate - Outlier rate percentage
   * @returns {string} Performance classification
   */
  classifyPerformance(outlierRate) {
    if (outlierRate >= 60) return 'excellent';
    if (outlierRate >= 40) return 'good';
    if (outlierRate >= 20) return 'fair';
    return 'needs_improvement';
  }

  /**
   * Generate attribute recommendation
   * @param {string} attribute - Attribute name
   * @param {string} value - Attribute value
   * @param {number} outlierRate - Success rate
   * @returns {string} Recommendation
   */
  generateAttributeRecommendation(attribute, value, outlierRate) {
    if (outlierRate >= 70) {
      return `Highly recommended: ${value} has ${outlierRate.toFixed(1)}% success rate`;
    } else if (outlierRate >= 50) {
      return `Consider using: ${value} performs well at ${outlierRate.toFixed(1)}% success`;
    } else if (outlierRate >= 30) {
      return `Moderate success: ${value} has ${outlierRate.toFixed(1)}% success rate`;
    } else {
      return `Use cautiously: ${value} has lower ${outlierRate.toFixed(1)}% success rate`;
    }
  }

  /**
   * Generate attribute insights
   * @param {Array} attributes - Attribute data
   * @returns {Array} Insights
   */
  generateAttributeInsights(attributes) {
    const insights = [];

    // Find standout performers
    const excellent = attributes.filter(a => a.outlierRate >= 70);
    if (excellent.length > 0) {
      const top = excellent[0];
      insights.push({
        type: 'top_performer',
        message: `"${top.value}" ${top.attribute} has ${top.outlierRate.toFixed(1)}% success rate - use it often!`,
        importance: 'high'
      });
    }

    // Find attributes with high usage but low success
    const problematic = attributes.filter(a => 
      a.totalOccurrences > 20 && a.outlierRate < 30
    );
    if (problematic.length > 0) {
      insights.push({
        type: 'avoid',
        message: `Consider avoiding "${problematic[0].value}" - only ${problematic[0].outlierRate.toFixed(1)}% success despite high usage`,
        importance: 'medium'
      });
    }

    return insights;
  }

  /**
   * Calculate overall health score
   * @param {Object} data - Dashboard data
   * @returns {Object} Health score
   */
  calculateOverallHealth(data) {
    let score = 50; // Base score

    // Factor in cluster performance
    if (data.clusterPerformance.bestProfile) {
      const outlierRate = parseFloat(data.clusterPerformance.bestProfile.outlierRate);
      score += (outlierRate - 30) * 0.5; // Adjust based on outlier rate
    }

    // Factor in style evolution
    if (data.styleEvolution.preferenceShifts) {
      const improving = data.styleEvolution.preferenceShifts.filter(s => s.type === 'improving').length;
      score += improving * 10;
    }

    // Clamp between 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      score: score.toFixed(0),
      rating: score >= 75 ? 'excellent' : score >= 50 ? 'good' : score >= 25 ? 'fair' : 'needs_work'
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.insightCache.clear();
    logger.info('Insights cache cleared');
  }
}

module.exports = new AnalyticsInsightsService();
