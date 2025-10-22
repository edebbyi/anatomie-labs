const express = require('express');
const router = express.Router();
const userFeedbackService = require('../services/userFeedbackService');
const rlhfLearningService = require('../services/rlhfLearningService');
const logger = require('../utils/logger');

/**
 * Stage 10: User Feedback Loop API Routes
 */

/**
 * POST /feedback
 * Submit user feedback for a generated image
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      generationId,
      assetId,
      feedbackType,
      userRating,
      comment,
      tags,
      sessionId
    } = req.body;

    // Validation
    if (!userId || !generationId || !assetId || !feedbackType) {
      return res.status(400).json({
        error: 'Missing required fields: userId, generationId, assetId, feedbackType'
      });
    }

    if (!['outlier', 'rejected', 'neutral', 'favorite'].includes(feedbackType)) {
      return res.status(400).json({
        error: 'Invalid feedbackType. Must be: outlier, rejected, neutral, or favorite'
      });
    }

    if (userRating && (userRating < 1 || userRating > 5)) {
      return res.status(400).json({
        error: 'userRating must be between 1 and 5'
      });
    }

    const result = await userFeedbackService.submitFeedback({
      userId,
      generationId,
      assetId,
      feedbackType,
      userRating,
      comment,
      tags,
      sessionId,
      feedbackSource: 'web'
    });

    res.json({
      success: true,
      feedback: result.feedback,
      isOutlier: result.isOutlier,
      clipScore: result.clipScore,
      message: result.isOutlier 
        ? 'Feedback recorded as successful generation (outlier)'
        : 'Feedback recorded successfully'
    });

  } catch (error) {
    logger.error('Failed to submit feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * GET /feedback/user/:userId
 * Get user's feedback history
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, feedbackType } = req.query;

    const result = await userFeedbackService.getUserFeedbackHistory(userId, {
      limit: parseInt(limit),
      feedbackType
    });

    res.json({
      userId,
      feedback: result.feedback,
      stats: result.stats
    });

  } catch (error) {
    logger.error('Failed to get user feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve feedback history' });
  }
});

/**
 * GET /feedback/summary
 * Get recent feedback summary
 */
router.get('/summary', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const summary = await userFeedbackService.getRecentFeedbackSummary(
      parseInt(days)
    );

    res.json({
      period: `${days} days`,
      summary
    });

  } catch (error) {
    logger.error('Failed to get feedback summary', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve summary' });
  }
});

/**
 * GET /outliers/rates
 * Get outlier rates by VLT attribute
 */
router.get('/outliers/rates', async (req, res) => {
  try {
    const { attribute, minSampleSize = 5 } = req.query;

    const rates = await userFeedbackService.getOutlierRateByAttribute({
      attribute,
      minSampleSize: parseInt(minSampleSize)
    });

    res.json({
      attribute: attribute || 'all',
      rates
    });

  } catch (error) {
    logger.error('Failed to get outlier rates', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve outlier rates' });
  }
});

/**
 * GET /outliers/training
 * Get outliers for training data
 */
router.get('/outliers/training', async (req, res) => {
  try {
    const { limit = 100, notUsed = true } = req.query;

    const outliers = await userFeedbackService.getOutliersForTraining({
      limit: parseInt(limit),
      notUsedForTraining: notUsed === 'true'
    });

    res.json({
      outliers,
      count: outliers.length
    });

  } catch (error) {
    logger.error('Failed to get training outliers', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve outliers' });
  }
});

/**
 * POST /outliers/training/mark-used
 * Mark outliers as used for training
 */
router.post('/outliers/training/mark-used', async (req, res) => {
  try {
    const { outlierIds } = req.body;

    if (!outlierIds || !Array.isArray(outlierIds)) {
      return res.status(400).json({
        error: 'outlierIds must be an array'
      });
    }

    await userFeedbackService.markOutliersAsUsedForTraining(outlierIds);

    res.json({
      success: true,
      markedCount: outlierIds.length,
      message: `Marked ${outlierIds.length} outliers as used for training`
    });

  } catch (error) {
    logger.error('Failed to mark outliers', { error: error.message });
    res.status(500).json({ error: 'Failed to mark outliers' });
  }
});

/**
 * GET /styles/top
 * Get top performing style profiles
 */
router.get('/styles/top', async (req, res) => {
  try {
    const profiles = await userFeedbackService.getTopStyleProfiles();

    res.json({
      profiles
    });

  } catch (error) {
    logger.error('Failed to get top styles', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve top style profiles' });
  }
});

/**
 * POST /learning/process
 * Manually trigger learning update from outliers
 */
router.post('/learning/process', async (req, res) => {
  try {
    const { limit = 50 } = req.body;

    const result = await rlhfLearningService.processOutliersForLearning(
      parseInt(limit)
    );

    res.json({
      success: true,
      processedCount: result.processedCount,
      updates: result.updates,
      message: `Processed ${result.processedCount} outliers for learning`
    });

  } catch (error) {
    logger.error('Failed to process learning', { error: error.message });
    res.status(500).json({ error: 'Failed to process learning updates' });
  }
});

/**
 * GET /learning/impact
 * Get learning impact statistics
 */
router.get('/learning/impact', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const impact = await rlhfLearningService.getLearningImpact(
      parseInt(days)
    );

    res.json({
      period: `${days} days`,
      impact
    });

  } catch (error) {
    logger.error('Failed to get learning impact', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve learning impact' });
  }
});

/**
 * GET /learning/recommendations
 * Get prompt recommendations based on successful attributes
 */
router.get('/learning/recommendations', async (req, res) => {
  try {
    const { userId } = req.query;

    const recommendations = await rlhfLearningService.getPromptRecommendations(
      userId || null
    );

    res.json({
      recommendations
    });

  } catch (error) {
    logger.error('Failed to get recommendations', { error: error.message });
    res.status(500).json({ error: 'Failed to retrieve recommendations' });
  }
});

/**
 * PUT /settings/thresholds
 * Update outlier detection thresholds
 */
router.put('/settings/thresholds', async (req, res) => {
  try {
    const { clipScore, userRating } = req.body;

    const thresholds = {};
    if (clipScore !== undefined) thresholds.clipScore = clipScore;
    if (userRating !== undefined) thresholds.userRating = userRating;

    if (Object.keys(thresholds).length === 0) {
      return res.status(400).json({
        error: 'Provide at least one threshold: clipScore or userRating'
      });
    }

    userFeedbackService.updateOutlierThresholds(thresholds);

    res.json({
      success: true,
      thresholds,
      message: 'Outlier thresholds updated'
    });

  } catch (error) {
    logger.error('Failed to update thresholds', { error: error.message });
    res.status(500).json({ error: 'Failed to update thresholds' });
  }
});

module.exports = router;
