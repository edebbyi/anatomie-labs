const Replicate = require('replicate');
const logger = require('../utils/logger');

/**
 * Imagen 4 Ultra Adapter via Replicate
 * Standardized interface for Google Imagen 4 Ultra via Replicate API
 */
class ImagenAdapter {
  constructor() {
    this.client = null;
    this.providerId = 'google-imagen';
    this.providerName = 'Google Imagen 4 Ultra';
    this.initialized = false;
    this.model = 'google/imagen-4-ultra';
    
    // Rate limiting
    this.requestsPerMinute = 100;
    this.lastRequestTime = 0;
  }

  /**
   * Initialize Replicate client
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }

    try {
      this.client = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
      });

      this.initialized = true;
      logger.info('Imagen 4 Ultra adapter initialized', {
        provider: this.providerId,
        model: this.model
      });
    } catch (error) {
      logger.error('Failed to initialize Imagen 4 Ultra adapter', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate image using Imagen 4 Ultra
   * @param {Object} params - Generation parameters
   * @param {string} params.prompt - Main generation prompt
   * @param {string} params.negativePrompt - Negative prompt
   * @param {Object} params.settings - Generation settings
   * @returns {Promise<Object>} Generation result
   */
  async generate(params) {
    await this.initialize();

    const {
      prompt,
      negativePrompt,
      settings = {}
    } = params;

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Rate limiting check
    await this.checkRateLimit();

    const startTime = Date.now();

    try {
      logger.info('Starting Imagen 4 Ultra generation', {
        provider: this.providerId,
        promptLength: prompt.length,
        hasNegativePrompt: !!negativePrompt
      });

      // Prepare Imagen 4 Ultra request with Stage 6 specifications
      // Resolution: 1024×1024 (base generation)
      // Guidance scale: 7.5 (optimal for fashion)
      // Steps: 50 (high quality)
      const imagenParams = {
        prompt: this.preparePrompt(prompt),
        aspect_ratio: this.mapAspectRatio(settings.size || 'square'),
        output_format: 'png',
        output_quality: 80, // Standard quality for initial generation
        safety_tolerance: settings.safetyTolerance || 2,
        // Stage 6 optimized parameters
        guidance_scale: settings.guidanceScale || 7.5,
        num_inference_steps: settings.steps || 50
      };

      // Add negative prompt if provided
      if (negativePrompt) {
        imagenParams.negative_prompt = negativePrompt;
      }

      // Replicate Imagen 4 Ultra generates 1 image at a time
      // Generate multiple images in parallel for better performance
      const requestedCount = settings.count || 1;
      
      const generationPromises = [];
      for (let i = 0; i < requestedCount; i++) {
        generationPromises.push(
          this.client.run(this.model, { input: imagenParams })
        );
      }
      
      // Wait for all generations to complete in parallel
      const outputs = await Promise.all(generationPromises);
      
      // Extract URLs from outputs
      const imageUrls = outputs
        .map(output => Array.isArray(output) ? output[0] : output)
        .filter(url => url !== null && url !== undefined);

      const endTime = Date.now();
      const latency = endTime - startTime;

      const result = {
        success: true,
        provider: this.providerId,
        providerName: this.providerName,
        images: imageUrls.map(url => ({
          url: url,
          revisedPrompt: null // Imagen doesn't return revised prompts
        })),
        metadata: {
          model: this.model,
          aspectRatio: imagenParams.aspect_ratio,
          outputFormat: imagenParams.output_format,
          outputQuality: imagenParams.output_quality,
          latency,
          promptLength: prompt.length,
          hasNegativePrompt: !!negativePrompt
        },
        cost: this.calculateCost(imagenParams, requestedCount),
        timestamp: new Date().toISOString()
      };

      logger.info('Imagen 4 Ultra generation completed', {
        provider: this.providerId,
        latency: `${latency}ms`,
        imageCount: result.images.length,
        cost: result.cost
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      logger.error('Imagen 4 Ultra generation failed', {
        provider: this.providerId,
        error: error.message,
        latency: `${latency}ms`,
        statusCode: error.status
      });

      return {
        success: false,
        provider: this.providerId,
        providerName: this.providerName,
        error: error.message,
        errorCode: error.code,
        metadata: {
          latency,
          statusCode: error.status
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Prepare prompt for Imagen 4 Ultra
   * Imagen 4 has specific best practices for prompts
   */
  preparePrompt(prompt) {
    // Imagen 4 Ultra max prompt length is ~5000 characters
    const maxLength = 5000;
    
    if (prompt.length > maxLength) {
      logger.warn('Prompt exceeds Imagen 4 max length, truncating', {
        originalLength: prompt.length,
        maxLength
      });
      return prompt.substring(0, maxLength);
    }

    return prompt;
  }

  /**
   * Map generic size to Imagen 4 Ultra aspect ratios
   */
  mapAspectRatio(size) {
    // Imagen 4 Ultra supports various aspect ratios
    const aspectRatioMap = {
      'square': '1:1',
      'landscape': '16:9',
      'portrait': '9:16',
      '1:1': '1:1',
      '16:9': '16:9',
      '9:16': '9:16',
      '4:3': '4:3',
      '3:4': '3:4',
      '21:9': '21:9',
      '9:21': '9:21'
    };

    return aspectRatioMap[size] || '1:1';
  }

  /**
   * Calculate cost based on Imagen 4 Ultra pricing via Replicate
   * @param {Object} params - Generation parameters (imagenParams)
   * @param {number} count - Number of images generated
   * @returns {number} Total cost in dollars
   */
  calculateCost(params, count = 1) {
    // Imagen 4 Ultra pricing on Replicate (approximate)
    // Base cost: $0.04 per image
    // Higher quality increases cost slightly
    
    const baseCost = 0.04;
    const qualityMultiplier = params.output_quality >= 90 ? 1.2 : 1.0;
    
    return baseCost * qualityMultiplier * count;
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit() {
    const now = Date.now();
    const minInterval = (60 * 1000) / this.requestsPerMinute; // ms between requests

    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      logger.debug('Rate limit wait', {
        provider: this.providerId,
        waitTime: `${waitTime}ms`
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Health check for Imagen 4 Ultra service
   */
  async healthCheck() {
    try {
      await this.initialize();
      return {
        healthy: true,
        provider: this.providerId,
        initialized: this.initialized,
        model: this.model
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.providerId,
        error: error.message
      };
    }
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities() {
    return {
      provider: this.providerId,
      providerName: this.providerName,
      model: this.model,
      supportsNegativePrompt: true,
      supportsMultipleImages: true,
      supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
      maxPromptLength: 5000,
      rateLimit: this.requestsPerMinute,
      features: [
        'photorealism',
        'fashion',
        'complex-compositions',
        'color-accuracy',
        'high-detail',
        'negative-prompts'
      ]
    };
  }
}

module.exports = new ImagenAdapter();
