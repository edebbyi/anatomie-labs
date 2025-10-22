const express = require('express');
const styleClusteringService = require('../services/styleClusteringService');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/style-clustering/create-profile
 * Create style profile with clustering from VLT analysis
 */
router.post('/create-profile', asyncHandler(async (req, res) => {
  const { userId, vltResult } = req.body;

  if (!userId || !vltResult) {
    return res.status(400).json({
      success: false,
      message: 'userId and vltResult are required'
    });
  }

  if (!vltResult.records || vltResult.records.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'VLT result must contain records for clustering'
    });
  }

  logger.info('Creating style clustering profile', {
    userId,
    recordCount: vltResult.records.length
  });

  const startTime = Date.now();

  try {
    const styleProfile = await styleClusteringService.createStyleProfile(userId, vltResult);
    const duration = Date.now() - startTime;

    logger.info('Style clustering profile created successfully', {
      userId,
      clusters: styleProfile.clusterCount,
      coverage: styleProfile.coverage.overallCoverage,
      dominantStyle: styleProfile.insights.dominantStyle,
      processingTime: `${duration}ms`
    });

    res.json({
      success: true,
      data: styleProfile,
      meta: {
        processingTime: `${duration}ms`,
        clusters: styleProfile.clusterCount,
        coverage: styleProfile.coverage.overallCoverage,
        dominantStyle: styleProfile.insights.dominantStyle
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Style clustering profile creation failed', {
      userId,
      error: error.message,
      processingTime: `${duration}ms`
    });

    res.status(500).json({
      success: false,
      message: error.message,
      meta: {
        processingTime: `${duration}ms`
      }
    });
  }
}));

/**
 * GET /api/style-clustering/profile/:userId
 * Get existing style profile for user
 */
router.get('/profile/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  logger.info('Getting style clustering profile', { userId });

  try {
    const styleProfile = await styleClusteringService.getStyleProfile(userId);

    if (!styleProfile) {
      return res.status(404).json({
        success: false,
        message: 'Style profile not found for user'
      });
    }

    res.json({
      success: true,
      data: styleProfile
    });

  } catch (error) {
    logger.error('Failed to get style clustering profile', {
      userId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * POST /api/style-clustering/update-profile
 * Update style profile with new VLT records
 */
router.post('/update-profile', asyncHandler(async (req, res) => {
  const { userId, newRecords } = req.body;

  if (!userId || !newRecords || !Array.isArray(newRecords)) {
    return res.status(400).json({
      success: false,
      message: 'userId and newRecords array are required'
    });
  }

  logger.info('Updating style clustering profile', {
    userId,
    newRecords: newRecords.length
  });

  const startTime = Date.now();

  try {
    const updatedProfile = await styleClusteringService.updateStyleProfile(userId, newRecords);
    const duration = Date.now() - startTime;

    logger.info('Style clustering profile updated successfully', {
      userId,
      totalRecords: updatedProfile.recordCount,
      processingTime: `${duration}ms`
    });

    res.json({
      success: true,
      data: updatedProfile,
      meta: {
        processingTime: `${duration}ms`,
        totalRecords: updatedProfile.recordCount,
        newRecords: newRecords.length
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Style clustering profile update failed', {
      userId,
      error: error.message,
      processingTime: `${duration}ms`
    });

    res.status(500).json({
      success: false,
      message: error.message,
      meta: {
        processingTime: `${duration}ms`
      }
    });
  }
}));

/**
 * POST /api/style-clustering/find-similar
 * Find similar styles using Pinecone
 */
router.post('/find-similar', asyncHandler(async (req, res) => {
  const { userId, styleQuery, topK = 10 } = req.body;

  if (!userId || !styleQuery) {
    return res.status(400).json({
      success: false,
      message: 'userId and styleQuery are required'
    });
  }

  logger.info('Finding similar styles', { userId, styleQuery, topK });

  try {
    const similarStyles = await styleClusteringService.findSimilarStyles(userId, styleQuery, topK);

    res.json({
      success: true,
      data: {
        query: styleQuery,
        results: similarStyles
      },
      meta: {
        resultCount: similarStyles.length,
        topK
      }
    });

  } catch (error) {
    logger.error('Failed to find similar styles', {
      userId,
      styleQuery,
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * GET /api/style-clustering/health
 * Health check for style clustering service
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    // Check if Python ML service is running
    const axios = require('axios');
    const pythonServiceUrl = process.env.PYTHON_ML_SERVICE_URL || 'http://localhost:8000';
    
    let pythonHealthy = false;
    try {
      const response = await axios.get(`${pythonServiceUrl}/health`, { timeout: 5000 });
      pythonHealthy = response.status === 200;
    } catch (error) {
      pythonHealthy = false;
    }

    // Check Pinecone service
    const pineconeService = require('../services/pineconeService');
    const pineconeHealthy = await pineconeService.healthCheck();

    const overallHealthy = pythonHealthy && pineconeHealthy;

    res.json({
      success: true,
      data: {
        status: overallHealthy ? 'healthy' : 'unhealthy',
        services: {
          pythonML: {
            status: pythonHealthy ? 'healthy' : 'unhealthy',
            url: pythonServiceUrl
          },
          pinecone: {
            status: pineconeHealthy ? 'healthy' : 'unhealthy',
            indexName: pineconeService.indexName
          }
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Style clustering health check failed', { error: error.message });

    res.json({
      success: true,
      data: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
}));

/**
 * GET /api/style-clustering/stats
 * Get style clustering statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    const db = require('../services/database');
    
    // Get basic statistics
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_profiles,
        COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_updates,
        AVG((profile_data->'clusterCount')::int) as avg_clusters,
        AVG((profile_data->'coverage'->>'overallCoverage')::int) as avg_coverage
      FROM user_style_profiles
    `);

    // Get dominant style distribution
    const styleDistribution = await db.query(`
      SELECT 
        profile_data->'insights'->>'dominantStyle' as dominant_style,
        COUNT(*) as count
      FROM user_style_profiles 
      WHERE profile_data->'insights'->>'dominantStyle' IS NOT NULL
      GROUP BY profile_data->'insights'->>'dominantStyle'
      ORDER BY count DESC
      LIMIT 10
    `);

    const stats = statsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        totalProfiles: parseInt(stats.total_profiles) || 0,
        recentUpdates: parseInt(stats.recent_updates) || 0,
        averageClusters: parseFloat(stats.avg_clusters) || 0,
        averageCoverage: parseFloat(stats.avg_coverage) || 0,
        dominantStyleDistribution: styleDistribution.rows.map(row => ({
          style: row.dominant_style,
          count: parseInt(row.count)
        }))
      }
    });

  } catch (error) {
    logger.error('Failed to get style clustering stats', { error: error.message });

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

module.exports = router;