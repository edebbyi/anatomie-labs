/**
 * Stage 11: Analytics Service Adapter
 * 
 * This adapter works with the actual database schema where:
 * - generations.pipeline_data contains VLT and routing info
 * - generation_feedback contains user ratings
 * - outliers table tracks high-quality generations
 */

const db = require('./database');
const logger = require('../utils/logger');

class AnalyticsServiceAdapter {
  constructor() {
    logger.info('Analytics Service Adapter initialized');
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
        providerPerformance,
        recentActivity,
        recommendations
      ] = await Promise.all([
        this.getStyleEvolution(userId, days),
        this.getProviderPerformance(userId, days),
        this.getRecentActivity(userId, 10),
        this.getBasicRecommendations(userId)
      ]);

      return {
        userId,
        period: { days, end: new Date() },
        styleEvolution,
        providerPerformance,
        recentActivity,
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
   */
  async getStyleEvolution(userId, days = 30) {
    try {
      const result = await db.query(`
        SELECT 
          DATE(g.created_at) as date,
          COUNT(*) as total_generations,
          COUNT(o.id) as outlier_count,
          ROUND(
            CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100,
            2
          ) as outlier_rate,
          AVG(gf.rating) as avg_rating,
          jsonb_agg(DISTINCT g.pipeline_data->'routing'->'provider'->>'name') 
            FILTER (WHERE g.pipeline_data->'routing'->'provider'->>'name' IS NOT NULL) as providers_used
        FROM generations g
        LEFT JOIN outliers o ON g.id = o.generation_id
        LEFT JOIN generation_feedback gf ON g.id = gf.generation_id
        WHERE g.user_id = $1
          AND g.created_at >= CURRENT_DATE - INTERVAL '1 day' * $2
        GROUP BY DATE(g.created_at)
        ORDER BY date DESC
      `, [userId, days]);

      const snapshots = result.rows;
      
      // Calculate trend
      const trend = this._calculateTrend(snapshots);

      return {
        snapshots,
        currentState: snapshots[0] || null,
        trend,
        totalGenerations: snapshots.reduce((sum, s) => sum + parseInt(s.total_generations || 0), 0),
        avgOutlierRate: snapshots.length > 0 
          ? (snapshots.reduce((sum, s) => sum + parseFloat(s.outlier_rate || 0), 0) / snapshots.length).toFixed(2)
          : 0
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
   * Get provider performance analysis
   */
  async getProviderPerformance(userId, days = 30) {
    try {
      const result = await db.query(`
        SELECT 
          g.pipeline_data->'routing'->'provider'->>'name' as provider_name,
          COUNT(*) as total_generations,
          COUNT(o.id) as outlier_count,
          ROUND(
            CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100,
            2
          ) as outlier_rate,
          AVG(gf.rating) as avg_rating,
          SUM(g.cost) as total_cost,
          AVG(g.cost) as avg_cost
        FROM generations g
        LEFT JOIN outliers o ON g.id = o.generation_id
        LEFT JOIN generation_feedback gf ON g.id = gf.generation_id
        WHERE g.user_id = $1
          AND g.created_at >= CURRENT_DATE - INTERVAL '1 day' * $2
          AND g.pipeline_data->'routing'->'provider'->>'name' IS NOT NULL
        GROUP BY provider_name
        ORDER BY outlier_rate DESC NULLS LAST
      `, [userId, days]);

      const providers = result.rows.map(row => ({
        provider: row.provider_name,
        totalGenerations: parseInt(row.total_generations),
        outlierCount: parseInt(row.outlier_count || 0),
        outlierRate: parseFloat(row.outlier_rate || 0),
        avgRating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(2) : null,
        totalCost: row.total_cost ? parseFloat(row.total_cost).toFixed(4) : null,
        avgCost: row.avg_cost ? parseFloat(row.avg_cost).toFixed(4) : null,
        performance: this._classifyPerformance(row.outlier_rate)
      }));

      return {
        providers,
        bestPerforming: providers[0] || null,
        summary: {
          totalProviders: providers.length,
          bestRate: providers[0] ? providers[0].outlierRate : 0
        }
      };

    } catch (error) {
      logger.error('Failed to get provider performance', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(userId, limit = 10) {
    try {
      const result = await db.query(`
        SELECT 
          g.id,
          g.status,
          g.created_at,
          g.pipeline_data->'routing'->'provider'->>'name' as provider,
          o.id IS NOT NULL as is_outlier,
          gf.rating,
          gf.feedback_type
        FROM generations g
        LEFT JOIN outliers o ON g.id = o.generation_id
        LEFT JOIN generation_feedback gf ON g.id = gf.generation_id
        WHERE g.user_id = $1
        ORDER BY g.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows.map(row => ({
        generationId: row.id,
        status: row.status,
        provider: row.provider,
        isOutlier: row.is_outlier,
        rating: row.rating,
        feedbackType: row.feedback_type,
        createdAt: row.created_at
      }));

    } catch (error) {
      logger.error('Failed to get recent activity', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get basic recommendations
   */
  async getBasicRecommendations(userId) {
    try {
      // Get user stats
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_generations,
          COUNT(o.id) as total_outliers,
          ROUND(
            CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100,
            2
          ) as outlier_rate
        FROM generations g
        LEFT JOIN outliers o ON g.id = o.generation_id
        WHERE g.user_id = $1
          AND g.created_at >= CURRENT_DATE - INTERVAL '30 days'
      `, [userId]);

      const stats = statsResult.rows[0];
      const recommendations = [];

      // Recommendation 1: Based on generation count
      if (parseInt(stats.total_generations) < 10) {
        recommendations.push({
          type: 'generate_more',
          priority: 'high',
          message: 'Generate more images to unlock detailed insights (currently ' + stats.total_generations + '/10 minimum)',
          action: 'Start generating to build your analytics profile'
        });
      }

      // Recommendation 2: Based on outlier rate
      const outlierRate = parseFloat(stats.outlier_rate || 0);
      if (outlierRate < 30) {
        recommendations.push({
          type: 'improve_quality',
          priority: 'medium',
          message: `Your outlier rate is ${outlierRate}% - try experimenting with different providers`,
          action: 'Test different AI providers to improve results'
        });
      } else if (outlierRate > 60) {
        recommendations.push({
          type: 'maintain_quality',
          priority: 'low',
          message: `Excellent ${outlierRate}% outlier rate - keep doing what you're doing!`,
          action: 'Continue with current approach'
        });
      }

      // Recommendation 3: Provider diversity
      const providerResult = await db.query(`
        SELECT COUNT(DISTINCT g.pipeline_data->'routing'->'provider'->>'name') as provider_count
        FROM generations g
        WHERE g.user_id = $1
          AND g.created_at >= CURRENT_DATE - INTERVAL '30 days'
      `, [userId]);

      const providerCount = parseInt(providerResult.rows[0].provider_count || 0);
      if (providerCount === 1) {
        recommendations.push({
          type: 'try_providers',
          priority: 'medium',
          message: 'You\'ve only used one provider - try others to find what works best',
          action: 'Experiment with different AI providers'
        });
      }

      return recommendations;

    } catch (error) {
      logger.error('Failed to get recommendations', {
        userId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Capture style snapshot for analytics
   */
  async captureStyleSnapshot(userId) {
    try {
      const recentData = await db.query(`
        SELECT 
          g.id,
          g.pipeline_data,
          o.id as outlier_id,
          gf.rating
        FROM generations g
        LEFT JOIN outliers o ON g.id = o.generation_id
        LEFT JOIN generation_feedback gf ON g.id = gf.generation_id
        WHERE g.user_id = $1
          AND g.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY g.created_at DESC
      `, [userId]);

      if (recentData.rows.length === 0) {
        logger.warn('No recent data for style snapshot', { userId });
        return null;
      }

      const total = recentData.rows.length;
      const totalOutliers = recentData.rows.filter(r => r.outlier_id).length;
      const outlierRate = (totalOutliers / total * 100).toFixed(2);

      // Extract provider distribution
      const providers = {};
      recentData.rows.forEach(row => {
        const provider = row.pipeline_data?.routing?.provider?.name;
        if (provider) {
          providers[provider] = (providers[provider] || 0) + 1;
        }
      });

      // Insert snapshot
      await db.query(`
        INSERT INTO style_evolution (
          user_id,
          snapshot_date,
          cluster_distribution,
          dominant_colors,
          total_generations,
          total_outliers,
          outlier_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, snapshot_date)
        DO UPDATE SET
          cluster_distribution = EXCLUDED.cluster_distribution,
          total_generations = EXCLUDED.total_generations,
          total_outliers = EXCLUDED.total_outliers,
          outlier_rate = EXCLUDED.outlier_rate
      `, [
        userId,
        new Date().toISOString().split('T')[0],
        JSON.stringify(providers),
        JSON.stringify({}), // Placeholder for colors
        total,
        totalOutliers,
        outlierRate
      ]);

      logger.info('Style snapshot captured', { userId, total, totalOutliers });

      return {
        userId,
        snapshotDate: new Date(),
        totalGenerations: total,
        totalOutliers,
        outlierRate
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
   * Get overall user statistics
   */
  async getUserStats(userId) {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_generations,
          COUNT(o.id) as total_outliers,
          ROUND(
            CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100,
            2
          ) as outlier_rate,
          AVG(gf.rating) as avg_rating,
          SUM(g.cost) as total_cost,
          MAX(g.created_at) as last_generation,
          MIN(g.created_at) as first_generation
        FROM generations g
        LEFT JOIN outliers o ON g.id = o.generation_id
        LEFT JOIN generation_feedback gf ON g.id = gf.generation_id
        WHERE g.user_id = $1
      `, [userId]);

      const stats = result.rows[0];
      
      return {
        totalGenerations: parseInt(stats.total_generations || 0),
        totalOutliers: parseInt(stats.total_outliers || 0),
        outlierRate: parseFloat(stats.outlier_rate || 0),
        avgRating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(2) : null,
        totalCost: stats.total_cost ? parseFloat(stats.total_cost).toFixed(2) : 0,
        lastGeneration: stats.last_generation,
        firstGeneration: stats.first_generation,
        performance: this._classifyPerformance(stats.outlier_rate)
      };

    } catch (error) {
      logger.error('Failed to get user stats', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods

  _calculateTrend(snapshots) {
    if (snapshots.length < 2) {
      return { direction: 'stable', strength: 0, description: 'Not enough data' };
    }

    const recent = snapshots.slice(0, Math.min(7, snapshots.length));
    const older = snapshots.slice(-Math.min(7, snapshots.length));

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

  _classifyPerformance(rate) {
    const r = parseFloat(rate || 0);
    if (r >= 60) return 'excellent';
    if (r >= 40) return 'good';
    if (r >= 20) return 'fair';
    return 'needs_improvement';
  }
}

module.exports = new AnalyticsServiceAdapter();
