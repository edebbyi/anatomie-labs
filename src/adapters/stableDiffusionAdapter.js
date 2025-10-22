const Replicate = require('replicate');
const logger = require('../utils/logger');

/**
 * Stable Diffusion 3.5 Large Adapter via Replicate
 * Standardized interface for Stable Diffusion 3.5 Large
 */
class StableDiffusionAdapter {
  constructor() {
    this.client = null;
    this.providerId = 'stable-diffusion-xl';
    this.providerName = 'Stable Diffusion 3.5 Large';
    this.initialized = false;
    this.model = 'stability-ai/stable-diffusion-3.5-large';
    
    // Rate limiting
    this.requestsPerMinute = 200;
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
      logger.info('Stable Diffusion 3.5 Large adapter initialized', {
        provider: this.providerId,
        model: this.model
      });
    } catch (error) {
      logger.error('Failed to initialize Stable Diffusion adapter', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate image using Stable Diffusion 3.5 Large
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
      logger.info('Starting Stable Diffusion 3.5 generation', {
        provider: this.providerId,
        promptLength: prompt.length,
        hasNegativePrompt: !!negativePrompt
      });

      // Prepare Stable Diffusion request
      const sdParams = {
        prompt: this.preparePrompt(prompt, negativePrompt),
        aspect_ratio: this.mapAspectRatio(settings.size),
        output_format: settings.format || 'webp',
        cfg: settings.cfg || 4.5, // Classifier-free guidance scale
        prompt_strength: settings.promptStrength || 0.85,
        num_outputs: 1
      };

      // Run the model
      const output = await this.client.run(this.model, {
        input: sdParams
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      // SD returns array of URLs
      const imageUrls = Array.isArray(output) ? output : [output];

      const result = {
        success: true,
        provider: this.providerId,
        providerName: this.providerName,
        images: imageUrls.map(url => ({
          url: url,
          revisedPrompt: null
        })),
        metadata: {
          model: this.model,
          aspectRatio: sdParams.aspect_ratio,
          outputFormat: sdParams.output_format,
          cfg: sdParams.cfg,
          promptStrength: sdParams.prompt_strength,
          latency,
          promptLength: prompt.length,
          hasNegativePrompt: !!negativePrompt
        },
        cost: this.calculateCost(sdParams),
        timestamp: new Date().toISOString()
      };

      logger.info('Stable Diffusion 3.5 generation completed', {
        provider: this.providerId,
        latency: `${latency}ms`,
        imageCount: result.images.length,
        cost: result.cost
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      logger.error('Stable Diffusion 3.5 generation failed', {
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
   * Prepare prompt for Stable Diffusion
   * SD 3.5 supports negative prompts in the main prompt with special syntax
   */
  preparePrompt(prompt, negativePrompt) {
    // SD 3.5 max prompt length
    const maxLength = 10000;
    
    let finalPrompt = prompt;
    
    // If negative prompt provided, we'll handle it separately in post-processing
    // For SD 3.5, we can append negative guidance in the prompt
    if (negativePrompt) {
      finalPrompt = `${prompt}\n\nAvoid: ${negativePrompt}`;
    }
    
    if (finalPrompt.length > maxLength) {
      logger.warn('Prompt exceeds SD 3.5 max length, truncating', {
        originalLength: finalPrompt.length,
        maxLength
      });
      return finalPrompt.substring(0, maxLength);
    }

    return finalPrompt;
  }

  /**
   * Map generic size to Stable Diffusion aspect ratios
   */
  mapAspectRatio(size) {
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
   * Calculate cost based on Stable Diffusion 3.5 pricing
   */
  calculateCost(params) {
    // SD 3.5 Large pricing on Replicate (approximate)
    // Base cost: $0.02 per image (very cost-effective)
    const baseCost = 0.02;
    
    return baseCost * params.num_outputs;
  }

  /**
   * Rate limiting check
   */
  async checkRateLimit() {
    const now = Date.now();
    const minInterval = (60 * 1000) / this.requestsPerMinute;

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
   * Health check
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
      supportsMultipleImages: false,
      supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
      maxPromptLength: 10000,
      rateLimit: this.requestsPerMinute,
      features: [
        'fast-generation',
        'cost-effective',
        'high-detail',
        'flexible-control',
        'negative-prompts'
      ]
    };
  }
}

module.exports = new StableDiffusionAdapter();
