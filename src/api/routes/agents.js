/**
 * AI Agents Routes - Integration with Python microservice
 * These routes provide enhanced AI capabilities through the 5-agent system
 */

const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const { authMiddleware } = require('../../middleware/auth');
const agentService = require('../../services/agentService');
const logger = require('../../utils/logger');

const router = express.Router();

// ============= PORTFOLIO ANALYSIS & STYLE PROFILES =============

/**
 * POST /api/agents/portfolio/upload
 * Upload ZIP portfolio, extract images, and analyze with Visual Analyst
 */
router.post('/portfolio/upload', authMiddleware, asyncHandler(async (req, res) => {
  const multer = require('multer');
  const AdmZip = require('adm-zip');
  const r2Storage = require('../../services/r2Storage');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');
  const agentService = require('../../services/agentService');
  
  // Configure multer for ZIP upload with increased timeout
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { 
      fileSize: 500 * 1024 * 1024, // 500MB
      fieldSize: 500 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
      const isZip = file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip');
      if (isZip) {
        cb(null, true);
      } else {
        cb(new Error('Only ZIP files are allowed'));
      }
    }
  }).any(); // accept any field name (e.g., 'file' or 'portfolio')
  
  // Set timeout to 10 minutes for large uploads
  req.setTimeout(600000);
  res.setTimeout(600000);
  
  // Handle file upload
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Support both 'file' and 'portfolio' field names
    let uploadedFile = req.file;
    if (!uploadedFile && Array.isArray(req.files)) {
      uploadedFile = req.files.find(f => (f.mimetype === 'application/zip') || f.originalname.toLowerCase().endsWith('.zip')) || null;
    }
    
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'No ZIP file uploaded (expected form field name "file" or "portfolio")'
      });
    }
    
    try {
      logger.info(`Processing portfolio ZIP for user ${req.user.id}`, {
        filename: uploadedFile.originalname,
        size: uploadedFile.size
      });
      
      // Extract ZIP
      const zip = new AdmZip(uploadedFile.buffer);
      const zipEntries = zip.getEntries();
      
      // Filter for image files
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const imageEntries = zipEntries.filter(entry => {
        const ext = path.extname(entry.entryName).toLowerCase();
        return !entry.isDirectory && imageExtensions.includes(ext);
      });
      
      if (imageEntries.length < 5) {
        return res.status(400).json({
          success: false,
          message: `Minimum 5 images required. Found ${imageEntries.length} images in ZIP.`
        });
      }
      
      if (imageEntries.length > 500) {
        return res.status(400).json({
          success: false,
          message: `Maximum 500 images allowed. Found ${imageEntries.length} images in ZIP.`
        });
      }
      
      logger.info(`Found ${imageEntries.length} images in ZIP`);
      
      // Upload images to R2 and collect URLs
      logger.info(`Uploading ${imageEntries.length} images to R2...`);
      const uploadPromises = imageEntries.slice(0, 100).map(async (entry, index) => { // Limit to 100 for analysis
        try {
          const imageBuffer = entry.getData();
          const ext = path.extname(entry.entryName).toLowerCase();
          
          // uploadImage expects buffer and metadata object
          const uploadResult = await r2Storage.uploadImage(imageBuffer, {
            userId: req.user.id,
            imageType: 'portfolio',
            format: ext.slice(1), // Remove the dot
            originalFilename: path.basename(entry.entryName)
          });
          
          if (uploadResult.success && uploadResult.cdnUrl) {
            logger.debug(`Uploaded image ${index + 1}/${imageEntries.length}: ${uploadResult.cdnUrl}`);
            return uploadResult.cdnUrl;
          }
          logger.warn(`Upload failed for image ${index + 1}: No URL returned`);
          return null;
        } catch (error) {
          logger.error('Failed to upload image from ZIP', { 
            error: error.message,
            index: index + 1,
            filename: entry.entryName
          });
          return null;
        }
      });
      
      const urls = await Promise.all(uploadPromises);
      const validUrls = urls.filter(url => url !== null);
      
      if (validUrls.length < 5) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload sufficient images to storage'
        });
      }
      
      logger.info(`Uploaded ${validUrls.length} images to R2 storage`);
      
      // Ensure agents service is available
      const health = await agentService.healthCheck();
      if (health.status !== 'healthy') {
        return res.status(503).json({
          success: false,
          message: 'Agents service unavailable. Please start the agents-service (FastAPI) and retry.',
          error: health.error || 'Service unhealthy'
        });
      }

      // Analyze portfolio with AI agents (Visual Analyst)
      const analysisResult = await agentService.completeOnboarding(req.user.id, validUrls);
      
      if (!analysisResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Portfolio analysis failed',
          error: analysisResult.error
        });
      }
      
      logger.info(`Portfolio analysis complete for user ${req.user.id}`);
      
      // Get the style profile that was just created
      let styleProfile = analysisResult.data.profile?.profile_data || {};
      
      // Enrich profile using Style Tagger Agent (generates tags, extracts garments, creates description)
      const styleTaggerAgent = require('../../services/styleTaggerAgent');
      
      logger.info('Enriching style profile with Style Tagger Agent...');
      const enrichment = styleTaggerAgent.analyzeAndEnrich(styleProfile);
      
      // Merge enrichment into profile
      styleProfile.style_tags = enrichment.style_tags;
      styleProfile.garment_types = enrichment.garment_types;
      styleProfile.style_description = enrichment.style_description;
      
      logger.info('Style profile enriched:', {
        tags: enrichment.style_tags,
        garmentTypes: enrichment.garment_types,
        description: enrichment.style_description
      });
      
      // Update the agents service with enriched profile
      try {
        await agentService.client.patch(`/portfolio/profile/${req.user.id}`, {
          style_tags: enrichment.style_tags,
          garment_types: enrichment.garment_types,
          style_description: enrichment.style_description
        });
        logger.info('Enriched style profile saved to agents service');
      } catch (error) {
        logger.warn('Failed to save enriched profile to agents service:', error.message);
        // Continue anyway - we have the enriched profile locally
      }
      
      // Generate 10 varied prompts using Prompt Generator Agent
      logger.info('Using Prompt Generator Agent to create varied prompts...');
      const promptGeneratorAgent = require('../../services/promptGeneratorAgent');
      const imagenAdapter = require('../../adapters/imagenAdapter');
      const axios = require('axios');
      
      logger.info('Generating 10 images from style profile', {
        userId: req.user.id,
        portfolioImages: validUrls.length,
        styleTags: styleProfile.style_tags,
        colors: styleProfile.color_palette,
        silhouettes: styleProfile.silhouettes,
        materials: styleProfile.materials
      });
      
      const generationResults = [];
      
      // Generate 10 unique prompts using the dedicated agent
      const prompts = promptGeneratorAgent.generateBatch(styleProfile, 10);
      
      logger.info(`Generated ${prompts.length} unique prompts:`, {
        prompts: prompts.map((p, i) => ({
          index: i + 1,
          garment: p.metadata.garment,
          mood: p.metadata.mood,
          preview: p.mainPrompt.substring(0, 80) + '...'
        }))
      });
      
      for (let i = 0; i < prompts.length; i++) {
        try {
          const fashionPrompt = prompts[i];
          const promptText = fashionPrompt.mainPrompt;
          const negativePrompt = fashionPrompt.negativePrompt;
          const promptMetadata = fashionPrompt.metadata;
          
          logger.info(`Generating image ${i + 1}/10 with prompt:`, { 
            garment: promptMetadata.garment,
            mood: promptMetadata.mood,
            color: promptMetadata.color,
            preview: promptText.substring(0, 120) + '...'
          });
          
          // Generate image using Imagen directly with the prompt
          const imageResult = await imagenAdapter.generate({
            prompt: promptText,
            negativePrompt: negativePrompt,
            settings: {
              count: 1,
              quality: 'standard',
              size: 'square'
            }
          });
          
          if (imageResult.success && imageResult.images && imageResult.images.length > 0) {
            // Upload to R2 and store
            const r2Storage = require('../../services/r2Storage');
            const image = imageResult.images[0];
            
            // Download from Imagen
            const axios = require('axios');
            const imgResponse = await axios.get(image.url, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imgResponse.data);
            
            // Upload to R2
            const uploadResult = await r2Storage.uploadImage(imageBuffer, {
              userId: req.user.id,
              imageType: 'generated',
              format: 'png'
            });
            
            if (uploadResult.success) {
              // Save to database for gallery display
              const db = require('../../services/database');
              const dbClient = await db.getClient();
              
              try {
                await dbClient.query(`
                  INSERT INTO images (
                    user_id, r2_key, r2_bucket, cdn_url,
                    original_size, format, vlt_analysis, generation_cost
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                  req.user.id,
                  uploadResult.key,
                  process.env.R2_BUCKET_NAME || 'anatomie-lab',
                  uploadResult.cdnUrl,
                  imageBuffer.length,
                  'png',
                  JSON.stringify({
                    promptText: promptText,
                    mainPrompt: promptText,
                    negativePrompt: negativePrompt,
                    promptMetadata: promptMetadata,
                    garment: promptMetadata.garment,
                    mood: promptMetadata.mood,
                    setting: promptMetadata.setting,
                    styleProfile: styleProfile.style_tags,
                    variationIndex: i,
                    generatedAt: new Date().toISOString(),
                    model: 'google-imagen',
                    category: 'onboarding_generated'
                  }),
                  0.030
                ]);
              } finally {
                dbClient.release();
              }
              
              generationResults.push({
                id: `onboard-${req.user.id}-${i}`,
                url: uploadResult.cdnUrl,
                cdnUrl: uploadResult.cdnUrl,
                actualPrompt: promptText,
                metadata: {
                  promptText: promptText,
                  mainPrompt: promptText,
                  negativePrompt: negativePrompt,
                  promptMetadata: promptMetadata,
                  garment: promptMetadata.garment,
                  mood: promptMetadata.mood,
                  setting: promptMetadata.setting,
                  color: promptMetadata.color,
                  silhouette: promptMetadata.silhouette,
                  styleProfile: styleProfile.style_tags,
                  variationIndex: i
                }
              });
            }
          }
        } catch (error) {
          logger.error('Generation failed for prompt', { index: i, error: error.message });
        }
      }
      
      logger.info(`Generated ${generationResults.length} AI images`);
      
      const generationResult = {
        success: true,
        mode: 'ai-generated',
        results: {
          successful: generationResults.length,
          failed: 10 - generationResults.length,
          total_cost: 0,
          results: generationResults.map(asset => ({
            image_id: asset.id,
            image_url: asset.url || asset.cdnUrl,
            url: asset.url || asset.cdnUrl,
            prompt: asset.actualPrompt || 'AI-generated fashion design',
            category: 'onboarding_generated',
            metadata: asset.metadata
          }))
        },
        message: 'AI images generated from your style profile'
      };
      
      res.json({
        success: true,
        message: 'Portfolio uploaded, analyzed, and initial images generated',
        data: {
          imagesUploaded: validUrls.length,
          profile: {
            ...analysisResult.data.profile,
            profile_data: styleProfile  // Include enriched profile with tags
          },
          initialGeneration: generationResult,
          imageUrls: validUrls
        }
      });
      
    } catch (error) {
      logger.error('Portfolio upload processing failed', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to process portfolio',
        error: error.message
      });
    }
  });
}));

/**
 * POST /api/agents/portfolio/analyze
 * Analyze portfolio images using Visual Analyst agent (direct URL input)
 */
router.post('/portfolio/analyze', authMiddleware, asyncHandler(async (req, res) => {
  const { imageUrls } = req.body;
  
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'imageUrls array is required (minimum 1 image)'
    });
  }
  
  if (imageUrls.length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Minimum 5 images required for style analysis'
    });
  }
  
  if (imageUrls.length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 20 images allowed per analysis'
    });
  }

  logger.info(`Portfolio analysis requested by user ${req.user.id} with ${imageUrls.length} images`);

  // Use the complete onboarding workflow
  const result = await agentService.completeOnboarding(req.user.id, imageUrls);

  if (result.success) {
    res.json({
      success: true,
      message: 'Portfolio analyzed successfully and style profile created',
      data: {
        designerId: req.user.id,
        imagesAnalyzed: imageUrls.length,
        profile: result.data.profile.profile_data,
        confidence: result.data.profile.profile_data.confidence_score,
        version: result.data.profile.profile_data.version
      }
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Portfolio analysis failed',
      error: result.error
    });
  }
}));

/**
 * GET /api/agents/profile/:userId
 * Get user's style profile with all attributes
 */
router.get('/profile/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Only allow users to fetch their own profile
  if (req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  try {
    const result = await agentService.getStyleProfile(userId);
    
    if (result.success) {
      // Extract profile data - agents service returns nested structure
      const profileData = result.data.profile_data || result.data.profile || result.data;
      
      logger.info('Style profile retrieved', {
        userId,
        hasData: !!profileData,
        styleTags: profileData?.style_tags,
        colors: profileData?.color_palette
      });
      
      res.json({
        success: true,
        data: {
          designerId: userId,
          profile: profileData,
          hasProfile: true
        }
      });
    } else if (result.code === 'PROFILE_NOT_FOUND') {
      logger.warn('Style profile not found', { userId });
      res.json({
        success: true,
        data: {
          designerId: userId,
          profile: null,
          hasProfile: false,
          message: 'No style profile found. Please complete onboarding first.'
        }
      });
    } else {
      logger.error('Failed to retrieve style profile', { userId, error: result.error });
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve style profile',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error fetching style profile:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve style profile',
      error: error.message
    });
  }
}));

/**
 * GET /api/agents/portfolio/:userId
 * Get user's portfolio images
 */
router.get('/portfolio/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Only allow users to fetch their own portfolio
  if (req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  try {
    // Get portfolio images from agents service
    const response = await agentService.client.get(`/portfolio/${userId}`);
    
    res.json({
      success: true,
      data: {
        designerId: userId,
        images: response.data.images || []
      }
    });
  } catch (error) {
    if (error.response?.status === 404) {
      res.json({
        success: true,
        data: {
          designerId: userId,
          images: []
        }
      });
    } else {
      logger.error('Error fetching portfolio:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve portfolio',
        error: error.message
      });
    }
  }
}));

/**
 * PATCH /api/agents/profile/:userId
 * Update user's style profile (e.g., edit tags)
 */
router.patch('/profile/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { style_tags } = req.body;
  
  // Only allow users to update their own profile
  if (req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  if (!style_tags || !Array.isArray(style_tags)) {
    return res.status(400).json({
      success: false,
      message: 'style_tags array is required'
    });
  }
  
  try {
    // Update the style profile with new tags
    const response = await agentService.client.patch(`/profile/${userId}`, {
      style_tags
    });
    
    res.json({
      success: true,
      message: 'Style tags updated successfully',
      data: response.data
    });
  } catch (error) {
    logger.error('Failed to update style tags:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update style tags',
      error: error.message
    });
  }
}));

/**
 * GET /api/agents/portfolio/profile
 * Get user's style profile
 */
router.get('/portfolio/profile', authMiddleware, asyncHandler(async (req, res) => {
  const { version } = req.query;

  const result = await agentService.getStyleProfile(req.user.id, version);

  if (result.success) {
    res.json({
      success: true,
      data: {
        designerId: req.user.id,
        profile: result.data.profile_data,
        hasProfile: true
      }
    });
  } else if (result.code === 'PROFILE_NOT_FOUND') {
    res.json({
      success: true,
      data: {
        designerId: req.user.id,
        profile: null,
        hasProfile: false,
        message: 'No style profile found. Please analyze your portfolio first.'
      }
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve style profile',
      error: result.error
    });
  }
}));

// ============= AI GENERATION =============

/**
 * POST /api/agents/generate
 * Generate images using the PromptGeneratorAgent with weights and brackets
 * This ensures every image uses the agent to create dynamic prompts
 */
router.post('/generate', authMiddleware, asyncHandler(async (req, res) => {
  const { prompt, mode = 'specific', quantity = 1 } = req.body;
  
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Prompt is required and must be a non-empty string'
    });
  }

  if (mode === 'batch' && (!quantity || quantity < 5 || quantity > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Batch mode requires quantity between 5 and 100'
    });
  }

  if (mode === 'specific' && quantity > 10) {
    return res.status(400).json({
      success: false,
      message: 'Specific mode supports maximum 10 images'
    });
  }

  logger.info(`AI generation requested: ${mode} mode, ${quantity} images, user: ${req.user.id}`);

  // Get user's style profile for prompt generation
  const profileResult = await agentService.getStyleProfile(req.user.id);
  
  if (!profileResult.success) {
    return res.status(400).json({
      success: false,
      message: 'Style profile required. Please complete onboarding first.',
      code: 'PROFILE_REQUIRED'
    });
  }
  
  const styleProfile = profileResult.data.profile_data || {};
  
  // Generate prompts using PromptGeneratorAgent (with weights and brackets)
  const promptGeneratorAgent = require('../../services/promptGeneratorAgent');
  const prompts = promptGeneratorAgent.generateBatch(styleProfile, quantity, {
    userModifiers: [prompt] // Include user's text as modifier
  });
  
  logger.info(`Generated ${prompts.length} weighted prompts with agent`, {
    userId: req.user.id,
    examples: prompts.slice(0, 2).map(p => ({
      preview: p.mainPrompt.substring(0, 100) + '...',
      hasWeights: p.mainPrompt.includes(':'),
      hasBrackets: p.mainPrompt.includes('[') || p.mainPrompt.includes('(')
    }))
  });
  
  // Generate images using these weighted prompts
  const imagenAdapter = require('../../adapters/imagenAdapter');
  const r2Storage = require('../../services/r2Storage');
  const db = require('../../services/database');
  
  const generationResults = [];
  
  for (let i = 0; i < prompts.length; i++) {
    try {
      const fashionPrompt = prompts[i];
      const promptText = fashionPrompt.mainPrompt;
      const negativePrompt = fashionPrompt.negativePrompt;
      const promptMetadata = fashionPrompt.metadata;
      
      logger.info(`Generating image ${i + 1}/${quantity}`, {
        hasWeights: promptText.includes(':'),
        hasBrackets: promptText.includes('['),
        modelCharacteristics: promptMetadata.modelCharacteristics?.length || 0
      });
      
      const imageResult = await imagenAdapter.generate({
        prompt: promptText,
        negativePrompt: negativePrompt,
        settings: {
          count: 1,
          quality: 'standard',
          size: 'square'
        }
      });
      
      if (imageResult.success && imageResult.images && imageResult.images.length > 0) {
        const image = imageResult.images[0];
        const axios = require('axios');
        const imgResponse = await axios.get(image.url, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imgResponse.data);
        
        const uploadResult = await r2Storage.uploadImage(imageBuffer, {
          userId: req.user.id,
          imageType: 'generated',
          format: 'png'
        });
        
        if (uploadResult.success) {
          const dbClient = await db.getClient();
          try {
            await dbClient.query(`
              INSERT INTO images (
                user_id, r2_key, r2_bucket, cdn_url,
                original_size, format, vlt_analysis, generation_cost
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              req.user.id,
              uploadResult.key,
              process.env.R2_BUCKET_NAME || 'anatomie-lab',
              uploadResult.cdnUrl,
              imageBuffer.length,
              'png',
              JSON.stringify({
                promptText: promptText,
                mainPrompt: promptText,
                negativePrompt: negativePrompt,
                promptMetadata: promptMetadata,
                hasWeights: true,
                hasBrackets: true,
                generatedAt: new Date().toISOString(),
                model: 'google-imagen',
                mode: mode
              }),
              0.030
            ]);
          } finally {
            dbClient.release();
          }
          
          generationResults.push({
            id: `gen-${req.user.id}-${i}`,
            url: uploadResult.cdnUrl,
            prompt: promptText,
            metadata: promptMetadata
          });
        }
      }
    } catch (error) {
      logger.error(`Failed to generate image ${i + 1}:`, error.message);
    }
  }
  
  const result = {
    success: generationResults.length > 0,
    data: {
      images: generationResults,
      mode: mode,
      quantity: generationResults.length,
      status: 'completed'
    }
  };

  if (result.success) {
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${req.user.id}`).emit('generation-started', {
        mode,
        quantity,
        batchId: result.data.batch_id || null,
        status: result.data.status || 'completed'
      });
    }

    res.json({
      success: true,
      message: mode === 'batch' ? 'Batch generation started' : 'Images generated successfully',
      data: {
        mode,
        ...result.data
      }
    });
  } else if (result.code === 'PROFILE_REQUIRED') {
    res.status(400).json({
      success: false,
      message: 'Style profile required for AI generation',
      error: result.error,
      action: 'Please analyze your portfolio first at /api/agents/portfolio/analyze'
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Image generation failed',
      error: result.error
    });
  }
}));

/**
 * GET /api/agents/images/:userId
 * Get all generated images for a user
 */
router.get('/images/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Only allow users to fetch their own images
  if (req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  // Query images directly from database to get vlt_analysis with prompts
  const db = require('../../services/database');
  const client = await db.getClient();
  
  try {
    logger.info('Fetching images for user', {
      userId,
      requestingUser: req.user.id
    });
    
    const result = await client.query(`
      SELECT 
        id as image_id,
        user_id,
        cdn_url as url,
        (vlt_analysis->>'promptText') as prompt,
        (vlt_analysis->>'mainPrompt') as main_prompt,
        created_at
      FROM images
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [userId]);
    
    logger.info('Images query result', {
      userId,
      imageCount: result.rows.length,
      firstImageUserId: result.rows[0]?.user_id
    });
    
    res.json({
      success: true,
      images: result.rows.map(row => ({
        image_id: row.image_id,
        id: row.image_id,
        url: row.url,
        prompt: row.prompt || row.main_prompt || 'AI-generated design',
        created_at: row.created_at
      }))
    });
  } catch (error) {
    logger.error('Failed to fetch images:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch images',
      error: error.message
    });
  } finally {
    client.release();
  }
}));

/**
 * GET /api/agents/batch/:batchId/status
 * Get batch generation status
 */
router.get('/batch/:batchId/status', authMiddleware, asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  const result = await agentService.getBatchStatus(batchId);

  if (result.success) {
    // Emit socket event with progress update
    const io = req.app.get('io');
    if (io && result.data.progress_percentage) {
      io.to(`user-${req.user.id}`).emit('generation-progress', {
        batchId,
        progress: result.data.progress_percentage,
        status: result.data.status
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } else if (result.code === 'BATCH_NOT_FOUND') {
    res.status(404).json({
      success: false,
      message: 'Batch not found',
      error: result.error
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Failed to get batch status',
      error: result.error
    });
  }
}));

// ============= FEEDBACK & LEARNING =============

/**
 * POST /api/agents/feedback
 * Submit feedback for learning
 */
router.post('/feedback', authMiddleware, asyncHandler(async (req, res) => {
  const { feedback } = req.body;
  
  if (!feedback || !Array.isArray(feedback) || feedback.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'feedback array is required and must contain at least one entry'
    });
  }

  // Validate feedback format
  for (const fb of feedback) {
    if (!fb.image_id || typeof fb.image_id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Each feedback entry must have a valid image_id'
      });
    }
  }

  // Add designer_id to all feedback entries
  const feedbackWithDesigner = feedback.map(fb => ({
    ...fb,
    designer_id: req.user.id
  }));

  logger.info(`Feedback submission: ${feedback.length} entries from user ${req.user.id}`);

  // Use learning workflow
  const result = await agentService.learnFromFeedback(req.user.id, feedbackWithDesigner);

  if (result.success) {
    res.json({
      success: true,
      message: result.data.message,
      data: {
        feedbackCount: feedback.length,
        profileUpdated: result.data.feedback?.profile_updated || false,
        newProfileVersion: result.data.feedback?.new_version || null
      }
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Feedback processing failed',
      error: result.error
    });
  }
}));

// ============= SYSTEM INTEGRATION =============

/**
 * GET /api/agents/health
 * Check health of AI agents service
 */
router.get('/health', asyncHandler(async (req, res) => {
  const result = await agentService.healthCheck();
  
  res.status(result.status === 'healthy' ? 200 : 503).json({
    success: result.status === 'healthy',
    data: result
  });
}));

/**
 * Enhanced generation route that combines your existing system with AI agents
 * This route acts as a smart router between legacy and new generation systems
 */
router.post('/generate/hybrid', authMiddleware, asyncHandler(async (req, res) => {
  const { prompt, mode = 'specific', quantity = 1, useAgents = true } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      message: 'Prompt is required'
    });
  }

  logger.info(`Hybrid generation: useAgents=${useAgents}, mode=${mode}, user=${req.user.id}`);

  if (useAgents) {
    // Check if user has a style profile
    const profileCheck = await agentService.getStyleProfile(req.user.id);
    
    if (profileCheck.success) {
      // Use AI agents for personalized generation
      logger.info('Using AI agents for personalized generation');
      const result = await agentService.generateImages(req.user.id, prompt, mode, quantity);
      
      if (result.success) {
        return res.json({
          success: true,
          message: 'Generated with AI agents',
          data: {
            ...result.data,
            generationMethod: 'ai-agents',
            personalized: true
          }
        });
      } else {
        // Fall back to legacy system
        logger.warn('AI agents failed, falling back to legacy system');
      }
    } else {
      logger.info('No style profile found, using legacy generation');
    }
  }

  // Fall back to your existing generation system
  const jobQueue = require('../../services/jobQueue');
  
  const jobId = await jobQueue.addImageGenerationJob({
    userId: req.user.id,
    prompt: prompt,
    quantity: quantity,
    model: 'dalle',
    parsedCommand: { garmentType: 'fashion item', quantity }
  });

  res.json({
    success: true,
    message: 'Generated with legacy system',
    data: {
      jobId,
      status: 'queued',
      quantity: quantity,
      estimatedTime: '2-5 minutes',
      statusUrl: `/api/images/job/${jobId}`,
      generationMethod: 'legacy',
      personalized: false
    }
  });
}));

module.exports = router;
