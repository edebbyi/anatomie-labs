const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
// Use the schema-compatible adapter
const analyticsService = require('../../services/analyticsServiceAdapter');
// Keep original services as fallback (not currently used)
// const analyticsServiceOriginal = require('../../services/analyticsService');
// const analyticsInsightsService = require('../../services/analyticsInsightsService');

const router = express.Router();

/**
 * GET /api/analytics/dashboard
 * Get comprehensive analytics dashboard
 * Includes style evolution, cluster performance, and recommendations
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 30 } = req.query;

  logger.info('Fetching analytics dashboard', { userId, days });

  const dashboard = await analyticsService.getUserDashboard(userId, {
    days: parseInt(days)
  });

  res.json({
    success: true,
    data: dashboard
  });
}));

/**
 * GET /api/analytics/insights
 * Get user statistics (simplified version)
 */
router.get('/insights', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  logger.info('Fetching insights dashboard', { userId });

  const stats = await analyticsService.getUserStats(userId);

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * GET /api/analytics/style-evolution
 * Track how user's style preferences evolve over time
 */
router.get('/style-evolution', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 30 } = req.query;

  logger.info('Fetching style evolution', { userId, days });

  const evolution = await analyticsService.getStyleEvolution(userId, parseInt(days));

  res.json({
    success: true,
    data: evolution
  });
}));

/**
 * POST /api/analytics/style-snapshot
 * Capture current style snapshot for a user
 */
router.post('/style-snapshot', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  logger.info('Capturing style snapshot', { userId });

  const snapshot = await analyticsService.captureStyleSnapshot(userId);

  res.json({
    success: true,
    data: snapshot,
    message: 'Style snapshot captured successfully'
  });
}));

/**
 * GET /api/analytics/provider-performance
 * Get performance analysis by AI provider
 */
router.get('/provider-performance', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { days = 30 } = req.query;

  logger.info('Fetching provider performance', { userId, days });

  const performance = await analyticsService.getProviderPerformance(userId, parseInt(days));

  res.json({
    success: true,
    data: performance
  });
}));

/**
 * GET /api/analytics/recent-activity
 * Get recent generation activity
 */
router.get('/recent-activity', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  logger.info('Fetching recent activity', { userId, limit });

  const activity = await analyticsService.getRecentActivity(userId, parseInt(limit));

  res.json({
    success: true,
    data: activity
  });
}));

/**
 * GET /api/analytics/recommendations
 * Get personalized recommendations based on user data
 */
router.get('/recommendations', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  logger.info('Fetching recommendations', { userId });

  const recommendations = await analyticsService.getBasicRecommendations(userId);

  res.json({
    success: true,
    data: recommendations
  });
}));

/**
 * GET /api/analytics/personalized-recommendations
 * Get detailed personalized recommendations with insights
 */
router.get('/personalized-recommendations', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  logger.info('Fetching personalized recommendations', { userId });

  const recommendations = await analyticsInsightsService.getPersonalizedRecommendations(userId);

  res.json({
    success: true,
    data: recommendations
  });
}));

/**
 * POST /api/analytics/generate-insights
 * Generate fresh insights for user
 */
router.post('/generate-insights', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  logger.info('Generating insights', { userId });

  const insights = await analyticsService.generateInsights(userId);

  res.json({
    success: true,
    data: insights,
    message: 'Insights generated successfully'
  });
}));

/**
 * GET /api/analytics/recent-insights
 * Get cached recent insights
 */
router.get('/recent-insights', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 5 } = req.query;

  logger.info('Fetching recent insights', { userId, limit });

  const insights = await analyticsService.getRecentInsights(userId, parseInt(limit));

  res.json({
    success: true,
    data: insights
  });
}));

/**
 * GET /api/analytics/global-trends
 * Get global trends and statistics (for comparison)
 */
router.get('/global-trends', asyncHandler(async (req, res) => {
  logger.info('Fetching global trends');

  // Get global attribute success rates
  const globalSuccess = await analyticsInsightsService.getAttributeSuccessRates();

  res.json({
    success: true,
    data: {
      globalAttributeSuccess: globalSuccess,
      message: 'Compare your performance to global trends'
    }
  });
}));

/**
 * DELETE /api/analytics/cache
 * Clear insights cache (admin or user request)
 */
router.delete('/cache', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  logger.info('Clearing insights cache', { userId });

  analyticsInsightsService.clearCache();

  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
}));

module.exports = router;
