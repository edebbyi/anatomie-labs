const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const rlhfWeightService = require('../../services/rlhfWeightService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/rlhf/feedback
 * Submit user feedback to update token weights
 */
router.post('/feedback', asyncHandler(async (req, res) => {
  const {
    userId,
    imageId,
    generationId,
    feedbackType,
    tokensUsed,
    timeViewed
  } = req.body;

  if (!userId || !feedbackType || !tokensUsed) {
    return res.status(400).json({
      success: false,
      message: 'userId, feedbackType, and tokensUsed are required'
    });
  }

  logger.info('RLHF feedback received', {
    userId,
    imageId,
    feedbackType
  });

  await rlhfWeightService.processFeedback({
    userId,
    imageId,
    generationId,
    feedbackType,
    tokensUsed,
    timeViewed: timeViewed || 0
  });

  res.json({
    success: true,
    message: 'Feedback processed successfully'
  });
}));

/**
 * GET /api/rlhf/weights/:userId
 * Get learned weights for a user
 */
router.get('/weights/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { category } = req.query;

  const weights = await rlhfWeightService.getWeights(userId, category);

  res.json({
    success: true,
    data: {
      userId,
      category: category || 'all',
      weights
    }
  });
}));

/**
 * GET /api/rlhf/top-tokens/:userId/:category
 * Get top performing tokens for a category
 */
router.get('/top-tokens/:userId/:category', asyncHandler(async (req, res) => {
  const { userId, category } = req.params;
  const { limit = 10 } = req.query;

  const topTokens = await rlhfWeightService.getTopTokens(
    userId,
    category,
    parseInt(limit)
  );

  res.json({
    success: true,
    data: {
      userId,
      category,
      topTokens
    }
  });
}));

/**
 * GET /api/rlhf/stats/:userId
 * Get learning statistics for a user
 */
router.get('/stats/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const stats = await rlhfWeightService.getLearningStats(userId);

  res.json({
    success: true,
    data: {
      userId,
      stats
    }
  });
}));

/**
 * GET /api/rlhf/select-tokens/:userId/:category
 * Get AI-selected tokens for a category (used during generation)
 */
router.get('/select-tokens/:userId/:category', asyncHandler(async (req, res) => {
  const { userId, category } = req.params;
  const { count = 3 } = req.query;

  const selectedTokens = await rlhfWeightService.selectTokens(
    userId,
    category,
    parseInt(count)
  );

  res.json({
    success: true,
    data: {
      userId,
      category,
      selectedTokens
    }
  });
}));

module.exports = router;
