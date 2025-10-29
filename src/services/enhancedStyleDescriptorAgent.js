/**
 * Enhanced Style Descriptor Agent (Anti-Hallucination Version)
 * 
 * Key improvements:
 * 1. Stricter prompts that enforce "only what you see"
 * 2. Integration with Validation Agent
 * 3. Multiple analysis passes for low-confidence results
 * 4. Explicit null handling for uncertain attributes
 */

const db = require('./database');
const logger = require('../utils/logger');
const Replicate = require('replicate');
const ValidationAgent = require('./validationAgent');

// Controlled vocabulary (same as before but with stricter validation)
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

class EnhancedStyleDescriptorAgent {
  /**
   * Analyze single image with anti-hallucination measures
   */
  async analyzeImage(image) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('Replicate API token not configured');
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    // Fetch image
    const imageBuffer = await this.fetchImage(image.url_original);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    logger.info('Enhanced Style Descriptor: Analyzing image', {
      imageId: image.id, 
      filename: image.filename
    });

    // Construct stricter prompt for structured extraction
    const prompt = `You are a professional fashion analyst with strict anti-hallucination protocols.
ONLY describe what you can clearly see in the image. If you're uncertain about any attribute, use null.

IMPORTANT RULES:
1. ONLY describe what you can clearly see in the image
2. If uncertain, use null - DO NOT guess or hallucinate
3. For colors, be extremely specific - if you see navy blue, say "navy", not "blue"
4. A DRESS is a single one-piece garment. Do NOT classify separate top+bottom combinations as "dress"
5. If you see a matching top and bottom (e.g., crop top + skirt in same fabric/pattern), classify as "two-piece" or "co-ord" or "matching set"
6. Focus on the PRIMARY garment if multiple items are shown
7. For ALL fields, if you cannot determine the value with high confidence, use null or empty array
8. Be conservative - it's better to say null than to guess

Extract the following attributes in JSON format:

{
  "garment_type": "one of: ${FASHION_ENUMS.garment_type.join(', ')}" or null,
  "is_two_piece": true/false or null (true if this is a matching top+bottom set),
  "silhouette": "one of: ${FASHION_ENUMS.silhouette.join(', ')}" or null,
  "fit": "one of: ${FASHION_ENUMS.fit.join(', ')}" or null,
  "neckline": "one of: ${FASHION_ENUMS.neckline.join(', ')}" or null,
  "sleeve_length": "one of: ${FASHION_ENUMS.sleeve_length.join(', ')}" or null,
  "fabric": "one of: ${FASHION_ENUMS.fabric.join(', ')}" or null,
  "finish": "one of: ${FASHION_ENUMS.finish.join(', ')}" or null,
  "texture": "one of: ${FASHION_ENUMS.texture.join(', ')}" or null,
  "color_palette": ["color1", "color2", "color3"] (MAX 3 DOMINANT colors ONLY, be precise) or [],
  "pattern": "one of: ${FASHION_ENUMS.pattern.join(', ')}" or null,
  "embellishments": ["feature1", "feature2"] or [],
  "lighting": {"type": "soft/hard/natural" or null, "direction": "front/side/back/45deg" or null},
  "camera": {"angle": "front/3/4 front/side/back" or null, "height": "eye level/high/low" or null},
  "background": "brief description" or null,
  "pose": "brief description" or null,
  "style_labels": [{"name": "style name", "score": 0.0-1.0}] (e.g., sport chic, minimalist tailoring, coastal prep) or [],
  "confidence": 0.0-1.0 (your confidence in this analysis - be honest),
  "reasoning": "brief explanation of your analysis, especially for uncertain attributes"
}

Return ONLY valid JSON. Be precise and use the controlled vocabulary. NEVER make up information.
If you're not confident about an attribute, use null.`;

    try {
      logger.info('Enhanced Style Descriptor: Calling Gemini 2.5 Flash for analysis', { 
        imageId: image.id, 
        filename: image.filename 
      });
      
      // Use Gemini 2.5 Flash via Replicate for vision analysis with conservative settings
      const output = await replicate.run(
        'google/gemini-2.5-flash',
        {
          input: {
            prompt: prompt,
            image: dataUri,
            max_output_tokens: 2048,
            temperature: 0.1 // Very low temperature for conservative outputs
          }
        }
      );

      // Parse response
      const responseText = Array.isArray(output) ? output.join('') : output;
      logger.info('Enhanced Style Descriptor: Raw response from Gemini', { 
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
      logger.info('Enhanced Style Descriptor: Parsed analysis', { 
        imageId: image.id,
        garmentType: analysis.garment_type,
        colorCount: Array.isArray(analysis.color_palette) ? analysis.color_palette.length : 0,
        confidence: analysis.confidence
      });

      // Validate and normalize
      const normalized = this.normalizeDescriptor(analysis);

      // If confidence is low, do a second pass
      if (normalized.confidence < 0.7) {
        logger.info('Enhanced Style Descriptor: Low confidence, doing second pass', {
          imageId: image.id,
          confidence: normalized.confidence
        });
        
        const secondPass = await this.secondPassAnalysis(image, normalized);
        if (secondPass.confidence > normalized.confidence) {
          logger.info('Enhanced Style Descriptor: Second pass improved confidence', {
            imageId: image.id,
            oldConfidence: normalized.confidence,
            newConfidence: secondPass.confidence
          });
          Object.assign(normalized, secondPass);
        }
      }

      // Store in database
      const descriptor = await this.saveDescriptor(image.id, image.user_id, normalized);
      logger.info('Enhanced Style Descriptor: Saved descriptor to database', { 
        imageId: image.id,
        descriptorId: descriptor.id
      });

      // Validate with Validation Agent to prevent hallucinations
      const validationResult = await ValidationAgent.validateDescriptor(descriptor, image.url_original);
      
      // If validation fails, use corrected descriptor
      if (!validationResult.is_valid && validationResult.corrected_descriptor) {
        logger.warn('Enhanced Style Descriptor: Validation failed, using corrected descriptor', {
          imageId: image.id,
          issues: validationResult.issues.length
        });
        
        // Update the descriptor with corrected values
        const correctedDescriptor = await this.updateDescriptor(descriptor.id, validationResult.corrected_descriptor);
        return correctedDescriptor;
      }

      return descriptor;
    } catch (error) {
      logger.error('Enhanced Style Descriptor: Analysis failed', { 
        imageId: image.id,
        filename: image.filename,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Second pass analysis for low-confidence results
   */
  async secondPassAnalysis(image, firstPass) {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    // Fetch image
    const imageBuffer = await this.fetchImage(image.url_original);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    // Focus on uncertain attributes
    const uncertainAttributes = [];
    for (const [key, value] of Object.entries(firstPass)) {
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        uncertainAttributes.push(key);
      }
    }

    if (uncertainAttributes.length === 0) {
      return firstPass; // No uncertain attributes
    }

    const focusedPrompt = `You are a professional fashion analyst doing a focused analysis.
The previous analysis had low confidence on these attributes: ${uncertainAttributes.join(', ')}.
Please focus ONLY on these attributes and provide your best assessment.

Previous analysis: ${JSON.stringify(firstPass)}

Focus ONLY on these uncertain attributes and provide your assessment:
${uncertainAttributes.map(attr => `- ${attr}`).join('\n')}

Return ONLY valid JSON with the updated attributes.`;

    try {
      const output = await replicate.run(
        'google/gemini-2.5-flash',
        {
          input: {
            prompt: focusedPrompt,
            image: dataUri,
            max_output_tokens: 1024,
            temperature: 0.05 // Even lower temperature for focused analysis
          }
        }
      );

      const responseText = Array.isArray(output) ? output.join('') : output;
      let jsonText = responseText;
      if (responseText.includes('```json')) {
        jsonText = responseText.split('```json')[1].split('```')[0].trim();
      } else if (responseText.includes('```')) {
        jsonText = responseText.split('```')[1].split('```')[0].trim();
      }

      const secondPass = JSON.parse(jsonText);
      
      // Merge with first pass
      const merged = { ...firstPass, ...secondPass };
      
      // Increase confidence slightly since we did a second pass
      merged.confidence = Math.min(1.0, merged.confidence + 0.1);
      
      return merged;
    } catch (error) {
      logger.warn('Second pass analysis failed, returning first pass', {
        imageId: image.id,
        error: error.message
      });
      return firstPass;
    }
  }

  /**
   * Normalize descriptor to ensure valid values
   */
  normalizeDescriptor(raw) {
    const normalized = {
      garment_type: this.validateEnum(raw.garment_type, FASHION_ENUMS.garment_type, true),
      is_two_piece: raw.is_two_piece === true || raw.is_two_piece === 'true' || null,
      silhouette: this.validateEnum(raw.silhouette, FASHION_ENUMS.silhouette, true),
      fit: this.validateEnum(raw.fit, FASHION_ENUMS.fit, true),
      neckline: this.validateEnum(raw.neckline, FASHION_ENUMS.neckline, true),
      sleeve_length: this.validateEnum(raw.sleeve_length, FASHION_ENUMS.sleeve_length, true),
      fabric: this.validateEnum(raw.fabric, FASHION_ENUMS.fabric, true),
      finish: this.validateEnum(raw.finish, FASHION_ENUMS.finish, true),
      texture: this.validateEnum(raw.texture, FASHION_ENUMS.texture, true),
      color_palette: Array.isArray(raw.color_palette) ? raw.color_palette.slice(0, 3) : [],
      pattern: this.validateEnum(raw.pattern, FASHION_ENUMS.pattern, true),
      embellishments: Array.isArray(raw.embellishments) ? raw.embellishments : [],
      lighting: raw.lighting || { type: null, direction: null },
      camera: raw.camera || { angle: null, height: null },
      background: raw.background || null,
      pose: raw.pose || null,
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
    if (!value) return null;
    
    const normalized = String(value).toLowerCase();
    if (allowedValues.includes(normalized)) {
      return normalized;
    }
    
    // Try partial matching
    const partialMatch = allowedValues.find(allowed => 
      normalized.includes(allowed) || allowed.includes(normalized)
    );
    
    return partialMatch || (allowNull ? null : allowedValues[0]);
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
      descriptor.is_two_piece || null,
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
   * Update descriptor in database
   */
  async updateDescriptor(descriptorId, updates) {
    const fields = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'image_id' && key !== 'user_id') {
        fields.push(`${key} = $${index}`);
        values.push(key.includes('palette') || key.includes('embellishments') || key.includes('lighting') || key.includes('camera') || key.includes('raw_analysis') || key.includes('style_labels') ? JSON.stringify(value) : value);
        index++;
      }
    }

    if (fields.length === 0) {
      return updates; // No updates needed
    }

    values.push(descriptorId);
    const query = `
      UPDATE image_descriptors
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${index}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
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
   * Get descriptor by ID
   */
  async getDescriptor(descriptorId) {
    const query = `SELECT * FROM image_descriptors WHERE id = $1`;
    const result = await db.query(query, [descriptorId]);
    return result.rows[0];
  }
}

module.exports = new EnhancedStyleDescriptorAgent();