/**
 * Podna Agent System Routes
 * 
 * Simplified agent-based onboarding and generation system.
 */

const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../../middleware/errorHandler');
const { authMiddleware } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const db = require('../../services/database');

// Import agents
const ingestionAgent = require('../../services/ingestionAgent');
const styleDescriptorAgent = require('../../services/ultraDetailedIngestionAgent');
const trendAnalysisAgent = require('../../services/trendAnalysisAgent');
const promptBuilderAgent = require('../../services/advancedPromptBuilderAgent');
const intelligentPromptBuilder = require('../../services/IntelligentPromptBuilder');
const PromptBuilderRouter = require('../../services/promptBuilderRouter');

// Create router with 10% traffic to new system
const promptRouter = new PromptBuilderRouter(10);
const imageGenerationAgent = require('../../services/imageGenerationAgent');
const feedbackLearnerAgent = require('../../services/feedbackLearnerAgent');
const continuousLearningAgent = require('../../services/continuousLearningAgent');
const validationAgent = require('../../services/validationAgent');

// Add this after the existing imports
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

/**
 * POST /api/podna/upload
 * Upload portfolio ZIP file and start ingestion
 */
router.post('/upload', authMiddleware, upload.single('portfolio'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please upload a ZIP file.'
    });
  }

  const userId = req.user.id;
  const zipBuffer = req.file.buffer;
  const filename = req.file.originalname;

  logger.info('Podna: Starting portfolio upload', { 
    userId, 
    filename,
    size: req.file.size
  });

  try {
    // Process ZIP with Ingestion Agent
    const result = await ingestionAgent.processZipUpload(userId, zipBuffer, filename);

    logger.info('Podna: Upload completed', {
      portfolioId: result.portfolio.id,
      imageCount: result.portfolio.imageCount,
      processingTimeMs: result.processingTimeMs
    });

    res.json({
      success: true,
      message: 'Portfolio uploaded successfully',
      data: {
        portfolioId: result.portfolio.id,
        imageCount: result.portfolio.imageCount,
        processingTimeMs: result.processingTimeMs
      }
    });

  } catch (error) {
    logger.error('Podna: Upload failed', { userId, error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process portfolio upload',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}));

/**
 * POST /api/podna/analyze/:portfolioId
 * Analyze portfolio images and extract style descriptors
 */
// Progress tracking for analysis
const analysisProgress = new Map();

router.post('/analyze/:portfolioId', authMiddleware, asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const userId = req.user.id;

  logger.info('Podna: Starting portfolio analysis', { userId, portfolioId });

  try {
    // Initialize progress
    analysisProgress.set(portfolioId, {
      status: 'starting',
      current: 0,
      total: 0,
      percentage: 0,
      message: 'Initializing analysis...'
    });

    // Analyze with Ultra-Detailed Ingestion Agent with progress callback
    const result = await styleDescriptorAgent.analyzePortfolio(portfolioId, async (progress) => {
      // Update progress
      analysisProgress.set(portfolioId, {
        status: 'analyzing',
        current: progress.current,
        total: progress.total,
        percentage: progress.percentage,
        currentImage: progress.currentImage,
        analyzed: progress.analyzed,
        failed: progress.failed,
        avgConfidence: progress.avgConfidence,
        avgCompleteness: progress.avgCompleteness,
        message: `Analyzing image ${progress.current} of ${progress.total}...`,
        error: progress.error
      });
      
      // Track interaction for continuous learning (non-blocking)
      if (progress.currentImage) {
        continuousLearningAgent.trackInteraction(userId, null, {
          event_type: 'image_analysis_progress',
          duration_ms: 1000, // Placeholder
          metadata: {
            portfolioId,
            current: progress.current,
            total: progress.total,
            avgConfidence: progress.avgConfidence,
            avgCompleteness: progress.avgCompleteness
          }
        }).catch(err => {
          logger.warn('Failed to track progress interaction', { error: err.message });
        });
      }
    });

    // Mark as complete
    analysisProgress.set(portfolioId, {
      status: 'complete',
      current: result.analyzed + result.failed,
      total: result.analyzed + result.failed,
      percentage: 100,
      analyzed: result.analyzed,
      failed: result.failed,
      avgConfidence: result.avgConfidence,
      avgCompleteness: result.avgCompleteness,
      message: 'Analysis complete!'
    });

    // Clean up progress after 5 minutes
    setTimeout(() => analysisProgress.delete(portfolioId), 5 * 60 * 1000);

    res.json({
      success: true,
      message: 'Portfolio analyzed successfully',
      data: {
        analyzed: result.analyzed,
        failed: result.failed,
        avgConfidence: result.avgConfidence,
        avgCompleteness: result.avgCompleteness,
        descriptors: result.descriptors.length
      }
    });

  } catch (error) {
    logger.error('Podna: Analysis failed', { userId, portfolioId, error: error.message });
    
    // Mark as failed
    analysisProgress.set(portfolioId, {
      status: 'failed',
      message: error.message || 'Analysis failed',
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze portfolio'
    });
  }
}));

/**
 * GET /api/podna/analyze/:portfolioId/progress
 * Get analysis progress for a portfolio
 */
router.get('/analyze/:portfolioId/progress', authMiddleware, asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  
  const progress = analysisProgress.get(portfolioId);
  
  if (!progress) {
    return res.json({
      success: true,
      data: {
        status: 'unknown',
        message: 'No active analysis found'
      }
    });
  }
  
  res.json({
    success: true,
    data: progress
  });
}));

/**
 * POST /api/podna/profile/generate/:portfolioId
 * Generate style profile from analyzed portfolio
 */
router.post('/profile/generate/:portfolioId', authMiddleware, asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const userId = req.user.id;

  logger.info('Podna: Generating style profile', { userId, portfolioId });

  try {
    // Generate with Trend Analysis Agent
    const profile = await trendAnalysisAgent.generateEnhancedStyleProfile(userId, portfolioId);

    res.json({
      success: true,
      message: 'Style profile generated successfully',
      data: {
        profile: {
          id: profile.id,
          styleLabels: profile.style_labels,
          clusters: profile.clusters,
          summaryText: profile.summary_text,
          totalImages: profile.total_images,
          distributions: {
            garments: profile.garment_distribution,
            colors: profile.color_distribution,
            fabrics: profile.fabric_distribution,
            silhouettes: profile.silhouette_distribution
          }
        }
      }
    });

  } catch (error) {
    logger.error('Podna: Profile generation failed', { userId, portfolioId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate style profile'
    });
  }
}));

/**
 * GET /api/podna/profile
 * Get user's style profile with portfolio images
 */
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  try {
    logger.info('Podna: Fetching style profile', { userId });

    const profile = await trendAnalysisAgent.getStyleProfile(userId);

    if (!profile) {
      logger.warn('Podna: No style profile found', { userId });
      return res.status(404).json({
        success: false,
        message: 'No style profile found. Please upload a portfolio first.'
      });
    }

    // Get portfolio images
    const imagesQuery = `
      SELECT pi.id, pi.filename, pi.url_original as url, pi.width, pi.height, pi.created_at as uploaded_at
      FROM portfolio_images pi
      WHERE pi.portfolio_id = $1
      ORDER BY pi.created_at DESC
    `;
    const imagesResult = await db.query(imagesQuery, [profile.portfolio_id]);

    // Parse JSON fields (they're stored as strings in DB)
    const parseJSON = (field) => {
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch (e) {
        logger.warn('Failed to parse JSON field', { error: e.message });
        return field;
      }
    };

    logger.info('Podna: Style profile fetched successfully', { 
      userId, 
      profileId: profile.id,
      imageCount: imagesResult.rows.length 
    });

    res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          portfolioId: profile.portfolio_id,
          styleLabels: parseJSON(profile.style_labels),
          clusters: parseJSON(profile.clusters),
          summaryText: profile.summary_text,
          totalImages: profile.total_images,
          distributions: {
            garments: parseJSON(profile.garment_distribution),
            colors: parseJSON(profile.color_distribution),
            fabrics: parseJSON(profile.fabric_distribution),
            silhouettes: parseJSON(profile.silhouette_distribution)
          },
          updatedAt: profile.updated_at,
          portfolioImages: imagesResult.rows
        }
      }
    });
  } catch (error) {
    logger.error('Podna: Profile fetch failed', { 
      userId, 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch style profile'
    });
  }
}));

/**
 * GET /api/podna/portfolio/:portfolioId/images
 * Get images from a specific portfolio
 */
router.get('/portfolio/:portfolioId/images', authMiddleware, asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const userId = req.user.id;

  // Verify ownership
  const portfolioQuery = `SELECT id FROM portfolios WHERE id = $1 AND user_id = $2`;
  const portfolioResult = await db.query(portfolioQuery, [portfolioId, userId]);
  
  if (portfolioResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Portfolio not found or unauthorized'
    });
  }

  const imagesQuery = `
    SELECT id, filename, url_original as url, width, height, created_at as uploaded_at
    FROM portfolio_images
    WHERE portfolio_id = $1
    ORDER BY created_at DESC
  `;
  const imagesResult = await db.query(imagesQuery, [portfolioId]);

  res.json({
    success: true,
    data: {
      portfolioId,
      images: imagesResult.rows
    }
  });
}));

/**
 * POST /api/podna/portfolio/:portfolioId/add-images
 * Add more images to existing portfolio
 */
router.post('/portfolio/:portfolioId/add-images', authMiddleware, upload.single('portfolio'), asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const userId = req.user.id;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please upload a ZIP file.'
    });
  }

  logger.info('Podna: Adding images to portfolio', { userId, portfolioId });

  // Verify ownership
  const portfolioQuery = `SELECT id FROM portfolios WHERE id = $1 AND user_id = $2`;
  const portfolioResult = await db.query(portfolioQuery, [portfolioId, userId]);
  
  if (portfolioResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Portfolio not found or unauthorized'
    });
  }

  const zipBuffer = req.file.buffer;
  const filename = req.file.originalname;

  try {
    // Add images to existing portfolio
    const result = await ingestionAgent.addImagesToPortfolio(portfolioId, zipBuffer, filename);

    logger.info('Podna: Images added to portfolio', {
      portfolioId,
      newImageCount: result.addedCount,
      totalImages: result.totalImages
    });

    res.json({
      success: true,
      message: 'Images added successfully',
      data: {
        addedCount: result.addedCount,
        totalImages: result.totalImages,
        duplicateCount: result.duplicateCount
      }
    });

  } catch (error) {
    logger.error('Podna: Add images failed', { portfolioId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to add images to portfolio'
    });
  }
}));

/**
 * POST /api/podna/generate
 * Generate a single image
 */
router.post('/generate', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { mode = 'exploratory', constraints = {}, provider = 'imagen-4-ultra', upscale = false } = req.body;

  logger.info('Podna: Generating image', { userId, mode, provider });

  try {
    // Generate prompt with A/B testing router
    // Add timestamp-based variation seed for diversity
    const variationSeed = Date.now() % 1000;
    
    const prompt = await promptRouter.generatePrompt(userId, { 
      garmentType: constraints.garment_type,
      season: constraints.season,
      occasion: constraints.occasion,
      creativity: mode === 'exploratory' ? 0.7 : mode === 'creative' ? 0.5 : 0.3,
      variationSeed: variationSeed,
      useCache: false // Disable caching to ensure variety
    });

    // Generate image with Image Generation Agent
    const generation = await imageGenerationAgent.generateImage(userId, prompt.id, { 
      provider, 
      upscale 
    });

    // Track generation interaction for continuous learning (non-blocking)
    continuousLearningAgent.trackInteraction(userId, generation.id, {
      event_type: 'image_generation',
      metadata: {
        promptId: prompt.id,
        provider,
        mode
      }
    }).catch(err => {
      logger.warn('Failed to track generation interaction', { error: err.message });
    });

    res.json({
      success: true,
      message: 'Image generated successfully',
      data: {
        generation: {
          id: generation.id,
          url: generation.url,
          promptText: prompt.text,
          promptSpec: prompt.json_spec,
          provider: generation.provider,
          costCents: generation.cost_cents,
          createdAt: generation.created_at
        }
      }
    });

  } catch (error) {
    logger.error('Podna: Generation failed', { userId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate image'
    });
  }
}));

/**
 * POST /api/podna/generate/batch
 * Generate batch of images
 */
router.post('/generate/batch', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { count = 10, mode = 'exploratory', provider = 'imagen-4-ultra' } = req.body;

  logger.info('Podna: Generating batch', { userId, count, mode });

  try {
    // Update image generation agent to use A/B testing router
    const generations = await imageGenerationAgent.generateBatch(userId, count, { 
      mode, 
      provider,
      promptBuilder: promptRouter
    });

    const totalCost = generations.reduce((sum, g) => sum + (g.cost_cents || 0), 0);

    // Track batch generation interaction for continuous learning (non-blocking)
    continuousLearningAgent.trackInteraction(userId, null, {
      event_type: 'batch_generation',
      metadata: {
        count,
        mode,
        provider,
        actualCount: generations.length
      }
    }).catch(err => {
      logger.warn('Failed to track batch generation interaction', { error: err.message });
    });

    res.json({
      success: true,
      message: `Generated ${generations.length} images successfully`,
      data: {
        count: generations.length,
        totalCostCents: totalCost,
        generations: generations.map(g => ({
          id: g.id,
          url: g.url,
          createdAt: g.created_at
        }))
      }
    });

  } catch (error) {
    logger.error('Podna: Batch generation failed', { userId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate batch'
    });
  }
}));

/**
 * GET /api/podna/gallery
 * Get user's generated images
 */
router.get('/gallery', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 50;

  const generations = await imageGenerationAgent.getUserGenerations(userId, limit);

  res.json({
    success: true,
    data: {
      count: generations.length,
      generations: generations.map(g => ({
        id: g.id,
        url: g.url,
        promptText: g.prompt_text,
        promptSpec: g.json_spec,
        provider: g.provider,
        costCents: g.cost_cents,
        createdAt: g.created_at
      }))
    }
  });
}));

/**
 * POST /api/podna/feedback
 * Submit feedback on generated image
 */
router.post('/feedback', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { generationId, type, note } = req.body;

  if (!generationId || !type) {
    return res.status(400).json({
      success: false,
      message: 'generationId and type are required'
    });
  }

  logger.info('Podna: Processing feedback', { userId, generationId, type });

  try {
    const result = await feedbackLearnerAgent.processFeedback(userId, generationId, { 
      type, 
      note 
    });

    // Update Thompson Sampling parameters for Intelligent Prompt Builder
    try {
      // Get the prompt ID associated with this generation
      const generationQuery = `SELECT prompt_id FROM generations WHERE id = $1`;
      const generationResult = await db.query(generationQuery, [generationId]);
      const promptId = generationResult.rows[0]?.prompt_id;
      
      if (promptId) {
        // Convert feedback type to Thompson parameters
        const feedbackParams = {
          liked: type === 'like' || type === 'heart',
          saved: type === 'save',
          shared: type === 'share'
        };
        
        // Update Thompson parameters
        await intelligentPromptBuilder.updateThompsonParamsFromFeedback(userId, promptId, feedbackParams);
      }
    } catch (thompsonError) {
      logger.warn('Failed to update Thompson parameters', { 
        userId, 
        generationId, 
        error: thompsonError.message 
      });
    }

    // Track feedback interaction for continuous learning
    await continuousLearningAgent.trackInteraction(userId, generationId, {
      event_type: 'feedback',
      metadata: {
        feedbackType: type,
        hasNote: !!note,
        feedbackId: result.feedback.id
      }
    });

    res.json({
      success: true,
      message: 'Feedback processed successfully',
      data: {
        feedback: {
          id: result.feedback.id,
          type: result.feedback.type,
          parsedCritique: result.feedback.parsed_critique
        },
        learningEvent: {
          id: result.learningEvent.id,
          delta: result.delta
        }
      }
    });

  } catch (error) {
    logger.error('Podna: Feedback processing failed', { userId, generationId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process feedback'
    });
  }
}));

/**
 * GET /api/podna/feedback
 * Get user's feedback history
 */
router.get('/feedback', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 50;

  const feedback = await feedbackLearnerAgent.getUserFeedback(userId, limit);

  res.json({
    success: true,
    data: {
      count: feedback.length,
      feedback: feedback.map(f => ({
        id: f.id,
        generationId: f.generation_id,
        type: f.type,
        note: f.note,
        parsedCritique: f.parsed_critique,
        imageUrl: f.url,
        createdAt: f.created_at
      }))
    }
  });
}));

/**
 * POST /api/podna/onboard
 * Complete onboarding workflow (upload + analyze + profile generation + initial batch)
 */
router.post('/onboard', authMiddleware, upload.single('portfolio'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please upload a ZIP file.'
    });
  }

  const userId = req.user.id;
  const zipBuffer = req.file.buffer;
  const filename = req.file.originalname;
  const generateInitial = req.body.generateInitial === 'true';
  const initialCount = parseInt(req.body.initialCount) || 5;

  logger.info('Podna: Starting complete onboarding', { userId, filename, generateInitial });

  try {
    // Step 1: Upload and ingest
    logger.info('Podna Onboarding: Step 1/4 - Ingesting portfolio');
    const uploadResult = await ingestionAgent.processZipUpload(userId, zipBuffer, filename);
    const portfolioId = uploadResult.portfolio.id;

    // Track ingestion interaction (non-blocking)
    continuousLearningAgent.trackInteraction(userId, null, {
      event_type: 'portfolio_upload',
      metadata: {
        portfolioId,
        imageCount: uploadResult.portfolio.imageCount,
        filename
      }
    }).catch(err => {
      logger.warn('Failed to track upload interaction', { error: err.message });
    });

    // Step 2: Analyze images
    logger.info('Podna Onboarding: Step 2/4 - Analyzing images');
    const analysisResult = await styleDescriptorAgent.analyzePortfolio(portfolioId);

    // Track analysis interaction (non-blocking)
    continuousLearningAgent.trackInteraction(userId, null, {
      event_type: 'portfolio_analysis',
      metadata: {
        portfolioId,
        analyzed: analysisResult.analyzed,
        failed: analysisResult.failed,
        avgConfidence: analysisResult.avgConfidence,
        avgCompleteness: analysisResult.avgCompleteness
      }
    }).catch(err => {
      logger.warn('Failed to track analysis interaction', { error: err.message });
    });

    // Step 3: Generate style profile
    logger.info('Podna Onboarding: Step 3/4 - Generating style profile');
    const profile = await trendAnalysisAgent.generateStyleProfile(userId, portfolioId);
    
    logger.info('Podna Onboarding: Profile generated successfully', {
      profileId: profile.id,
      portfolioId: profile.portfolio_id,
      totalImages: profile.total_images,
      styleLabelsCount: Array.isArray(profile.style_labels) ? profile.style_labels.length : 'N/A',
      clustersCount: Array.isArray(profile.clusters) ? profile.clusters.length : 'N/A'
    });

    // Track profile generation interaction (non-blocking)
    continuousLearningAgent.trackInteraction(userId, null, {
      event_type: 'profile_generation',
      metadata: {
        portfolioId,
        profileId: profile.id
      }
    }).catch(err => {
      logger.warn('Failed to track profile generation interaction', { error: err.message });
    });

    // Step 4: Generate initial images (optional)
    let generations = [];
    if (generateInitial) {
      logger.info('Podna Onboarding: Step 4/4 - Generating initial images');
      // Use imagen-4-ultra provider as specified in memory notes
      generations = await imageGenerationAgent.generateBatch(userId, initialCount, { 
        mode: 'exploratory',
        provider: 'imagen-4-ultra'
      });
      
      // Track initial generation interaction (non-blocking)
      continuousLearningAgent.trackInteraction(userId, null, {
        event_type: 'initial_generation',
        metadata: {
          count: initialCount,
          actualCount: generations.length,
          provider: 'imagen-4-ultra'
        }
      }).catch(err => {
        logger.warn('Failed to track initial generation interaction', { error: err.message });
      });
    }

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        portfolio: {
          id: portfolioId,
          imageCount: uploadResult.portfolio.imageCount
        },
        analysis: {
          analyzed: analysisResult.analyzed,
          failed: analysisResult.failed,
          avgConfidence: analysisResult.avgConfidence,
          avgCompleteness: analysisResult.avgCompleteness
        },
        profile: {
          id: profile.id,
          summaryText: profile.summary_text,
          styleLabels: profile.style_labels,
          clusters: profile.clusters
        },
        generations: {
          count: generations.length,
          images: generations.map(g => ({
            id: g.id,
            url: g.url
          }))
        }
      }
    });

  } catch (error) {
    logger.error('Podna: Onboarding failed', { userId, error: error.message });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Onboarding failed'
    });
  }
}));

module.exports = router;