const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const jobQueue = require('../../services/jobQueue');
const redis = require('../../services/redis');
const r2Storage = require('../../services/r2Storage');
const Image = require('../../models/Image');
const Pod = require('../../models/Pod');
const { extractMetadataFromPromptSpec } = require('../../utils/promptMetadata');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const router = express.Router();

const toLikedImageDto = (row) => ({
  id: row.id,
  url: row.url,
  createdAt: row.created_at,
  likedAt: row.liked_at,
  promptText: row.prompt_text,
  metadata: extractMetadataFromPromptSpec(row.json_spec),
  podIds: Array.isArray(row.pod_ids) ? row.pod_ids : [],
});

const toPodDto = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  imageCount: Number(row.image_count) || 0,
  coverImageUrl: row.cover_image_url || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * POST /api/images/generate
 * Generate images from voice command
 */
router.post('/generate', asyncHandler(async (req, res) => {
  const { parsedCommand, vltSpecification, model } = req.body;

  if (!parsedCommand || !parsedCommand.quantity) {
    return res.status(400).json({
      success: false,
      message: 'parsedCommand with quantity is required'
    });
  }

  logger.info('Image generation requested', {
    userId: req.user.id,
    quantity: parsedCommand.quantity,
    garmentType: parsedCommand.garmentType
  });

  // Add job to queue
  const jobId = await jobQueue.addImageGenerationJob({
    userId: req.user.id,
    prompt: vltSpecification || parsedCommand.garmentType,
    quantity: parsedCommand.quantity,
    model: model || 'imagen',
    parsedCommand
  });

  res.json({
    success: true,
    message: 'Image generation job queued successfully',
    data: {
      jobId,
      status: 'queued',
      quantity: parsedCommand.quantity,
      estimatedTime: '2-5 minutes',
      statusUrl: `/api/images/job/${jobId}`
    }
  });
}));

/**
 * GET /api/images/job/:jobId
 * Get job status
 */
router.get('/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  
  const status = await jobQueue.getJobStatus(jobId);
  
  if (!status) {
    return res.status(404).json({
      success: false,
      message: 'Job not found'
    });
  }
  
  res.json({
    success: true,
    data: status
  });
}));

/**
 * GET /api/images/gallery
 * Get user's image gallery
 */
router.get('/gallery', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isOutlier, jobId } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  const result = await Image.findByUserId(req.user.id, {
    limit: parseInt(limit),
    offset,
    isOutlier: isOutlier !== undefined ? isOutlier === 'true' : null,
    jobId
  });

  // Format and group images by prompts for prompt-centric UI
  const formattedImages = result.images.map(image => {
    // Parse VLT analysis to extract prompt and metadata
    let vltData = {};
    if (image.vlt_analysis) {
      try {
        vltData = typeof image.vlt_analysis === 'string' 
          ? JSON.parse(image.vlt_analysis) 
          : image.vlt_analysis;
      } catch (e) {
        logger.warn('Failed to parse vlt_analysis', { imageId: image.id, error: e.message });
      }
    }

    return {
      id: image.id,
      url: image.cdn_url,
      prompt: vltData.promptText || vltData.mainPrompt || vltData.prompt_text || 'Generated image',
      promptId: vltData.promptId || `prompt-${image.id}`, // Group by prompt ID
      tags: vltData.tags || [
        vltData.garmentType || 'fashion',
        vltData.aesthetic || vltData.style?.aesthetic || 'contemporary'
      ].filter(Boolean),
      metadata: {
        garmentType: vltData.garmentType,
        silhouette: vltData.silhouette,
        colors: vltData.colors ? Object.values(vltData.colors).filter(Boolean) : [],
        texture: vltData.fabric?.texture,
        lighting: 'professional',
        generatedAt: image.created_at,
        model: vltData.model || 'imagen',
        confidence: vltData.confidence,
        aesthetic: vltData.style?.aesthetic || vltData.aesthetic,
        formality: vltData.style?.formality || vltData.formality
      }
    };
  });

  // Group images by prompt ID to create prompt-centric structure
  const promptGroups = {};
  formattedImages.forEach(image => {
    const promptId = image.promptId;
    if (!promptGroups[promptId]) {
      promptGroups[promptId] = {
        id: promptId,
        prompt: image.prompt,
        tags: image.tags,
        images: [],
        metadata: image.metadata, // Use first image's metadata as representative
        totalImages: 0,
        avgConfidence: 0
      };
    }
    promptGroups[promptId].images.push(image);
    promptGroups[promptId].totalImages++;
  });

  // Convert to array and calculate averages
  const prompts = Object.values(promptGroups).map(prompt => {
    prompt.avgConfidence = prompt.images.reduce((sum, img) => sum + (img.metadata.confidence || 0), 0) / prompt.images.length;
    // Sort images within each prompt by generation time
    prompt.images.sort((a, b) => new Date(b.metadata.generatedAt) - new Date(a.metadata.generatedAt));
    return prompt;
  });

  // Sort prompts by most recent generation
  prompts.sort((a, b) => new Date(b.images[0].metadata.generatedAt) - new Date(a.images[0].metadata.generatedAt));

  res.json({
    success: true,
    data: {
      prompts: prompts, // Grouped by prompt for prompt-centric UI
      images: formattedImages, // Individual images for backward compatibility
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.pagination.total,
        totalPrompts: prompts.length,
        hasMore: result.pagination.hasMore
      }
    }
  });
}));

/**
 * GET /api/images/liked
 * Get user's liked images (heart/save feedback)
 */
router.get('/liked', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const likedImages = await Image.findLikedByUser(userId);

  res.json({
    success: true,
    data: {
      count: likedImages.length,
      images: likedImages.map(toLikedImageDto),
    },
  });
}));

/**
 * POST /api/images/:imageId/pods
 * Assign an image to multiple pods (overwrites membership)
 */
router.post('/:imageId/pods', asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { imageId } = req.params;
  const { podIds } = req.body || {};

  if (!Array.isArray(podIds)) {
    const error = new Error('podIds array is required');
    error.statusCode = 400;
    throw error;
  }

  const updatedPods = await Pod.setImagePods(userId, imageId, podIds);
  const membershipPods = await Pod.getPodsForImage(userId, imageId);

  res.json({
    success: true,
    message: 'Updated pod assignments for image',
    data: {
      podIds: membershipPods.map((pod) => pod.id),
      pods: membershipPods.map(toPodDto),
      updatedPods: updatedPods.map(toPodDto),
    },
  });
}));

/**
 * POST /api/images/test-upload
 * Test R2 upload (development only)
 */
router.post('/test-upload', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image file provided'
    });
  }

  // Upload to R2
  const uploadResult = await r2Storage.uploadImage(req.file.buffer, {
    userId: req.user.id,
    imageType: 'generated',
    format: req.file.mimetype.split('/')[1]
  });

  // Save to database
  const image = await Image.create({
    userId: req.user.id,
    r2Key: uploadResult.key,
    r2Bucket: uploadResult.bucket,
    cdnUrl: uploadResult.cdnUrl,
    originalSize: uploadResult.size,
    format: req.file.mimetype.split('/')[1]
  });

  res.json({
    success: true,
    message: 'Test upload successful',
    data: {
      image,
      r2: uploadResult
    }
  });
}));

module.exports = router;
