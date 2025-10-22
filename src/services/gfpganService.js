const axios = require('axios');
const logger = require('../utils/logger');

/**
 * GFPGAN Face Enhancement Service
 * Uses Replicate API for face restoration and enhancement
 * Model: tencentarc/gfpgan
 */
class GFPGANService {
  constructor() {
    this.apiKey = process.env.REPLICATE_API_TOKEN;
    this.baseUrl = 'https://api.replicate.com/v1/predictions';
    this.modelVersion = 'tencentarc/gfpgan:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c';
    
    if (!this.apiKey) {
      logger.warn('REPLICATE_API_TOKEN not configured - face enhancement will be disabled');
    }
  }

  /**
   * Enhance face in generated image
   * @param {Object} params - Enhancement parameters
   * @returns {Promise<Object>}
   */
  async enhanceFace(params) {
    const {
      imageUrl,
      scale = 2,
      version = 'v1.4'
    } = params;

    if (!this.apiKey) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }

    logger.info('Starting GFPGAN face enhancement', {
      imageUrl,
      scale,
      version
    });

    const startTime = Date.now();

    try {
      // Create prediction with Prefer: wait header
      const response = await axios.post(
        this.baseUrl,
        {
          version: this.modelVersion,
          input: {
            img: imageUrl,
            scale,
            version
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait'
          },
          timeout: 120000 // 2 minute timeout
        }
      );

      const prediction = response.data;
      const latency = Date.now() - startTime;

      if (prediction.status === 'succeeded') {
        logger.info('GFPGAN enhancement completed', {
          latency: `${latency}ms`,
          outputUrl: prediction.output
        });

        return {
          success: true,
          enhancedImageUrl: prediction.output,
          originalImageUrl: imageUrl,
          scale,
          version,
          latency,
          cost: this.estimateCost(latency)
        };
      } else if (prediction.status === 'failed') {
        throw new Error(`GFPGAN enhancement failed: ${prediction.error}`);
      } else {
        // Handle processing state
        return await this.pollPrediction(prediction.id, startTime);
      }

    } catch (error) {
      logger.error('GFPGAN enhancement failed', {
        error: error.message,
        imageUrl
      });
      throw error;
    }
  }

  /**
   * Poll prediction status until complete
   * @param {string} predictionId - Prediction ID
   * @param {number} startTime - Start timestamp
   * @returns {Promise<Object>}
   */
  async pollPrediction(predictionId, startTime) {
    const maxAttempts = 30; // 30 attempts * 4 seconds = 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      await this.sleep(4000); // Wait 4 seconds between polls
      attempts++;

      try {
        const response = await axios.get(`${this.baseUrl}/${predictionId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });

        const prediction = response.data;

        if (prediction.status === 'succeeded') {
          const latency = Date.now() - startTime;
          logger.info('GFPGAN enhancement completed (polled)', {
            latency: `${latency}ms`,
            attempts,
            outputUrl: prediction.output
          });

          return {
            success: true,
            enhancedImageUrl: prediction.output,
            latency,
            cost: this.estimateCost(latency)
          };
        } else if (prediction.status === 'failed') {
          throw new Error(`GFPGAN enhancement failed: ${prediction.error}`);
        }

        logger.debug('GFPGAN enhancement in progress', {
          predictionId,
          status: prediction.status,
          attempts
        });

      } catch (error) {
        if (attempts >= maxAttempts) {
          throw error;
        }
        logger.warn('Poll attempt failed, retrying', {
          attempt: attempts,
          error: error.message
        });
      }
    }

    throw new Error('GFPGAN enhancement timeout');
  }

  /**
   * Batch enhance multiple images
   * @param {Array<string>} imageUrls - Array of image URLs
   * @param {Object} options - Enhancement options
   * @returns {Promise<Array<Object>>}
   */
  async batchEnhance(imageUrls, options = {}) {
    logger.info('Starting batch GFPGAN enhancement', {
      imageCount: imageUrls.length
    });

    const promises = imageUrls.map(imageUrl => 
      this.enhanceFace({ imageUrl, ...options })
        .catch(error => {
          logger.error('Batch enhancement failed for image', {
            imageUrl,
            error: error.message
          });
          return {
            success: false,
            originalImageUrl: imageUrl,
            error: error.message
          };
        })
    );

    const results = await Promise.all(promises);
    
    const successful = results.filter(r => r.success).length;
    logger.info('Batch GFPGAN enhancement completed', {
      total: results.length,
      successful,
      failed: results.length - successful
    });

    return results;
  }

  /**
   * Estimate cost based on processing time
   * GFPGAN on Replicate: ~$0.005 per prediction
   * @param {number} latency - Processing time in ms
   * @returns {number} Estimated cost in USD
   */
  estimateCost(latency) {
    return 0.005; // Fixed cost per prediction
  }

  /**
   * Check if service is available
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new GFPGANService();
