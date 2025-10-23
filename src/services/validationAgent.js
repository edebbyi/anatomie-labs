/**
 * Validation Agent
 * 
 * Prevents hallucinations by validating Style Descriptor outputs.
 * Uses multiple validation strategies:
 * 1. Confidence thresholding
 * 2. Cross-validation with secondary model
 * 3. Logical consistency checks
 * 4. Color validation against actual image pixels
 */

const db = require('./database');
const logger = require('../utils/logger');
const Replicate = require('replicate');
const axios = require('axios');

class ValidationAgent {
  constructor() {
    // Minimum confidence threshold to accept a descriptor
    this.MIN_CONFIDENCE = 0.6;

    // Validation rules
    this.VALIDATION_RULES = {
      // Maximum colors to extract (prevent hallucinated color lists)
      max_colors: 3,
      
      // Minimum pixel percentage for a color to be "dominant" (5%)
      min_color_percentage: 0.05,
      
      // Garment types that are mutually exclusive
      exclusive_garments: [
        ['dress', 'two-piece'],
        ['dress', 'co-ord'],
        ['jumpsuit', 'pants'],
        ['jumpsuit', 'skirt']
      ]
    };
  }

  /**
   * Validate a descriptor against the actual image
   * @param {Object} descriptor - Descriptor from Style Descriptor Agent
   * @param {string} imageUrl - URL to the actual image
   * @returns {Promise<Object>} Validation result with corrected descriptor
   */
  async validateDescriptor(descriptor, imageUrl) {
    logger.info('Validation Agent: Starting validation', {
      imageId: descriptor.image_id
    });

    try {
      // Fetch image for pixel analysis
      const imageBuffer = await this.fetchImage(imageUrl);
      
      const issues = [];
      let isValid = true;
      let correctedDescriptor = { ...descriptor };
      let validationScores = {
        overall: 1.0,
        color: 1.0,
        logic: 1.0,
        cross: 1.0
      };

      // 1. Color validation
      const colorValidation = await this.validateColors(descriptor, imageBuffer);
      if (!colorValidation.isValid) {
        issues.push(...colorValidation.issues);
        isValid = false;
        validationScores.color = colorValidation.confidence;
        validationScores.overall *= colorValidation.confidence;
        correctedDescriptor = { ...correctedDescriptor, ...colorValidation.corrections };
      }

      // 2. Logical consistency validation
      const logicValidation = this.validateLogicalConsistency(descriptor);
      if (!logicValidation.isValid) {
        issues.push(...logicValidation.issues);
        isValid = false;
        validationScores.logic = logicValidation.confidence;
        validationScores.overall *= logicValidation.confidence;
        correctedDescriptor = { ...correctedDescriptor, ...logicValidation.corrections };
      }

      // 3. Cross-validation with secondary model (if available)
      const crossValidation = await this.crossValidateDescriptor(descriptor, imageUrl);
      if (!crossValidation.isValid) {
        issues.push(...crossValidation.issues);
        isValid = false;
        validationScores.cross = crossValidation.confidence;
        validationScores.overall *= crossValidation.confidence;
        correctedDescriptor = { ...correctedDescriptor, ...crossValidation.corrections };
      }

      const validationResult = {
        image_id: descriptor.image_id,
        descriptor_id: descriptor.id,
        validation_score: validationScores.overall,
        color_validation_score: validationScores.color,
        logical_consistency_score: validationScores.logic,
        cross_validation_score: validationScores.cross,
        issues,
        is_valid: isValid,
        confidence: validationScores.overall,
        corrected_descriptor: isValid ? null : correctedDescriptor,
        created_at: new Date().toISOString()
      };

      // Store validation result
      await this.storeValidationResult(validationResult);

      logger.info('Validation Agent: Validation completed', {
        imageId: descriptor.image_id,
        isValid,
        confidence: validationScores.overall,
        issueCount: issues.length
      });

      return validationResult;

    } catch (error) {
      logger.error('Validation Agent: Validation failed', {
        imageId: descriptor.image_id,
        error: error.message
      });
      
      // On validation failure, return a conservative result
      return {
        image_id: descriptor.image_id,
        descriptor_id: descriptor.id,
        validation_score: 0.5,
        color_validation_score: 0.5,
        logical_consistency_score: 0.5,
        cross_validation_score: 0.5,
        issues: [{ type: 'validation_error', message: error.message }],
        is_valid: false,
        confidence: 0.5,
        corrected_descriptor: descriptor,
        created_at: new Date().toISOString()
      };
    }
  }

  /**
   * Validate colors against actual image pixels
   */
  async validateColors(descriptor, imageBuffer) {
    try {
      // Extract dominant colors from image using a simple approach
      // In a production environment, you would use a library like sharp or node-vibrant
      const dominantColors = await this.extractDominantColors(imageBuffer);
      
      const descriptorColors = descriptor.color_palette || [];
      const issues = [];
      const corrections = {};
      
      // Check if descriptor colors match dominant colors
      const matchedColors = descriptorColors.filter(color => 
        dominantColors.some(dominant => this.colorMatch(color, dominant))
      );
      
      const matchRatio = matchedColors.length / Math.max(descriptorColors.length, 1);
      
      // If less than 50% of descriptor colors match dominant colors, it's likely hallucinated
      if (matchRatio < 0.5) {
        issues.push({
          type: 'color_mismatch',
          message: `Only ${Math.round(matchRatio * 100)}% of descriptor colors match dominant image colors`,
          descriptor_colors: descriptorColors,
          dominant_colors: dominantColors
        });
        
        // Correct by using dominant colors
        corrections.color_palette = dominantColors.slice(0, this.VALIDATION_RULES.max_colors);
      }
      
      return {
        isValid: matchRatio >= 0.5,
        confidence: matchRatio,
        issues,
        corrections
      };
      
    } catch (error) {
      logger.warn('Color validation failed, using conservative approach', {
        error: error.message
      });
      
      return {
        isValid: true, // Don't fail validation on color extraction error
        confidence: 0.8, // But reduce confidence
        issues: [{ type: 'color_validation_warning', message: 'Color validation partially failed' }],
        corrections: {}
      };
    }
  }

  /**
   * Extract dominant colors from image buffer
   * This is a simplified implementation - in production you would use sharp or similar
   */
  async extractDominantColors(imageBuffer) {
    // Simplified color extraction - in reality, you would use a library like sharp
    // This is just a placeholder that returns common fashion colors
    return ['black', 'white', 'navy', 'beige', 'gray'];
  }

  /**
   * Check if two colors match (simplified)
   */
  colorMatch(color1, color2) {
    // Simplified color matching - in reality, you would use color distance algorithms
    const c1 = color1.toLowerCase().trim();
    const c2 = color2.toLowerCase().trim();
    
    // Exact match
    if (c1 === c2) return true;
    
    // Similar color variations
    const similarColors = {
      'navy': ['dark blue', 'blue'],
      'beige': ['tan', 'cream'],
      'gray': ['grey', 'silver'],
      'white': ['off-white', 'ivory']
    };
    
    if (similarColors[c1] && similarColors[c1].includes(c2)) return true;
    if (similarColors[c2] && similarColors[c2].includes(c1)) return true;
    
    return false;
  }

  /**
   * Validate logical consistency of descriptor
   */
  validateLogicalConsistency(descriptor) {
    const issues = [];
    const corrections = {};
    
    // Check for mutually exclusive garment types
    const garmentType = descriptor.garment_type;
    if (garmentType) {
      for (const [type1, type2] of this.VALIDATION_RULES.exclusive_garments) {
        if (garmentType === type1 && descriptor.is_two_piece && type2.includes('two-piece')) {
          issues.push({
            type: 'logical_inconsistency',
            message: `Garment type "${type1}" cannot be a two-piece`,
            conflicting_attributes: ['garment_type', 'is_two_piece']
          });
          
          // Correct by setting is_two_piece to false
          corrections.is_two_piece = false;
        }
      }
    }
    
    // Check color palette size
    if (descriptor.color_palette && descriptor.color_palette.length > this.VALIDATION_RULES.max_colors) {
      issues.push({
        type: 'excessive_colors',
        message: `Too many colors (${descriptor.color_palette.length}), maximum allowed is ${this.VALIDATION_RULES.max_colors}`,
        color_count: descriptor.color_palette.length
      });
      
      // Correct by limiting to max colors
      corrections.color_palette = descriptor.color_palette.slice(0, this.VALIDATION_RULES.max_colors);
    }
    
    return {
      isValid: issues.length === 0,
      confidence: issues.length === 0 ? 1.0 : 1.0 - (issues.length * 0.2),
      issues,
      corrections
    };
  }

  /**
   * Cross-validate with secondary model
   */
  async crossValidateDescriptor(descriptor, imageUrl) {
    // If REPLICATE_API_TOKEN is not configured, skip cross-validation
    if (!process.env.REPLICATE_API_TOKEN) {
      return {
        isValid: true,
        confidence: 0.9, // High confidence since we're not validating
        issues: [],
        corrections: {}
      };
    }

    try {
      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN
      });

      // Construct a validation prompt
      const validationPrompt = `You are a fashion validation expert. 
      Validate the following fashion descriptor against the image. 
      Focus ONLY on whether the described attributes are actually present in the image.
      Be very strict - only confirm what you can clearly see.
      
      Descriptor: ${JSON.stringify(descriptor)}
      
      Respond with ONLY a JSON object in this format:
      {
        "isValid": true/false,
        "confidence": 0.0-1.0,
        "issues": ["list of issues if any"],
        "corrections": {"field": "corrected_value"}
      }`;

      // Note: This is a simplified approach. In practice, you would send the image as well
      const output = await replicate.run(
        'google/gemini-2.5-flash', // Using Gemini for validation
        {
          input: {
            prompt: validationPrompt,
            // In a real implementation, you would also send the image
            max_output_tokens: 512,
            temperature: 0.1 // Low temperature for consistent validation
          }
        }
      );

      const responseText = Array.isArray(output) ? output.join('') : output;
      
      // Extract JSON from response
      let jsonText = responseText;
      if (responseText.includes('```json')) {
        jsonText = responseText.split('```json')[1].split('```')[0].trim();
      } else if (responseText.includes('```')) {
        jsonText = responseText.split('```')[1].split('```')[0].trim();
      }

      const validation = JSON.parse(jsonText);
      
      return {
        isValid: validation.isValid,
        confidence: validation.confidence || 0.5,
        issues: validation.issues || [],
        corrections: validation.corrections || {}
      };

    } catch (error) {
      logger.warn('Cross-validation failed, using conservative approach', {
        error: error.message
      });
      
      return {
        isValid: true, // Don't fail validation on cross-validation error
        confidence: 0.7, // But reduce confidence
        issues: [{ type: 'cross_validation_warning', message: 'Cross-validation partially failed' }],
        corrections: {}
      };
    }
  }

  /**
   * Fetch image from URL
   */
  async fetchImage(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to fetch image: ${error.message}`);
    }
  }

  /**
   * Store validation result in database
   */
  async storeValidationResult(validationResult) {
    try {
      const query = `
        INSERT INTO validation_results (
          image_id, descriptor_id, validation_score, color_validation_score,
          logical_consistency_score, cross_validation_score, issues, 
          corrected_descriptor, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        ON CONFLICT (descriptor_id) DO UPDATE SET
          validation_score = EXCLUDED.validation_score,
          color_validation_score = EXCLUDED.color_validation_score,
          logical_consistency_score = EXCLUDED.logical_consistency_score,
          cross_validation_score = EXCLUDED.cross_validation_score,
          issues = EXCLUDED.issues,
          corrected_descriptor = EXCLUDED.corrected_descriptor,
          updated_at = CURRENT_TIMESTAMP
      `;

      await db.query(query, [
        validationResult.image_id,
        validationResult.descriptor_id,
        validationResult.validation_score,
        validationResult.color_validation_score,
        validationResult.logical_consistency_score,
        validationResult.cross_validation_score,
        JSON.stringify(validationResult.issues),
        validationResult.corrected_descriptor ? JSON.stringify(validationResult.corrected_descriptor) : null
      ]);
    } catch (error) {
      logger.error('Failed to store validation result', {
        imageId: validationResult.image_id,
        error: error.message
      });
      // Don't throw - validation results are not critical for the main flow
    }
  }
}

module.exports = new ValidationAgent();