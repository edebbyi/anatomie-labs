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
   * Normalize provider names coming from various clients to match supported adapters
   * @param {string} provider - Raw provider identifier
   * @returns {string} Normalized provider identifier
   */
  normalizeProvider(provider) {
    const fallbackProvider = 'imagen-4-ultra';

    if (!provider) {
      return fallbackProvider;
    }

    const raw = String(provider).trim();
    if (!raw) {
      return fallbackProvider;
    }

    const normalized = raw.toLowerCase();
    const alias = normalized.replace(/[\s_]+/g, '-');

    if (
      alias === 'imagen-4-ultra' ||
      alias === 'imagen-4' ||
      alias === 'imagen4-ultra' ||
      alias === 'imagen4' ||
      alias === 'imagen' ||
      alias === 'google-imagen' ||
      alias === 'google-imagen-4' ||
      alias === 'google-imagen-4-ultra'
    ) {
      return 'imagen-4-ultra';
    }

    if (
      alias === 'stable-diffusion' ||
      alias === 'stable-diffusion-xl' ||
      alias === 'stable-diffusionxl' ||
      alias === 'stable-diffusion-1' ||
      alias === 'sdxl'
    ) {
      return 'stable-diffusion';
    }

    if (
      alias === 'dalle' ||
      alias === 'dall-e' ||
      alias === 'dalle-3' ||
      alias === 'dall-e-3'
    ) {
      logger.warn('Unsupported provider requested, falling back to Imagen-4 Ultra', {
        requestedProvider: raw,
        fallbackProvider
      });
      return fallbackProvider;
    }

    return raw;
  }

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

    const normalizedProvider = this.normalizeProvider(provider);

    logger.info('Image Generation Agent: Starting generation', { 
      userId, 
      promptId, 
      provider: normalizedProvider,
      requestedProvider: provider
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

      let providerUrl = null;

      if (normalizedProvider === 'imagen-4-ultra') {
        const result = await this.generateWithImagen(prompt.text, width, height);
        // Imagen-4 Ultra returns buffer directly
        if (result.buffer) {
          imageBuffer = result.buffer;
        } else if (result.url) {
          imageBuffer = await this.downloadImage(result.url);
        } else {
          throw new Error('No buffer or URL returned from Imagen-4 Ultra');
        }
        seed = result.seed;
        costCents = result.costCents;
        params = result.params;
        providerUrl = result.url || null;
      } else if (normalizedProvider === 'stable-diffusion') {
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
        providerUrl = result.url || null;
      } else {
        throw new Error(`Unsupported provider: ${normalizedProvider}`);
      }

      let uploadResult = null;
      let cdnUrl = null;
      let r2Key = null;

      if (r2Storage.isConfigured()) {
        try {
          uploadResult = await r2Storage.uploadImage(imageBuffer, {
            userId,
            imageType: 'generated',
            format: 'jpg'
          });
          cdnUrl = uploadResult.cdnUrl;
          r2Key = uploadResult.key;
        } catch (uploadError) {
          logger.warn('Image Generation Agent: R2 upload failed, using provider URL', {
            userId,
            promptId,
            error: uploadError.message
          });
        }
      } else {
        logger.warn('Image Generation Agent: R2 not configured, using provider URL', {
          userId,
          promptId
        });
      }

      if (!cdnUrl) {
        if (providerUrl) {
          cdnUrl = providerUrl;
        } else if (imageBuffer) {
          cdnUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        } else {
          throw new Error('Unable to determine CDN URL for generated image');
        }
      }

      // Save generation record
      const generation = await this.saveGeneration(userId, promptId, {
        url: cdnUrl,
        r2_key: r2Key,
        width,
        height,
        provider: normalizedProvider,
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
        provider: normalizedProvider,
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

      const firstItem = Array.isArray(output) && output.length > 0 ? output[0] : null;

      logger.info('Replicate API response received', { 
        outputType: typeof output,
        isArray: Array.isArray(output),
        outputLength: Array.isArray(output) ? output.length : 'N/A',
        firstItemType: firstItem ? typeof firstItem : null,
        firstItemKeys: firstItem && typeof firstItem === 'object'
          ? Object.keys(firstItem).slice(0, 6)
          : undefined
      });

      // Cost for Imagen-4 Ultra via Replicate: ~$0.02 per image
      const costCents = 2;

      let providerUrl = null;

      const convertOutputToBuffer = async (raw) => {
        if (!raw) return null;

        if (Buffer.isBuffer(raw)) {
          return raw.length ? raw : null;
        }

        if (raw instanceof Uint8Array) {
          return raw.length ? Buffer.from(raw) : null;
        }

        if (typeof raw === 'string') {
          if (!raw.trim()) return null;
          if (raw.startsWith('data:image')) {
            const base64Data = raw.split(',')[1];
            return base64Data ? Buffer.from(base64Data, 'base64') : null;
          }
          if (!providerUrl) {
            providerUrl = raw;
          }
          return this.downloadImage(raw);
        }

        if (Array.isArray(raw)) {
          for (const item of raw) {
            const buffer = await convertOutputToBuffer(item);
            if (buffer && buffer.length) {
              return buffer;
            }
          }
          return null;
        }

        if (typeof raw === 'object') {
          // Some Replicate outputs wrap the data in { buffer } or { data }
          if (raw.buffer) {
            return convertOutputToBuffer(raw.buffer);
          }

          if (Array.isArray(raw.data) && raw.data.every((value) => typeof value === 'number')) {
            return Buffer.from(raw.data);
          }

          if (typeof raw.base64 === 'string') {
            return Buffer.from(raw.base64, 'base64');
          }

          if (typeof raw.b64_json === 'string') {
            return Buffer.from(raw.b64_json, 'base64');
          }

          if (raw.Body && Array.isArray(raw.Body.data)) {
            return Buffer.from(raw.Body.data);
          }

          let candidateUrl =
            raw.url ||
            raw.href ||
            raw.uri ||
            raw.path ||
            raw.file ||
            raw.filepath ||
            raw.file_path ||
            raw.download_url ||
            raw.cdn_url ||
            raw.signed_url ||
            null;

          if (!candidateUrl && typeof raw.toString === 'function') {
            const potentialUrl = raw.toString();
            if (typeof potentialUrl === 'string' && potentialUrl.startsWith('http')) {
              candidateUrl = potentialUrl;
            }
          }

          if (!candidateUrl && typeof raw.getUrl === 'function') {
            try {
              const resolvedUrl = await raw.getUrl();
              if (resolvedUrl) {
                candidateUrl = resolvedUrl;
              }
            } catch (getUrlError) {
              logger.warn('Replicate output getUrl() failed', {
                error: getUrlError.message
              });
            }
          }

          if (!candidateUrl && typeof raw.getDownloadUrl === 'function') {
            try {
              const resolvedUrl = await raw.getDownloadUrl();
              if (resolvedUrl) {
                candidateUrl = resolvedUrl;
              }
            } catch (getUrlError) {
              logger.warn('Replicate output getDownloadUrl() failed', {
                error: getUrlError.message
              });
            }
          }

          if (candidateUrl) {
            if (!providerUrl) {
              providerUrl = candidateUrl;
            }
            return this.downloadImage(candidateUrl);
          }
        }

        return null;
      };

      const imageBuffer = await convertOutputToBuffer(output);

      if (!imageBuffer || imageBuffer.length === 0) {
        const outputPreview = Array.isArray(output) && output.length > 0
          ? typeof output[0]
          : typeof output;

        logger.error('Unsupported Replicate output format', {
          outputPreview,
          isArray: Array.isArray(output)
        });
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
        params,
        url: providerUrl
      };

    } catch (error) {
      logger.error('Replicate API call failed', { 
        error: error.message,
        stack: error.stack
      });

      if (process.env.NODE_ENV === 'development') {
        logger.warn('Using mock image for development', {
          reason: error.message
        });
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
    const { promptBuilder, ...generationOptions } = options || {};
    const PromptBuilderAgent = promptBuilder || require('./IntelligentPromptBuilder');
    const generations = [];

    // Generate varied prompts for each image
    for (let i = 0; i < count; i++) {
      try {
        // Add variation to ensure different prompts
        const variedOptions = {
          ...generationOptions,
          generationMethod: generationOptions.generationMethod || 'batch_generation',
          variationSeed: i, // Add seed for variation
          mode:
            generationOptions.mode ||
            (i % 3 === 0 ? 'exploratory' : i % 3 === 1 ? 'refinement' : 'creative'),
        };

        // Generate prompt with variation seed
        const prompt = await PromptBuilderAgent.generatePrompt(userId, variedOptions);

        const promptId = prompt?.prompt_id || prompt?.id;
        if (!promptId) {
          logger.error('Batch generation prompt missing ID', {
            index: i,
            hasPrompt: !!prompt,
            keys: prompt ? Object.keys(prompt) : [],
          });
          continue;
        }

        const promptText =
          pickFirstString(
            prompt?.positive_prompt,
            prompt?.text,
            prompt?.prompt,
            prompt?.display_text,
            prompt?.rendered
          ) || null;

        const promptMetadataRaw =
          (prompt && typeof prompt.metadata === 'object' && prompt.metadata) ||
          (prompt && typeof prompt.json_spec === 'object' && prompt.json_spec) ||
          {};

        const { metadata: normalizedPromptMetadata, tags: derivedTags } =
          normalizePromptMetadata(promptMetadataRaw);

        // Generate image
        const generation = await this.generateImage(userId, promptId, variedOptions);

        const existingTags = Array.isArray(generation.tags)
          ? generation.tags.filter((value) => typeof value === 'string' && value.trim())
          : [];

        generation.prompt_id = generation.prompt_id || promptId;
        generation.prompt_text = generation.prompt_text || promptText;
        generation.prompt_metadata =
          generation.prompt_metadata || promptMetadataRaw || {};
        generation.metadata = {
          ...(generation.metadata || {}),
          ...normalizedPromptMetadata,
        };
        if (!generation.metadata.generationMethod) {
          generation.metadata.generationMethod = 'batch_generation';
        }
        if (!generation.metadata.spec) {
          generation.metadata.spec = promptMetadataRaw;
        }
        if (!generation.metadata.generatedAt && generation.created_at) {
          generation.metadata.generatedAt = generation.created_at;
        }
        generation.tags = Array.from(new Set([...existingTags, ...derivedTags]));

        generations.push(generation);

        logger.info('Batch generation progress', {
          completed: i + 1,
          total: count,
          promptId,
          promptText: (prompt?.text || prompt?.positive_prompt || '').substring(0, 100) + '...',
        });
      } catch (error) {
        logger.error('Batch generation item failed', {
          index: i,
          error: error.message,
        });
      }
    }

    return generations;
  }
}

module.exports = new ImageGenerationAgent();
