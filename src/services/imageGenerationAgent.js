/**
 * Image Generation Agent
 * 
 * Calls Imagen-4 Ultra API for image generation.
 * Logs prompts, seeds, params, and costs.
 * Optional Real-ESRGAN upscaling.
 */

const db = require('./database');
const r2Storage = require('./r2Storage');
const logger = require('../utils/logger');
const axios = require('axios');
const crypto = require('crypto');

class ImageGenerationAgent {
  /**
   * Generate image from prompt
   * @param {string} userId - User ID
   * @param {string} promptId - Prompt ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation record
   */
  async generateImage(userId, promptId, options = {}) {
    const {
      provider = 'imagen-4-ultra',
      upscale = false,
      width = 1024,
      height = 1024
    } = options;

    logger.info('Image Generation Agent: Starting generation', { 
      userId, 
      promptId, 
      provider 
    });

    // Get prompt
    const prompt = await this.getPrompt(promptId);
    if (!prompt) {
      throw new Error('Prompt not found');
    }

    const startTime = Date.now();

    try {
      let imageBuffer;
      let seed;
      let costCents;
      let params;

      if (provider === 'imagen-4-ultra') {
        const result = await this.generateWithImagen(prompt.text, width, height);
        // Imagen-4 Ultra returns buffer directly
        if (result.buffer) {
          imageBuffer = result.buffer;
        } else if (result.url) {
          // Fallback for development mock
          imageBuffer = await this.downloadImage(result.url);
        } else {
          throw new Error('No buffer or URL returned from Imagen-4 Ultra');
        }
        seed = result.seed;
        costCents = result.costCents;
        params = result.params;
      } else if (provider === 'stable-diffusion') {
        const result = await this.generateWithStableDiffusion(prompt.text, width, height);
        // Also returns buffer now (redirects to Imagen)
        if (result.buffer) {
          imageBuffer = result.buffer;
        } else if (result.url) {
          imageBuffer = await this.downloadImage(result.url);
        } else {
          throw new Error('No buffer or URL returned from provider');
        }
        seed = result.seed;
        costCents = result.costCents;
        params = result.params;
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Upload buffer to R2
      const uploadResult = await r2Storage.uploadImage(imageBuffer, {
        userId,
        imageType: 'generated',
        format: 'jpg'
      });

      // Save generation record
      const generation = await this.saveGeneration(userId, promptId, {
        url: uploadResult.cdnUrl,
        r2_key: uploadResult.key,
        width,
        height,
        provider,
        params,
        seed,
        cost_cents: costCents,
        is_upscaled: false
      });

      // Upscale if requested
      if (upscale) {
        await this.upscaleImage(generation.id, imageBuffer);
      }

      const generationTime = Date.now() - startTime;
      logger.info('Image Generation Agent: Generation complete', { 
        generationId: generation.id,
        provider,
        costCents,
        generationTimeMs: generationTime
      });

      return generation;

    } catch (error) {
      logger.error('Image Generation Agent: Generation failed', { 
        userId, 
        promptId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Generate with Imagen-4 Ultra via Replicate
   */
  async generateWithImagen(promptText, width, height) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('Replicate API token not configured');
    }

    const Replicate = require('replicate');
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    
    const seed = crypto.randomBytes(4).readUInt32BE(0);
    
    // Map dimensions to aspect ratio
    const aspectRatio = width === height ? '1:1' : 
                       width > height ? '16:9' : '9:16';
    
    const params = {
      prompt: promptText,
      aspect_ratio: aspectRatio,
      output_format: 'jpg',
      safety_filter_level: 'block_only_high'
    };

    try {
      logger.info('Calling Replicate Imagen-4 Ultra model', { 
        promptLength: promptText.length,
        aspectRatio 
      });
      
      // Use Imagen-4 Ultra from Google
      let output = await replicate.run(
        'google/imagen-4-ultra',
        { input: params }
      );

      // If output is an async iterator, consume it
      if (output && typeof output[Symbol.asyncIterator] === 'function') {
        logger.info('Consuming async iterator from Replicate');
        const results = [];
        for await (const item of output) {
          results.push(item);
        }
        output = results;
        logger.info('Async iterator consumed', { resultCount: results.length });
      }

      logger.info('Replicate API response received', { 
        outputType: typeof output,
        isArray: Array.isArray(output),
        outputLength: Array.isArray(output) ? output.length : 'N/A'
      });

      // Cost for Imagen-4 Ultra via Replicate: ~$0.02 per image
      const costCents = 2;

      // Imagen-4 Ultra returns raw image data as Uint8Array, not a URL
      // We need to convert the Uint8Array chunks to a Buffer
      let imageBuffer;
      
      if (Array.isArray(output) && output.length > 0) {
        // Check if we have Uint8Array chunks
        if (output[0] instanceof Uint8Array) {
          logger.info('Converting Uint8Array chunks to Buffer', { chunkCount: output.length });
          
          // Calculate total length
          const totalLength = output.reduce((sum, chunk) => sum + chunk.length, 0);
          
          // Combine all chunks into a single buffer
          imageBuffer = Buffer.concat(output.map(chunk => Buffer.from(chunk)));
          
          logger.info('Image buffer created', { 
            sizeKB: (imageBuffer.length / 1024).toFixed(2),
            totalChunks: output.length 
          });
        } else if (typeof output[0] === 'string') {
          // If it's a URL string, handle as before
          const imageUrl = output[0];
          logger.info('Output is URL, downloading...', { url: imageUrl.substring(0, 50) });
          imageBuffer = await this.downloadImage(imageUrl);
        } else {
          throw new Error(`Unexpected output array element type: ${typeof output[0]}`);
        }
      } else if (output instanceof Uint8Array) {
        // Single Uint8Array
        imageBuffer = Buffer.from(output);
        logger.info('Single Uint8Array converted to buffer', { 
          sizeKB: (imageBuffer.length / 1024).toFixed(2) 
        });
      } else if (typeof output === 'string') {
        // URL string
        logger.info('Output is URL string, downloading...');
        imageBuffer = await this.downloadImage(output);
      } else {
        throw new Error(`Unexpected output type from Replicate: ${typeof output}`);
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Failed to create image buffer from Replicate output');
      }

      logger.info('Image data ready for upload', { 
        sizeKB: (imageBuffer.length / 1024).toFixed(2) 
      });

      // Return buffer directly instead of URL
      return {
        buffer: imageBuffer,
        seed: String(seed),
        costCents,
        params
      };

    } catch (error) {
      logger.error('Replicate API call failed', { 
        error: error.message,
        stack: error.stack
      });
      
      // Fallback to mock for development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Using mock image for development');
        return {
          url: 'https://via.placeholder.com/1024x1024.png?text=Imagen+4+Ultra+Mock',
          seed: String(seed),
          costCents: 0,
          params
        };
      }
      
      throw error;
    }
  }

  /**
   * Generate with Stable Diffusion (now redirects to Imagen-4 Ultra)
   */
  async generateWithStableDiffusion(promptText, width, height) {
    // Redirect to Imagen-4 Ultra for consistency
    logger.info('Redirecting Stable Diffusion request to Imagen-4 Ultra');
    return this.generateWithImagen(promptText, width, height);
  }

  /**
   * Download image from URL
   */
  async downloadImage(url) {
    // Handle different URL formats from Replicate API
    let imageUrl = url;
    
    // If url is an array, get first element
    if (Array.isArray(url)) {
      imageUrl = url[0];
    }
    
    // If url is a FileOutput object, get the URL string
    if (typeof imageUrl === 'object' && imageUrl !== null) {
      imageUrl = imageUrl.url || imageUrl.toString();
    }
    
    // Ensure we have a string
    if (typeof imageUrl !== 'string') {
      throw new Error(`Invalid URL format: ${typeof imageUrl}`);
    }
    
    // If base64, convert
    if (imageUrl.startsWith('data:image')) {
      const base64Data = imageUrl.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }

    // Otherwise download
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  /**
   * Upscale image with Real-ESRGAN via Replicate
   */
  async upscaleImage(generationId, imageBuffer) {
    logger.info('Upscaling image with Real-ESRGAN', { generationId });

    try {
      if (!process.env.REPLICATE_API_TOKEN) {
        logger.warn('Replicate API token not configured, skipping upscale');
        return;
      }

      const Replicate = require('replicate');
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

      // Upload image buffer to temporary location or convert to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64Image}`;

      // Run Real-ESRGAN upscaling via Replicate
      const output = await replicate.run(
        'nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b',
        {
          input: {
            image: dataUri,
            scale: 2,
            face_enhance: false
          }
        }
      );

      // Download upscaled image
      const upscaledBuffer = await this.downloadImage(output);

      // Upload upscaled version to R2
      const generation = await db.query('SELECT r2_key, user_id FROM generations WHERE id = $1', [generationId]);
      const originalKey = generation.rows[0]?.r2_key;
      const userId = generation.rows[0]?.user_id;
      
      if (originalKey && userId) {
        const uploadResult = await r2Storage.uploadImage(upscaledBuffer, {
          userId,
          imageType: 'generated',
          format: 'jpg'
        });

        // Update generation record
        await db.query(`
          UPDATE generations
          SET is_upscaled = true, 
              url_upscaled = $1,
              r2_key_upscaled = $2,
              upscale_cost_cents = 1
          WHERE id = $3
        `, [uploadResult.cdnUrl, uploadResult.key, generationId]);

        logger.info('Image upscaled successfully', { generationId });
      }

    } catch (error) {
      logger.error('Upscaling failed', { generationId, error: error.message });
    }
  }

  /**
   * Save generation record
   */
  async saveGeneration(userId, promptId, data) {
    const { v4: uuidv4 } = require('uuid');
    const generationId = uuidv4();
    
    const query = `
      INSERT INTO generations (
        id, user_id, prompt_id, url, r2_key, width, height,
        provider, params, seed, cost_cents, is_upscaled, upscale_cost_cents
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const result = await db.query(query, [
      generationId,
      userId,
      promptId,
      data.url,
      data.r2_key,
      data.width,
      data.height,
      data.provider,
      JSON.stringify(data.params),
      data.seed,
      data.cost_cents,
      data.is_upscaled || false,
      data.upscale_cost_cents || 0
    ]);

    // Update prompt's generation_id
    await db.query(`
      UPDATE prompts SET generation_id = $1 WHERE id = $2
    `, [generationId, promptId]);

    return result.rows[0];
  }

  /**
   * Get prompt
   */
  async getPrompt(promptId) {
    const query = `SELECT * FROM prompts WHERE id = $1`;
    const result = await db.query(query, [promptId]);
    return result.rows[0] || null;
  }

  /**
   * Get user generations
   */
  async getUserGenerations(userId, limit = 50) {
    const query = `
      SELECT g.*, p.text as prompt_text, p.json_spec
      FROM generations g
      JOIN prompts p ON g.prompt_id = p.id
      WHERE g.user_id = $1
      ORDER BY g.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Generate batch of images
   */
  async generateBatch(userId, count = 10, options = {}) {
    const PromptBuilderAgent = require('./promptBuilderAgent');
    const generations = [];

    // Add variation to options for each generation to ensure diverse prompts
    for (let i = 0; i < count; i++) {
      try {
        // Add variation to ensure different prompts
        const variedOptions = {
          ...options,
          variationSeed: i, // Add seed for variation
          mode: options.mode || (i % 3 === 0 ? 'exploratory' : i % 3 === 1 ? 'refinement' : 'creative')
        };
        
        // Generate prompt
        const prompt = await PromptBuilderAgent.generatePrompt(userId, variedOptions);
        
        // Generate image
        const generation = await this.generateImage(userId, prompt.id, options);
        generations.push(generation);

        logger.info('Batch generation progress', { 
          completed: i + 1, 
          total: count,
          promptId: prompt.id,
          promptText: prompt.text.substring(0, 100) + '...'
        });

      } catch (error) {
        logger.error('Batch generation item failed', { 
          index: i, 
          error: error.message 
        });
      }
    }

    return generations;
  }
}

module.exports = new ImageGenerationAgent();
