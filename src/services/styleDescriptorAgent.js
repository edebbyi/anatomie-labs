/**
 * Style Descriptor Agent & Microdata-to-JSON Agent
 * 
 * Extracts high-level style labels and produces structured fashion JSON
 * with normalized attributes using Gemini 2.5 Flash vision.
 */

const db = require('./database');
const logger = require('../utils/logger');
const Replicate = require('replicate');

// Controlled vocabulary for validation
const FASHION_ENUMS = {
  garment_type: ['dress', 'blazer', 'pants', 'skirt', 'coat', 'jacket', 'top', 'blouse', 'shirt', 'sweater', 'cardigan', 'shorts', 'jeans', 'chinos', 'suit', 'jumpsuit', 'romper', 'two-piece', 'co-ord', 'matching set'],
  silhouette: ['a-line', 'straight', 'oversized', 'fitted', 'relaxed', 'bodycon', 'empire', 'shift', 'wrap', 'peplum', 'balloon', 'pencil'],
  fit: ['tailored', 'relaxed', 'slim', 'oversized', 'regular', 'loose', 'tight', 'custom'],
  neckline: ['crew', 'v-neck', 'halter', 'boat', 'scoop', 'square', 'sweetheart', 'off-shoulder', 'turtleneck', 'cowl', 'one-shoulder'],
  sleeve_length: ['sleeveless', 'short', '3/4', 'long', 'cap', 'bell', 'bishop'],
  fabric: ['linen', 'silk', 'cotton', 'wool', 'denim', 'satin', 'chiffon', 'velvet', 'leather', 'cashmere', 'polyester', 'rayon', 'tweed', 'jersey'],
  finish: ['matte', 'glossy', 'sheen', 'metallic', 'brushed', 'distressed'],
  texture: ['smooth', 'ribbed', 'quilted', 'textured', 'embossed', 'pleated', 'ruched'],
  pattern: ['solid', 'stripe', 'floral', 'polka dot', 'plaid', 'checkered', 'animal print', 'geometric', 'abstract', 'paisley']
};

class StyleDescriptorAgent {
  /**
   * Analyze all images in a portfolio and extract descriptors
   * @param {string} portfolioId - Portfolio ID
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Analysis results
   */
  async analyzePortfolio(portfolioId, progressCallback = null) {
    logger.info('Style Descriptor Agent: Starting portfolio analysis', { portfolioId });

    // Get portfolio images
    const images = await this.getPortfolioImages(portfolioId);
    
    if (images.length === 0) {
      throw new Error('No images found in portfolio');
    }

    const results = {
      analyzed: 0,
      failed: 0,
      descriptors: []
    };

    // Parallel processing configuration
    // Higher concurrency = faster but more API load
    // Default: 5 concurrent requests (good balance)
    // Can be adjusted via ANALYSIS_CONCURRENCY env var
    const CONCURRENCY_LIMIT = parseInt(process.env.ANALYSIS_CONCURRENCY || '5', 10);
    const batches = [];
    
    // Split images into batches for parallel processing
    for (let i = 0; i < images.length; i += CONCURRENCY_LIMIT) {
      batches.push(images.slice(i, i + CONCURRENCY_LIMIT));
    }

    logger.info('Style Descriptor Agent: Processing in parallel', {
      totalImages: images.length,
      batchCount: batches.length,
      concurrency: CONCURRENCY_LIMIT
    });

    let processedCount = 0;

    // Process each batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Process all images in this batch simultaneously
      const batchPromises = batch.map(async (image, indexInBatch) => {
        const globalIndex = batchIndex * CONCURRENCY_LIMIT + indexInBatch;
        
        try {
          const descriptor = await this.analyzeImage(image);
          results.descriptors.push(descriptor);
          results.analyzed++;
          processedCount++;
          
          // Send progress update
          if (progressCallback) {
            progressCallback({
              current: processedCount,
              total: images.length,
              percentage: Math.round((processedCount / images.length) * 100),
              currentImage: image.filename,
              analyzed: results.analyzed,
              failed: results.failed
            });
          }
          
          return { success: true, descriptor };
        } catch (error) {
          logger.error('Style Descriptor Agent: Failed to analyze image', { 
            imageId: image.id,
            filename: image.filename,
            error: error.message 
          });
          results.failed++;
          processedCount++;
          
          // Send progress update even for failures
          if (progressCallback) {
            progressCallback({
              current: processedCount,
              total: images.length,
              percentage: Math.round((processedCount / images.length) * 100),
              currentImage: image.filename,
              analyzed: results.analyzed,
              failed: results.failed,
              error: error.message
            });
          }
          
          return { success: false, error: error.message };
        }
      });

      // Wait for all images in this batch to complete
      await Promise.all(batchPromises);
      
      logger.info('Style Descriptor Agent: Batch complete', { 
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        processed: processedCount,
        total: images.length
      });
    }

    logger.info('Style Descriptor Agent: Completed', { 
      portfolioId,
      analyzed: results.analyzed,
      failed: results.failed,
      totalTime: 'parallelized'
    });

    return results;
  }

  /**
   * Analyze single image and extract microdata
   * @param {Object} image - Image record
   * @returns {Promise<Object>} Descriptor record
   */
  async analyzeImage(image) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('Replicate API token not configured');
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    // Fetch image from URL
    const imageBuffer = await this.fetchImage(image.url_original);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    // Log image fetch for debugging
    logger.info('Style Descriptor Agent: Fetched image for analysis', { 
      imageId: image.id, 
      filename: image.filename,
      url: image.url_original,
      sizeKB: (imageBuffer.length / 1024).toFixed(2)
    });

    // Construct prompt for structured extraction
    const prompt = `You are a professional fashion analyst. Analyze this fashion image and identify the MAIN garment shown.

IMPORTANT RULES:
1. Identify only ONE primary garment type per image
2. If you see a matching top and bottom (e.g., crop top + skirt in same fabric/pattern), classify as "two-piece" or "co-ord" or "matching set"
3. A DRESS is a single one-piece garment. Do NOT classify separate top+bottom combinations as "dress"
4. If uncertain between dress and two-piece, look for:
   - Dress: Continuous fabric from top to bottom, single garment
   - Two-piece: Visible separation/gap between top and bottom, different pieces
5. Focus on the PRIMARY garment if multiple items are shown
6. For colors, be very specific and accurate. Do NOT guess or hallucinate colors not present.
7. For ALL fields, if you cannot determine the value, use null or empty array, but NEVER make up values.

Extract the following attributes in JSON format:

{
  "garment_type": "one of: ${FASHION_ENUMS.garment_type.join(', ')}",
  "is_two_piece": true/false (true if this is a matching top+bottom set),
  "silhouette": "one of: ${FASHION_ENUMS.silhouette.join(', ')}",
  "fit": "one of: ${FASHION_ENUMS.fit.join(', ')}",
  "neckline": "one of: ${FASHION_ENUMS.neckline.join(', ')} or null if not visible",
  "sleeve_length": "one of: ${FASHION_ENUMS.sleeve_length.join(', ')} or null if not visible",
  "fabric": "one of: ${FASHION_ENUMS.fabric.join(', ')}",
  "finish": "one of: ${FASHION_ENUMS.finish.join(', ')}",
  "texture": "one of: ${FASHION_ENUMS.texture.join(', ')}",
  "color_palette": ["color1", "color2", "color3"] (max 3 DOMINANT colors ONLY, be precise),
  "pattern": "one of: ${FASHION_ENUMS.pattern.join(', ')}",
  "embellishments": ["feature1", "feature2"] or [],
  "lighting": {"type": "soft/hard/natural", "direction": "front/side/back/45deg"},
  "camera": {"angle": "front/3/4 front/side/back", "height": "eye level/high/low"},
  "background": "brief description",
  "pose": "brief description",
  "style_labels": [{"name": "style name", "score": 0.0-1.0}] (e.g., sport chic, minimalist tailoring, coastal prep),
  "confidence": 0.0-1.0 (your confidence in this analysis),
  "reasoning": "brief explanation of why you chose this garment_type (especially for dress vs two-piece)"
}

Return ONLY valid JSON. Be precise and use the controlled vocabulary. NEVER make up information.`;

    try {
      logger.info('Style Descriptor Agent: Calling Gemini 2.5 Flash for analysis', { 
        imageId: image.id, 
        filename: image.filename 
      });
      
      // Use Gemini 2.5 Flash via Replicate for vision analysis
      const output = await replicate.run(
        'google/gemini-2.5-flash',
        {
          input: {
            prompt: prompt,
            image: dataUri,
            max_output_tokens: 2048,
            temperature: 0.2
          }
        }
      );

      // Parse response
      const responseText = Array.isArray(output) ? output.join('') : output;
      logger.info('Style Descriptor Agent: Raw response from Gemini', { 
        imageId: image.id,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 200) + '...'
      });
      
      // Extract JSON from response (handle markdown code blocks)
      let jsonText = responseText;
      if (responseText.includes('```json')) {
        jsonText = responseText.split('```json')[1].split('```')[0].trim();
      } else if (responseText.includes('```')) {
        jsonText = responseText.split('```')[1].split('```')[0].trim();
      }

      const analysis = JSON.parse(jsonText);
      logger.info('Style Descriptor Agent: Parsed analysis', { 
        imageId: image.id,
        garmentType: analysis.garment_type,
        colorCount: Array.isArray(analysis.color_palette) ? analysis.color_palette.length : 0
      });

      // Validate and normalize
      const normalized = this.normalizeDescriptor(analysis);

      // Store in database
      const descriptor = await this.saveDescriptor(image.id, image.user_id, normalized);
      logger.info('Style Descriptor Agent: Saved descriptor to database', { 
        imageId: image.id,
        descriptorId: descriptor.id
      });

      return descriptor;
    } catch (error) {
      logger.error('Gemini via Replicate analysis failed', { 
        imageId: image.id,
        filename: image.filename,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Normalize descriptor to ensure valid values
   */
  normalizeDescriptor(raw) {
    const normalized = {
      garment_type: this.validateEnum(raw.garment_type, FASHION_ENUMS.garment_type),
      is_two_piece: raw.is_two_piece === true || raw.is_two_piece === 'true',
      silhouette: this.validateEnum(raw.silhouette, FASHION_ENUMS.silhouette),
      fit: this.validateEnum(raw.fit, FASHION_ENUMS.fit),
      neckline: this.validateEnum(raw.neckline, FASHION_ENUMS.neckline, true),
      sleeve_length: this.validateEnum(raw.sleeve_length, FASHION_ENUMS.sleeve_length, true),
      fabric: this.validateEnum(raw.fabric, FASHION_ENUMS.fabric),
      finish: this.validateEnum(raw.finish, FASHION_ENUMS.finish),
      texture: this.validateEnum(raw.texture, FASHION_ENUMS.texture),
      color_palette: Array.isArray(raw.color_palette) ? raw.color_palette.slice(0, 3) : [],
      pattern: this.validateEnum(raw.pattern, FASHION_ENUMS.pattern),
      embellishments: Array.isArray(raw.embellishments) ? raw.embellishments : [],
      lighting: raw.lighting || { type: 'unknown', direction: 'unknown' },
      camera: raw.camera || { angle: 'front', height: 'eye level' },
      background: raw.background || 'unknown',
      pose: raw.pose || 'standing',
      style_labels: Array.isArray(raw.style_labels) ? raw.style_labels : [],
      confidence: parseFloat(raw.confidence) || 0.5,
      reasoning: raw.reasoning || '',
      raw_analysis: raw
    };

    return normalized;
  }

  /**
   * Validate enum value
   */
  validateEnum(value, allowedValues, allowNull = false) {
    if (!value && allowNull) return null;
    
    const normalized = String(value).toLowerCase();
    if (allowedValues.includes(normalized)) {
      return normalized;
    }
    
    // Fallback to first value
    return allowedValues[0];
  }

  /**
   * Save descriptor to database
   */
  async saveDescriptor(imageId, userId, descriptor) {
    const query = `
      INSERT INTO image_descriptors (
        image_id, user_id, garment_type, is_two_piece, silhouette, fit, neckline,
        sleeve_length, fabric, finish, texture, color_palette, pattern,
        embellishments, lighting, camera, background, pose, raw_analysis, confidence, reasoning
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      ON CONFLICT (image_id) DO UPDATE SET
        garment_type = EXCLUDED.garment_type,
        is_two_piece = EXCLUDED.is_two_piece,
        silhouette = EXCLUDED.silhouette,
        fit = EXCLUDED.fit,
        neckline = EXCLUDED.neckline,
        sleeve_length = EXCLUDED.sleeve_length,
        fabric = EXCLUDED.fabric,
        finish = EXCLUDED.finish,
        texture = EXCLUDED.texture,
        color_palette = EXCLUDED.color_palette,
        pattern = EXCLUDED.pattern,
        embellishments = EXCLUDED.embellishments,
        lighting = EXCLUDED.lighting,
        camera = EXCLUDED.camera,
        background = EXCLUDED.background,
        pose = EXCLUDED.pose,
        raw_analysis = EXCLUDED.raw_analysis,
        confidence = EXCLUDED.confidence,
        reasoning = EXCLUDED.reasoning
      RETURNING *
    `;

    const result = await db.query(query, [
      imageId,
      userId,
      descriptor.garment_type,
      descriptor.is_two_piece || false,
      descriptor.silhouette,
      descriptor.fit,
      descriptor.neckline,
      descriptor.sleeve_length,
      descriptor.fabric,
      descriptor.finish,
      descriptor.texture,
      JSON.stringify(descriptor.color_palette),
      descriptor.pattern,
      JSON.stringify(descriptor.embellishments),
      JSON.stringify(descriptor.lighting),
      JSON.stringify(descriptor.camera),
      descriptor.background,
      descriptor.pose,
      JSON.stringify(descriptor.raw_analysis),
      descriptor.confidence,
      descriptor.reasoning || null
    ]);

    return result.rows[0];
  }

  /**
   * Get portfolio images
   */
  async getPortfolioImages(portfolioId) {
    const query = `
      SELECT id, user_id, url_original, filename
      FROM portfolio_images
      WHERE portfolio_id = $1
      ORDER BY created_at
    `;

    const result = await db.query(query, [portfolioId]);
    return result.rows;
  }

  /**
   * Fetch image from URL
   */
  async fetchImage(url) {
    // If R2 URL, fetch directly
    if (url.startsWith('http')) {
      const axios = require('axios');
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    }
    
    throw new Error('Invalid image URL');
  }

  /**
   * Get descriptors for portfolio
   */
  async getDescriptors(portfolioId) {
    const query = `
      SELECT d.*
      FROM image_descriptors d
      JOIN portfolio_images pi ON d.image_id = pi.id
      WHERE pi.portfolio_id = $1
    `;

    const result = await db.query(query, [portfolioId]);
    return result.rows;
  }
}

module.exports = new StyleDescriptorAgent();
