const express = require('express');
const { asyncHandler } = require('../../middleware/errorHandler');
const promptEnhancementService = require('../../services/promptEnhancementService');
const vltService = require('../../services/vltService');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/prompt/enhance
 * Enhance VLT specification using Claude/GPT
 */
router.post('/enhance', asyncHandler(async (req, res) => {
  const { vltSpec, options = {} } = req.body;

  if (!vltSpec || !vltSpec.records) {
    return res.status(400).json({
      success: false,
      message: 'Valid VLT specification required'
    });
  }

  logger.info('Prompt enhancement requested', {
    userId: req.user.id,
    recordCount: vltSpec.records.length,
    provider: options.provider
  });

  const startTime = Date.now();

  try {
    const result = await promptEnhancementService.enhancePrompt(vltSpec, {
      ...options,
      userId: req.user.id
    });

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}ms`,
        provider: result.metadata.provider,
        enhancementCount: result.enhancements.length
      }
    });

  } catch (error) {
    logger.error('Prompt enhancement failed', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/prompt/enhance-from-vlt-job
 * Convenience endpoint: fetch VLT job and enhance in one call
 */
router.post('/enhance-from-vlt-job', asyncHandler(async (req, res) => {
  const { jobId, options = {} } = req.body;

  if (!jobId) {
    return res.status(400).json({
      success: false,
      message: 'VLT job ID required'
    });
  }

  logger.info('Enhancing from VLT job', {
    userId: req.user.id,
    jobId
  });

  try {
    // In a real implementation, you'd fetch the VLT job from your database
    // For now, we'll require the client to provide the full VLT spec
    return res.status(501).json({
      success: false,
      message: 'Not implemented - please use /enhance with full VLT spec'
    });

  } catch (error) {
    logger.error('VLT job enhancement failed', {
      userId: req.user.id,
      jobId,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/prompt/batch-enhance
 * Enhance multiple VLT specifications
 */
router.post('/batch-enhance', asyncHandler(async (req, res) => {
  const { vltSpecs, options = {} } = req.body;

  if (!Array.isArray(vltSpecs) || vltSpecs.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Array of VLT specifications required'
    });
  }

  logger.info('Batch prompt enhancement requested', {
    userId: req.user.id,
    count: vltSpecs.length
  });

  const startTime = Date.now();

  try {
    const result = await promptEnhancementService.batchEnhance(vltSpecs, {
      ...options,
      userId: req.user.id
    });

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      data: result,
      meta: {
        processingTime: `${duration}ms`,
        totalSpecs: result.total,
        successful: result.successful.length,
        failed: result.failed,
        successRate: result.successRate
      }
    });

  } catch (error) {
    logger.error('Batch prompt enhancement failed', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * POST /api/prompt/quick-enhance
 * Quick enhancement from simple text prompt (bypasses VLT)
 */
router.post('/quick-enhance', asyncHandler(async (req, res) => {
  const { prompt, options = {} } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      message: 'Prompt text required'
    });
  }

  logger.info('Quick prompt enhancement requested', {
    userId: req.user.id,
    promptLength: prompt.length
  });

  try {
    // Create a minimal VLT-like structure
    const mockVltSpec = {
      jobId: `quick_${Date.now()}`,
      records: [{
        imageId: 'quick_enhance',
        garmentType: 'unknown',
        silhouette: 'unknown',
        promptText: prompt,
        confidence: 1.0,
        fabric: {},
        colors: {},
        construction: {},
        style: {}
      }]
    };

    const result = await promptEnhancementService.enhancePrompt(mockVltSpec, {
      ...options,
      userId: req.user.id
    });

    res.json({
      success: true,
      data: {
        originalPrompt: prompt,
        enhanced: result.enhancements[0]?.enhanced || {},
        metadata: result.metadata
      }
    });

  } catch (error) {
    logger.error('Quick enhancement failed', {
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/prompt/providers
 * Get available enhancement providers
 */
router.get('/providers', asyncHandler(async (req, res) => {
  const providers = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      id: 'claude',
      name: 'Claude (Anthropic)',
      model: 'claude-3-5-sonnet-20241022',
      recommended: true,
      features: ['fashion expertise', 'detailed prompts', 'json output']
    });
  }

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      id: 'openai',
      name: 'GPT-4 (OpenAI)',
      model: 'gpt-4-turbo-preview',
      recommended: false,
      features: ['general purpose', 'creative prompts', 'json output']
    });
  }

  res.json({
    success: true,
    data: {
      providers,
      defaultProvider: providers.find(p => p.recommended)?.id || providers[0]?.id,
      available: providers.length > 0
    }
  });
}));

/**
 * GET /api/prompt/styles
 * Get available enhancement styles
 */
router.get('/styles', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      styles: [
        {
          id: 'professional',
          name: 'Professional',
          description: 'High-end fashion photography with technical precision',
          recommended: true
        },
        {
          id: 'editorial',
          name: 'Editorial',
          description: 'Magazine-quality artistic direction',
          recommended: false
        },
        {
          id: 'commercial',
          name: 'Commercial',
          description: 'Product-focused with broad appeal',
          recommended: false
        },
        {
          id: 'artistic',
          name: 'Artistic',
          description: 'Creative and experimental interpretations',
          recommended: false
        }
      ],
      defaultStyle: 'professional'
    }
  });
}));

module.exports = router;
