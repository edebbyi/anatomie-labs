const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsInsightsService');
const logger = require('../utils/logger');

/**
 * Stage 11: Analytics & Insights API Routes
 * VLT-powered analytics dashboard endpoints
 */

/**
 * @route GET /api/analytics/dashboard/:userId
 * @desc Get comprehensive analytics dashboard for user
 * @access Private
 */
router.get('/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info('Fetching analytics dashboard', { userId });
    
    const dashboard = await analyticsService.getUserInsightsDashboard(userId);
    
    res.json({
      success: true,
      data: dashboard
    });
    
  } catch (error) {
    logger.error('Error fetching analytics dashboard', {
      userId: req.params.userId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate analytics dashboard',
      message: error.message
    });
  }
});

/**
 * @route GET /api/analytics/style-evolution/:userId
 * @desc Get style evolution tracking over time
 * @access Private
 */
router.get('/style-evolution/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info('Fetching style evolution', { userId });
    
    const evolution = await analyticsService.getStyleEvolution(userId);
    
    res.json({
      success: true,
      data: evolution
    });
    
  } catch (error) {
    logger.error('Error fetching style evolution', {
      userId: req.params.userId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch style evolution data',
      message: error.message
    });
  }
});

/**
 * @route GET /api/analytics/cluster-performance/:userId
 * @desc Get cluster/style profile performance analysis
 * @access Private
 */
router.get('/cluster-performance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info('Fetching cluster performance', { userId });
    
    const performance = await analyticsService.getClusterPerformance(userId);
    
    res.json({
      success: true,
      data: performance
    });
    
  } catch (error) {
    logger.error('Error fetching cluster performance', {
      userId: req.params.userId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cluster performance data',
      message: error.message
    });
  }
});

/**
 * @route GET /api/analytics/attribute-success
 * @desc Get VLT attribute success rates (global or user-specific)
 * @access Private
 */
router.get('/attribute-success', async (req, res) => {
  try {
    const { userId } = req.query;
    
    logger.info('Fetching attribute success rates', { userId });
    
    const success = await analyticsService.getAttributeSuccessRates(userId);
    
    res.json({
      success: true,
      data: success
    });
    
  } catch (error) {
    logger.error('Error fetching attribute success rates', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attribute success rates',
      message: error.message
    });
  }
});

/**
 * @route GET /api/analytics/recommendations/:userId
 * @desc Get personalized recommendations for user
 * @access Private
 */
router.get('/recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info('Fetching personalized recommendations', { userId });
    
    const recommendations = await analyticsService.getPersonalizedRecommendations(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        recommendations,
        count: recommendations.length,
        generatedAt: new Date()
      }
    });
    
  } catch (error) {
    logger.error('Error fetching recommendations', {
      userId: req.params.userId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch personalized recommendations',
      message: error.message
    });
  }
});

/**
 * @route GET /api/analytics/insights-summary/:userId
 * @desc Get quick insights summary without full dashboard
 * @access Private
 */
router.get('/insights-summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    logger.info('Fetching insights summary', { userId });
    
    // Get minimal data for quick summary
    const [evolution, performance] = await Promise.all([
      analyticsService.getStyleEvolution(userId),
      analyticsService.getClusterPerformance(userId)
    ]);
    
    const summary = {
      userId,
      bestProfile: performance.bestProfile,
      recentTrend: evolution.preferenceShifts && evolution.preferenceShifts.length > 0
        ? evolution.preferenceShifts[0]
        : null,
      dataPoints: evolution.weeklyData.length,
      generatedAt: new Date()
    };
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    logger.error('Error fetching insights summary', {
      userId: req.params.userId,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch insights summary',
      message: error.message
    });
  }
});

/**
 * @route POST /api/analytics/clear-cache
 * @desc Clear analytics cache (admin only)
 * @access Private/Admin
 */
router.post('/clear-cache', async (req, res) => {
  try {
    logger.info('Clearing analytics cache');
    
    analyticsService.clearCache();
    
    res.json({
      success: true,
      message: 'Analytics cache cleared successfully',
      clearedAt: new Date()
    });
    
  } catch (error) {
    logger.error('Error clearing analytics cache', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear analytics cache',
      message: error.message
    });
  }
});

/**
 * @route GET /api/analytics/health-check
 * @desc Health check for analytics service
 * @access Public
 */
router.get('/health-check', async (req, res) => {
  try {
    res.json({
      success: true,
      service: 'Analytics & Insights Dashboard',
      stage: 11,
      status: 'operational',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Analytics service health check failed'
    });
  }
});

module.exports = router;
