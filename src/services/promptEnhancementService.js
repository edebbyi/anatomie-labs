const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const logger = require('../utils/logger');

/**
 * Stage 2: Prompt Enhancement Service
 * Enhances VLT specifications using Claude/GPT to generate detailed,
 * professional image generation prompts with rich fashion terminology
 * 
 * ADDED: interpretUserPrompt() method for natural language prompt parsing
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
    
    // Default to OpenAI if available, otherwise Claude
    this.defaultProvider = this.openai ? 'openai' : 'claude';
    
    if (!this.anthropic && !this.openai) {
      logger.warn('No AI provider configured for prompt enhancement');
    }
  }

  /**
   * ADDED: Interpret user's natural language prompt into structured attributes
   * This is the KEY method that was missing!
   * 
   * @param {string} userPrompt - User's natural language description
   * @param {Object} brandDNA - User's extracted brand DNA (optional)
   * @param {Object} options - Interpretation options
   * @returns {Promise<Object>} Parsed attributes and interpretation
   */
  async interpretUserPrompt(userPrompt, brandDNA = null, options = {}) {
    const {
      provider = this.defaultProvider,
      includeEnhancedSuggestion = true
    } = options;

    try {
      logger.info('Starting user prompt interpretation', {
        provider,
        promptLength: userPrompt.length,
        hasBrandDNA: !!brandDNA
      });

      const startTime = Date.now();
      
      let result;
      if (provider === 'claude' && this.anthropic) {
        result = await this.interpretWithClaude(userPrompt, brandDNA, options);
      } else if (provider === 'openai' && this.openai) {
        result = await this.interpretWithGPT(userPrompt, brandDNA, options);
      } else {
        throw new Error(`Provider ${provider} not configured`);
      }

      const duration = Date.now() - startTime;
      logger.info('Prompt interpretation completed', {
        provider,
        duration: `${duration}ms`,
        specificity: result.specificity
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
      logger.error('Prompt interpretation failed', {
        provider,
        error: error.message,
        prompt: userPrompt.substring(0, 100)
      });
      
      // Fallback to basic parsing
      return this.fallbackInterpretation(userPrompt, brandDNA);
    }
  }

  /**
   * ADDED: Interpret using Claude
   */
  async interpretWithClaude(userPrompt, brandDNA, options) {
    try {
      const systemPrompt = this.buildInterpretationSystemPrompt(brandDNA);
      const userMessage = this.buildInterpretationUserPrompt(userPrompt, brandDNA);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.3, // Lower temperature for more consistent parsing
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      });

      const content = response.content[0].text;
      return this.parseInterpretationResponse(content, userPrompt, brandDNA);
    } catch (error) {
      logger.warn('Claude interpretation failed, using fallback', {
        error: error.message
      });
      return this.fallbackInterpretation(userPrompt, brandDNA);
    }
  }

  /**
   * ADDED: Interpret using GPT
   */
  async interpretWithGPT(userPrompt, brandDNA, options) {
    try {
      const systemPrompt = this.buildInterpretationSystemPrompt(brandDNA);
      const userMessage = this.buildInterpretationUserPrompt(userPrompt, brandDNA);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      });

      const content = response.choices[0].message.content;
      return this.parseInterpretationResponse(content, userPrompt, brandDNA);
    } catch (error) {
      logger.warn('GPT interpretation failed, using fallback', {
        error: error.message
      });
      return this.fallbackInterpretation(userPrompt, brandDNA);
    }
  }

  /**
   * ADDED: Build system prompt for interpretation
   */
  buildInterpretationSystemPrompt(brandDNA) {
    let prompt = `You are an expert fashion design interpreter. Your task is to parse natural language fashion descriptions into structured attributes for AI image generation.

CORE TASK:
Parse user's prompt into specific fashion attributes:
- Garment type(s)
- Colors
- Fabrics/materials
- Style adjectives
- Silhouette/fit
- Occasion/context
- Construction details
- Accessories

SPECIFICITY DETECTION:
Assess how specific the user's prompt is:
- HIGH: Very detailed (e.g., "navy wool double-breasted blazer with peak lapels")
- MEDIUM: Some details (e.g., "elegant black evening gown")
- LOW: Vague/abstract (e.g., "something elegant", "casual outfit")

IMPORTANT:
- Extract ONLY what the user explicitly mentioned
- Don't add assumptions unless necessary
- Identify missing attributes (user wants creative freedom there)
- Return in JSON format`;

    if (brandDNA) {
      prompt += `

BRAND DNA CONTEXT (User's Portfolio Style):
Primary Aesthetic: ${brandDNA.primaryAesthetic}
Signature Colors: ${brandDNA.signatureColors.map(c => c.name).join(', ')}
Signature Fabrics: ${brandDNA.signatureFabrics.map(f => f.name).join(', ')}
Typical Garments: ${brandDNA.primaryGarments.map(g => g.type).join(', ')}

Use this context to:
1. Better understand user's aesthetic language
2. Suggest brand-aligned enhancements
3. Fill gaps with brand-consistent choices`;
    }

    return prompt;
  }

  /**
   * ADDED: Build user prompt for interpretation
   */
  buildInterpretationUserPrompt(userPrompt, brandDNA) {
    return `Parse this fashion prompt into structured attributes:

USER PROMPT: "${userPrompt}"

Return JSON with this EXACT structure:
{
  "garmentType": "string or null",
  "colors": ["color1", "color2"] or [],
  "fabrics": ["fabric1", "fabric2"] or [],
  "styleAdjectives": ["elegant", "casual"] or [],
  "silhouette": "string or null",
  "occasion": "string or null",
  "constructionDetails": ["detail1"] or [],
  "accessories": ["accessory1"] or [],
  "specificity": "high|medium|low",
  "userModifiers": ["term1", "term2"],
  "missingAttributes": ["color", "fabric"],
  "enhancedSuggestion": "string (if brand DNA available)"
}

RULES:
- "userModifiers": ALL meaningful terms from user's prompt (these will be weighted in final prompt)
- "missingAttributes": What user DIDN'T specify (opportunities for brand DNA)
- "specificity": Assess based on detail level
- "enhancedSuggestion": Only if brand DNA provided - suggest how to enhance with brand style
- Use null or [] for unspecified attributes
- Be conservative - don't invent details`;
  }

  /**
   * ADDED: Parse LLM interpretation response
   */
  parseInterpretationResponse(content, originalPrompt, brandDNA) {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/\{[\s\S]*\}/);
      
      let parsed;
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        parsed = JSON.parse(jsonStr);
      } else {
        throw new Error('No JSON found in response');
      }

      // Validate and normalize
      const interpretation = {
        originalPrompt,
        garmentType: parsed.garmentType || null,
        colors: Array.isArray(parsed.colors) ? parsed.colors : [],
        fabrics: Array.isArray(parsed.fabrics) ? parsed.fabrics : [],
        styleAdjectives: Array.isArray(parsed.styleAdjectives) ? parsed.styleAdjectives : [],
        silhouette: parsed.silhouette || null,
        occasion: parsed.occasion || null,
        constructionDetails: Array.isArray(parsed.constructionDetails) ? parsed.constructionDetails : [],
        accessories: Array.isArray(parsed.accessories) ? parsed.accessories : [],
        specificity: parsed.specificity || this.detectSpecificity(originalPrompt),
        userModifiers: Array.isArray(parsed.userModifiers) ? parsed.userModifiers : [],
        missingAttributes: Array.isArray(parsed.missingAttributes) ? parsed.missingAttributes : [],
        enhancedSuggestion: parsed.enhancedSuggestion || null,
        brandDNAAvailable: !!brandDNA
      };

      // If no userModifiers extracted, use style adjectives + garment as fallback
      if (interpretation.userModifiers.length === 0) {
        interpretation.userModifiers = [
          ...interpretation.styleAdjectives,
          interpretation.garmentType
        ].filter(Boolean);
      }

      // Determine creativity level based on specificity
      interpretation.recommendedCreativity = this.calculateCreativityLevel(interpretation.specificity);

      logger.info('Interpretation parsed successfully', {
        garmentType: interpretation.garmentType,
        colorCount: interpretation.colors.length,
        specificity: interpretation.specificity,
        modifierCount: interpretation.userModifiers.length
      });

      return interpretation;

    } catch (error) {
      logger.error('Failed to parse interpretation response', {
        error: error.message,
        content: content.substring(0, 500)
      });
      
      return this.fallbackInterpretation(originalPrompt, brandDNA);
    }
  }

  /**
   * ADDED: Detect specificity from prompt length and detail
   */
  detectSpecificity(prompt) {
    const words = prompt.toLowerCase().split(/\s+/);
    
    // High specificity indicators
    const detailWords = ['double-breasted', 'peak', 'notch', 'lapel', 'wool', 
                        'cotton', 'silk', 'seaming', 'construction', 'detail'];
    const hasDetailWords = detailWords.some(word => prompt.toLowerCase().includes(word));
    
    if (words.length >= 8 || hasDetailWords) {
      return 'high';
    } else if (words.length >= 4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * ADDED: Calculate creativity level from specificity
   */
  calculateCreativityLevel(specificity) {
    switch (specificity) {
      case 'high': return 0.2;   // Very literal - user knows what they want
      case 'medium': return 0.5; // Balanced interpretation
      case 'low': return 0.8;    // High creativity - fill gaps with brand DNA
      default: return 0.5;
    }
  }

  /**
   * ADDED: Fallback interpretation (when LLM fails)
   */
  fallbackInterpretation(userPrompt, brandDNA) {
    logger.warn('Using fallback interpretation');

    // Basic keyword extraction
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Common garment types
    const garmentTypes = ['blazer', 'dress', 'gown', 'coat', 'jacket', 'pants', 
                         'skirt', 'shirt', 'blouse', 'sweater', 'cardigan'];
    const garmentType = garmentTypes.find(g => lowerPrompt.includes(g)) || null;
    
    // Common colors
    const colors = ['black', 'white', 'navy', 'red', 'blue', 'green', 'beige', 
                   'gray', 'brown', 'cream', 'camel'];
    const extractedColors = colors.filter(c => lowerPrompt.includes(c));
    
    // Common style adjectives
    const styles = ['elegant', 'casual', 'formal', 'sophisticated', 'modern', 
                   'classic', 'contemporary', 'minimalist'];
    const styleAdjectives = styles.filter(s => lowerPrompt.includes(s));
    
    return {
      originalPrompt: userPrompt,
      garmentType,
      colors: extractedColors,
      fabrics: [],
      styleAdjectives,
      silhouette: null,
      occasion: null,
      constructionDetails: [],
      accessories: [],
      specificity: this.detectSpecificity(userPrompt),
      userModifiers: [...styleAdjectives, garmentType].filter(Boolean),
      missingAttributes: ['fabric', 'silhouette', 'construction'],
      enhancedSuggestion: brandDNA ? 
        `I'll interpret "${userPrompt}" using your brand's signature aesthetic.` : null,
      brandDNAAvailable: !!brandDNA,
      recommendedCreativity: 0.5,
      fallback: true
    };
  }

  // ========== EXISTING METHODS BELOW (UNCHANGED) ==========

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
