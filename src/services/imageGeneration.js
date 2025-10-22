const Replicate = require('replicate');
const logger = require('../utils/logger');
const r2Storage = require('./r2Storage');
const Image = require('../models/Image');
const jobQueue = require('./jobQueue');
const axios = require('axios');

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Model versions - using actual Replicate model names
// Only using Imagen 4 Ultra for highest quality generation
const MODELS = {
  'imagen-4-ultra': 'google/imagen-4-ultra'
};

/**
 * Generate images using Imagen 4 Ultra via Replicate
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generation result
 */
const generateImages = async (options) => {
  const {
    prompt,
    quantity = 1,
    model = 'imagen-4-ultra',
    aspectRatio = '1:1',
    negativePrompt = '',
    userId,
    jobId
  } = options;

  logger.info('Starting Imagen generation', {
    userId,
    jobId,
    prompt: prompt.substring(0, 100),
    quantity,
    model
  });

  const results = [];
  const startTime = Date.now();

  try {
    // Generate images one by one (Replicate generates 1 at a time)
    for (let i = 0; i < quantity; i++) {
      // Update job progress
      if (jobId) {
        await jobQueue.updateJobProgress(jobId, i, quantity);
      }

      logger.info(`Generating image ${i + 1}/${quantity}`, { jobId, userId });

      // Run Imagen via Replicate
      const output = await replicate.run(MODELS[model], {
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          negative_prompt: negativePrompt,
          output_format: 'jpg',
          guidance_scale: 7.5,
          num_inference_steps: 50
        }
      });

      // Replicate returns a URL to the generated image
      const imageUrl = Array.isArray(output) ? output[0] : output;

      if (!imageUrl) {
        throw new Error('No image URL returned from Replicate');
      }

      // Download image from Replicate
      const imageBuffer = await downloadImage(imageUrl);

      // Upload to R2
      const uploadResult = await r2Storage.uploadImage(imageBuffer, {
        userId,
        imageType: 'generated',
        format: 'jpg',
        jobId
      });

      // Save to database
      const imageRecord = await Image.create({
        userId,
        jobId,
        r2Key: uploadResult.key,
        r2Bucket: uploadResult.bucket,
        cdnUrl: uploadResult.cdnUrl,
        originalSize: uploadResult.size,
        format: 'jpg',
        generationCost: calculateCost(model)
      });

      results.push({
        imageId: imageRecord.id,
        cdnUrl: imageRecord.cdn_url,
        r2Key: uploadResult.key,
        size: uploadResult.size
      });

      logger.info(`Image ${i + 1}/${quantity} generated and uploaded`, {
        jobId,
        imageId: imageRecord.id,
        size: uploadResult.size
      });
    }

    const totalTime = Date.now() - startTime;
    const avgTimePerImage = totalTime / quantity;

    logger.info('Imagen generation batch completed', {
      userId,
      jobId,
      quantity,
      totalTime: `${totalTime}ms`,
      avgTimePerImage: `${avgTimePerImage.toFixed(0)}ms`,
      totalCost: (calculateCost(model) * quantity).toFixed(4)
    });

    return {
      success: true,
      images: results,
      metadata: {
        model,
        quantity,
        totalTime,
        avgTimePerImage,
        totalCost: calculateCost(model) * quantity
      }
    };

  } catch (error) {
    logger.error('Imagen generation failed', {
      userId,
      jobId,
      error: error.message,
      prompt: prompt.substring(0, 100)
    });

    throw error;
  }
};

/**
 * Download image from URL
 * @param {string} url - Image URL
 * @returns {Promise<Buffer>} Image buffer
 */
const downloadImage = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000 // 60 second timeout
    });

    return Buffer.from(response.data);
  } catch (error) {
    logger.error('Failed to download image from Replicate', {
      url,
      error: error.message
    });
    throw new Error(`Failed to download image: ${error.message}`);
  }
};

/**
 * Calculate cost per image based on model
 * @param {string} model - Model name
 * @returns {number} Cost in USD
 */
const calculateCost = (model) => {
  const costs = {
    'imagen-4-ultra': 0.030, // ~$0.03 per image (estimate for Replicate)
    'imagen-4-fast': 0.010   // ~$0.01 per image (estimate for Replicate)
  };

  return costs[model] || 0.030;
};

/**
 * Process image generation job from queue
 * @param {Object} job - Job data from queue
 * @returns {Promise<void>}
 */
const processGenerationJob = async (job) => {
  const { id: jobId, userId, prompt, quantity, model } = job;

  try {
    logger.info('Processing generation job', { jobId, userId, quantity, model });

    // Update job status to processing
    await jobQueue.updateJobStatus(jobId, 'processing');

    // Publish job update
    await jobQueue.publishJobUpdate(jobId, userId, {
      status: 'processing',
      message: 'Starting image generation...'
    });

    // Generate images
    const result = await generateImages({
      prompt,
      quantity,
      model: model || 'imagen-4-ultra',
      userId,
      jobId
    });

    // Update job status to completed
    await jobQueue.updateJobStatus(jobId, 'completed', {
      imagesGenerated: result.images.length,
      totalCost: result.metadata.totalCost
    });

    // Publish completion
    await jobQueue.publishJobUpdate(jobId, userId, {
      status: 'completed',
      message: 'Image generation completed!',
      images: result.images,
      metadata: result.metadata
    });

    logger.info('Generation job completed successfully', {
      jobId,
      userId,
      imagesGenerated: result.images.length
    });

  } catch (error) {
    logger.error('Generation job failed', {
      jobId,
      userId,
      error: error.message
    });

    // Update job status to failed
    await jobQueue.updateJobStatus(jobId, 'failed', {
      error: error.message
    });

    // Publish failure
    await jobQueue.publishJobUpdate(jobId, userId, {
      status: 'failed',
      message: 'Image generation failed',
      error: error.message
    });
  }
};

/**
 * Start job queue worker
 * Continuously polls queue for new jobs
 * @returns {Promise<void>}
 */
const startWorker = async () => {
  logger.info('Image generation worker started');

  while (true) {
    try {
      // Get next job from queue (blocking with 30s timeout)
      const job = await jobQueue.getNextImageGenerationJob(30);

      if (job) {
        await processGenerationJob(job);
      }

    } catch (error) {
      logger.error('Worker error', { error: error.message });
      // Wait a bit before retrying on error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

/**
 * Test Replicate connection
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      logger.warn('Replicate API token not configured');
      return false;
    }

    // Try to get account info (simple API call)
    await replicate.collections.get('text-to-image');
    logger.info('Replicate connection test successful');
    return true;

  } catch (error) {
    logger.error('Replicate connection test failed', { error: error.message });
    return false;
  }
};

/**
 * Get available models
 * @returns {Array<Object>} List of available models
 */
const getAvailableModels = () => {
  return [
    {
      id: 'imagen-4-ultra',
      name: 'Imagen 4 Ultra',
      description: 'Google\'s highest quality image generation model for detailed and photorealistic images',
      costPerImage: 0.030,
      avgGenerationTime: '8-12s',
      recommended: true
    }
  ];
};

module.exports = {
  generateImages,
  processGenerationJob,
  startWorker,
  testConnection,
  getAvailableModels,
  calculateCost
};
