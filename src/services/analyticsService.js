/**
 * Stage 11: Analytics & Insights Service
 * 
 * VLT-powered analytics dashboard providing actionable insights:
 * - Style evolution tracking (how preferences change over time)
 * - Cluster performance analysis (outlier rates per style mode)
 * - Attribute success rates (which VLT attributes → more outliers)
 * - Personalized recommendations based on data
 */

const db = require('./database');
const logger = require('../utils/logger');

class AnalyticsService {
  constructor() {
    logger.info('Analytics Service initialized');
  }

  /**
   * Get comprehensive user analytics dashboard
   */
  async getUserDashboard(userId, options = {}) {
    const { days = 30 } = options;

    try {
      logger.info('Generating user dashboard', { userId, days });

      const [
        styleEvolution,
        clusterPerformance,
        attributeSuccess,
        recentInsights,
        recommendations
      ] = await Promise.all([
        this.getStyleEvolution(userId, days),
        this.getClusterPerformance(userId, days),
        this.getAttributeSuccessRates(userId),
        this.getRecentInsights(userId, 5),
        this.getRecommendations(userId, 3)
      ]);

      return {
        userId,
        period: { days, end: new Date() },
        styleEvolution,
        clusterPerformance,
        attributeSuccess,
        insights: recentInsights,
        recommendations,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to generate user dashboard', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Track style evolution over time
   * Shows how user preferences change
   */
  async getStyleEvolution(userId, days = 30) {
    try {
      const result = await db.query(`
        SELECT 
          snapshot_date,
          cluster_distribution,
          dominant_colors,
          dominant_styles,
          dominant_silhouettes,
          dominant_fabrications,
          outlier_rate,
          avg_clip_score,
          avg_user_rating,
          trend_direction,
          trend_strength
        FROM style_evolution
        WHERE user_id = $1
          AND snapshot_date >= CURRENT_DATE - $2
        ORDER BY snapshot_date DESC
      `, [userId, days]);

      if (result.rows.length === 0) {
        // Generate initial snapshot if none exists
        await this.captureStyleSnapshot(userId);
        return this.getStyleEvolution(userId, days);
      }

      const evolution = result.rows;
      const latest = evolution[0];
      const previous = evolution[evolution.length - 1];

      // Calculate trend
      const trend = this._calculateEvolutionTrend(evolution);

      return {
        snapshots: evolution,
        currentState: latest,
        trend: {
          direction: trend.direction,
          strength: trend.strength,
          description: trend.description
        },
        insights: this._generateEvolutionInsights(latest, previous)
      };

    } catch (error) {
      logger.error('Failed to get style evolution', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Capture style snapshot for a user (daily)
   */
  async captureStyleSnapshot(userId) {
    try {
      // Get user's recent generations with their attributes
      const recentData = await db.query(`
        SELECT 
          g.style_cluster_id,
          g.vlt_spec,
          o.id as is_outlier,
          f.clip_score,
          f.user_rating
        FROM generations g
        LEFT JOIN outliers o ON g.id = o.generation_id
        LEFT JOIN user_feedback f ON g.id = f.generation_id
        WHERE g.user_id = $1
          AND g.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY g.created_at DESC
      `, [userId]);

      if (recentData.rows.length === 0) {
        logger.warn('No recent data for style snapshot', { userId });
        return null;
      }

      // Aggregate attributes
      const colors = {};
      const styles = {};
      const silhouettes = {};
      const fabrications = {};
      const clusterDist = {};
      let totalOutliers = 0;
      let totalClipScore = 0;
      let totalRating = 0;
      let ratingCount = 0;

      recentData.rows.forEach(row => {
        const vlt = row.vlt_spec || {};
        
        // Count attributes
        if (vlt.colors?.primary) {
          colors[vlt.colors.primary] = (colors[vlt.colors.primary] || 0) + 1;
        }
        if (vlt.style?.aesthetic) {
          styles[vlt.style.aesthetic] = (styles[vlt.style.aesthetic] || 0) + 1;
        }
        if (vlt.silhouette) {
          silhouettes[vlt.silhouette] = (silhouettes[vlt.silhouette] || 0) + 1;
        }
        if (vlt.fabric?.type) {
          fabrications[vlt.fabric.type] = (fabrications[vlt.fabric.type] || 0) + 1;
        }
        
        // Cluster distribution
        if (row.style_cluster_id !== null) {
          clusterDist[`cluster_${row.style_cluster_id}`] = 
            (clusterDist[`cluster_${row.style_cluster_id}`] || 0) + 1;
        }
        
        // Metrics
        if (row.is_outlier) totalOutliers++;
        if (row.clip_score) totalClipScore += row.clip_score;
        if (row.user_rating) {
          totalRating += row.user_rating;
          ratingCount++;
        }
      });

      const total = recentData.rows.length;

      // Insert snapshot
      await db.query(`
        INSERT INTO style_evolution (
          user_id,
          snapshot_date,
          cluster_distribution,
          dominant_colors,
          dominant_styles,
          dominant_silhouettes,
          dominant_fabrications,
          total_generations,
          total_outliers,
          outlier_rate,
          avg_clip_score,
          avg_user_rating
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (user_id, snapshot_date)
        DO UPDATE SET
          cluster_distribution = EXCLUDED.cluster_distribution,
          dominant_colors = EXCLUDED.dominant_colors,
          dominant_styles = EXCLUDED.dominant_styles,
          dominant_silhouettes = EXCLUDED.dominant_silhouettes,
          dominant_fabrications = EXCLUDED.dominant_fabrications,
          total_generations = EXCLUDED.total_generations,
          total_outliers = EXCLUDED.total_outliers,
          outlier_rate = EXCLUDED.outlier_rate,
          avg_clip_score = EXCLUDED.avg_clip_score,
          avg_user_rating = EXCLUDED.avg_user_rating
      `, [
        userId,
        new Date().toISOString().split('T')[0], // today's date
        JSON.stringify(clusterDist),
        JSON.stringify(colors),
        JSON.stringify(styles),
        JSON.stringify(silhouettes),
        JSON.stringify(fabrications),
        total,
        totalOutliers,
        (totalOutliers / total * 100).toFixed(2),
        (totalClipScore / total).toFixed(2),
        ratingCount > 0 ? (totalRating / ratingCount).toFixed(2) : null
      ]);

      logger.info('Style snapshot captured', { userId, total, totalOutliers });

      return {
        userId,
        snapshotDate: new Date(),
        totalGenerations: total,
        totalOutliers,
        outlierRate: (totalOutliers / total * 100).toFixed(2)
      };

    } catch (error) {
      logger.error('Failed to capture style snapshot', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get cluster performance analysis
   * Shows outlier rates per style mode
   */
  async getClusterPerformance(userId, days = 30) {
    try {
      const result = await db.query(`
        SELECT 
          cluster_id,
          cluster_name,
          total_generations,
          total_outliers,
          outlier_rate,
          avg_clip_score,
          avg_user_rating,
          best_provider,
          top_attributes,
          provider_scores
        FROM cluster_performance
        WHERE user_id = $1
          AND period_end >= CURRENT_DATE - $2
        ORDER BY outlier_rate DESC
      `, [userId, days]);

      const clusters = result.rows.map(cluster => ({
        ...cluster,
        performance: this._classifyPerformance(cluster.outlier_rate),
        insights: this._generateClusterInsights(cluster)
      }));

      // Find best and worst performing clusters
      const best = clusters[0];
      const worst = clusters[clusters.length - 1];

      return {
        clusters,
        summary: {
          bestPerforming: best ? {
            cluster: best.cluster_name,
            outlierRate: best.outlier_rate,
            insight: `Your '${best.cluster_name}' style generates ${best.outlier_rate}% outlier rate`
          } : null,
          worstPerforming: worst && clusters.length > 1 ? {
            cluster: worst.cluster_name,
            outlierRate: worst.outlier_rate,
            insight: `Consider exploring more of your '${best.cluster_name}' style`
          } : null
        }
      };

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
   * Shows which VLT attributes lead to more outliers
   */
  async getAttributeSuccessRates(userId) {
    try {
      const result = await db.query(`
        SELECT 
          attribute_name,
          attribute_value,
          outlier_count,
          total_count,
          outlier_rate,
          avg_clip_score,
          avg_user_rating
        FROM vlt_attribute_success
        WHERE total_count >= 3
        ORDER BY outlier_rate DESC
        LIMIT 20
      `);

      // Group by attribute type
      const byAttribute = {};
      result.rows.forEach(row => {
        if (!byAttribute[row.attribute_name]) {
          byAttribute[row.attribute_name] = [];
        }
        byAttribute[row.attribute_name].push({
          value: row.attribute_value,
          outlierRate: parseFloat(row.outlier_rate),
          outlierCount: row.outlier_count,
          totalCount: row.total_count,
          avgClipScore: row.avg_clip_score,
          avgUserRating: row.avg_user_rating,
          performance: this._classifyPerformance(row.outlier_rate)
        });
      });

      // Generate insights
      const insights = this._generateAttributeInsights(byAttribute);

      return {
        byAttribute,
        topPerformers: result.rows.slice(0, 5).map(r => ({
          attribute: r.attribute_name,
          value: r.attribute_value,
          outlierRate: parseFloat(r.outlier_rate),
          insight: `${r.attribute_value} has ${r.outlier_rate}% outlier rate - consider using more`
        })),
        insights
      };

    } catch (error) {
      logger.error('Failed to get attribute success rates', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent insights for user
   */
  async getRecentInsights(userId, limit = 5) {
    try {
      const result = await db.query(`
        SELECT 
          insight_type,
          title,
          description,
          confidence_score,
          category,
          generated_at
        FROM insights_cache
        WHERE user_id = $1
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY priority DESC, generated_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;

    } catch (error) {
      logger.error('Failed to get recent insights', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(userId, limit = 3) {
    try {
      const result = await db.query(`
        SELECT 
          recommendation_type,
          title,
          description,
          action_data,
          expected_improvement,
          confidence,
          based_on
        FROM personalized_recommendations
        WHERE user_id = $1
          AND status = 'pending'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY confidence DESC, expected_improvement DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;

    } catch (error) {
      logger.error('Failed to get recommendations', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate insights based on data analysis
   */
  async generateInsights(userId) {
    try {
      logger.info('Generating insights', { userId });

      const [
        styleEvolution,
        clusterPerf,
        attrSuccess
      ] = await Promise.all([
        this.getStyleEvolution(userId, 30),
        this.getClusterPerformance(userId, 30),
        this.getAttributeSuccessRates(userId)
      ]);

      const insights = [];

      // Insight 1: Best performing cluster
      if (clusterPerf.clusters.length > 0) {
        const best = clusterPerf.clusters[0];
        insights.push({
          type: 'cluster_performance',
          title: `Your '${best.cluster_name}' style generates ${best.outlier_rate}% outlier rate`,
          description: `This is ${best.outlier_rate >= 60 ? 'excellent' : 'good'} performance. Consider using this style more often.`,
          confidence: 0.85,
          category: 'success',
          priority: 10
        });
      }

      // Insight 2: Attribute recommendations
      if (attrSuccess.topPerformers.length > 0) {
        const top = attrSuccess.topPerformers[0];
        insights.push({
          type: 'attribute_recommendation',
          title: `${top.value} has ${top.outlierRate}% outlier rate`,
          description: `Using ${top.attribute}='${top.value}' consistently performs well - consider increasing usage`,
          confidence: 0.80,
          category: 'opportunity',
          priority: 8
        });
      }

      // Insight 3: Style evolution trend
      if (styleEvolution.trend.direction === 'improving') {
        insights.push({
          type: 'style_evolution',
          title: `Your style is improving over time`,
          description: `Your outlier rate has been trending upward. Keep exploring!`,
          confidence: 0.75,
          category: 'trend',
          priority: 6
        });
      }

      // Store insights in cache
      for (const insight of insights) {
        await this.storeInsight(userId, insight);
      }

      return insights;

    } catch (error) {
      logger.error('Failed to generate insights', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Store insight in cache
   */
  async storeInsight(userId, insight) {
    try {
      await db.query(`
        INSERT INTO insights_cache (
          user_id,
          insight_type,
          title,
          description,
          confidence_score,
          priority,
          category,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
      `, [
        userId,
        insight.type,
        insight.title,
        insight.description,
        insight.confidence,
        insight.priority,
        insight.category
      ]);

    } catch (error) {
      logger.error('Failed to store insight', { userId, error: error.message });
    }
  }

  // Helper methods

  _calculateEvolutionTrend(snapshots) {
    if (snapshots.length < 2) {
      return { direction: 'stable', strength: 0, description: 'Not enough data' };
    }

    const recent = snapshots.slice(0, 7);
    const older = snapshots.slice(-7);

    const recentAvg = recent.reduce((sum, s) => sum + parseFloat(s.outlier_rate || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + parseFloat(s.outlier_rate || 0), 0) / older.length;

    const change = recentAvg - olderAvg;
    const direction = change > 2 ? 'improving' : change < -2 ? 'declining' : 'stable';
    const strength = Math.abs(change) / 100;

    return {
      direction,
      strength,
      description: `${direction === 'improving' ? '↑' : direction === 'declining' ? '↓' : '→'} ${Math.abs(change).toFixed(1)}% change`
    };
  }

  _generateEvolutionInsights(latest, previous) {
    const insights = [];

    if (!previous) return insights;

    // Color evolution
    const latestColors = latest.dominant_colors || {};
    const prevColors = previous.dominant_colors || {};
    const newColors = Object.keys(latestColors).filter(c => !prevColors[c]);
    
    if (newColors.length > 0) {
      insights.push(`You're exploring new colors: ${newColors.join(', ')}`);
    }

    // Outlier rate change
    const rateChange = parseFloat(latest.outlier_rate || 0) - parseFloat(previous.outlier_rate || 0);
    if (Math.abs(rateChange) > 5) {
      insights.push(`Your outlier rate ${rateChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(rateChange).toFixed(1)}%`);
    }

    return insights;
  }

  _generateClusterInsights(cluster) {
    const insights = [];
    const rate = parseFloat(cluster.outlier_rate || 0);

    if (rate >= 60) {
      insights.push(`Excellent performance - this is your strongest style`);
    } else if (rate >= 45) {
      insights.push(`Good performance - consider using more often`);
    } else if (rate < 30) {
      insights.push(`Consider exploring other style modes`);
    }

    if (cluster.best_provider) {
      insights.push(`Best results with ${cluster.best_provider}`);
    }

    return insights;
  }

  _generateAttributeInsights(byAttribute) {
    const insights = [];

    // Find attributes with highest variance
    Object.entries(byAttribute).forEach(([attrName, values]) => {
      const rates = values.map(v => v.outlierRate);
      const max = Math.max(...rates);
      const min = Math.min(...rates);
      const variance = max - min;

      if (variance > 20) {
        const best = values.find(v => v.outlierRate === max);
        insights.push({
          attribute: attrName,
          recommendation: `${best.value} performs ${variance.toFixed(0)}% better than others`,
          action: `consider_more`,
          value: best.value
        });
      }
    });

    return insights;
  }

  _classifyPerformance(rate) {
    const r = parseFloat(rate || 0);
    if (r >= 60) return 'excellent';
    if (r >= 45) return 'good';
    if (r >= 30) return 'average';
    return 'poor';
  }
}

module.exports = new AnalyticsService();
