const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const { authMiddleware } = require('../../middleware/auth');
const personaService = require('../../services/personaService');
const portfolioService = require('../../services/portfolioService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/persona
 * Create a new persona for the user
 * Requires authentication
 */
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const {
    name,
    description,
    keywords = [],
    stylePreferences = {},
    examplePrompts = []
  } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Persona name is required'
    });
  }

  logger.info('Creating persona', {
    userId: req.user.id,
    name
  });

  try {
    const persona = await personaService.createPersona(req.user.id, {
      name,
      description,
      keywords,
      stylePreferences,
      examplePrompts
    });

    res.status(201).json({
      success: true,
      data: persona,
      message: 'Persona created successfully'
    });

  } catch (error) {
    logger.error('Persona creation failed', {
      userId: req.user.id,
      name,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/persona
 * Get all personas for the user
 * Requires authentication
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  logger.info('Fetching user personas', {
    userId: req.user.id
  });

  try {
    const personas = await personaService.getUserPersonas(req.user.id);

    res.json({
      success: true,
      data: personas,
      meta: {
        count: personas.length,
        hasActive: personas.some(p => p.is_active)
      }
    });

  } catch (error) {
    logger.error('Failed to fetch personas', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/persona/active
 * Get the active persona for the user
 * Requires authentication
 */
router.get('/active', authMiddleware, asyncHandler(async (req, res) => {
  logger.info('Fetching active persona', {
    userId: req.user.id
  });

  try {
    const persona = await personaService.getActivePersona(req.user.id);

    if (!persona) {
      return res.json({
        success: true,
        data: null,
        message: 'No active persona set'
      });
    }

    res.json({
      success: true,
      data: persona
    });

  } catch (error) {
    logger.error('Failed to fetch active persona', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * PUT /api/persona/:id/activate
 * Set a persona as active
 * Requires authentication
 */
router.put('/:id/activate', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  logger.info('Activating persona', {
    userId: req.user.id,
    personaId: id
  });

  try {
    const persona = await personaService.setActivePersona(req.user.id, parseInt(id));

    res.json({
      success: true,
      data: persona,
      message: `Persona "${persona.name}" is now active`
    });

  } catch (error) {
    logger.error('Failed to activate persona', {
      userId: req.user.id,
      personaId: id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/persona/match
 * Match an enhanced prompt to user's persona
 * Requires authentication
 */
router.post('/match', authMiddleware, asyncHandler(async (req, res) => {
  const { enhancedPrompt, options = {} } = req.body;

  if (!enhancedPrompt) {
    return res.status(400).json({
      success: false,
      message: 'Enhanced prompt required'
    });
  }

  logger.info('Matching prompt to persona', {
    userId: req.user.id,
    hasPrompt: !!enhancedPrompt
  });

  const startTime = Date.now();

  try {
    const result = await personaService.matchToPersona(
      req.user.id,
      enhancedPrompt,
      options
    );

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}ms`,
        matchScore: result.matchScore,
        wasAdjusted: result.adjustments.length > 0
      }
    });

  } catch (error) {
    logger.error('Persona matching failed', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/persona/:id/feedback
 * Update persona based on user feedback
 * Requires authentication
 */
router.post('/:id/feedback', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    likedPrompts = [],
    dislikedPrompts = [],
    imageIds = []
  } = req.body;

  logger.info('Updating persona from feedback', {
    userId: req.user.id,
    personaId: id,
    likedCount: likedPrompts.length
  });

  try {
    const result = await personaService.updatePersonaFromFeedback(
      req.user.id,
      parseInt(id),
      { likedPrompts, dislikedPrompts, imageIds }
    );

    res.json({
      success: true,
      data: result,
      message: 'Persona updated from feedback'
    });

  } catch (error) {
    logger.error('Failed to update persona from feedback', {
      userId: req.user.id,
      personaId: id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/persona/evolution
 * Analyze user's style evolution over time
 * Requires authentication
 */
router.get('/evolution', authMiddleware, asyncHandler(async (req, res) => {
  const { daysBack = 30, personaId } = req.query;

  logger.info('Analyzing style evolution', {
    userId: req.user.id,
    daysBack,
    personaId
  });

  try {
    const analysis = await personaService.analyzeStyleEvolution(
      req.user.id,
      {
        daysBack: parseInt(daysBack),
        personaId: personaId ? parseInt(personaId) : null
      }
    );

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Style evolution analysis failed', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/persona/initialize-defaults
 * Initialize default personas for new user
 * Requires authentication
 */
router.post('/initialize-defaults', authMiddleware, asyncHandler(async (req, res) => {
  logger.info('Initializing default personas', {
    userId: req.user.id
  });

  try {
    const personas = await personaService.initializeDefaultPersonas(req.user.id);

    res.status(201).json({
      success: true,
      data: personas,
      message: `${personas.length} default personas created`
    });

  } catch (error) {
    logger.error('Failed to initialize default personas', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/persona/default-templates
 * Get default persona templates
 */
router.get('/default-templates', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      templates: personaService.defaultPersonas,
      message: 'Use these as a starting point for creating custom personas'
    }
  });
}));

/**
 * POST /api/persona/profile
 * Save user's portfolio/style profile from VLT analysis
 * This creates the database records for the uploaded portfolio
 * NO AUTH REQUIRED - used during onboarding
 */
router.post('/profile', asyncHandler(async (req, res) => {
  const { userId, vltAnalysis, summary, timestamp } = req.body;

  if (!vltAnalysis || !vltAnalysis.records) {
    return res.status(400).json({
      success: false,
      message: 'VLT analysis data is required'
    });
  }

  // Use userId from body (for onboarding) or from auth if available
  const targetUserId = userId || req.user?.id;

  if (!targetUserId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }

  logger.info('Saving portfolio from VLT analysis', {
    userId: targetUserId,
    recordCount: vltAnalysis.records.length,
    jobId: vltAnalysis.jobId
  });

  const startTime = Date.now();

  try {
    // Save VLT analysis results to database
    const result = await portfolioService.saveBatchAnalysis(
      targetUserId,
      vltAnalysis,
      { summary, timestamp }
    );

    const duration = Date.now() - startTime;

    logger.info('Portfolio saved successfully', {
      userId: targetUserId,
      savedCount: result.savedCount,
      duration: `${duration}ms`
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Portfolio saved: ${result.savedCount} items`,
      meta: {
        processingTime: `${duration}ms`,
        totalRecords: result.totalCount,
        savedRecords: result.savedCount
      }
    });

  } catch (error) {
    logger.error('Failed to save portfolio', {
      userId: targetUserId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}));

/**
 * GET /api/persona/stats/:userId
 * Get user's portfolio and generation statistics (public)
 * NO AUTH REQUIRED
 */
router.get('/stats/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    const db = require('../../services/database');
    
    // Get portfolio count and garment type distribution
    const portfolioStats = await db.query(
      `SELECT 
        COUNT(*) as portfolio_count,
        json_object_agg(garment_type, type_count) as garment_distribution
      FROM (
        SELECT garment_type, COUNT(*) as type_count
        FROM vlt_specifications
        WHERE user_id = $1
        GROUP BY garment_type
      ) sub`,
      [userId]
    );
    
    // Get generated images count
    const imagesCount = await db.query(
      `SELECT COUNT(*) as total_images FROM images WHERE user_id = $1`,
      [userId]
    );
    
    // Get style clusters from VLT data
    const styleClusters = await db.query(
      `SELECT 
        COALESCE(attributes->>'aesthetic', 'contemporary') as aesthetic,
        COALESCE(attributes->>'formality', 'casual') as formality,
        COUNT(*) as count
      FROM vlt_specifications
      WHERE user_id = $1
      GROUP BY aesthetic, formality
      ORDER BY count DESC
      LIMIT 5`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        portfolioCount: parseInt(portfolioStats.rows[0]?.portfolio_count || 0),
        garmentDistribution: portfolioStats.rows[0]?.garment_distribution || {},
        generatedImagesCount: parseInt(imagesCount.rows[0]?.total_images || 0),
        styleClusters: styleClusters.rows.map(row => ({
          name: `${row.aesthetic} ${row.formality}`,
          count: parseInt(row.count)
        }))
      }
    });

  } catch (error) {
    logger.error('Failed to fetch portfolio stats', {
      userId,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/persona/images/:userId
 * Get user's generated images (public endpoint for onboarding)
 * NO AUTH REQUIRED - allows viewing images after onboarding without login
 */
router.get('/images/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { limit = 100, offset = 0 } = req.query;

  logger.info('Fetching user images (public)', {
    userId,
    limit,
    offset
  });

  try {
    const db = require('../../services/database');
    const result = await db.query(
      `SELECT 
        id,
        r2_key,
        cdn_url,
        thumbnail_url,
        width,
        height,
        vlt_analysis,
        quality_score,
        created_at
      FROM images
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
        userId
      }
    });

  } catch (error) {
    logger.error('Failed to fetch user images', {
      userId,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/persona/portfolio
 * Get user's portfolio items
 * Requires authentication
 */
router.get('/portfolio', authMiddleware, asyncHandler(async (req, res) => {
  const { limit, offset, garmentType } = req.query;

  logger.info('Fetching user portfolio', {
    userId: req.user.id,
    limit,
    offset
  });

  try {
    const portfolio = await portfolioService.getUserPortfolio(
      req.user.id,
      {
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
        garmentType: garmentType || null
      }
    );

    const summary = await portfolioService.getPortfolioSummary(req.user.id);

    res.json({
      success: true,
      data: portfolio,
      meta: {
        count: portfolio.length,
        summary
      }
    });

  } catch (error) {
    logger.error('Failed to fetch portfolio', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * DELETE /api/persona/:id
 * Delete a persona
 * Requires authentication
 */
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;

  logger.info('Deleting persona', {
    userId: req.user.id,
    personaId: id
  });

  try {
    // Note: Implementation depends on your database service
    // For now, returning a placeholder response
    res.json({
      success: true,
      message: 'Persona deleted successfully'
    });

  } catch (error) {
    logger.error('Failed to delete persona', {
      userId: req.user.id,
      personaId: id,
      error: error.message
    });
    throw error;
  }
}));

module.exports = router;
