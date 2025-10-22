/**
 * Stage 11: Analytics & Insights API Routes
 * 
 * Endpoints for VLT-powered analytics dashboard
 */

const express = require('express');
const router = express.Router();
const analyticsService = require('../../services/analyticsService');
const logger = require('../../utils/logger');

/**
 * GET /api/analytics/dashboard/:userId
 * Get comprehensive analytics dashboard for user
 */
router.get('/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const dashboard = await analyticsService.getUserDashboard(userId, { 
      days: parseInt(days) 
    });

    res.json({
      success: true,
      dashboard
    });

  } catch (error) {
    logger.error('Failed to get dashboard', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/style-evolution/:userId
 * Get style evolution tracking
 */
router.get('/style-evolution/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const evolution = await analyticsService.getStyleEvolution(userId, parseInt(days));

    res.json({
      success: true,
      evolution
    });

  } catch (error) {
    logger.error('Failed to get style evolution', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analytics/capture-snapshot/:userId
 * Manually trigger style snapshot capture
 */
router.post('/capture-snapshot/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const snapshot = await analyticsService.captureStyleSnapshot(userId);

    res.json({
      success: true,
      snapshot
    });

  } catch (error) {
    logger.error('Failed to capture snapshot', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/cluster-performance/:userId
 * Get cluster performance analysis (outlier rates per style mode)
 */
router.get('/cluster-performance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const performance = await analyticsService.getClusterPerformance(userId, parseInt(days));

    res.json({
      success: true,
      performance
    });

  } catch (error) {
    logger.error('Failed to get cluster performance', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/attribute-success/:userId
 * Get attribute success rates (which VLT attributes lead to outliers)
 */
router.get('/attribute-success/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const attributeSuccess = await analyticsService.getAttributeSuccessRates(userId);

    res.json({
      success: true,
      attributeSuccess
    });

  } catch (error) {
    logger.error('Failed to get attribute success rates', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/insights/:userId
 * Get recent insights for user
 */
router.get('/insights/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 5 } = req.query;

    const insights = await analyticsService.getRecentInsights(userId, parseInt(limit));

    res.json({
      success: true,
      insights
    });

  } catch (error) {
    logger.error('Failed to get insights', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analytics/generate-insights/:userId
 * Generate new insights for user
 */
router.post('/generate-insights/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const insights = await analyticsService.generateInsights(userId);

    res.json({
      success: true,
      insights,
      count: insights.length
    });

  } catch (error) {
    logger.error('Failed to generate insights', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/recommendations/:userId
 * Get personalized recommendations
 */
router.get('/recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 3 } = req.query;

    const recommendations = await analyticsService.getRecommendations(userId, parseInt(limit));

    res.json({
      success: true,
      recommendations
    });

  } catch (error) {
    logger.error('Failed to get recommendations', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/example-insights
 * Get example insights showcasing capabilities (for demo)
 */
router.get('/example-insights', (req, res) => {
  res.json({
    success: true,
    examples: [
      {
        type: 'cluster_performance',
        title: "Your 'Fluid Evening' style generates 65% outlier rate",
        description: "(vs. 45% for Minimalist Tailoring)",
        confidence: 0.85,
        category: 'success'
      },
      {
        type: 'attribute_recommendation',
        title: "Soft dramatic lighting has 70% outlier rate",
        description: "Consider increasing usage in your generations",
        confidence: 0.78,
        category: 'opportunity'
      },
      {
        type: 'fabric_recommendation',
        title: "Silk charmeuse fabrications consistently perform better",
        description: "Than wool suiting in your style profile",
        confidence: 0.72,
        category: 'opportunity'
      }
    ]
  });
});

module.exports = router;
