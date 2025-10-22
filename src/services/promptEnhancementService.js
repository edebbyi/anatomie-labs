const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const logger = require('../utils/logger');

/**
 * Stage 2: Prompt Enhancement Service
 * Enhances VLT specifications using Claude/GPT to generate detailed,
 * professional image generation prompts with rich fashion terminology
 */
class PromptEnhancementService {
  constructor() {
    // Initialize Claude client
    this.anthropic = process.env.ANTHROPIC_API_KEY 
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
    
    // Initialize OpenAI client
    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
    
    // Default to Claude if available, otherwise GPT
    this.defaultProvider = this.anthropic ? 'claude' : 'openai';
    
    if (!this.anthropic && !this.openai) {
      logger.warn('No AI provider configured for prompt enhancement');
    }
  }

  /**
   * Enhance VLT specification into detailed image generation prompt
   * @param {Object} vltSpec - VLT analysis result
   * @param {Object} options - Enhancement options
   * @returns {Promise<Object>}
   */
  async enhancePrompt(vltSpec, options = {}) {
    const {
      provider = this.defaultProvider,
      style = 'professional',
      creativity = 0.7,
      includeNegativePrompt = true
    } = options;

    try {
      logger.info('Starting prompt enhancement', {
        provider,
        recordCount: vltSpec.records?.length || 0,
        style
      });

      const startTime = Date.now();
      
      let result;
      if (provider === 'claude' && this.anthropic) {
        result = await this.enhanceWithClaude(vltSpec, options);
      } else if (provider === 'openai' && this.openai) {
        result = await this.enhanceWithGPT(vltSpec, options);
      } else {
        throw new Error(`Provider ${provider} not configured`);
      }

      const duration = Date.now() - startTime;
      logger.info('Prompt enhancement completed', {
        provider,
        duration: `${duration}ms`,
        enhancedCount: result.enhancements.length
      });

      return {
        ...result,
        metadata: {
          provider,
          processingTime: duration,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Prompt enhancement failed', {
        provider,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Enhance using Claude (Anthropic)
   * @param {Object} vltSpec - VLT specification
   * @param {Object} options - Enhancement options
   * @returns {Promise<Object>}
   */
  async enhanceWithClaude(vltSpec, options = {}) {
    const systemPrompt = this.buildSystemPrompt(options);
    const userPrompt = this.buildUserPrompt(vltSpec, options);

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: options.creativity || 0.7,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.content[0].text;
    return this.parseEnhancedResponse(content, vltSpec);
  }

  /**
   * Enhance using GPT (OpenAI)
   * @param {Object} vltSpec - VLT specification
   * @param {Object} options - Enhancement options
   * @returns {Promise<Object>}
   */
  async enhanceWithGPT(vltSpec, options = {}) {
    const systemPrompt = this.buildSystemPrompt(options);
    const userPrompt = this.buildUserPrompt(vltSpec, options);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      temperature: options.creativity || 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.choices[0].message.content;
    return this.parseEnhancedResponse(content, vltSpec);
  }

  /**
   * Build system prompt for LLM
   * @param {Object} options - Enhancement options
   * @returns {string}
   */
  buildSystemPrompt(options) {
    return `You are an expert fashion photographer and AI image generation prompt engineer specializing in high-end fashion imagery.

Your task is to transform structured garment analysis data (VLT specifications) into detailed, professional image generation prompts optimized for AI models like DALL-E, Midjourney, and Stable Diffusion.

GUIDELINES:
1. Use rich, descriptive fashion terminology
2. Include precise details about fabric, texture, construction, and fit
3. Specify professional photography elements (lighting, composition, styling)
4. Balance technical garment details with artistic vision
5. Optimize for ${options.style || 'professional'} aesthetic
6. Generate prompts that are 150-300 words
7. Include negative prompts to avoid common AI artifacts

OUTPUT FORMAT (JSON):
{
  "mainPrompt": "Detailed positive prompt...",
  "negativePrompt": "Things to avoid...",
  "keywords": ["keyword1", "keyword2", ...],
  "photographyStyle": "studio/editorial/lifestyle",
  "technicalNotes": "Additional generation parameters"
}`;
  }

  /**
   * Build user prompt from VLT specification
   * @param {Object} vltSpec - VLT specification
   * @param {Object} options - Enhancement options
   * @returns {string}
   */
  buildUserPrompt(vltSpec, options) {
    const records = vltSpec.records || [];
    
    if (records.length === 0) {
      throw new Error('No VLT records to enhance');
    }

    // For batch processing, enhance each record
    const recordPrompts = records.map((record, index) => {
      return `
RECORD ${index + 1}:
Garment Type: ${record.garmentType || 'not specified'}
Silhouette: ${record.silhouette || 'not specified'}
Fabric: ${JSON.stringify(record.fabric || {}, null, 2)}
Colors: ${JSON.stringify(record.colors || {}, null, 2)}
Construction: ${JSON.stringify(record.construction || {}, null, 2)}
Style: ${JSON.stringify(record.style || {}, null, 2)}
Original Prompt: ${record.promptText || 'N/A'}
`;
    }).join('\n---\n');

    return `Transform the following VLT garment analysis into professional image generation prompts.

${recordPrompts}

Generate enhanced prompts for each record in JSON format. Focus on creating photorealistic, professionally styled fashion images that accurately represent the analyzed garments.`;
  }

  /**
   * Parse LLM response into structured format
   * @param {string} content - LLM response content
   * @param {Object} vltSpec - Original VLT specification
   * @returns {Object}
   */
  parseEnhancedResponse(content, vltSpec) {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/);
      
      let parsed;
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        // Try direct JSON parse
        parsed = JSON.parse(content);
      }

      // Handle single object or array of objects
      const enhancements = Array.isArray(parsed) ? parsed : [parsed];

      // Map enhancements to VLT records
      const results = vltSpec.records.map((record, index) => {
        const enhancement = enhancements[index] || enhancements[0];
        
        return {
          recordId: record.imageId || `record_${index}`,
          originalVLT: {
            garmentType: record.garmentType,
            silhouette: record.silhouette,
            promptText: record.promptText,
            confidence: record.confidence
          },
          enhanced: {
            mainPrompt: enhancement.mainPrompt || enhancement.prompt || '',
            negativePrompt: enhancement.negativePrompt || this.getDefaultNegativePrompt(),
            keywords: enhancement.keywords || this.extractKeywords(record),
            photographyStyle: enhancement.photographyStyle || 'studio',
            technicalNotes: enhancement.technicalNotes || ''
          },
          metadata: {
            wordCount: (enhancement.mainPrompt || '').split(' ').length,
            hasNegativePrompt: !!enhancement.negativePrompt,
            enhancementQuality: this.assessQuality(enhancement)
          }
        };
      });

      return {
        jobId: vltSpec.jobId,
        originalRecordCount: vltSpec.records.length,
        enhancements: results,
        summary: this.generateEnhancementSummary(results)
      };

    } catch (error) {
      logger.error('Failed to parse enhancement response', {
        error: error.message,
        content: content.substring(0, 500)
      });
      
      // Fallback: use basic enhancement
      return this.generateFallbackEnhancements(vltSpec);
    }
  }

  /**
   * Extract keywords from VLT record
   * @param {Object} record - VLT record
   * @returns {Array<string>}
   */
  extractKeywords(record) {
    const keywords = [];
    
    if (record.garmentType) keywords.push(record.garmentType);
    if (record.silhouette) keywords.push(record.silhouette);
    if (record.fabric?.type) keywords.push(record.fabric.type);
    if (record.colors?.primary) keywords.push(record.colors.primary);
    if (record.style?.aesthetic) keywords.push(record.style.aesthetic);
    
    return keywords.filter(Boolean);
  }

  /**
   * Get default negative prompt
   * @returns {string}
   */
  getDefaultNegativePrompt() {
    return 'blurry, low quality, distorted, deformed, watermark, text, logo, amateur, unrealistic proportions, bad anatomy, oversaturated, underexposed, duplicate, cropped';
  }

  /**
   * Assess enhancement quality
   * @param {Object} enhancement - Enhanced prompt data
   * @returns {string}
   */
  assessQuality(enhancement) {
    const prompt = enhancement.mainPrompt || enhancement.prompt || '';
    const wordCount = prompt.split(' ').length;
    
    if (wordCount < 50) return 'low';
    if (wordCount < 150) return 'medium';
    return 'high';
  }

  /**
   * Generate enhancement summary
   * @param {Array} enhancements - Enhanced results
   * @returns {Object}
   */
  generateEnhancementSummary(enhancements) {
    return {
      totalEnhancements: enhancements.length,
      averageWordCount: Math.round(
        enhancements.reduce((sum, e) => sum + e.metadata.wordCount, 0) / enhancements.length
      ),
      photographyStyles: [...new Set(enhancements.map(e => e.enhanced.photographyStyle))],
      qualityDistribution: {
        high: enhancements.filter(e => e.metadata.enhancementQuality === 'high').length,
        medium: enhancements.filter(e => e.metadata.enhancementQuality === 'medium').length,
        low: enhancements.filter(e => e.metadata.enhancementQuality === 'low').length
      }
    };
  }

  /**
   * Generate fallback enhancements (when LLM parsing fails)
   * @param {Object} vltSpec - VLT specification
   * @returns {Object}
   */
  generateFallbackEnhancements(vltSpec) {
    logger.warn('Using fallback enhancement method');
    
    const enhancements = vltSpec.records.map((record, index) => {
      const prompt = this.buildBasicPrompt(record);
      
      return {
        recordId: record.imageId || `record_${index}`,
        originalVLT: {
          garmentType: record.garmentType,
          silhouette: record.silhouette,
          promptText: record.promptText,
          confidence: record.confidence
        },
        enhanced: {
          mainPrompt: prompt,
          negativePrompt: this.getDefaultNegativePrompt(),
          keywords: this.extractKeywords(record),
          photographyStyle: 'studio',
          technicalNotes: 'Fallback enhancement used'
        },
        metadata: {
          wordCount: prompt.split(' ').length,
          hasNegativePrompt: true,
          enhancementQuality: 'medium'
        }
      };
    });

    return {
      jobId: vltSpec.jobId,
      originalRecordCount: vltSpec.records.length,
      enhancements,
      summary: this.generateEnhancementSummary(enhancements)
    };
  }

  /**
   * Build basic prompt from VLT record (fallback method)
   * @param {Object} record - VLT record
   * @returns {string}
   */
  buildBasicPrompt(record) {
    const parts = [];
    
    // Garment and silhouette
    if (record.garmentType) {
      parts.push(`${record.silhouette || ''} ${record.garmentType}`.trim());
    }
    
    // Fabric
    if (record.fabric?.type) {
      parts.push(`made from ${record.fabric.type}`);
      if (record.fabric.texture) {
        parts.push(`with ${record.fabric.texture} texture`);
      }
    }
    
    // Color
    if (record.colors?.primary) {
      parts.push(`in ${record.colors.primary}`);
    }
    
    // Style
    if (record.style?.aesthetic) {
      parts.push(`${record.style.aesthetic} aesthetic`);
    }
    
    // Professional photography context
    parts.push('professional fashion photography');
    parts.push('studio lighting');
    parts.push('high resolution');
    parts.push('detailed textures');
    parts.push('editorial quality');
    
    return parts.join(', ');
  }

  /**
   * Batch enhance multiple VLT specs
   * @param {Array<Object>} vltSpecs - Array of VLT specifications
   * @param {Object} options - Enhancement options
   * @returns {Promise<Array<Object>>}
   */
  async batchEnhance(vltSpecs, options = {}) {
    logger.info('Starting batch enhancement', {
      count: vltSpecs.length
    });

    const results = await Promise.allSettled(
      vltSpecs.map(spec => this.enhancePrompt(spec, options))
    );

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    
    const failed = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    if (failed.length > 0) {
      logger.warn('Some batch enhancements failed', {
        failedCount: failed.length,
        errors: failed.map(e => e.message)
      });
    }

    return {
      successful,
      failed: failed.length,
      total: vltSpecs.length,
      successRate: (successful.length / vltSpecs.length * 100).toFixed(2) + '%'
    };
  }
}

module.exports = new PromptEnhancementService();
