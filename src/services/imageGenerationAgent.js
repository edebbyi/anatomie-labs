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
const { normalizePromptMetadata } = require('../utils/promptMetadata');

const pickFirstString = (...candidates) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    } else if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const found = pickFirstString(item);
        if (found) return found;
      }
    } else if (typeof candidate === 'object') {
      const record = candidate || {};
      const nested = pickFirstString(
        record.name,
        record.label,
        record.value,
        record.title,
        record.description,
        record.text,
        record.type
      );
      if (nested) return nested;
    }
  }
  return null;
};


class ImageGenerationAgent {
  /**
   * Generate image from prompt
   * @param {string} userId - User ID
   * @param {string} promptId - Prompt ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated image data
   */
  async generateImage(userId, promptId, options = {}) {
    const {
      provider = 'imagen-4-ultra',
      upscale = false
    } = options;

    try {
      // Get prompt from database
      const promptQuery = `
        SELECT p.*, u.email as user_email
        FROM prompts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = $1 AND p.user_id = $2
      `;
      const promptResult = await db.query(promptQuery, [promptId, userId]);

      if (promptResult.rows.length === 0) {
        throw new Error('Prompt not found or unauthorized');
      }

      const prompt = promptResult.rows[0];
      const promptText = pickFirstString(
        prompt.positive_prompt,
        prompt.text,
        prompt.prompt
      );

      if (!promptText) {
        throw new Error('No prompt text found');
      }

      logger.info('Starting image generation', {
        userId,
        promptId,
        provider,
        promptLength: promptText.length
      });

      // Generate image using Replicate
      let imageUrl, imageBuffer;
      
      if (provider === 'imagen-4-ultra') {
        imageBuffer = await this.generateImagenUltra(promptText);
        imageUrl = await this.uploadImageToR2(imageBuffer, userId, promptId);
      } else {
        imageUrl = await this.generateStableDiffusion(promptText);
      }

      // Save generation to database
      const generationQuery = `
        INSERT INTO generations (
          user_id, prompt_id, url, provider, cost_cents, 
          prompt_text, prompt_metadata, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, url, created_at
      `;
      
      const generationResult = await db.query(generationQuery, [
        userId,
        promptId,
        imageUrl,
        provider,
        2, // Cost in cents
        promptText,
        prompt.json_spec || {},
        {
          generatedAt: new Date().toISOString(),
          provider,
          promptLength: promptText.length
        }
      ]);

      const generation = generationResult.rows[0];

      // Upscale if requested
      if ( upscale && imageBuffer) {
        try {
          await this.upscaleImage(generation.id, imageBuffer);
        } catch (upscaleError) {
          logger.warn('Upscaling failed, but original generation succeeded', {
            generationId: generation.id,
            error: upscaleError.message
          });
        }
      }

      logger.info('Image generation completed', {
        generationId: generation.id,
        userId,
        url: imageUrl
      });

      return {
        id: generation.id,
        url: imageUrl,
        prompt: promptText,
        provider,
        cost_cents: 2,
        created_at: generation.created_at
      };

    } catch (error) {
      logger.error('Image generation failed', {
        userId,
        promptId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Generate image using Imagen-4 Ultra via Replicate
   * @param {string} promptText - Text prompt
   * @returns {Promise<Buffer>} Image buffer
   */
  async generateImagenUltra(promptText) {
    const Replicate = require('replicate');
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    const params = {
      prompt: promptText,
      aspect_ratio: "1:1",
      output_format: "png",
      output_quality: 95,
      negative_prompt: "",
      num_inference_steps: 50,
      guidance_scale: 7.5
    };

    logger.info('Calling Imagen-4 Ultra via Replicate', {
      promptLength: promptText.length
    });

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
    
    // Handle ReadableStream (newer Replicate models return streams)
    if (Array.isArray(output) && output.length > 0 && 
        output[0] && typeof output[0] === 'object' && 
        output[0] instanceof ReadableStream) {
      logger.info('Consuming ReadableStream from Replicate');
      const streamResults = [];
      
      for (let i = 0; i < output.length; i++) {
        const stream = output[i];
        const reader = stream.getReader();
        const chunks = [];
        
        try {
          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              chunks.push(value);
            }
          }
          
          // Combine chunks into Uint8Array
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const uint8Array = new Uint8Array(totalLength);
          let offset = 0;
          
          for (const chunk of chunks) {
            uint8Array.set(chunk, offset);
            offset += chunk.length;
          }
          
          streamResults.push(uint8Array);
          logger.info('ReadableStream consumed', { 
            streamIndex: i, 
            chunkCount: chunks.length,
            totalSizeKB: (totalLength / 1024).toFixed(2)
          });
          
        } catch (streamError) {
          logger.error('Failed to consume ReadableStream', { 
            streamIndex: i, 
            error: streamError.message 
          });
          throw new Error(`Failed to consume ReadableStream: ${streamError.message}`);
        } finally {
          reader.releaseLock();
        }
      }
      
      output = streamResults;
      logger.info('All ReadableStreams consumed', { resultCount: streamResults.length });
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

    return imageBuffer;
  }

  /**
   * Generate image using Stable Diffusion via Replicate
   * @param {string} promptText - Text prompt
   * @returns {Promise<string>} Image URL
   */
  async generateStableDiffusion(promptText) {
    const Replicate = require('replicate');
    
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    const output = await replicate.run(
      "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
      {
        input: {
          prompt: promptText,
          num_outputs: 1,
          width: 512,
          height: 512,
          num_inference_steps: 20
        }
      }
    );

    if (Array.isArray(output) && output.length > 0) {
      return output[0];
    } else {
      throw new Error('No image URL returned from Stable Diffusion');
    }
  }

  /**
   * Upload image to Cloudflare R2 storage
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} userId - User ID
   * @param {string} promptId - Prompt ID
   * @returns {Promise<string>} Image URL
   */
  async uploadImageToR2(imageBuffer, userId, promptId) {
    try {
      const timestamp = Date.now();
      const filename = `generated-${userId}-${promptId}-${timestamp}.png`;
      
      const uploadResult = await r2Storage.uploadImage(imageBuffer, {
        userId,
        imageType: 'generated',
        format: 'png'
      });

      logger.info('Image uploaded to R2', {
        userId,
        promptId,
        filename,
        sizeKB: (imageBuffer.length / 1024).toFixed(2)
      });

      return uploadResult.url;

    } catch (error) {
      logger.error('Failed to upload image to R2', {
        userId,
        promptId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Download image from URL
   * @param {string} imageUrl - Image URL
   * @returns {Promise<Buffer>} Image buffer
   */
  async downloadImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      return Buffer.from(response.data);

    } catch (error) {
      logger.error('Failed to download image', {
        imageUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upscale image using Real-ESRGAN
   * @param {string} generationId - Generation ID
   * @param {Buffer} imageBuffer - Original image buffer
   * @returns {Promise<void>}
   */
  async upscaleImage(generationId, imageBuffer) {
    try {
      logger.info('Starting image upscaling', { generationId });

      // Convert image buffer to base64 for upscaling
      const base64Image = imageBuffer.toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64Image}`;

      // Run Real-ESRGAN upscaling via Replicate
      const Replicate = require('replicate');
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
      });

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
              upscaled_at = NOW()
          WHERE id = $2
        `, [uploadResult.url, generationId]);

        logger.info('Image upscaling completed', {
          generationId,
          upscaledUrl: uploadResult.url
        });
      }

    } catch (error) {
      logger.error('Image upscaling failed', {
        generationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate batch of images
   * @param {string} userId - User ID
   * @param {number} count - Number of images to generate
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of generated images
   */
  async generateBatch(userId, count, options = {}) {
    const { mode = 'exploratory', provider = 'imagen-4-ultra' } = options;
    
    logger.info('Starting batch generation', {
      userId,
      count,
      mode,
      provider
    });

    const generations = [];
    
    // For batch generation, we'd typically create multiple prompts
    // For now, we'll use the same prompt logic but generate multiple images
    try {
      // Create a simple prompt for batch generation
      const promptText = "Fashion design, elegant garment, studio photography, high quality";
      
      // Create a prompt record
      const promptQuery = `
        INSERT INTO prompts (user_id, positive_prompt, json_spec, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id
      `;
      
      const promptResult = await db.query(promptQuery, [
        userId,
        promptText,
        { type: 'batch', mode, count }
      ]);

      const promptId = promptResult.rows[0].id;

      // Generate multiple images
      for (let i = 0; i < count; i++) {
        try {
          const generation = await this.generateImage(userId, promptId, { provider });
          generations.push(generation);
          
          logger.info('Batch generation progress', {
            userId,
            current: i + 1,
            total: count,
            generationId: generation.id
          });
          
        } catch (genError) {
          logger.error('Individual batch generation failed', {
            userId,
            index: i,
            error: genError.message
          });
          // Continue with remaining generations
        }
      }

      logger.info('Batch generation completed', {
        userId,
        requested: count,
        successful: generations.length
      });

      return generations;

    } catch (error) {
      logger.error('Batch generation failed', {
        userId,
        count,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new ImageGenerationAgent();