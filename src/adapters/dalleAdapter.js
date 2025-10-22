const OpenAI = require('openai');
const logger = require('../utils/logger');

/**
 * DALL-E 3 Adapter for Image Generation
 * Standardized interface for OpenAI DALL-E 3 API
 */
class DalleAdapter {
  constructor() {
    this.client = null;
    this.providerId = 'openai-dalle3';
    this.providerName = 'DALL-E 3';
    this.initialized = false;
    
    // Rate limiting
    this.requestsPerMinute = 50;
    this.requestQueue = [];
    this.lastRequestTime = 0;
  }

  /**
   * Initialize OpenAI client
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    try {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      this.initialized = true;
      logger.info('DALL-E 3 adapter initialized', {
        provider: this.providerId
      });
    } catch (error) {
      logger.error('Failed to initialize DALL-E 3 adapter', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate image using DALL-E 3
   * @param {Object} params - Generation parameters
   * @param {string} params.prompt - Main generation prompt
   * @param {string} params.negativePrompt - Negative prompt (not supported by DALL-E)
   * @param {Object} params.settings - Generation settings
   * @returns {Promise<Object>} Generation result
   */
  async generate(params) {
    await this.initialize();

    const {
      prompt,
      settings = {}
    } = params;

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Rate limiting check
    await this.checkRateLimit();

    const startTime = Date.now();

    try {
      logger.info('Starting DALL-E 3 generation', {
        provider: this.providerId,
        promptLength: prompt.length,
        quality: settings.quality || 'standard'
      });

      // Prepare DALL-E 3 request
      const dalleParams = {
        model: 'dall-e-3',
        prompt: this.preparePrompt(prompt),
        n: 1, // DALL-E 3 only supports n=1
        size: this.mapSize(settings.size),
        quality: settings.quality || 'standard', // 'standard' or 'hd'
        style: settings.style || 'vivid', // 'vivid' or 'natural'
        response_format: 'url'
      };

      // Generate image
      const response = await this.client.images.generate(dalleParams);

      const endTime = Date.now();
      const latency = endTime - startTime;

      const result = {
        success: true,
        provider: this.providerId,
        providerName: this.providerName,
        images: response.data.map(img => ({
          url: img.url,
          revisedPrompt: img.revised_prompt || prompt
        })),
        metadata: {
          model: 'dall-e-3',
          quality: dalleParams.quality,
          style: dalleParams.style,
          size: dalleParams.size,
          latency,
          promptLength: prompt.length,
          revisedPrompt: response.data[0]?.revised_prompt
        },
        cost: this.calculateCost(dalleParams),
        timestamp: new Date().toISOString()
      };

      logger.info('DALL-E 3 generation completed', {
        provider: this.providerId,
        latency: `${latency}ms`,
        imageCount: result.images.length,
        cost: result.cost
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;

      logger.error('DALL-E 3 generation failed', {
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
   * Prepare prompt for DALL-E 3
   * DALL-E 3 has specific requirements and limitations
   */
  preparePrompt(prompt) {
    // DALL-E 3 max prompt length is 4000 characters
    const maxLength = 4000;
    
    if (prompt.length > maxLength) {
      logger.warn('Prompt exceeds DALL-E 3 max length, truncating', {
        originalLength: prompt.length,
        maxLength
      });
      return prompt.substring(0, maxLength);
    }

    return prompt;
  }

  /**
   * Map generic size to DALL-E 3 supported sizes
   */
  mapSize(size) {
    // DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
    const sizeMap = {
      'square': '1024x1024',
      'landscape': '1792x1024',
      'portrait': '1024x1792',
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792'
    };

    return sizeMap[size] || '1024x1024';
  }

  /**
   * Calculate cost based on DALL-E 3 pricing
   */
  calculateCost(params) {
    const { quality, size } = params;

    // DALL-E 3 pricing (as of 2024)
    // Standard quality: $0.04 per 1024x1024, $0.08 for HD
    // HD quality: $0.08 per 1024x1024, $0.12 for larger sizes
    
    if (quality === 'hd') {
      if (size === '1024x1024') {
        return 0.08;
      } else {
        return 0.12; // 1792x1024 or 1024x1792
      }
    } else {
      if (size === '1024x1024') {
        return 0.04;
      } else {
        return 0.08;
      }
    }
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
   * Health check for DALL-E 3 service
   */
  async healthCheck() {
    try {
      await this.initialize();
      return {
        healthy: true,
        provider: this.providerId,
        initialized: this.initialized
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
      supportsNegativePrompt: false,
      supportsMultipleImages: false, // DALL-E 3 only generates 1 image at a time
      supportedSizes: ['1024x1024', '1792x1024', '1024x1792'],
      supportedQualities: ['standard', 'hd'],
      supportedStyles: ['vivid', 'natural'],
      maxPromptLength: 4000,
      rateLimit: this.requestsPerMinute
    };
  }
}

module.exports = new DalleAdapter();
