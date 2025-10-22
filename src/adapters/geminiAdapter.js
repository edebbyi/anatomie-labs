const Replicate = require('replicate');
const logger = require('../utils/logger');

/**
 * Gemini 2.5 Flash Image Adapter via Replicate
 * Standardized interface for Google Gemini 2.5 Flash Image
 */
class GeminiAdapter {
  constructor() {
    this.client = null;
    this.providerId = 'google-gemini';
    this.providerName = 'Gemini 2.5 Flash Image';
    this.initialized = false;
    this.model = 'google/gemini-2.5-flash-image';
    
    // Rate limiting
    this.requestsPerMinute = 150;
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
      logger.info('Gemini 2.5 Flash Image adapter initialized', {
        provider: this.providerId,
        model: this.model
      });
    } catch (error) {
      logger.error('Failed to initialize Gemini adapter', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate image using Gemini 2.5 Flash Image
   * @param {Object} params - Generation parameters
   * @param {string} params.prompt - Main generation prompt
   * @param {string} params.negativePrompt - Negative prompt (not officially supported)
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
      logger.info('Starting Gemini 2.5 Flash Image generation', {
        provider: this.providerId,
        promptLength: prompt.length,
        hasNegativePrompt: !!negativePrompt
      });

      // Prepare Gemini request
      const geminiParams = {
        prompt: this.preparePrompt(prompt, negativePrompt),
        aspect_ratio: this.mapAspectRatio(settings.size),
        output_format: settings.format || 'jpg',
        image_input: [] // For future image-to-image support
      };

      // Run the model
      const output = await this.client.run(this.model, {
        input: geminiParams
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Gemini returns array of URLs or single URL
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
          aspectRatio: geminiParams.aspect_ratio,
          outputFormat: geminiParams.output_format,
          latency,
          promptLength: prompt.length,
          hasNegativePrompt: !!negativePrompt
        },
        cost: this.calculateCost(geminiParams),
        timestamp: new Date().toISOString()
      };

      logger.info('Gemini 2.5 Flash Image generation completed', {
        provider: this.providerId,
        latency: `${latency}ms`,
        imageCount: result.images.length,
        cost: result.cost
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      logger.error('Gemini 2.5 Flash Image generation failed', {
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
   * Prepare prompt for Gemini
   * Note: Gemini may have different handling for negative prompts
   */
  preparePrompt(prompt, negativePrompt) {
    // Gemini Flash max prompt length (approximate)
    const maxLength = 8000;
    
    let finalPrompt = prompt;
    
    // Append negative prompt as instruction if provided
    if (negativePrompt) {
      finalPrompt = `${prompt}\n\n[Exclude the following: ${negativePrompt}]`;
    }
    
    if (finalPrompt.length > maxLength) {
      logger.warn('Prompt exceeds Gemini max length, truncating', {
        originalLength: finalPrompt.length,
        maxLength
      });
      return finalPrompt.substring(0, maxLength);
    }

    return finalPrompt;
  }

  /**
   * Map generic size to Gemini aspect ratios
   */
  mapAspectRatio(size) {
    // Gemini supports match_input_image or specific ratios
    const aspectRatioMap = {
      'square': '1:1',
      'landscape': '16:9',
      'portrait': '9:16',
      '1:1': '1:1',
      '16:9': '16:9',
      '9:16': '9:16',
      '4:3': '4:3',
      '3:4': '3:4'
    };

    return aspectRatioMap[size] || '1:1';
  }

  /**
   * Calculate cost based on Gemini 2.5 Flash pricing
   */
  calculateCost(params) {
    // Gemini 2.5 Flash pricing (approximate, very cost-effective)
    // Base cost: $0.01 per image (flash model is cheap)
    const baseCost = 0.01;
    
    return baseCost;
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
      supportsNegativePrompt: false, // Limited support
      supportsMultipleImages: false,
      supportedAspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      maxPromptLength: 8000,
      rateLimit: this.requestsPerMinute,
      features: [
        'ultra-fast',
        'very-cost-effective',
        'good-quality',
        'image-to-image-capable'
      ]
    };
  }
}

module.exports = new GeminiAdapter();
