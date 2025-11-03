const express = require('express');
const router = express.Router();
const modelGenderService = require('../../services/modelGenderDetectionService');
const logger = require('../../utils/logger');

/**
 * Model Gender Detection API Routes
 * Handles model gender preference detection and management
 */

/**
 * GET /api/model-gender/preference
 * Get user's current model gender preference
 */
router.get('/preference', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID required'
      });
    }

    const preference = await modelGenderService.getUserModelGenderPreference(userId);

    res.json({
      success: true,
      preference
    });
  } catch (error) {
    logger.error('Failed to get model gender preference', {
      error: error.message
    });
    res.status(500).json({
      error: 'Failed to retrieve preference'
    });
  }
});

/**
 * POST /api/model-gender/preference
 * Update user's model gender preference
 * 
 * Body:
 * {
 *   setting: "auto" | "female" | "male" | "both",
 *   manual_override?: boolean,
 *   detected_gender?: string,
 *   confidence?: number
 * }
 */
router.post('/preference', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { setting, manual_override, detected_gender, confidence } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID required'
      });
    }

    if (!setting) {
      return res.status(400).json({
        error: 'Setting is required'
      });
    }

    const updated = await modelGenderService.updateUserModelGenderPreference(userId, {
      setting,
      manual_override: manual_override ?? false,
      detected_gender,
      confidence
    });

    res.json({
      success: true,
      message: 'Model gender preference updated',
      preference: updated
    });
  } catch (error) {
    logger.error('Failed to update model gender preference', {
      error: error.message
    });
    res.status(500).json({
      error: error.message || 'Failed to update preference'
    });
  }
});

/**
 * POST /api/model-gender/analyze-portfolio
 * Analyze portfolio images for model gender prevalence
 * 
 * Body:
 * {
 *   portfolioImages: Array of image URLs or objects,
 *   autoUpdate?: boolean (default: true)
 * }
 */
router.post('/analyze-portfolio', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { portfolioImages = [], autoUpdate = true } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID required'
      });
    }

    if (!Array.isArray(portfolioImages) || portfolioImages.length === 0) {
      return res.status(400).json({
        error: 'portfolioImages array is required and must not be empty'
      });
    }

    const analysisResult = await modelGenderService.analyzePortfolioForModelGender(
      userId,
      portfolioImages
    );

    // Auto-update preference if requested
    if (autoUpdate && analysisResult.detected_gender !== 'neutral') {
      await modelGenderService.updateUserModelGenderPreference(userId, {
        setting: 'auto',
        detected_gender: analysisResult.detected_gender,
        confidence: analysisResult.confidence,
        manual_override: false
      });
    }

    res.json({
      success: true,
      analysis: analysisResult,
      message: autoUpdate
        ? `Portfolio analyzed. Model gender preference set to: ${analysisResult.detected_gender}`
        : 'Portfolio analysis complete'
    });
  } catch (error) {
    logger.error('Failed to analyze portfolio for model gender', {
      error: error.message
    });
    res.status(500).json({
      error: error.message || 'Failed to analyze portfolio'
    });
  }
});

/**
 * GET /api/model-gender/prompt-element
 * Get the appropriate model gender prompt element for generation
 * 
 * Query:
 * - generationIndex: number (optional, for alternation)
 * - trackAlternation: boolean (optional, default: true)
 */
router.get('/prompt-element', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const generationIndex = parseInt(req.query.generationIndex || '0');
    const trackAlternation = req.query.trackAlternation !== 'false';

    if (!userId) {
      return res.status(400).json({
        error: 'User ID required'
      });
    }

    const promptElement = await modelGenderService.getModelGenderPromptElement(
      userId,
      generationIndex,
      trackAlternation
    );

    res.json({
      success: true,
      promptElement
    });
  } catch (error) {
    logger.error('Failed to get model gender prompt element', {
      error: error.message
    });
    res.status(500).json({
      error: 'Failed to generate prompt element'
    });
  }
});

/**
 * GET /api/model-gender/detection-history
 * Get the detection history for user's portfolio analysis
 * 
 * Query:
 * - limit: number (optional, default: 50)
 * - offset: number (optional, default: 0)
 */
router.get('/detection-history', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const offset = parseInt(req.query.offset || '0');

    if (!userId) {
      return res.status(400).json({
        error: 'User ID required'
      });
    }

    const db = require('../../services/database');
    const result = await db.query(
      `SELECT 
        id,
        portfolio_image_id,
        detected_gender,
        confidence,
        model_count_male,
        model_count_female,
        analysis_timestamp
       FROM model_gender_detection_history
       WHERE user_id = $1
       ORDER BY analysis_timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM model_gender_detection_history WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit,
        offset,
        total: countResult.rows[0].total
      }
    });
  } catch (error) {
    logger.error('Failed to get detection history', {
      error: error.message
    });
    res.status(500).json({
      error: 'Failed to retrieve detection history'
    });
  }
});

module.exports = router;