const express = require('express');
const multer = require('multer');
const generationService = require('../services/generationService');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * POST /api/generate/from-image
 * Generate image from uploaded file (full pipeline)
 */
router.post('/from-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided'
      });
    }

    const { userId, settings } = req.body;
    
    const parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : settings || {};

    logger.info('Generate from image request', {
      userId,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });

    const result = await generationService.generateFromImage({
      userId: userId || null,
      imageFile: req.file.buffer,
      settings: parsedSettings
    });

    res.json({
      success: true,
      generation: result
    });

  } catch (error) {
    logger.error('Generate from image failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate/generate
 * Generate images from text description (user-friendly endpoint)
 */
router.post('/generate', async (req, res) => {
  try {
    const { userId, description, model, count, vltAttributes } = req.body;

    if (!description) {
      return res.status(400).json({
        error: 'Description is required'
      });
    }

    logger.info('Text-based generation request with agent system', {
      userId,
      descriptionLength: description.length,
      count
    });

    // Validate userId is a valid UUID or set to null
    let validUserId = null;
    if (userId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userId)) {
        validUserId = userId;
      } else {
        logger.warn('Invalid userId format, continuing without userId', { userId });
      }
    }

    // Use generateFromQuery which uses the agent system to create prompts
    const result = await generationService.generateFromQuery({
      userId: validUserId,
      query: description,
      settings: {
        count: count || 1,
        provider: model || 'google-imagen',
        quality: 'standard'
      }
    });

    // Normalize assets to always include a usable URL field
    const normalizedAssets = Array.isArray(result?.assets)
      ? result.assets.map((a) => ({
          id: a.id,
          url: a.url || a.cdnUrl || a.cdn_url,
          cdnUrl: a.cdnUrl || a.cdn_url || a.url,
          createdAt: a.createdAt || a.created_at || new Date().toISOString(),
          metadata: a.metadata || null,
          prompt: a.prompt || a.prompt_text || a.promptText,
          tags: Array.isArray(a.tags) ? a.tags : undefined,
        }))
      : [];

    res.json({
      success: true,
      assets: normalizedAssets,
      generation: result.generation || result,
      metadata: result.metadata || result.pipeline_data || null
    });

  } catch (error) {
    logger.error('Text-based generation failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate/from-prompt
 * Generate image from direct prompt (bypass VLT)
 */
router.post('/from-prompt', async (req, res) => {
  try {
    const { userId, prompt, negativePrompt, settings } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required'
      });
    }

    logger.info('Generate from prompt request', {
      userId,
      promptLength: prompt.length
    });

    const result = await generationService.generateFromPrompt({
      userId: userId || null,
      prompt,
      negativePrompt,
      settings: settings || {}
    });

    res.json({
      success: true,
      generation: result
    });

  } catch (error) {
    logger.error('Generate from prompt failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/generate/:id
 * Get generation status and details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const generation = await generationService.getGeneration(id);

    if (!generation) {
      return res.status(404).json({
        error: 'Generation not found'
      });
    }

    res.json({
      success: true,
      generation
    });

  } catch (error) {
    logger.error('Get generation failed', {
      generationId: req.params.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/generate
 * List user's generations
 */
router.get('/', async (req, res) => {
  try {
    const {
      userId,
      limit = 20,
      offset = 0,
      status
    } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required'
      });
    }

    const generations = await generationService.listGenerations(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      status
    });

    res.json({
      success: true,
      generations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: generations.length
      }
    });

  } catch (error) {
    logger.error('List generations failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate/:id/feedback
 * Submit feedback on a generation
 */
router.post('/:id/feedback', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      userId,
      feedbackType,
      rating,
      comment,
      assetId
    } = req.body;

    if (!userId || !feedbackType) {
      return res.status(400).json({
        error: 'userId and feedbackType are required'
      });
    }

    // Store feedback in database
    const db = require('../utils/db');
    const client = await db.getClient();

    try {
      const result = await client.query(`
        INSERT INTO generation_feedback (
          generation_id, asset_id, user_id,
          feedback_type, rating, comment
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [id, assetId || null, userId, feedbackType, rating || null, comment || null]);

      logger.info('Feedback submitted', {
        generationId: id,
        userId,
        feedbackType
      });

      res.json({
        success: true,
        feedback: result.rows[0]
      });
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Submit feedback failed', {
      generationId: req.params.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/generate/:id
 * Delete a generation and its assets
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required'
      });
    }

    // Verify ownership and delete
    const db = require('../utils/db');
    const client = await db.getClient();

    try {
      // Check ownership
      const ownerCheck = await client.query(`
        SELECT id FROM generations
        WHERE id = $1 AND user_id = $2
      `, [id, userId]);

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Generation not found or unauthorized'
        });
      }

      // Delete generation (cascade will handle assets and feedback)
      await client.query(`
        DELETE FROM generations
        WHERE id = $1
      `, [id]);

      logger.info('Generation deleted', {
        generationId: id,
        userId
      });

      res.json({
        success: true,
        message: 'Generation deleted'
      });
    } finally {
      client.release();
    }

  } catch (error) {
    logger.error('Delete generation failed', {
      generationId: req.params.id,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/generate/onboarding
 * Generate initial 100 images (50 prompts × 2 each) for onboarding with progress streaming
 */
router.post('/onboarding', async (req, res) => {
  const { userId, targetCount = 20, bufferPercent = 10, provider = 'google-imagen' } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      error: 'userId is required'
    });
  }
  
  // Set up Server-Sent Events for progress updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  logger.info('Starting onboarding generation', {
    userId,
    targetCount,
    provider
  });
  
  try {
    const portfolioService = require('../services/portfolioService');
    const promptTemplateService = require('../services/promptTemplateService');
    const dppSelectionService = require('../services/dppSelectionService');
    const Image = require('../models/Image');
    
    // Send initial progress
    res.write(`data: ${JSON.stringify({
      progress: 0,
      message: 'Starting image generation...'
    })}\n\n`);
    
    // Get user's portfolio and summary
    const portfolio = await portfolioService.getUserPortfolio(userId);
    const portfolioSummary = await portfolioService.getPortfolioSummary(userId);
    
    if (!portfolio || portfolio.length === 0) {
      throw new Error('No portfolio found for user. Please complete VLT analysis first.');
    }
    
    // Validate portfolio has meaningful analysis (prevent generic image generation)
    if (!portfolioSummary.garmentTypeDistribution || portfolioSummary.garmentTypeDistribution.length === 0) {
      throw new Error('Portfolio analysis is incomplete. VLT service may have failed to properly analyze your images.');
    }
    
    logger.info('Portfolio validation passed', {
      portfolioSize: portfolio.length,
      garmentTypes: portfolioSummary.garmentTypeDistribution.length,
      hasColors: !!portfolioSummary.dominantColors,
      hasSilhouettes: !!portfolioSummary.silhouettes
    });
    
    res.write(`data: ${JSON.stringify({
      progress: 5,
      message: `Found ${portfolio.length} portfolio items`
    })}\n\n`);
    
    // Fetch user's style profile from style clustering service
    let styleProfile = null;
    try {
      const styleClusteringService = require('../services/styleClusteringService');
      const rawProfile = await styleClusteringService.getStyleProfile(userId);
      
      if (rawProfile) {
        // Normalize style profile format for prompt template service
        // Database stores as 'styleClusters', but prompt template expects 'clusters'
        styleProfile = {
          ...rawProfile,
          clusters: rawProfile.styleClusters || rawProfile.clusters || [],
          updated_at: rawProfile.updated_at
        };
        
        logger.info('Style profile loaded for prompt generation', {
          userId,
          clusters: styleProfile.clusterCount,
          clusterArray: styleProfile.clusters.length,
          dominantStyle: styleProfile.insights?.dominantStyle
        });
      } else {
        logger.warn('No style profile found, will use VLT-based templates', { userId });
      }
    } catch (error) {
      logger.warn('Failed to load style profile, will use VLT-based templates', {
        userId,
        error: error.message
      });
    }
    
    // Calculate how many prompts to generate (2 images per prompt)
    // targetCount = total images desired (e.g., 20)
    // Each prompt generates 2 images, so we need targetCount/2 prompts
    const promptCount = Math.ceil((targetCount / 2) * (1 + bufferPercent / 100));
    logger.info('Calculated prompt count', { targetCount, promptCount, bufferPercent, totalImages: promptCount * 2 });
    
    // Group portfolio items by garment type for proportional selection
    const garmentGroups = {};
    portfolio.forEach(item => {
      const type = item.garment_type || 'unknown';
      if (!garmentGroups[type]) garmentGroups[type] = [];
      garmentGroups[type].push(item);
    });
    
    // Calculate proportional distribution based on original portfolio
    const garmentDistribution = portfolioSummary.garmentTypeDistribution || [];
    const totalItems = portfolioSummary.totalImages || portfolio.length;
    
    logger.info('Garment distribution from portfolio', {
      distribution: garmentDistribution,
      totalItems,
      targetPrompts: promptCount
    });
    
    // Generate prompts respecting proportions
    const prompts = [];
    let promptIndex = 0;
    
    for (const garmentInfo of garmentDistribution) {
      const { type, count } = garmentInfo;
      
      // Calculate how many prompts should be generated for this garment type
      const proportion = count / totalItems;
      const targetPromptsForType = Math.round(promptCount * proportion);
      
      const itemsOfType = garmentGroups[type] || [];
      
      logger.info(`Generating ${targetPromptsForType} prompts for ${type} (${count}/${totalItems} = ${(proportion * 100).toFixed(1)}%)`);
      
      // Generate prompts for this garment type
      for (let i = 0; i < targetPromptsForType && promptIndex < promptCount; i++) {
        const itemIndex = i % itemsOfType.length; // Cycle through items if needed
        const vltSpec = itemsOfType[itemIndex];
        
        if (!vltSpec) continue;
        
        try {
          logger.debug('Generating prompt with style profile', {
            promptIndex,
            type,
            hasStyleProfile: !!styleProfile,
            styleProfileClusters: styleProfile?.clusters?.length || 0
          });
          
          const prompt = promptTemplateService.generatePrompt(
            vltSpec,
            styleProfile, // Use actual style profile from clustering
            { userId, exploreMode: promptIndex % 5 === 0 }
          );
          
          logger.debug('Prompt generated', {
            promptIndex,
            templateUsed: prompt.metadata?.templateId,
            promptPreview: prompt.mainPrompt.substring(0, 80)
          });
          
          prompts.push({
            id: `prompt-${promptIndex + 1}`,
            vltSpec: vltSpec,
            mainPrompt: prompt.mainPrompt,
            negativePrompt: prompt.negativePrompt,
            metadata: {
              ...prompt.metadata,
              garmentType: type,
              proportionBased: true
            }
          });
          
          promptIndex++;
          
        } catch (error) {
          logger.warn('Prompt generation failed for item', { 
            index: promptIndex, 
            type, 
            error: error.message 
          });
        }
        
        const progress = 5 + Math.floor((promptIndex / promptCount) * 10);
        res.write(`data: ${JSON.stringify({
          progress,
          message: `Generated prompt ${promptIndex}/${promptCount} (${type})`
        })}\n\n`);
      }
    }
    
    // Fill any remaining prompts with random items if needed
    while (prompts.length < promptCount && portfolio.length > 0) {
      const randomItem = portfolio[Math.floor(Math.random() * portfolio.length)];
      
      try {
        const prompt = promptTemplateService.generatePrompt(
          randomItem,
          styleProfile, // Use actual style profile from clustering
          { userId, exploreMode: prompts.length % 5 === 0 }
        );
        
        prompts.push({
          id: `prompt-${prompts.length + 1}`,
          vltSpec: randomItem,
          mainPrompt: prompt.mainPrompt,
          negativePrompt: prompt.negativePrompt,
          metadata: {
            ...prompt.metadata,
            garmentType: randomItem.garment_type || 'unknown',
            proportionBased: false,
            fillIn: true
          }
        });
        
      } catch (error) {
        logger.warn('Fill-in prompt generation failed', { error: error.message });
        break;
      }
    }
    
    // Log final distribution for verification
    const finalDistribution = {};
    prompts.forEach(p => {
      const type = p.metadata?.garmentType || 'unknown';
      finalDistribution[type] = (finalDistribution[type] || 0) + 1;
    });
    
    logger.info('Prompts generated with proportional distribution', { 
      count: prompts.length,
      originalDistribution: garmentDistribution,
      promptDistribution: finalDistribution
    });
    
    // Send distribution info to frontend
    const distributionMessage = Object.entries(finalDistribution)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
    
    res.write(`data: ${JSON.stringify({
      progress: 14,
      message: `Generated ${prompts.length} prompts: ${distributionMessage}`
    })}\n\n`);
    
    const totalImagesToGenerate = prompts.length * 2;
    res.write(`data: ${JSON.stringify({
      progress: 15,
      message: `Creating ${totalImagesToGenerate} images from ${prompts.length} prompts based on your portfolio (${targetCount} target images)...`
    })}\n\n`);
    
    // Generate images using AI Agents Service
    const agentService = require('../services/agentService');
    const generatedImages = [];
    let successCount = 0;
    let failCount = 0;
    
    // Check if agents service is available
    const agentsHealth = await agentService.healthCheck();
    const useAgents = agentsHealth.status === 'healthy';
    
    if (useAgents) {
      logger.info('Using AI Agents Service for image generation');
    } else {
      logger.warn('AI Agents Service unavailable, falling back to direct generation');
    }
    
    // Process in batches of 3 prompts concurrently (6 images at a time)
    const BATCH_SIZE = 3;
    
    for (let batchStart = 0; batchStart < prompts.length; batchStart += BATCH_SIZE) {
      const batch = prompts.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (prompt) => {
        try {
          let result;
          
          if (useAgents) {
            // Use AI Agents multi-agent pipeline
            const agentResult = await agentService.generateImages(
              userId,
              prompt.mainPrompt,
              'specific',
              2 // Generate 2 images per prompt
            );
            
            if (agentResult.success && agentResult.data.images) {
              // Convert agent response to standard format
              result = {
                assets: agentResult.data.images.map((img, idx) => ({
                  id: img.image_id || `${prompt.id}-${idx}`,
                  url: img.url,
                  thumbnailUrl: img.thumbnail_url || img.url,
                  metadata: {
                    ...img.metadata,
                    prompt: prompt.mainPrompt,
                    agentGenerated: true
                  }
                }))
              };
            } else {
              throw new Error(agentResult.error || 'Agent generation failed');
            }
          } else {
            // Fallback to direct generation
            result = await generationService.generateFromImage({
              userId,
              vltSpec: prompt.vltSpec,
              settings: {
                count: 2, // Generate 2 images per prompt
                provider,
                bufferPercent: 0, // Already accounted for
                promptId: prompt.id, // Pass prompt ID for pairing in gallery
                mainPrompt: prompt.mainPrompt, // Pass main prompt text for storage
                negativePrompt: prompt.negativePrompt, // Pass negative prompt
                promptMetadata: prompt.metadata // Pass prompt metadata
              }
            });
          }
          
          if (result && result.assets && result.assets.length > 0) {
            // Return both images with prompt info
            return result.assets.map(asset => ({
              id: asset.id,
              url: asset.url,
              promptId: prompt.id,
              metadata: prompt.metadata,
              success: true
            }));
          }
          return [];
        } catch (error) {
          logger.error('Image generation failed', {
            promptId: prompt.id,
            error: error.message
          });
          return [{ success: false, error: error.message, promptId: prompt.id }];
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten and process results
      batchResults.forEach(results => {
        results.forEach(result => {
          if (result.success !== false) {
            generatedImages.push(result);
            successCount++;
          } else {
            failCount++;
          }
        });
      });
      
      // Calculate progress (15% to 85%)
      const completedPrompts = batchStart + batch.length;
      const progress = 15 + Math.floor((completedPrompts / prompts.length) * 70);
      
      // Get last few generated images for preview (last 6 images)
      const previewImages = generatedImages.slice(-6).map(img => ({
        id: img.id,
        url: img.url
      }));
      
      res.write(`data: ${JSON.stringify({
        progress,
        message: `Generated ${successCount} images...`,
        stats: {
          prompts: completedPrompts,
          totalPrompts: prompts.length,
          images: successCount,
          failed: failCount
        },
        previewImages // Send latest images for preview
      })}\n\n`);
    }
    
    logger.info('Image generation complete', {
      total: prompts.length,
      success: successCount,
      failed: failCount
    });
    
    res.write(`data: ${JSON.stringify({
      progress: 85,
      message: `Generated ${successCount} images. Selecting best ${targetCount}...`
    })}\n\n`);
    
    // Select best images using DPP
    let selectedImages = generatedImages;
    if (generatedImages.length > targetCount) {
      try {
        selectedImages = await dppSelectionService.selectDiverseImages(
          generatedImages,
          targetCount,
          {
            userId,
            qualityThreshold: 0.7,
            diversityWeight: 0.6
          }
        );
      } catch (error) {
        logger.warn('DPP selection failed, using all images', { error: error.message });
        selectedImages = generatedImages.slice(0, targetCount);
      }
    }
    
    res.write(`data: ${JSON.stringify({
      progress: 95,
      message: `Selected ${selectedImages.length} best images`
    })}\n\n`);
    
    // Save completion state
    res.write(`data: ${JSON.stringify({
      progress: 100,
      message: 'Complete!',
      done: true,
      result: {
        totalGenerated: successCount,
        totalFailed: failCount,
        selected: selectedImages.length,
        targetCount: targetCount
      }
    })}\n\n`);
    
    logger.info('Onboarding generation complete', {
      userId,
      totalGenerated: successCount,
      selected: selectedImages.length
    });
    
    res.end();
    
  } catch (error) {
    logger.error('Onboarding generation failed', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    res.write(`data: ${JSON.stringify({
      error: error.message,
      progress: 0
    })}\n\n`);
    
    res.end();
  }
});

module.exports = router;
