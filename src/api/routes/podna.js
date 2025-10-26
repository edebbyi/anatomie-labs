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

    // Extract brand DNA
    const brandDNA = intelligentPromptBuilder.extractBrandDNA({
      aesthetic_themes: parseJSON(profile.aesthetic_themes),
      color_distribution: parseJSON(profile.color_distribution),
      fabric_distribution: parseJSON(profile.fabric_distribution),
      construction_patterns: parseJSON(profile.construction_patterns),
      garment_distribution: parseJSON(profile.garment_distribution),
      signature_pieces: parseJSON(profile.signature_pieces),
      total_images: profile.total_images,
      avg_confidence: profile.avg_confidence
    });

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
          styleTags: Array.isArray(profile.style_tags) ? profile.style_tags : parseJSON(profile.style_tags) || [],
          aestheticThemes: parseJSON(profile.aesthetic_themes),
          constructionPatterns: parseJSON(profile.construction_patterns),
          signaturePieces: parseJSON(profile.signature_pieces),
          updatedAt: profile.updated_at,
          portfolioImages: imagesResult.rows
        },
        brandDNA: brandDNA ? {
          primaryAesthetic: brandDNA.primaryAesthetic,
          secondaryAesthetics: brandDNA.secondaryAesthetics,
          signatureColors: brandDNA.signatureColors,
          signatureFabrics: brandDNA.signatureFabrics,
          signatureConstruction: brandDNA.signatureConstruction,
          preferredPhotography: {
            shotTypes: brandDNA.preferredShotTypes,
            lighting: brandDNA.preferredLighting,
            angles: brandDNA.preferredAngles
          },
          primaryGarments: brandDNA.primaryGarments,
          confidence: {
            aesthetic: brandDNA.aestheticConfidence,
            overall: brandDNA.overallConfidence
          },
          metadata: {
            totalImages: brandDNA.totalImages,
            lastUpdated: brandDNA.lastUpdated,
            driftScore: brandDNA.driftScore
          }
        } : null
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
 * Generate a single image with optional user prompt interpretation
 */
router.post('/generate', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { 
    prompt, // Add user prompt parameter
    mode = 'exploratory', 
    constraints = {}, 
    provider = 'imagen-4-ultra', 
    upscale = false,
    interpret = true // Add interpretation flag
  } = req.body;

  logger.info('Podna: Generating image', { userId, mode, provider, hasUserPrompt: !!prompt });

  try {
    let generationPrompt;
    
    // If user provided a prompt, use enhanced interpretation
    if (prompt && interpret) {
      // Get enhanced style profile
      const styleProfile = await intelligentPromptBuilder.getEnhancedStyleProfile(userId);
      
      // Extract brand DNA
      const brandDNA = styleProfile ? intelligentPromptBuilder.extractBrandDNA(styleProfile) : null;

      logger.info('Generating with user prompt and brand DNA', {
        userId,
        prompt: prompt.substring(0, 50),
        hasBrandDNA: !!brandDNA
      });

      // Generate enhanced prompt
      const promptResult = await intelligentPromptBuilder.generatePrompt(userId, {
        creativity: mode === 'exploratory' ? 0.7 : mode === 'creative' ? 0.5 : 0.3,
        brandDNA,
        enforceBrandDNA: true,
        brandDNAStrength: 0.8,
        userPrompt: prompt
      });
      
      generationPrompt = promptResult;
    } else {
      // Generate prompt with A/B testing router (existing behavior)
      // Add timestamp-based variation seed for diversity
      const variationSeed = Date.now() % 1000;
      
      generationPrompt = await promptRouter.generatePrompt(userId, { 
        garmentType: constraints.garment_type,
        season: constraints.season,
        occasion: constraints.occasion,
        creativity: mode === 'exploratory' ? 0.7 : mode === 'creative' ? 0.5 : 0.3,
        variationSeed: variationSeed,
        useCache: false // Disable caching to ensure variety
      });
    }

    // Generate image with Image Generation Agent
    const generation = await imageGenerationAgent.generateImage(userId, generationPrompt.id || generationPrompt.prompt_id, { 
      provider, 
      upscale 
    });

    // Track generation interaction for continuous learning (non-blocking)
    continuousLearningAgent.trackInteraction(userId, generation.id, {
      event_type: 'image_generation',
      metadata: {
        promptId: generationPrompt.id || generationPrompt.prompt_id,
        provider,
        mode,
        hasUserPrompt: !!prompt
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
          promptText: generationPrompt.text || generationPrompt.positive_prompt,
          promptSpec: generationPrompt.json_spec || generationPrompt.metadata,
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
 * POST /api/podna/generate-with-dna
 * Generate images with brand DNA enforcement
 */
router.post('/generate-with-dna', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { userId } = req.user;
    const { 
      prompt, 
      enforceBrandDNA = true, 
      brandDNAStrength = 0.8,
      creativity = 0.3,
      count = 4,
      options = {} 
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    // Get enhanced style profile
    const styleProfile = await intelligentPromptBuilder.getEnhancedStyleProfile(userId);
    
    if (!styleProfile && enforceBrandDNA) {
      return res.status(400).json({
        success: false,
        message: 'No style profile found. Please upload a portfolio first.',
        code: 'NO_STYLE_PROFILE'
      });
    }

    // Extract brand DNA
    const brandDNA = styleProfile 
      ? intelligentPromptBuilder.extractBrandDNA(styleProfile)
      : null;

    logger.info('Generating with brand DNA', {
      userId,
      prompt: prompt.substring(0, 50),
      enforceBrandDNA,
      hasBrandDNA: !!brandDNA,
      brandConfidence: brandDNA?.overallConfidence
    });

    // Generate enhanced prompt
    const promptResult = await intelligentPromptBuilder.generatePrompt(userId, {
      ...options,
      creativity,
      brandDNA,
      enforceBrandDNA,
      brandDNAStrength,
      userPrompt: prompt
    });

    // Generate images
    const generations = [];

    for (let i = 0; i < count; i++) {
      try {
        const generation = await imageGenerationAgent.generateImage(userId, promptResult.prompt_id, options);
        
        // Add brand consistency score to generation
        generation.brand_consistency_score = promptResult.metadata.brand_consistency_score;
        generation.brand_dna_applied = enforceBrandDNA;
        
        generations.push(generation);
        
      } catch (genError) {
        logger.error('Individual generation failed', {
          userId,
          index: i,
          error: genError.message
        });
      }
    }

    if (generations.length === 0) {
      throw new Error('All generations failed');
    }

    res.json({
      success: true,
      data: {
        generations,
        prompt: promptResult,
        brandDNA: brandDNA ? {
          primaryAesthetic: brandDNA.primaryAesthetic,
          signatureElements: {
            colors: brandDNA.signatureColors.slice(0, 3).map(c => c.name),
            fabrics: brandDNA.signatureFabrics.slice(0, 3).map(f => f.name),
            construction: brandDNA.signatureConstruction.slice(0, 3).map(c => c.detail)
          },
          confidence: brandDNA.overallConfidence
        } : null,
        avgBrandConsistency: generations.reduce((sum, g) => 
          sum + (g.brand_consistency_score || 0.5), 0
        ) / generations.length
      }
    });

  } catch (error) {
    logger.error('Generation with DNA failed', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Generation failed',
      code: 'GENERATION_ERROR'
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
 * Get user's generated images with metadata for filtering
 */
router.get('/gallery', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 50;

  // Modified to return all generated images, not just liked ones
  const query = `
    SELECT g.*, p.text as prompt_text, p.json_spec
    FROM generations g
    JOIN prompts p ON g.prompt_id = p.id
    WHERE g.user_id = $1
    ORDER BY g.created_at DESC
    LIMIT $2
  `;

  const result = await db.query(query, [userId, limit]);
  const generations = result.rows;

  // Extract metadata from prompt specifications for filtering
  const generationsWithMetadata = generations.map(g => {
    // Extract metadata from the prompt specification
    let metadata = {};
    
    if (g.json_spec && g.json_spec.thompson_selection) {
      const selection = g.json_spec.thompson_selection;
      
      // Extract colors
      if (selection.colors && Array.isArray(selection.colors)) {
        metadata.colors = selection.colors.map(c => 
          typeof c === 'string' ? c : (c.name || JSON.stringify(c))
        );
      }
      
      // Extract garment type
      if (selection.garment && selection.garment.type) {
        metadata.garmentType = selection.garment.type;
      } else if (selection.garment && typeof selection.garment === 'string') {
        metadata.garmentType = selection.garment;
      }
      
      // Extract style tags/aesthetic
      if (selection.styleContext) {
        metadata.styleTags = [selection.styleContext];
      }
      
      // Extract silhouette
      if (selection.garment && selection.garment.silhouette) {
        metadata.silhouette = selection.garment.silhouette;
      }
      
      // Extract fabric
      if (selection.fabric && selection.fabric.material) {
        metadata.fabric = selection.fabric.material;
      } else if (selection.fabric && typeof selection.fabric === 'string') {
        metadata.fabric = selection.fabric;
      }
    }
    
    return {
      id: g.id,
      url: g.url,
      promptText: g.prompt_text,
      promptSpec: g.json_spec,
      provider: g.provider,
      costCents: g.cost_cents,
      createdAt: g.created_at,
      metadata: metadata
    };
  });

  res.json({
    success: true,
    data: {
      count: generationsWithMetadata.length,
      generations: generationsWithMetadata
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
    const profile = await trendAnalysisAgent.generateEnhancedStyleProfile(userId, portfolioId);
    
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


/**
 * GET /api/podna/brand-consistency/:generationId
 * Get detailed brand consistency breakdown for a generation
 */
router.get('/brand-consistency/:generationId', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const { generationId } = req.params;
    const userId = req.user.id;

    // Verify ownership of the generation
    const generationQuery = `
      SELECT g.id, g.prompt_id, g.user_id, p.json_spec
      FROM generations g
      LEFT JOIN prompts p ON g.prompt_id = p.id
      WHERE g.id = $1 AND g.user_id = $2
    `;
    
    const generationResult = await db.query(generationQuery, [generationId, userId]);
    
    if (generationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Generation not found or unauthorized'
      });
    }

    const generation = generationResult.rows[0];
    
    // Get the prompt metadata which contains brand consistency info
    const promptSpec = generation.json_spec;
    
    if (!promptSpec || !promptSpec.brand_consistency_score) {
      return res.status(404).json({
        success: false,
        message: 'Brand consistency data not available for this generation'
      });
    }

    // Get enhanced style profile for detailed breakdown
    const styleProfile = await intelligentPromptBuilder.getEnhancedStyleProfile(userId);
    const brandDNA = styleProfile ? intelligentPromptBuilder.extractBrandDNA(styleProfile) : null;
    
    if (!brandDNA) {
      return res.status(404).json({
        success: false,
        message: 'No brand DNA found for user'
      });
    }

    // Calculate detailed breakdown
    const thompsonSelection = promptSpec.thompson_selection || {};
    
    const breakdown = {
      aesthetic: {
        score: thompsonSelection.styleContext === brandDNA.primaryAesthetic ? 1.0 : 
               brandDNA.secondaryAesthetics.includes(thompsonSelection.styleContext) ? 0.7 : 0.3,
        matched: thompsonSelection.styleContext,
        expected: brandDNA.primaryAesthetic
      },
      colors: {
        score: thompsonSelection.colors && thompsonSelection.colors.length > 0 ? 
               thompsonSelection.colors.filter(c => 
                 brandDNA.signatureColors.some(sc => sc.name === c.name)
               ).length / thompsonSelection.colors.length : 0,
        matched: thompsonSelection.colors?.map(c => c.name) || [],
        expected: brandDNA.signatureColors.map(c => c.name)
      },
      fabric: {
        score: thompsonSelection.fabric && 
               brandDNA.signatureFabrics.some(sf => sf.name === thompsonSelection.fabric?.material) ? 1.0 : 0.5,
        matched: thompsonSelection.fabric?.material,
        expected: brandDNA.signatureFabrics.map(sf => sf.name)
      },
      construction: {
        score: thompsonSelection.construction && thompsonSelection.construction.length > 0 ? 
               thompsonSelection.construction.filter(c => 
                 brandDNA.signatureConstruction.some(sc => 
                   c.includes(sc.detail) || sc.detail.includes(c)
                 )
               ).length / thompsonSelection.construction.length : 0.5,
        matched: thompsonSelection.construction || [],
        expected: brandDNA.signatureConstruction.map(sc => sc.detail)
      },
      photography: {
        score: 0.5, // Default score
        matched: {},
        expected: {}
      }
    };

    // Calculate photography scores if available
    if (thompsonSelection.pose && brandDNA.preferredShotTypes.length > 0) {
      const preferredShot = brandDNA.preferredShotTypes[0].type;
      breakdown.photography.score += thompsonSelection.pose.shot_type === preferredShot ? 0.3 : 0.1;
      breakdown.photography.matched.shotType = thompsonSelection.pose.shot_type;
      breakdown.photography.expected.shotType = preferredShot;
    }
    
    if (thompsonSelection.photography && brandDNA.preferredAngles.length > 0) {
      const preferredAngle = brandDNA.preferredAngles[0].angle;
      breakdown.photography.score += thompsonSelection.photography.angle === preferredAngle ? 0.2 : 0.0;
      breakdown.photography.matched.angle = thompsonSelection.photography.angle;
      breakdown.photography.expected.angle = preferredAngle;
    }
    
    // Normalize photography score
    breakdown.photography.score = Math.min(1.0, breakdown.photography.score);

    res.json({
      success: true,
      data: {
        generationId,
        overallScore: promptSpec.brand_consistency_score,
        breakdown
      }
    });

  } catch (error) {
    logger.error('Brand consistency lookup failed', {
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get brand consistency data',
      code: 'BRAND_CONSISTENCY_ERROR'
    });
  }
}));

// Add this helper function to get ultra detailed descriptors
async function getUltraDetailedDescriptors(portfolioId) {
  const query = `
    SELECT 
      d.*,
      pi.url_original as image_url
    FROM ultra_detailed_descriptors d
    JOIN portfolio_images pi ON d.image_id = pi.id
    WHERE pi.portfolio_id = $1
    ORDER BY d.overall_confidence DESC, d.completeness_percentage DESC
  `;

  const result = await db.query(query, [portfolioId]);
  return result.rows;
}

module.exports = router;