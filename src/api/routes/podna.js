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
const { normalizePromptMetadata } = require('../../utils/promptMetadata');

// Import agents
const ingestionAgent = require('../../services/ingestionAgent');
const styleDescriptorAgent = require('../../services/ultraDetailedIngestionAgent');
const trendAnalysisAgent = require('../../services/trendAnalysisAgent');
const modelGenderService = require('../../services/modelGenderDetectionService');
const promptBuilderAgent = require('../../services/advancedPromptBuilderAgent');
const intelligentPromptBuilder = require('../../services/IntelligentPromptBuilder');
const PromptBuilderRouter = require('../../services/promptBuilderRouter');
const r2Storage = require('../../services/r2Storage');

// Create router with 10% traffic to new system
const promptRouter = new PromptBuilderRouter(10);
const imageGenerationAgent = require('../../services/imageGenerationAgent');
const feedbackLearnerAgent = require('../../services/feedbackLearnerAgent');

// Optional: continuousLearningAgent (not yet implemented)
let continuousLearningAgent = null;
try {
  const cla = require('../../services/continuousLearningAgent');
  if (cla && typeof cla.trackInteraction === 'function') {
    continuousLearningAgent = cla;
  }
} catch (err) {
  // Module not available - continue without it
  logger.debug('continuousLearningAgent not available', { error: err.message });
}

const validationAgent = require('../../services/validationAgent');

// Add this after the existing imports
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const DEFAULT_SIGNED_URL_TTL = 3600 * 24 * 7; // 7 days
const SIGNED_URL_TTL_SECONDS = Number(process.env.R2_SIGNED_URL_TTL) > 0
  ? Number(process.env.R2_SIGNED_URL_TTL)
  : DEFAULT_SIGNED_URL_TTL;

const FORCE_SIGNED_URLS = process.env.R2_USE_SIGNED_URLS === 'true';
const PLACEHOLDER_CDN_HOSTS = new Set(['images.designerbff.com']);

const isPlaceholderCdnUrl = (value) => {
  if (!value) return true;
  try {
    const { hostname } = new URL(value);
    return PLACEHOLDER_CDN_HOSTS.has(hostname.toLowerCase());
  } catch (error) {
    return true;
  }
};

const resolveGenerationAssetUrl = async ({
  url,
  cdnUrl,
  urlUpscaled,
  assetUrl,
  r2Key,
  r2KeyUpscaled,
  assetR2Key,
  generationId,
}) => {
  const fallbackUrl = urlUpscaled || url || cdnUrl || assetUrl || null;
  const signingKey = r2KeyUpscaled || r2Key || assetR2Key || null;
  const shouldSign =
    Boolean(signingKey) &&
    typeof r2Storage?.isConfigured === 'function' &&
    r2Storage.isConfigured() &&
    (FORCE_SIGNED_URLS || isPlaceholderCdnUrl(fallbackUrl));

  if (shouldSign) {
    try {
      return await r2Storage.getSignedUrl(signingKey, SIGNED_URL_TTL_SECONDS);
    } catch (error) {
      logger.warn('Failed to sign generation asset URL; falling back to stored path', {
        generationId,
        signingKey,
        error: error.message,
      });
    }
  }

  return fallbackUrl;
};

const shouldSignPortfolioImageUrl = (image, fallbackUrl) => {
  if (!image?.r2_key) return false;
  if (FORCE_SIGNED_URLS) return true;
  if (!fallbackUrl) return true;
  if (fallbackUrl.includes('X-Amz-Signature')) return true;
  return isPlaceholderCdnUrl(fallbackUrl);
};

const resolvePortfolioImageUrls = async (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const canSign =
    typeof r2Storage?.isConfigured === 'function' && r2Storage.isConfigured();

  return Promise.all(
    images.map(async (image) => {
      const fallbackUrl =
        image.url ||
        image.url_preview ||
        image.url_original ||
        image.image_url ||
        null;

      if (canSign && shouldSignPortfolioImageUrl(image, fallbackUrl)) {
        try {
          const signedUrl = await r2Storage.getSignedUrl(
            image.r2_key,
            SIGNED_URL_TTL_SECONDS
          );
          return { ...image, url: signedUrl };
        } catch (error) {
          logger.warn(
            'Failed to sign portfolio image URL; falling back to stored URL',
            {
              imageId: image.id,
              r2Key: image.r2_key,
              error: error.message,
            }
          );
        }
      }

      return { ...image, url: fallbackUrl };
    })
  );
};

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
      
      // Track interaction for continuous learning (non-blocking) - temporarily disabled
      // TODO: Re-enable once continuousLearningAgent is properly implemented
      /*
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
      */
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

    // Parse JSON fields
    const parseJSON = (field) => {
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch (e) {
        logger.warn('Failed to parse JSON field', { error: e.message });
        return field;
      }
    };

    // Generate clusters from aesthetic themes
    const aestheticThemesArray = Array.isArray(profile.aesthetic_themes) 
      ? profile.aesthetic_themes 
      : parseJSON(profile.aesthetic_themes) || [];
    
    const clusters = aestheticThemesArray.slice(0, 5).map((theme, index) => ({
      name: theme.name || `Cluster ${index + 1}`,
      cluster_name: theme.name || `Cluster ${index + 1}`,
      weight: theme.score || theme.weight || (1 / Math.max(aestheticThemesArray.length, 1)),
      score: theme.score || theme.weight || (1 / Math.max(aestheticThemesArray.length, 1)),
      description: theme.description || `Key aesthetic direction in your portfolio`,
      signatureDetails: theme.signatureDetails || [],
      topDescriptors: theme.descriptors ? (Array.isArray(theme.descriptors) ? theme.descriptors : []) : []
    }));

    // Generate style labels from aesthetic themes
    const styleTags = Array.isArray(profile.style_tags) 
      ? profile.style_tags 
      : parseJSON(profile.style_tags) || [];
    
    const styleLabels = styleTags.slice(0, 10).map(tag => ({
      name: tag,
      score: 1,
      count: 1
    }));

    res.json({
      success: true,
      message: 'Style profile generated successfully',
      data: {
        profile: {
          id: profile.id,
          styleLabels: styleLabels,
          clusters: clusters,
          summaryText: profile.summary_text,
          totalImages: profile.total_images,
          distributions: {
            garments: parseJSON(profile.garment_distribution),
            colors: parseJSON(profile.color_distribution),
            fabrics: parseJSON(profile.fabric_distribution),
            silhouettes: parseJSON(profile.silhouette_distribution)
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
      SELECT 
        pi.id, 
        pi.filename, 
        pi.url_original, 
        pi.url_preview,
        pi.r2_key,
        pi.width, 
        pi.height, 
        pi.created_at as uploaded_at
      FROM portfolio_images pi
      WHERE pi.portfolio_id = $1
      ORDER BY pi.created_at DESC
    `;
    const imagesResult = await db.query(imagesQuery, [profile.portfolio_id]);
    const portfolioImages = await resolvePortfolioImageUrls(imagesResult.rows);

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

    // Generate clusters from aesthetic themes (for frontend display)
    const aestheticThemesArray = Array.isArray(profile.aesthetic_themes) 
      ? profile.aesthetic_themes 
      : parseJSON(profile.aesthetic_themes) || [];
    
    const clusters = aestheticThemesArray.slice(0, 5).map((theme, index) => ({
      name: theme.name || `Cluster ${index + 1}`,
      cluster_name: theme.name || `Cluster ${index + 1}`,
      weight: theme.score || theme.weight || (1 / Math.max(aestheticThemesArray.length, 1)),
      score: theme.score || theme.weight || (1 / Math.max(aestheticThemesArray.length, 1)),
      description: theme.description || `Key aesthetic direction in your portfolio`,
      signatureDetails: theme.signatureDetails || [],
      topDescriptors: theme.descriptors ? (Array.isArray(theme.descriptors) ? theme.descriptors : []) : []
    }));

    // Generate style labels from aesthetic themes
    const styleTags = Array.isArray(profile.style_tags) 
      ? profile.style_tags 
      : parseJSON(profile.style_tags) || [];
    
    const styleLabels = styleTags.slice(0, 10).map(tag => ({
      name: tag,
      score: 1,
      count: 1
    }));

    logger.info('Podna: Style profile fetched successfully', { 
      userId, 
      profileId: profile.id,
      imageCount: portfolioImages.length,
      clustersCount: clusters.length,
      styleLabelsCount: styleLabels.length
    });

    res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          portfolioId: profile.portfolio_id,
          styleLabels: styleLabels,
          clusters: clusters,
          summaryText: profile.summary_text,
          totalImages: profile.total_images,
          distributions: {
            garments: parseJSON(profile.garment_distribution),
            colors: parseJSON(profile.color_distribution),
            fabrics: parseJSON(profile.fabric_distribution),
            silhouettes: parseJSON(profile.silhouette_distribution)
          },
          styleTags: styleTags,
          aestheticThemes: aestheticThemesArray,
          constructionPatterns: parseJSON(profile.construction_patterns),
          signaturePieces: parseJSON(profile.signature_pieces),
          updatedAt: profile.updated_at,
          portfolioImages
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
    SELECT 
      id, 
      filename, 
      url_original,
      url_preview,
      r2_key,
      width, 
      height, 
      created_at as uploaded_at
    FROM portfolio_images
    WHERE portfolio_id = $1
    ORDER BY created_at DESC
  `;
  const imagesResult = await db.query(imagesQuery, [portfolioId]);
  const images = await resolvePortfolioImageUrls(imagesResult.rows);

  res.json({
    success: true,
    data: {
      portfolioId,
      images
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
 * UPDATED: Now properly interprets natural language prompts using promptEnhancementService
 */
router.post('/generate', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    prompt, // User's natural language prompt
    mode = 'exploratory',
    constraints = {},
    provider = 'imagen-4-ultra',
    upscale = false,
    interpret = true, // Interpret natural language prompt
    interpretOptions = {} // Additional interpretation options
  } = req.body;

  logger.info('Podna: Generating image', { userId, mode, provider, hasUserPrompt: !!prompt });

  try {
    let generationPrompt;
    let interpretation = null;
    let enhancedSuggestion = null;

    // UPDATED: If user provided a prompt, interpret it properly
    if (prompt && interpret) {
      // STEP 1: Get enhanced style profile and brand DNA
      const styleProfile = await intelligentPromptBuilder.getEnhancedStyleProfile(userId);
      const brandDNA = styleProfile ? intelligentPromptBuilder.extractBrandDNA(styleProfile) : null;

      logger.info('Interpreting user prompt with brand DNA', {
        userId,
        prompt: prompt.substring(0, 50),
        hasBrandDNA: !!brandDNA
      });

      // STEP 2: Interpret user's natural language prompt using promptEnhancementService
      // THIS IS THE KEY ADDITION!
      const promptEnhancementService = require('../../services/promptEnhancementService');

      interpretation = await promptEnhancementService.interpretUserPrompt(
        prompt,
        brandDNA,
        interpretOptions
      );

      logger.info('Prompt interpreted successfully', {
        userId,
        garmentType: interpretation.garmentType,
        specificity: interpretation.specificity,
        modifierCount: interpretation.userModifiers.length
      });

      // STEP 3: Generate enhanced prompt using IntelligentPromptBuilder with parsed attributes
      const promptResult = await intelligentPromptBuilder.generatePrompt(userId, {
        creativity: interpretation.recommendedCreativity ||
                   (mode === 'exploratory' ? 0.7 : mode === 'creative' ? 0.5 : 0.3),
        brandDNA,
        enforceBrandDNA: true,
        brandDNAStrength: interpretation.specificity === 'low' ? 0.9 :
                         interpretation.specificity === 'medium' ? 0.6 : 0.3,
        parsedUserPrompt: interpretation, // UPDATED: Pass full interpretation
        userModifiers: interpretation.userModifiers,
        respectUserIntent: interpretation.specificity === 'high' // Literal for high specificity
      });

      generationPrompt = promptResult;
      enhancedSuggestion = interpretation.enhancedSuggestion;

    } else if (prompt && !interpret) {
      // User wants to use their prompt literally (no interpretation)
      logger.info('Using literal user prompt (no interpretation)', { userId, prompt: prompt.substring(0, 50) });

      const styleProfile = await intelligentPromptBuilder.getEnhancedStyleProfile(userId);
      const brandDNA = styleProfile ? intelligentPromptBuilder.extractBrandDNA(styleProfile) : null;

      const promptResult = await intelligentPromptBuilder.generatePrompt(userId, {
        creativity: 0.1, // Very literal
        brandDNA,
        enforceBrandDNA: false,
        userModifiers: [prompt], // Use entire prompt as single modifier
        respectUserIntent: true
      });

      generationPrompt = promptResult;

    } else {
      // No user prompt - generate from Thompson sampling (existing behavior)
      logger.info('Generating without user prompt (Thompson sampling)', { userId });

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

    // STEP 4: Generate image with Image Generation Agent
    const generation = await imageGenerationAgent.generateImage(
      userId,
      generationPrompt.id || generationPrompt.prompt_id,
      { provider, upscale }
    );

    const promptText =
      generationPrompt.positive_prompt ||
      generationPrompt.text ||
      generationPrompt.prompt ||
      null;
    const promptMetadataRaw =
      (generationPrompt && typeof generationPrompt.metadata === 'object' && generationPrompt.metadata) ||
      (generationPrompt && typeof generationPrompt.json_spec === 'object' && generationPrompt.json_spec) ||
      {};

    const { metadata: normalizedPromptMetadata, tags: derivedTags } = normalizePromptMetadata(promptMetadataRaw);
    const existingTags = Array.isArray(generation.tags)
      ? generation.tags.filter((value) => typeof value === 'string' && value.trim())
      : [];

    generation.prompt_text = generation.prompt_text || promptText;
    generation.prompt_metadata = generation.prompt_metadata || promptMetadataRaw;
    generation.metadata = {
      ...(generation.metadata || {}),
      ...normalizedPromptMetadata,
    };
    if (!generation.metadata.spec) {
      generation.metadata.spec = promptMetadataRaw;
    }
    if (!generation.metadata.generatedAt && generation.created_at) {
      generation.metadata.generatedAt = generation.created_at;
    }
    generation.tags = Array.from(new Set([...existingTags, ...derivedTags]));

    // Track generation interaction for continuous learning (non-blocking)
    if (continuousLearningAgent && typeof continuousLearningAgent.trackInteraction === 'function') {
      continuousLearningAgent.trackInteraction(userId, generation.id, {
        event_type: 'image_generation',
        metadata: {
          promptId: generationPrompt.id || generationPrompt.prompt_id,
          provider,
          mode,
          hasUserPrompt: !!prompt,
          interpreted: !!interpretation
        }
      }).catch(err => {
        logger.warn('Failed to track generation interaction', { error: err.message });
      });
    }

    // STEP 5: Build enhanced response with interpretation details
    const generationImageUrl = await resolveGenerationAssetUrl({
      url: generation.url,
      urlUpscaled: generation.url_upscaled,
      r2Key: generation.r2_key,
      r2KeyUpscaled: generation.r2_key_upscaled,
      generationId: generation.id,
    });

    if (!generationImageUrl) {
      logger.warn('Podna: Unable to resolve accessible URL for generation', {
        generationId: generation.id,
      });
    }

    const response = {
      success: true,
      message: 'Image generated successfully',
      data: {
        generation: {
          id: generation.id,
          url: generationImageUrl,
          prompt: generation.prompt_text || promptText,
          promptText: generation.prompt_text || promptText,
          prompt_text: generation.prompt_text || promptText,
          promptSpec: generationPrompt.json_spec || generationPrompt.metadata,
          promptMetadata: generation.prompt_metadata || null,
          metadata: generation.metadata || generation.prompt_metadata || null,
          tags: Array.isArray(generation.tags) ? generation.tags : derivedTags,
          provider: generation.provider,
          costCents: generation.cost_cents,
          createdAt: generation.created_at
        }
      }
    };

    // UPDATED: Add interpretation details if available (for UI to show "something better")
    if (interpretation) {
      response.data.interpretation = {
        originalPrompt: interpretation.originalPrompt,
        parsedAttributes: {
          garmentType: interpretation.garmentType,
          colors: interpretation.colors,
          fabrics: interpretation.fabrics,
          styleAdjectives: interpretation.styleAdjectives,
          specificity: interpretation.specificity
        },
        enhancedSuggestion: interpretation.enhancedSuggestion,
        brandDNAApplied: !!interpretation.brandDNAAvailable,
        creativityLevel: interpretation.recommendedCreativity
      };
    }

    res.json(response);

  } catch (error) {
    logger.error('Podna: Generation failed', { userId, error: error.message, stack: error.stack });

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
    const userId = req.user?.id;

    if (!userId) {
      logger.warn('Podna: Missing user ID on generate-with-dna request');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const {
      prompt,
      enforceBrandDNA = true,
      brandDNAStrength = 0.8,
      creativity = 0.3,
      count = 4,
      options = {},
      interpretPrompt: interpretPromptInput = true,
      provider = 'imagen-4-ultra',
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    const promptText = prompt.trim();
    const interpretPrompt = interpretPromptInput !== false;
    const shouldEnforceBrandDNA = interpretPrompt && enforceBrandDNA;
    const generationOptions = {
      ...options,
      provider: options?.provider || provider,
    };
    generationOptions.provider = imageGenerationAgent.normalizeProvider(generationOptions.provider);

    let brandDNA = null;
    let enforceBrandDNAEffective = shouldEnforceBrandDNA;
    if (shouldEnforceBrandDNA) {
      const styleProfile = await intelligentPromptBuilder.getEnhancedStyleProfile(userId);

      if (!styleProfile) {
        // Do not hard fail — proceed without Brand DNA
        logger.warn('Podna: No style profile found; proceeding without Brand DNA', { userId });
        enforceBrandDNAEffective = false;
      } else {
        brandDNA = intelligentPromptBuilder.extractBrandDNA(styleProfile);
      }
    }

    logger.info('Podna: Preparing generation prompt', {
      userId,
      prompt: promptText.substring(0, 50),
      interpretPrompt,
      enforceBrandDNA: enforceBrandDNAEffective,
      hasBrandDNA: !!brandDNA,
      brandConfidence: brandDNA?.overallConfidence
    });

    const buildPromptArtifact = (rawPromptResult) => {
      if (!rawPromptResult) return null;

      const metadataCandidate =
        (rawPromptResult && typeof rawPromptResult.metadata === 'object' && rawPromptResult.metadata) ||
        null;
      const specCandidate =
        (rawPromptResult && typeof rawPromptResult.json_spec === 'object' && rawPromptResult.json_spec) ||
        null;
      const metadataRaw = specCandidate || metadataCandidate || {};

      const { metadata: normalizedMetadata, tags: derivedTags } =
        normalizePromptMetadata(metadataRaw);

      const positivePrompt =
        rawPromptResult.positive_prompt ||
        rawPromptResult.text ||
        rawPromptResult.prompt ||
        promptText;

      const negativePrompt =
        rawPromptResult.negative_prompt ||
        rawPromptResult.negativePrompt ||
        options?.negativePrompt ||
        intelligentPromptBuilder.DEFAULT_NEGATIVE_PROMPT;

      const brandConsistencyScore = (() => {
        if (rawPromptResult?.metadata && typeof rawPromptResult.metadata === 'object') {
          const score = rawPromptResult.metadata.brand_consistency_score;
          return typeof score === 'number' ? score : null;
        }
        if (normalizedMetadata?.brand_consistency_score !== undefined) {
          const score = normalizedMetadata.brand_consistency_score;
          return typeof score === 'number' ? score : null;
        }
        return null;
      })();

      return {
        raw: rawPromptResult,
        promptId: rawPromptResult.prompt_id || rawPromptResult.id || null,
        positivePrompt,
        negativePrompt,
        metadataRaw,
        normalizedMetadata,
        derivedTags,
        brandConsistencyScore,
        brandDNAApplied: enforceBrandDNAEffective,
      };
    };

    const promptArtifacts = [];

    if (!interpretPrompt) {
      const literalMetadata = {
        source: 'user_literal',
        enforceBrandDNA: false,
        creativity,
        brand_consistency_score: null,
      };
      const negativePrompt =
        options?.negativePrompt || intelligentPromptBuilder.DEFAULT_NEGATIVE_PROMPT;

      const literalRecord = await intelligentPromptBuilder.savePrompt(userId, {
        positive_prompt: promptText,
        negative_prompt: negativePrompt,
        metadata: literalMetadata,
        creativity,
      });

      const literalResult = {
        positive_prompt: promptText,
        negative_prompt: negativePrompt,
        metadata: literalMetadata,
        prompt_id: literalRecord.id,
      };

      for (let i = 0; i < count; i++) {
        const artifact = buildPromptArtifact(literalResult);
        if (artifact) {
          promptArtifacts.push(artifact);
        }
      }
    } else {
      const baseBuilderOptions = {
        ...options,
        creativity,
        brandDNA,
        enforceBrandDNA: enforceBrandDNAEffective,
        brandDNAStrength,
        userPrompt: promptText,
      };

      for (let i = 0; i < count; i++) {
        try {
          const promptVariant = await intelligentPromptBuilder.generatePrompt(userId, {
            ...baseBuilderOptions,
            useCache: false, // ensure variations
            variationSeed: Date.now() + i,
            generationIndex: i,
          });

          const artifact = buildPromptArtifact(promptVariant);
          if (artifact) {
            promptArtifacts.push(artifact);
          }
        } catch (promptError) {
          logger.error('Prompt generation failed for batch item', {
            userId,
            index: i,
            error: promptError.message,
          });
        }
      }
    }

    if (promptArtifacts.length === 0) {
      throw new Error('Failed to prepare prompts for generation');
    }

    // Generate images
    const generationResults = [];

    for (let i = 0; i < promptArtifacts.length; i++) {
      const artifact = promptArtifacts[i];

      if (!artifact?.promptId) {
        logger.warn('Skipping generation due to missing prompt ID', {
          userId,
          index: i,
        });
        continue;
      }

      try {
        const generation = await imageGenerationAgent.generateImage(
          userId,
          artifact.promptId,
          generationOptions
        );

        const existingTags = Array.isArray(generation.tags)
          ? generation.tags.filter((value) => typeof value === 'string' && value.trim())
          : [];

        generation.prompt_text = generation.prompt_text || artifact.positivePrompt;
        generation.prompt_metadata = generation.prompt_metadata || artifact.metadataRaw;

        const mergedMetadata = { ...(generation.metadata || {}) };
        const normalizedMetadata = artifact.normalizedMetadata || {};

        Object.entries(normalizedMetadata).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          if (mergedMetadata[key] === undefined || mergedMetadata[key] === null) {
            mergedMetadata[key] = value;
          }
        });

        if (!mergedMetadata.spec) {
          mergedMetadata.spec = artifact.metadataRaw;
        }

        if (
          normalizedMetadata.promptGroup &&
          !mergedMetadata.promptGroup
        ) {
          mergedMetadata.promptGroup = normalizedMetadata.promptGroup;
        }

        if (!mergedMetadata.generatedAt && generation.created_at) {
          mergedMetadata.generatedAt = generation.created_at;
        }

        generation.metadata = mergedMetadata;

        const combinedTags = new Set([
          ...existingTags,
          ...(Array.isArray(artifact.derivedTags) ? artifact.derivedTags : []),
        ]);
        generation.tags = Array.from(combinedTags);

        if (
          generation.brand_consistency_score === undefined ||
          generation.brand_consistency_score === null
        ) {
          generation.brand_consistency_score = artifact.brandConsistencyScore;
        }
        generation.brand_dna_applied = enforceBrandDNAEffective;

        generationResults.push({ generation, artifact });
      } catch (genError) {
        logger.error('Individual generation failed', {
          userId,
          index: i,
          error: genError.message
        });
      }
    }

    if (generationResults.length === 0) {
      throw new Error('All generations failed');
    }

    const brandConsistencySum = generationResults.reduce(
      (sum, item) => sum + (item.generation.brand_consistency_score || 0.5),
      0
    );

    res.json({
      success: true,
      data: {
        generations: await Promise.all(
          generationResults.map(async ({ generation: g, artifact }) => {
            const promptTextValue = g.prompt_text || artifact.positivePrompt || promptText;

            let effectiveUrl = await resolveGenerationAssetUrl({
              url: g.url,
              cdnUrl: g.cdn_url,
              urlUpscaled: g.url_upscaled,
              r2Key: g.r2_key,
              r2KeyUpscaled: g.r2_key_upscaled,
              generationId: g.id,
            });

            if (!effectiveUrl) {
              try {
                const assetResult = await db.query(
                  `
                  SELECT cdn_url, r2_key
                  FROM generation_assets
                  WHERE generation_id = $1::text
                  ORDER BY created_at DESC
                  LIMIT 1
                  `,
                  [g.id]
                );

                const asset = assetResult.rows[0];
                if (asset) {
                  effectiveUrl = await resolveGenerationAssetUrl({
                    assetUrl: asset.cdn_url,
                    assetR2Key: asset.r2_key,
                    generationId: g.id,
                  });
                }
              } catch (assetError) {
                logger.warn('Failed to resolve generation asset URL', {
                  generationId: g.id,
                  error: assetError.message
                });
              }
            }

            if (!effectiveUrl) {
              logger.warn('Generation missing URL after asset lookup', {
                generationId: g.id,
                hasR2Key: !!g.r2_key
              });
            }

            const baseMetadata = (g.metadata && typeof g.metadata === 'object')
              ? g.metadata
              : (g.prompt_metadata && typeof g.prompt_metadata === 'object')
                ? g.prompt_metadata
                : null;
            const responseMetadata = baseMetadata ? { ...baseMetadata } : {};
            if (!responseMetadata.generationMethod) {
              responseMetadata.generationMethod = 'generate_endpoint';
            }

            return {
              id: g.id,
              url: effectiveUrl,
              createdAt: g.created_at,
              prompt: promptTextValue,
              promptText: promptTextValue,
              prompt_text: promptTextValue,
              metadata: responseMetadata,
              promptMetadata: g.prompt_metadata || null,
              tags: Array.isArray(g.tags) ? g.tags : artifact.derivedTags,
              provider: g.provider,
              costCents: g.cost_cents ?? null,
              brandConsistencyScore: g.brand_consistency_score,
              brandDNAApplied: g.brand_dna_applied
            };
          })
        ),
        prompt: promptArtifacts[0]?.raw || null,
        prompts: promptArtifacts.map((artifact) => ({
          promptId: artifact.promptId,
          prompt: artifact.positivePrompt,
          negativePrompt: artifact.negativePrompt,
          metadata: artifact.metadataRaw,
          derivedTags: artifact.derivedTags,
          brandConsistencyScore: artifact.brandConsistencyScore,
        })),
        brandDNA: brandDNA ? {
          primaryAesthetic: brandDNA.primaryAesthetic,
          signatureElements: {
            colors: (brandDNA.signatureColors || []).slice(0, 3).map((c) => c.name),
            fabrics: (brandDNA.signatureFabrics || []).slice(0, 3).map((f) => f.name),
            construction: (brandDNA.signatureConstruction || []).slice(0, 3).map((c) => c.detail)
          },
          confidence: brandDNA.overallConfidence
        } : null,
        avgBrandConsistency: brandConsistencySum / generationResults.length,
        settings: {
          interpretPrompt,
          enforceBrandDNA: shouldEnforceBrandDNA,
          creativity,
          brandDNAStrength: shouldEnforceBrandDNA ? brandDNAStrength : 0,
          provider: generationOptions.provider,
        }
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
  const { count = 5, mode = 'exploratory', provider = 'imagen-4-ultra' } = req.body;

  logger.info('Podna: Generating batch', { userId, count, mode });

  try {
    // Update image generation agent to use A/B testing router
    const generations = await imageGenerationAgent.generateBatch(userId, count, { 
      mode, 
      provider,
      promptBuilder: promptRouter
    });

    if (generations.length === 0) {
      logger.error('Podna: Batch generation returned no images', { userId, count, mode, provider });
      return res.status(500).json({
        success: false,
        message: 'Failed to generate images',
        code: 'NO_GENERATIONS'
      });
    }

    const totalCost = generations.reduce((sum, g) => sum + (g.cost_cents || 0), 0);

    // Track batch generation interaction for continuous learning (non-blocking)
    if (continuousLearningAgent && typeof continuousLearningAgent.trackInteraction === 'function') {
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
    }

    res.json({
      success: true,
      message: `Generated ${generations.length} images successfully`,
      data: {
        count: generations.length,
        totalCostCents: totalCost,
        generations: await Promise.all(generations.map(async (g) => {
          const promptText = g.prompt_text || g.promptText || g.prompt || null;
          const promptMetadata = g.prompt_metadata || g.promptMetadata || null;
          const normalizedMetadata = (g.metadata && typeof g.metadata === 'object')
            ? g.metadata
            : (promptMetadata && typeof promptMetadata === 'object')
              ? promptMetadata
              : {};
          const tags = Array.isArray(g.tags)
            ? g.tags.filter(tag => typeof tag === 'string' && tag.trim())
            : [];

          let effectiveUrl = await resolveGenerationAssetUrl({
            url: g.url,
            cdnUrl: g.cdn_url,
            urlUpscaled: g.url_upscaled,
            r2Key: g.r2_key,
            r2KeyUpscaled: g.r2_key_upscaled,
            generationId: g.id,
          });

          if (!effectiveUrl) {
            try {
              const assetResult = await db.query(
                `
                  SELECT cdn_url, r2_key
                  FROM generation_assets
                  WHERE generation_id = $1::text
                  ORDER BY created_at DESC
                  LIMIT 1
                `,
                [g.id]
                );

              const asset = assetResult.rows[0];
              if (asset) {
                effectiveUrl = await resolveGenerationAssetUrl({
                  assetUrl: asset.cdn_url,
                  assetR2Key: asset.r2_key,
                  generationId: g.id,
                });
              }
            } catch (assetError) {
              logger.warn('Failed to resolve batch generation asset URL', {
                generationId: g.id,
                error: assetError.message
              });
            }
          }

          if (!effectiveUrl) {
            logger.warn('Batch generation missing URL after asset lookup', {
              generationId: g.id,
              hasR2Key: !!g.r2_key
            });
          }

          const responseMetadata = { ...normalizedMetadata };
          if (!responseMetadata.generationMethod) {
            responseMetadata.generationMethod = 'batch_generation';
          }

          return {
            id: g.id,
            url: effectiveUrl,
            createdAt: g.created_at || g.createdAt || new Date().toISOString(),
            promptId: g.prompt_id,
            prompt: promptText,
            promptText,
            prompt_text: promptText,
            metadata: responseMetadata,
            promptMetadata,
            tags,
            provider: g.provider,
            costCents: g.cost_cents ?? null
          };
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
 * Query params:
 *   - limit: number of images to return (default 50)
 *   - archived: true to show archived images only, false to exclude archived (default false)
 */
router.get('/gallery', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 50;
  const archived = req.query.archived === 'true';

  // Modified to return all generated images, excluding archived by default
  // Add archived filter based on query parameter
  // Also join a representative asset so we always have a URL even when g.url is null
  const query = `
    SELECT 
      g.*, 
      p.text AS prompt_text, 
      p.json_spec,
      ga.cdn_url    AS asset_cdn_url,
      ga.r2_key     AS asset_r2_key
    FROM generations g
    JOIN prompts p ON g.prompt_id = p.id
    LEFT JOIN LATERAL (
      SELECT cdn_url, r2_key
      FROM generation_assets
      WHERE generation_id = g.id::text
      ORDER BY id ASC
      LIMIT 1
    ) ga ON TRUE
    WHERE g.user_id = $1::uuid AND g.archived = $3::boolean
    ORDER BY g.created_at DESC
    LIMIT $2
  `;

  const result = await db.query(query, [userId, limit, archived]);
  const generations = result.rows;

  const generationsWithMetadata = await Promise.all(
    generations.map(async (g) => {
      const promptMetadataRaw = g.json_spec || g.prompt_metadata || {};
      const { metadata: normalizedMetadata, tags: derivedTags } = normalizePromptMetadata(promptMetadataRaw);
      const promptText = g.prompt_text || g.prompt || null;

      const effectiveUrl = await resolveGenerationAssetUrl({
        url: g.url,
        urlUpscaled: g.url_upscaled,
        assetUrl: g.asset_cdn_url,
        r2Key: g.r2_key,
        r2KeyUpscaled: g.r2_key_upscaled,
        assetR2Key: g.asset_r2_key,
        generationId: g.id,
      });

      let generationMethod = normalizedMetadata?.generationMethod;
      if (!generationMethod) {
        const settingsRaw = g.settings;
        let settingsObj = null;
        if (settingsRaw && typeof settingsRaw === 'string') {
          try {
            settingsObj = JSON.parse(settingsRaw);
          } catch (err) {
            logger.warn('Failed to parse generation settings JSON', {
              generationId: g.id,
              error: err.message
            });
          }
        } else if (settingsRaw && typeof settingsRaw === 'object') {
          settingsObj = settingsRaw;
        }

        if (settingsObj && typeof settingsObj === 'object') {
          const candidate = settingsObj.generationMethod;
          if (typeof candidate === 'string' && candidate.trim()) {
            generationMethod = candidate;
          } else if (settingsObj.batchCount || settingsObj.mode === 'exploratory') {
            generationMethod = 'batch_generation';
          }
        }
      }

      if (!generationMethod) {
        generationMethod = 'generate_endpoint';
      }

      const responseMetadata = {
        ...(normalizedMetadata || {}),
        generationMethod,
      };

      return {
        id: g.id,
        url: effectiveUrl,
        createdAt: g.created_at,
        prompt: promptText,
        promptText,
        prompt_text: promptText,
        metadata: responseMetadata,
        promptMetadata: promptMetadataRaw,
        tags: derivedTags,
        provider: g.provider,
        costCents: g.cost_cents ?? null,
      };
    })
  );

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
    if (continuousLearningAgent && typeof continuousLearningAgent.trackInteraction === 'function') {
      try {
        await continuousLearningAgent.trackInteraction(userId, generationId, {
          event_type: 'feedback',
          metadata: {
            feedbackType: type,
            hasNote: !!note,
            feedbackId: result.feedback.id
          }
        });
      } catch (err) {
        logger.warn('Failed to track feedback interaction', { error: err.message });
      }
    }

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
 * POST /api/podna/archive/:generationId
 * Archive an image (mark as discarded)
 */
router.post('/archive/:generationId', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { generationId } = req.params;

  logger.info('Archiving generation', { userId, generationId });

  // Update the generation to mark as archived
  const archiveQuery = `
    UPDATE generations
    SET archived = TRUE, archived_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND user_id = $2
    RETURNING id, archived, archived_at
  `;

  const result = await db.query(archiveQuery, [generationId, userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Generation not found or unauthorized'
    });
  }

  res.json({
    success: true,
    message: 'Image archived successfully',
    data: {
      generationId: result.rows[0].id,
      archived: result.rows[0].archived,
      archivedAt: result.rows[0].archived_at
    }
  });
}));

/**
 * POST /api/podna/unarchive/:generationId
 * Restore an archived image
 */
router.post('/unarchive/:generationId', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { generationId } = req.params;

  logger.info('Unarchiving generation', { userId, generationId });

  // Update the generation to mark as not archived
  const unarchiveQuery = `
    UPDATE generations
    SET archived = FALSE, archived_at = NULL
    WHERE id = $1 AND user_id = $2
    RETURNING id, archived, archived_at
  `;

  const result = await db.query(unarchiveQuery, [generationId, userId]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Generation not found or unauthorized'
    });
  }

  res.json({
    success: true,
    message: 'Image restored successfully',
    data: {
      generationId: result.rows[0].id,
      archived: result.rows[0].archived,
      archivedAt: result.rows[0].archived_at
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
    // TODO: Re-enable once continuousLearningAgent is implemented
    // continuousLearningAgent.trackInteraction(userId, null, {
    //   event_type: 'portfolio_upload',
    //   metadata: {
    //     portfolioId,
    //     imageCount: uploadResult.portfolio.imageCount,
    //     filename
    //   }
    // }).catch(err => {
    //   logger.warn('Failed to track upload interaction', { error: err.message });
    // });

    // Step 2: Analyze images
    logger.info('Podna Onboarding: Step 2/4 - Analyzing images');
    const analysisResult = await styleDescriptorAgent.analyzePortfolio(portfolioId);

    // Track analysis interaction (non-blocking)
    // TODO: Re-enable once continuousLearningAgent is implemented
    // continuousLearningAgent.trackInteraction(userId, null, {
    //   event_type: 'portfolio_analysis',
    //   metadata: {
    //     portfolioId,
    //     analyzed: analysisResult.analyzed,
    //     failed: analysisResult.failed,
    //     avgConfidence: analysisResult.avgConfidence,
    //     avgCompleteness: analysisResult.avgCompleteness
    //   }
    // }).catch(err => {
    //   logger.warn('Failed to track analysis interaction', { error: err.message });
    // });

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
    // TODO: Re-enable once continuousLearningAgent is implemented
    // continuousLearningAgent.trackInteraction(userId, null, {
    //   event_type: 'profile_generation',
    //   metadata: {
    //     portfolioId,
    //     profileId: profile.id
    //   }
    // }).catch(err => {
    //   logger.warn('Failed to track profile generation interaction', { error: err.message });
    // });

    // Analyze model gender from portfolio (non-blocking)
    try {
      logger.info('Podna Onboarding: Analyzing model gender distribution');
      const genderAnalysis = await modelGenderService.analyzePortfolioForModelGender(userId, portfolioId);
      logger.info('Podna Onboarding: Model gender analysis complete', {
        detectedGender: genderAnalysis.detected_gender,
        confidence: genderAnalysis.confidence,
        percentages: genderAnalysis.percentages
      });
    } catch (error) {
      logger.warn('Podna Onboarding: Failed to analyze model gender (non-blocking)', {
        error: error.message
      });
      // Don't fail the onboarding if gender analysis fails
    }

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
      // TODO: Re-enable once continuousLearningAgent is implemented
      // continuousLearningAgent.trackInteraction(userId, null, {
      //   event_type: 'initial_generation',
      //   metadata: {
      //     count: initialCount,
      //     actualCount: generations.length,
      //     provider: 'imagen-4-ultra'
      //   }
      // }).catch(err => {
      //   logger.warn('Failed to track initial generation interaction', { error: err.message });
      // });
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
