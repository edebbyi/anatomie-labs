const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Real-ESRGAN Upscaling Service
 * Uses Replicate API for image super-resolution
 * Model: nightmareai/real-esrgan
 */
class RealESRGANService {
  constructor() {
    this.apiKey = process.env.REPLICATE_API_TOKEN;
    this.baseUrl = 'https://api.replicate.com/v1/predictions';
    this.modelVersion = 'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa';
    
    if (!this.apiKey) {
      logger.warn('REPLICATE_API_TOKEN not configured - image upscaling will be disabled');
    }
  }

  /**
   * Upscale image using Real-ESRGAN
   * @param {Object} params - Upscaling parameters
   * @returns {Promise<Object>}
   */
  async upscaleImage(params) {
    const {
      imageUrl,
      scale = 2,
      faceEnhance = false
    } = params;

    if (!this.apiKey) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }

    logger.info('Starting Real-ESRGAN upscaling', {
      imageUrl,
      scale,
      faceEnhance
    });

    const startTime = Date.now();

    try {
      // Create prediction with Prefer: wait header
      const response = await axios.post(
        this.baseUrl,
        {
          version: this.modelVersion,
          input: {
            image: imageUrl,
            scale,
            face_enhance: faceEnhance
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
        logger.info('Real-ESRGAN upscaling completed', {
          latency: `${latency}ms`,
          outputUrl: prediction.output
        });

        return {
          success: true,
          upscaledImageUrl: prediction.output,
          originalImageUrl: imageUrl,
          scale,
          faceEnhance,
          latency,
          cost: this.estimateCost(scale, latency)
        };
      } else if (prediction.status === 'failed') {
        throw new Error(`Real-ESRGAN upscaling failed: ${prediction.error}`);
      } else {
        // Handle processing state
        return await this.pollPrediction(prediction.id, startTime, scale);
      }

    } catch (error) {
      logger.error('Real-ESRGAN upscaling failed', {
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
   * @param {number} scale - Upscale factor
   * @returns {Promise<Object>}
   */
  async pollPrediction(predictionId, startTime, scale) {
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
          logger.info('Real-ESRGAN upscaling completed (polled)', {
            latency: `${latency}ms`,
            attempts,
            outputUrl: prediction.output
          });

          return {
            success: true,
            upscaledImageUrl: prediction.output,
            latency,
            cost: this.estimateCost(scale, latency)
          };
        } else if (prediction.status === 'failed') {
          throw new Error(`Real-ESRGAN upscaling failed: ${prediction.error}`);
        }

        logger.debug('Real-ESRGAN upscaling in progress', {
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

    throw new Error('Real-ESRGAN upscaling timeout');
  }

  /**
   * Batch upscale multiple images
   * @param {Array<string>} imageUrls - Array of image URLs
   * @param {Object} options - Upscaling options
   * @returns {Promise<Array<Object>>}
   */
  async batchUpscale(imageUrls, options = {}) {
    logger.info('Starting batch Real-ESRGAN upscaling', {
      imageCount: imageUrls.length
    });

    const promises = imageUrls.map(imageUrl => 
      this.upscaleImage({ imageUrl, ...options })
        .catch(error => {
          logger.error('Batch upscaling failed for image', {
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
    logger.info('Batch Real-ESRGAN upscaling completed', {
      total: results.length,
      successful,
      failed: results.length - successful
    });

    return results;
  }

  /**
   * Estimate cost based on scale and processing time
   * Real-ESRGAN on Replicate: ~$0.005-$0.01 per prediction
   * @param {number} scale - Upscale factor
   * @param {number} latency - Processing time in ms
   * @returns {number} Estimated cost in USD
   */
  estimateCost(scale, latency) {
    // Higher scale = more compute = higher cost
    const baseCost = 0.005;
    const scaleFactor = scale / 2; // 2x = 1.0, 4x = 2.0
    return baseCost * scaleFactor;
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

module.exports = new RealESRGANService();
