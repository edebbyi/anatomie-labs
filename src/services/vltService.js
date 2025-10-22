const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class VLTService {
  constructor() {
    this.apiUrl = process.env.VLT_API_URL || 'https://visual-descriptor-516904417440.us-central1.run.app';
    this.apiKey = process.env.VLT_API_KEY;
    this.defaultModel = process.env.VLT_DEFAULT_MODEL || 'gemini';
    this.defaultPasses = process.env.VLT_DEFAULT_PASSES || 'A,B,C';
    
    if (!this.apiKey) {
      logger.warn('VLT_API_KEY not configured. VLT functionality will be disabled.');
    }
  }

  /**
   * Check if VLT service is available
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.apiUrl}/healthz`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.error('VLT health check failed:', error.message);
      return false;
    }
  }

  /**
   * Analyze a single image using VLT with automatic fallback
   * @param {string|Buffer} imageInput - File path or buffer
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>}
   */
  async analyzeImage(imageInput, options = {}) {
    if (!this.apiKey) {
      throw new Error('VLT API key not configured');
    }

    const requestedModel = options.model || this.defaultModel;
    const fallbackModel = requestedModel === 'gemini' ? 'openai' : null;

    try {
      return await this._attemptImageAnalysis(imageInput, {
        ...options,
        model: requestedModel
      });
    } catch (primaryError) {
      logger.error(`VLT image analysis failed with ${requestedModel}:`, primaryError.message);
      
      // Try fallback model if available
      if (fallbackModel) {
        logger.info(`Attempting fallback to ${fallbackModel} model...`);
        try {
          const result = await this._attemptImageAnalysis(imageInput, {
            ...options,
            model: fallbackModel
          });
          
          // Add fallback info to result
          result.fallback = {
            originalModel: requestedModel,
            usedModel: fallbackModel,
            reason: primaryError.message
          };
          
          logger.info(`Fallback to ${fallbackModel} successful`);
          return result;
        } catch (fallbackError) {
          logger.error(`Fallback to ${fallbackModel} also failed:`, fallbackError.message);
          throw new Error(
            `VLT analysis failed with both ${requestedModel} and ${fallbackModel}. ` +
            `Primary error: ${primaryError.message}. Fallback error: ${fallbackError.message}`
          );
        }
      }
      
      throw new Error(`VLT analysis failed: ${primaryError.message}`);
    }
  }

  /**
   * Internal method to attempt single image analysis with a specific model
   * @private
   */
  async _attemptImageAnalysis(imageInput, options) {
    const formData = new FormData();
    
    // Handle different input types
    if (typeof imageInput === 'string') {
      // File path
      if (!fs.existsSync(imageInput)) {
        throw new Error(`Image file not found: ${imageInput}`);
      }
      formData.append('file', fs.createReadStream(imageInput));
    } else if (Buffer.isBuffer(imageInput)) {
      // Buffer
      formData.append('file', imageInput, { filename: 'image.jpg' });
    } else {
      throw new Error('Invalid image input type');
    }

    // Add analysis parameters
    formData.append('passes', options.passes || this.defaultPasses);
    formData.append('model', options.model);

    const response = await axios.post(`${this.apiUrl}/v1/jobs`, formData, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...formData.getHeaders()
      },
      timeout: 30000 // 30 second timeout
    });

    return this.processVLTResponse(response.data);
  }

  /**
   * Analyze multiple images from a ZIP file with automatic fallback
   * @param {string|Buffer} zipInput - ZIP file path or buffer
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>}
   */
  async analyzeBatch(zipInput, options = {}) {
    if (!this.apiKey) {
      throw new Error('VLT API key not configured');
    }

    const requestedModel = options.model || this.defaultModel;
    const fallbackModel = requestedModel === 'gemini' ? 'openai' : null;

    try {
      return await this._attemptBatchAnalysis(zipInput, {
        ...options,
        model: requestedModel
      });
    } catch (primaryError) {
      logger.error(`VLT batch analysis failed with ${requestedModel}:`, primaryError.message);
      
      // Try fallback model if available
      if (fallbackModel) {
        logger.info(`Attempting fallback to ${fallbackModel} model...`);
        try {
          const result = await this._attemptBatchAnalysis(zipInput, {
            ...options,
            model: fallbackModel
          });
          
          // Add fallback info to result
          result.fallback = {
            originalModel: requestedModel,
            usedModel: fallbackModel,
            reason: primaryError.message
          };
          
          logger.info(`Fallback to ${fallbackModel} successful`);
          return result;
        } catch (fallbackError) {
          logger.error(`Fallback to ${fallbackModel} also failed:`, fallbackError.message);
          throw new Error(
            `VLT batch analysis failed with both ${requestedModel} and ${fallbackModel}. ` +
            `Primary error: ${primaryError.message}. Fallback error: ${fallbackError.message}`
          );
        }
      }
      
      throw new Error(`VLT batch analysis failed: ${primaryError.message}`);
    }
  }

  /**
   * Internal method to attempt batch analysis with a specific model
   * @private
   */
  async _attemptBatchAnalysis(zipInput, options) {
    const formData = new FormData();
    
    // Handle different input types
    if (typeof zipInput === 'string') {
      if (!fs.existsSync(zipInput)) {
        throw new Error(`ZIP file not found: ${zipInput}`);
      }
      formData.append('file', fs.createReadStream(zipInput));
    } else if (Buffer.isBuffer(zipInput)) {
      formData.append('file', zipInput, { filename: 'batch.zip' });
    } else {
      throw new Error('Invalid ZIP input type');
    }

    formData.append('passes', options.passes || this.defaultPasses);
    formData.append('model', options.model);

    const response = await axios.post(`${this.apiUrl}/v1/jobs`, formData, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...formData.getHeaders()
      },
      timeout: 120000 // 2 minute timeout for batch processing
    });

    return this.processVLTResponse(response.data);
  }

  /**
   * Process and normalize VLT API response
   * @param {Object} rawResponse - Raw response from VLT API
   * @returns {Object} Processed response
   */
  processVLTResponse(rawResponse) {
    try {
      const { job_id, status, records, backend, model } = rawResponse;
      
      if (status !== 'completed') {
        throw new Error(`VLT job not completed. Status: ${status}`);
      }

      const processedRecords = records.map(record => ({
        imageId: record.image_id,
        garmentType: record.garment_type,
        silhouette: record.silhouette,
        fabric: {
          type: record.fabric?.type,
          texture: record.fabric?.texture,
          weight: record.fabric?.weight,
          finish: record.fabric?.finish
        },
        colors: {
          primary: record.colors?.primary,
          secondary: record.colors?.secondary,
          pattern: record.colors?.pattern
        },
        construction: {
          seams: record.construction?.seams,
          closure: record.construction?.closure,
          details: record.construction?.details
        },
        style: {
          aesthetic: record.style?.aesthetic,
          formality: record.style?.formality,
          season: record.style?.season
        },
        promptText: record.prompt_text,
        confidence: typeof record.confidence === 'number' ? record.confidence : 0.8,
        attributes: this.extractAttributes(record)
      }));

      return {
        jobId: job_id,
        status,
        backend,
        model,
        timestamp: new Date().toISOString(),
        records: processedRecords,
        summary: this.generateSummary(processedRecords)
      };
    } catch (error) {
      logger.error('Failed to process VLT response:', error.message);
      throw error;
    }
  }

  /**
   * Extract structured attributes from VLT record
   * @param {Object} record - VLT record
   * @returns {Object} Extracted attributes
   */
  extractAttributes(record) {
    const attributes = {};
    
    // Garment attributes
    if (record.garment_type) attributes.garment_type = record.garment_type;
    if (record.silhouette) attributes.silhouette = record.silhouette;
    
    // Fabric attributes
    if (record.fabric?.type) attributes.fabric_type = record.fabric.type;
    if (record.fabric?.texture) attributes.texture = record.fabric.texture;
    if (record.fabric?.weight) attributes.weight = record.fabric.weight;
    
    // Color attributes
    if (record.colors?.primary) attributes.primary_color = record.colors.primary;
    if (record.colors?.pattern?.type) attributes.pattern = record.colors.pattern.type;
    
    // Style attributes
    if (record.style?.aesthetic) attributes.aesthetic = record.style.aesthetic;
    if (record.style?.formality) attributes.formality = record.style.formality;
    
    return attributes;
  }

  /**
   * Generate summary statistics for batch analysis
   * @param {Array} records - Processed VLT records
   * @returns {Object} Summary statistics
   */
  generateSummary(records) {
    const summary = {
      totalImages: records.length,
      garmentTypes: {},
      dominantColors: {},
      fabricTypes: {},
      silhouettes: {},
      averageConfidence: 0
    };

    let totalConfidence = 0;

    records.forEach(record => {
      // Count garment types
      if (record.garmentType) {
        summary.garmentTypes[record.garmentType] = 
          (summary.garmentTypes[record.garmentType] || 0) + 1;
      }

      // Count colors
      if (record.colors?.primary) {
        summary.dominantColors[record.colors.primary] = 
          (summary.dominantColors[record.colors.primary] || 0) + 1;
      }

      // Count fabric types
      if (record.fabric?.type) {
        summary.fabricTypes[record.fabric.type] = 
          (summary.fabricTypes[record.fabric.type] || 0) + 1;
      }

      // Count silhouettes
      if (record.silhouette) {
        summary.silhouettes[record.silhouette] = 
          (summary.silhouettes[record.silhouette] || 0) + 1;
      }

      totalConfidence += record.confidence;
    });

    summary.averageConfidence = records.length > 0 ? 
      (totalConfidence / records.length).toFixed(2) : 0;

    return summary;
  }

  /**
   * Convert VLT analysis to prompt enhancement data
   * @param {Object} vltResult - VLT analysis result
   * @returns {Object} Prompt enhancement data
   */
  toPromptEnhancement(vltResult) {
    const enhancements = vltResult.records.map(record => ({
      originalPrompt: record.promptText,
      enhancedPrompt: this.generateEnhancedPrompt(record),
      attributes: record.attributes,
      confidence: record.confidence,
      vltData: {
        garmentType: record.garmentType,
        silhouette: record.silhouette,
        fabric: record.fabric,
        colors: record.colors,
        construction: record.construction,
        style: record.style
      }
    }));

    return {
      jobId: vltResult.jobId,
      timestamp: vltResult.timestamp,
      enhancements
    };
  }

  /**
   * Generate enhanced prompt from VLT analysis
   * @param {Object} record - VLT record
   * @returns {string} Enhanced prompt
   */
  generateEnhancedPrompt(record) {
    const parts = [];
    
    // Start with garment type and silhouette
    if (record.garmentType && record.silhouette) {
      parts.push(`${record.silhouette} ${record.garmentType}`);
    } else if (record.garmentType) {
      parts.push(record.garmentType);
    }

    // Add fabric details
    if (record.fabric?.type) {
      parts.push(`made from ${record.fabric.type}`);
      if (record.fabric.texture) {
        parts.push(`with ${record.fabric.texture} texture`);
      }
    }

    // Add color information
    if (record.colors?.primary) {
      parts.push(`in ${record.colors.primary}`);
      if (record.colors?.pattern?.type) {
        parts.push(`with ${record.colors.pattern.type} pattern`);
      }
    }

    // Add construction details
    if (record.construction?.seams) {
      parts.push(`featuring ${record.construction.seams}`);
    }

    // Add style attributes
    if (record.style?.aesthetic) {
      parts.push(`${record.style.aesthetic} style`);
    }

    // Add professional photography context
    parts.push('professional fashion photography, studio lighting, high resolution, detailed textures');

    return parts.join(', ');
  }
}

module.exports = new VLTService();