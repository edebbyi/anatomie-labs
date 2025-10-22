/**
 * Evolving Multi-Template Prompt System with RLHF
 * 
 * Combines structured templates with randomization and continuous learning
 * Based on hybrid strategy: consistency + exploration + RLHF optimization
 */

const logger = require('../utils/logger');
const rlhfWeightService = require('./rlhfWeightService');

class PromptTemplateService {
  constructor() {
    // User-specific template cache (generated from style profiles)
    this.userTemplates = {};
    
    // Fallback generic templates (only used if no style profile)
    this.genericTemplates = this._initializeGenericTemplates();
    
    // Token/modifier performance tracking (RLHF rewards)
    this.tokenScores = this._loadTokenScores();
    
    // Randomization parameters
    this.explorationRate = 0.2; // 20% of generations use random exploration
    
    logger.info('PromptTemplateService initialized with RLHF support');
  }

  /**
   * Generate prompt using evolved templates + RLHF scores
   * 
   * @param {Object} vltSpec - VLT analysis from portfolio
   * @param {Object} styleProfile - User's style clusters from Stage 2
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated prompt with metadata
   */
  async generatePrompt(vltSpec, styleProfile, options = {}) {
    const {
      userId,
      exploreMode = Math.random() < this.explorationRate,
      forceTemplate = null,
      userModifiers = []
    } = options;

    logger.info('Generating prompt - comprehensive debug', {
      userId,
      hasVltSpec: !!vltSpec,
      vltSpecKeys: vltSpec ? Object.keys(vltSpec) : null,
      hasStyleProfile: !!styleProfile,
      styleProfileKeys: styleProfile ? Object.keys(styleProfile) : null,
      clusterCount: styleProfile?.clusters?.length || 0,
      exploreMode
    });

    // Step 1: Check if we have a valid style profile
    if (!styleProfile || !styleProfile.clusters || styleProfile.clusters.length === 0) {
      logger.warn('Creating enhanced VLT-based template due to missing style profile', {
        userId,
        vltSpecAvailable: !!vltSpec,
        vltGarmentType: vltSpec?.garmentType || vltSpec?.garment_type,
        reason: !styleProfile ? 'no_style_profile' : 'no_clusters'
      });
      
      return this._generateEnhancedVLTPrompt(vltSpec, options);
    }
    
    // Step 2: Get or create templates from user's style profile
    let templates = this._getUserTemplates(userId, styleProfile);
    
    // If no templates available, create a VLT-specific template on the fly
    if (!templates) {
      logger.info('Creating VLT-specific template from analysis', { userId, vltSpec: vltSpec.id || 'unknown' });
      templates = this._createVltBasedTemplate(vltSpec);
    }
    
    // Step 2: Select best template for this VLT spec
    const template = this._selectTemplate(vltSpec, styleProfile, templates, forceTemplate);
    
    // Step 2: Build core prompt structure from VLT
    const corePrompt = this._buildCorePrompt(vltSpec, template);
    
    // Step 3: Add RLHF-learned modifiers (high-reward tokens)
    const learnedModifiers = await this._selectLearnedModifiers(
      vltSpec,
      styleProfile,
      userId,
      exploreMode,
      templates,
      template
    );
    
    // Step 4: Optional random exploration (for discovery)
    const exploratoryTokens = exploreMode ? 
      this._generateExploratoryTokens(template, vltSpec, templates) : [];
    
    // Step 5: Add user-provided modifiers (from UI)
    const userTokens = userModifiers || [];
    
    // Step 6: Assemble final prompt with word limit (default 30 words for 20-35 range)
    const maxWords = options.maxWords || 30;
    const finalPrompt = this._assemblePrompt({
      core: corePrompt,
      learned: learnedModifiers,
      exploratory: exploratoryTokens,
      user: userTokens,
      template: template
    }, maxWords);
    
    // Step 7: Generate negative prompt
    const negativePrompt = this._generateNegativePrompt(vltSpec, template);

    // Step 8: Track which RLHF tokens were used for feedback learning
    const rlhfTokensUsed = this._categorizeTokensForRLHF(
      [...learnedModifiers, ...exploratoryTokens],
      vltSpec
    );

    return {
      mainPrompt: finalPrompt.text,
      negativePrompt: negativePrompt,
      metadata: {
        templateId: template.id,
        templateName: template.name,
        exploreMode: exploreMode,
        rlhfTokensUsed: rlhfTokensUsed, // For feedback tracking
        components: {
          core: {
            text: corePrompt,
            editable: false,
            description: 'Base description from your portfolio'
          },
          learned: {
            tokens: learnedModifiers,
            editable: true,
            description: 'AI-learned preferences (from your feedback)',
            scores: learnedModifiers.map(m => ({
              token: m,
              score: this.tokenScores[m] || 0.5
            }))
          },
          exploratory: {
            tokens: exploratoryTokens,
            editable: true,
            description: 'Experimental variations (for discovery)'
          },
          user: {
            tokens: userTokens,
            editable: true,
            description: 'Your custom additions'
          }
        },
        vltSource: vltSpec.id || 'unknown'
      }
    };
  }

  /**
   * Process user feedback to update token scores (RLHF reward signal)
   * 
   * @param {Object} feedback - User feedback data
   */
  processFeedback(feedback) {
    const {
      userId,
      generationId,
      feedbackType, // 'save', 'share', 'remix', 'dislike', 'irrelevant'
      promptUsed,
      tokensUsed,
      timeViewed
    } = feedback;

    // Compute reward signal
    const reward = this._computeReward(feedbackType, timeViewed);
    
    logger.info('Processing feedback', { 
      userId, 
      generationId, 
      feedbackType, 
      reward 
    });

    // Update token scores (online learning)
    tokensUsed.learned.forEach(token => {
      this._updateTokenScore(token, reward, userId);
    });

    tokensUsed.exploratory.forEach(token => {
      // Exploratory tokens get higher weight in updates (discovery bonus)
      this._updateTokenScore(token, reward * 1.5, userId);
    });

    // Log for batch RLHF training
    this._logFeedbackForRLHF({
      userId,
      generationId,
      promptUsed,
      tokensUsed,
      reward,
      feedbackType,
      timestamp: new Date()
    });
  }

  /**
   * Get or create user-specific templates from their style profile
   * Templates are based on actual GMM clusters from Stage 2
   */
  _getUserTemplates(userId, styleProfile) {
    // Check cache
    const cacheKey = `${userId}_${styleProfile?.updated_at || 'default'}`;
    if (this.userTemplates[cacheKey]) {
      return this.userTemplates[cacheKey];
    }

    // If no style profile, warn and use VLT-based templates instead of generic
    if (!styleProfile || !styleProfile.clusters) {
      logger.warn('No style profile available - this means VLT analysis failed or style clustering failed. Using basic VLT-driven templates instead of generic ones.', { userId });
      // Return null to force VLT-based template generation
      return null;
    }

    // Generate templates from style profile clusters
    const templates = this._generateTemplatesFromClusters(styleProfile);
    
    // Generate evocative names for templates (async, non-blocking)
    this._enhanceTemplateNames(templates, userId).catch(err => {
      logger.warn('Failed to enhance template names, using technical names', { error: err.message });
    });
    
    // Cache for this user
    this.userTemplates[cacheKey] = templates;
    
    logger.info('Generated user-specific templates from style profile', {
      userId,
      numTemplates: Object.keys(templates).length,
      clusters: styleProfile.clusters.map(c => c.style_summary)
    });
    
    return templates;
  }

  /**
   * Create template directly from VLT analysis when no style profile available
   * This prevents generic "romantic florals" type prompts
   */
  _createVltBasedTemplate(vltSpec) {
    const templateId = 'vlt_based';
    
    // Extract actual attributes from VLT analysis
    const garmentType = vltSpec.garmentType || vltSpec.garment_type || 'garment';
    const silhouette = vltSpec.attributes?.silhouette || vltSpec.silhouette || 'fitted';
    const primaryColor = vltSpec.colors?.primary || vltSpec.colors?.dominant || 'neutral';
    const styleOverall = vltSpec.style?.overall || vltSpec.style_overall || 'contemporary';
    const mood = vltSpec.style?.mood || vltSpec.style_mood || 'sophisticated';
    const aesthetic = vltSpec.style?.aesthetic || vltSpec.style_aesthetic || 'modern';
    
    logger.info('Creating VLT-based template from actual analysis', {
      garmentType,
      silhouette,
      primaryColor,
      styleOverall,
      mood,
      aesthetic
    });
    
    const template = {};
    template[templateId] = {
      id: templateId,
      name: `${garmentType} in ${styleOverall} style`,
      description: 'Generated directly from your image analysis',
      structure: {
        core: [
          'professional fashion photography',
          garmentType,
          `${silhouette} silhouette`,
          `${primaryColor} tones`,
          `${styleOverall} ${mood} style`,
          'studio lighting',
          'clean background'
        ]
      },
      modifiers: {
        high_reward: [
          `${styleOverall} aesthetic`,
          `${mood} mood`,
          `${aesthetic} design`,
          'professional quality',
          'detailed craftsmanship'
        ],
        medium_reward: [
          `${garmentType} design`,
          `${primaryColor} palette`,
          'luxury fashion',
          'magazine editorial'
        ]
      }
    };
    
    return template;
  }

  /**
   * Generate templates dynamically from user's style profile clusters
   * Each cluster becomes a template
   */
  _generateTemplatesFromClusters(styleProfile) {
    const templates = {};
    
    // Each GMM cluster becomes a template
    styleProfile.clusters.forEach((cluster, index) => {
      const templateId = `cluster_${cluster.id}`;
      const dominantAttrs = cluster.dominant_attributes;
      
      // Extract dominant characteristics
      const silhouette = dominantAttrs.silhouette?.[0] || 'fitted';
      const colorPrimary = dominantAttrs.color?.[0] || 'neutral';
      const styleOverall = dominantAttrs.style_overall?.[0] || 'contemporary';
      const mood = dominantAttrs.style_mood?.[0] || 'sophisticated';
      
      templates[templateId] = {
        id: templateId,
        name: cluster.style_summary || `Style Mode ${index + 1}`, // Will be enhanced by LLM
        technicalName: cluster.style_summary, // Keep technical description
        description: `Based on ${cluster.percentage.toFixed(0)}% of your portfolio`,
        clusterId: cluster.id,
        clusterSize: cluster.size,
        percentage: cluster.percentage,
        structure: {
          // Condensed core structure (15-20 words max for better image generation)
          core: [
            'professional fashion photography',
            '{garment_type}',
            `${silhouette} silhouette`,
            `${colorPrimary} tones`,
            `${styleOverall} ${mood} style`,
            'studio lighting',
            'clean background'
          ]
        },
        modifiers: this._deriveModifiers(dominantAttrs, cluster)
      };
    });
    
    return templates;
  }

  /**
   * Derive composition based on cluster attributes
   */
  _deriveComposition(dominantAttrs) {
    const garmentType = dominantAttrs.garmentType?.[0] || 'dress';
    
    // Determine shot type based on garment
    let shot = 'full body shot';
    if (['top', 'blouse', 'shirt', 'jacket'].includes(garmentType.toLowerCase())) {
      shot = '3/4 body, waist up';
    } else if (['pants', 'skirt'].includes(garmentType.toLowerCase())) {
      shot = 'full body, emphasis on lower half';
    }
    
    return [
      shot,
      '{angle} angle',
      'professional fashion model',
      '{pose} pose'
    ];
  }

  /**
   * Derive lighting based on style
   */
  _deriveLighting(styleOverall, mood) {
    const style = styleOverall?.toLowerCase() || '';
    const moodLower = mood?.toLowerCase() || '';
    
    // Map styles to lighting
    if (style.includes('minimalist') || style.includes('modern')) {
      return [
        'bright even studio lighting',
        'clean illumination',
        'minimal shadows'
      ];
    } else if (style.includes('romantic') || moodLower.includes('soft')) {
      return [
        'soft natural window light',
        'gentle shadows',
        'golden hour lighting',
        'diffused illumination'
      ];
    } else if (style.includes('dramatic') || moodLower.includes('bold')) {
      return [
        'dramatic side lighting',
        'deep shadows',
        'bold contrast',
        'theatrical lighting'
      ];
    } else {
      // Elegant/sophisticated default
      return [
        'sophisticated studio lighting',
        'subtle dramatic shadows',
        'professional key light'
      ];
    }
  }

  /**
   * Derive background based on style
   */
  _deriveBackground(styleOverall) {
    const style = styleOverall?.toLowerCase() || '';
    
    if (style.includes('minimalist') || style.includes('modern')) {
      return [
        'pure white background',
        'minimal setting',
        'negative space'
      ];
    } else if (style.includes('romantic') || style.includes('bohemian')) {
      return [
        'natural setting',
        'soft bokeh',
        'dreamy atmosphere'
      ];
    } else if (style.includes('dramatic')) {
      return [
        'dramatic setting',
        'bold backdrop',
        'artistic composition'
      ];
    } else {
      return [
        'clean minimal background',
        'soft {background_color}',
        'professional studio setup'
      ];
    }
  }

  /**
   * Derive detail descriptors from cluster attributes
   */
  _deriveDetails(dominantAttrs) {
    const details = [
      'detailed texture',
      'impeccable tailoring'
    ];
    
    const fabrication = dominantAttrs.fabrication?.[0];
    if (fabrication) {
      details.push(`${fabrication} fabric quality`);
    }
    
    const silhouette = dominantAttrs.silhouette?.[0];
    if (silhouette) {
      details.push(`perfect ${silhouette} drape`);
    }
    
    return details;
  }

  /**
   * Derive modifiers from cluster characteristics
   * These are the RLHF-learnable tokens
   */
  _deriveModifiers(dominantAttrs, cluster) {
    const highReward = [];
    const mediumReward = [];
    
    // Extract from cluster's style attributes
    const styleOverall = dominantAttrs.style_overall?.[0];
    const mood = dominantAttrs.style_mood?.[0];
    const aesthetic = dominantAttrs.style_aesthetic?.[0];
    
    // Build high-reward modifiers from actual portfolio attributes
    if (styleOverall) {
      highReward.push(`${styleOverall} aesthetic`);
      highReward.push(`${styleOverall} design language`);
    }
    
    if (mood) {
      highReward.push(`${mood} mood`);
    }
    
    if (aesthetic) {
      highReward.push(`${aesthetic} style`);
    }
    
    // Add garment-specific modifiers
    const garmentType = dominantAttrs.garmentType?.[0];
    if (garmentType) {
      mediumReward.push(`${garmentType} design`);
    }
    
    // Add color-based modifiers
    const color = dominantAttrs.color?.[0];
    if (color) {
      mediumReward.push(`${color} palette`);
      mediumReward.push(`${color} tones`);
    }
    
    // Add generic high-quality modifiers
    highReward.push('magazine editorial quality');
    highReward.push('luxury fashion');
    highReward.push('designer quality');
    
    // Representative records can suggest modifiers
    if (cluster.representative_records && cluster.representative_records.length > 0) {
      mediumReward.push('signature style');
      mediumReward.push('brand aesthetic');
    }
    
    return {
      high_reward: highReward,
      medium_reward: mediumReward
    };
  }

  /**
   * Fallback: Initialize generic template library
   * Only used when no style profile is available
   */
  _initializeGenericTemplates() {
    return {
      // Template 1: Elegant Evening Wear
      elegant_evening: {
        id: 'elegant_evening',
        name: 'Elegant Evening Wear',
        description: 'Sophisticated, formal evening fashion',
        structure: {
          core: [
            'professional fashion photography',
            '{garment_type}',
            '{silhouette} silhouette',
            '{primary_color} tones',
            'elegant sophisticated style',
            'studio lighting',
            'clean background'
          ]
        },
        modifiers: {
          high_reward: [
            'magazine editorial quality',
            'haute couture',
            'luxury fashion',
            'timeless elegance',
            'graceful draping'
          ],
          medium_reward: [
            'evening gown aesthetic',
            'formal occasion',
            'red carpet worthy',
            'designer quality'
          ]
        }
      },

      // Template 2: Minimalist Modern
      minimalist_modern: {
        id: 'minimalist_modern',
        name: 'Minimalist Modern',
        description: 'Clean, architectural, contemporary fashion',
        structure: {
          core: [
            'professional fashion photography',
            '{garment_type}',
            '{silhouette} silhouette',
            '{primary_color} tones',
            'minimalist contemporary style',
            'clean lighting',
            'white background'
          ]
        },
        modifiers: {
          high_reward: [
            'bauhaus inspired',
            'japanese minimalism',
            'scandinavian design',
            'geometric precision',
            'understated luxury'
          ],
          medium_reward: [
            'contemporary fashion',
            'urban minimalist',
            'modern simplicity'
          ]
        }
      },

      // Template 3: Romantic Bohemian
      romantic_bohemian: {
        id: 'romantic_bohemian',
        name: 'Romantic Bohemian',
        description: 'Soft, flowing, feminine romantic style',
        structure: {
          core: [
            'professional fashion photography',
            '{garment_type}',
            'flowing {silhouette}',
            'soft {primary_color}',
            'romantic bohemian style',
            'natural lighting',
            'dreamy atmosphere'
          ]
        },
        modifiers: {
          high_reward: [
            'bohemian romance',
            'vintage inspired',
            'ethereal beauty',
            'soft femininity',
            'free spirited'
          ],
          medium_reward: [
            'romantic aesthetic',
            'flowing fabric',
            'natural beauty'
          ]
        }
      },

      // Template 4: Dramatic Avant-Garde
      dramatic_avant_garde: {
        id: 'dramatic_avant_garde',
        name: 'Dramatic Avant-Garde',
        description: 'Bold, artistic, experimental fashion',
        structure: {
          core: [
            'professional fashion photography',
            '{garment_type}',
            'sculptural {silhouette}',
            'bold {primary_color}',
            'dramatic avant-garde style',
            'theatrical lighting',
            'artistic backdrop'
          ]
        },
        modifiers: {
          high_reward: [
            'runway fashion',
            'editorial statement',
            'haute couture artistry',
            'fashion forward',
            'museum worthy'
          ],
          medium_reward: [
            'bold fashion',
            'artistic expression',
            'statement making'
          ]
        }
      }
    };
  }

  /**
   * Select best template based on VLT spec from user's templates
   */
  _selectTemplate(vltSpec, styleProfile, templates, forceTemplate = null) {
    if (forceTemplate && templates[forceTemplate]) {
      return templates[forceTemplate];
    }

    // If we have user-specific templates, select the largest cluster (dominant style)
    if (styleProfile && styleProfile.clusters && Object.keys(templates).length > 0) {
      // Templates are already sorted by cluster size
      const dominantCluster = styleProfile.clusters[0];
      const templateId = `cluster_${dominantCluster.id}`;
      
      if (templates[templateId]) {
        logger.debug('Selected template from dominant cluster', {
          templateId,
          clusterSize: dominantCluster.size,
          percentage: dominantCluster.percentage
        });
        return templates[templateId];
      }
    }

    // Fallback: use first available template
    const firstTemplateId = Object.keys(templates)[0];
    return templates[firstTemplateId];
  }

  /**
   * Build core prompt from VLT spec using template structure
   */
  _buildCorePrompt(vltSpec, template) {
    // Use condensed core structure
    const core = template.structure.core.map(c => 
      this._replacePlaceholders(c, vltSpec)
    );
    
    return core.join(', ');
  }

  /**
   * Select learned modifiers based on RLHF token scores
   */
  async _selectLearnedModifiers(vltSpec, styleProfile, userId, exploreMode, templates, template) {
    
    // Get high-reward modifiers for this template
    const highRewardTokens = template.modifiers.high_reward;
    const mediumRewardTokens = template.modifiers.medium_reward;
    
    // If userId is provided, use RLHF weight service for data-driven selection
    if (userId) {
      try {
        // Categorize tokens for RLHF
        const categorizedTokens = this._categorizeTokensForRLHF([
          ...highRewardTokens,
          ...mediumRewardTokens
        ], vltSpec);
        
        // Select tokens using RLHF weights for each category
        const selectedTokens = [];
        
        for (const [category, tokens] of Object.entries(categorizedTokens)) {
          if (tokens.length > 0) {
            // Use RLHF service to select best tokens (limit to 1-2 per category)
            const count = Math.min(2, Math.ceil(tokens.length / 4)); // Select fewer tokens
            const rlhfSelected = await rlhfWeightService.selectTokens(
              userId,
              category,
              count
            );
            
            // Filter to only include tokens that are in our template
            const validSelected = rlhfSelected.filter(t => tokens.includes(t));
            selectedTokens.push(...validSelected);
          }
        }
        
        logger.debug('RLHF-based token selection', {
          userId,
          selectedCount: selectedTokens.length,
          exploreMode
        });
        
        return selectedTokens;
        
      } catch (error) {
        logger.warn('RLHF token selection failed, falling back to score-based', {
          userId,
          error: error.message
        });
      }
    }
    
    // Fallback: Sort by RLHF scores (legacy method)
    const scoredTokens = [
      ...highRewardTokens.map(t => ({ 
        token: t, 
        score: this._getTokenScore(t, userId),
        tier: 'high'
      })),
      ...mediumRewardTokens.map(t => ({ 
        token: t, 
        score: this._getTokenScore(t, userId),
        tier: 'medium'
      }))
    ];
    
    // Sort by score descending
    scoredTokens.sort((a, b) => b.score - a.score);
    
    // Select top N tokens (with some randomness for exploration)
    // Reduced to keep prompts under 50 words
    const numToSelect = exploreMode ? 
      Math.floor(Math.random() * 2) + 1 : // 1-2 in explore mode
      Math.floor(Math.random() * 2) + 2;  // 2-3 in exploit mode
    
    return scoredTokens.slice(0, numToSelect).map(t => t.token);
  }

  /**
   * Generate exploratory tokens for discovery
   * Randomly combines tokens from different templates
   */
  _generateExploratoryTokens(currentTemplate, vltSpec, templates) {
    const exploratoryTokens = [];
    
    // Cross-template token swapping
    const otherTemplates = Object.values(templates)
      .filter(t => t.id !== currentTemplate.id);
    
    if (otherTemplates.length > 0) {
      // Randomly select another template
      const randomTemplate = otherTemplates[
        Math.floor(Math.random() * otherTemplates.length)
      ];
      
      // Borrow only 1 high-reward modifier from other template (keep it minimal)
      const borrowCount = 1;
      const borrowed = this._randomSample(
        randomTemplate.modifiers.high_reward, 
        borrowCount
      );
      
      exploratoryTokens.push(...borrowed);
    }
    
    // Random novel descriptors (low frequency, high potential)
    const novelTokens = [
      'architectural precision',
      'organic flow',
      'geometric balance',
      'asymmetric beauty',
      'sculptural form',
      'fluid dynamics',
      'timeless appeal',
      'modern heritage',
      'sustainable luxury',
      'artisan crafted'
    ];
    
    if (Math.random() < 0.3) { // 30% chance
      exploratoryTokens.push(
        novelTokens[Math.floor(Math.random() * novelTokens.length)]
      );
    }
    
    return exploratoryTokens;
  }

  /**
   * Assemble final prompt from all components with word limit
   */
  _assemblePrompt(components, maxWords = 30) {
    const { core, learned, exploratory, user, template } = components;
    
    // Prioritize components: core (60%), learned (25%), user (10%), exploratory (5%)
    const prioritized = [
      { parts: [core], weight: 0.60 },           // Core is most important
      { parts: learned, weight: 0.25 },          // RLHF tokens next
      { parts: user, weight: 0.10 },             // User custom additions
      { parts: exploratory, weight: 0.05 }       // Exploration least important
    ];
    
    const tokens = [];
    let currentWordCount = 0;
    
    // Allocate words based on priority and weight
    for (const { parts, weight } of prioritized) {
      const allocated = Math.floor(maxWords * weight);
      let used = 0;
      
      for (const part of parts) {
        if (!part) continue;
        
        const partWords = part.split(/[\s,]+/).filter(w => w.length > 0);
        const partWordCount = partWords.length;
        
        if (currentWordCount + partWordCount <= maxWords && used + partWordCount <= allocated) {
          tokens.push(part);
          currentWordCount += partWordCount;
          used += partWordCount;
        } else {
          // Truncate if we're close to limit
          const remaining = Math.min(maxWords - currentWordCount, allocated - used);
          if (remaining > 0) {
            tokens.push(partWords.slice(0, remaining).join(' '));
            currentWordCount += remaining;
          }
          break;
        }
      }
      
      if (currentWordCount >= maxWords) {
        logger.debug('Reached max word limit', { currentWordCount, maxWords });
        break;
      }
    }
    
    const text = tokens.join(', ');
    const actualWordCount = text.split(/[\s,]+/).filter(w => w.length > 0).length;
    
    return {
      text,
      length: text.length,
      tokenCount: actualWordCount,
      truncated: actualWordCount >= maxWords,
      maxWords: maxWords
    };
  }

  /**
   * Generate negative prompt
   */
  _generateNegativePrompt(vltSpec, template) {
    const baseNegatives = [
      'blurry', 'low quality', 'pixelated', 'distorted',
      'bad anatomy', 'poorly rendered', 'amateur',
      'wrinkled fabric', 'stained', 'damaged clothing',
      'overexposed', 'underexposed', 'bad lighting',
      'cropped awkwardly', 'cluttered background',
      'watermark', 'text', 'logo'
    ];
    
    return baseNegatives.join(', ');
  }

  /**
   * Replace placeholders in template strings with VLT data
   */
  _replacePlaceholders(text, vltSpec) {
    const replacements = {
      '{garment_type}': vltSpec.garmentType || 'garment',
      '{silhouette}': vltSpec.attributes?.silhouette || 'fitted',
      '{neckline}': vltSpec.attributes?.neckline || 'round',
      '{sleeve_length}': vltSpec.attributes?.sleeveLength || 'sleeveless',
      '{length}': vltSpec.attributes?.length || 'midi',
      '{primary_color}': vltSpec.colors?.primary || 'neutral',
      '{finish}': vltSpec.colors?.finish || 'matte',
      '{angle}': this._selectRandom(['3/4', 'side', 'front']),
      '{pose}': this._selectRandom(['confident', 'elegant', 'natural', 'poised']),
      '{background_color}': this._selectRandom(['gray', 'white', 'cream'])
    };
    
    let result = text;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(placeholder, value);
    }
    
    return result;
  }

  /**
   * Compute reward signal from user feedback
   */
  _computeReward(feedbackType, timeViewed = 0) {
    const rewardMap = {
      'save': 1.0,           // Highest reward
      'share': 0.9,
      'remix': 0.8,
      'view_long': 0.5,      // Viewed > 5 seconds
      'view_short': 0.1,     // Viewed < 5 seconds
      'dislike': -0.5,
      'irrelevant': -1.0     // Strongest negative signal
    };
    
    let reward = rewardMap[feedbackType] || 0;
    
    // Time-based adjustment
    if (feedbackType === 'view_long' || feedbackType === 'view_short') {
      reward = Math.min(1.0, timeViewed / 10); // Max reward at 10s
    }
    
    return reward;
  }

  /**
   * Update token score with new reward (online learning)
   */
  _updateTokenScore(token, reward, userId) {
    const key = userId ? `${userId}:${token}` : token;
    
    // Initialize if doesn't exist
    if (!this.tokenScores[key]) {
      this.tokenScores[key] = {
        score: 0.5,
        count: 0,
        lastUpdated: new Date()
      };
    }
    
    // Exponential moving average (online learning)
    const alpha = 0.1; // Learning rate
    const current = this.tokenScores[key].score;
    this.tokenScores[key].score = current + alpha * (reward - current);
    this.tokenScores[key].count += 1;
    this.tokenScores[key].lastUpdated = new Date();
    
    logger.debug('Token score updated', {
      token,
      userId,
      newScore: this.tokenScores[key].score,
      reward
    });
  }

  /**
   * Get token score (user-specific or global)
   */
  _getTokenScore(token, userId = null) {
    const userKey = userId ? `${userId}:${token}` : null;
    const globalKey = token;
    
    // Try user-specific first, fallback to global
    if (userKey && this.tokenScores[userKey]) {
      return this.tokenScores[userKey].score;
    }
    
    if (this.tokenScores[globalKey]) {
      return this.tokenScores[globalKey].score;
    }
    
    // Default score for unknown tokens
    return 0.5;
  }

  /**
   * Load token scores from persistent storage
   */
  _loadTokenScores() {
    // TODO: Load from database
    // For now, initialize with defaults
    return {};
  }

  /**
   * Log feedback for batch RLHF training
   */
  _logFeedbackForRLHF(feedbackData) {
    // TODO: Send to Python ML service for batch training
    logger.info('Feedback logged for RLHF', {
      userId: feedbackData.userId,
      reward: feedbackData.reward
    });
  }

  /**
   * Utility: Select random item from array
   */
  _selectRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Utility: Random sample from array
   */
  _randomSample(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Generate enhanced VLT-based prompt when style profile is not available
   * This creates more sophisticated prompts than the basic VLT fallback
   */
  _generateEnhancedVLTPrompt(vltSpec, options) {
    const { userId } = options;
    
    // Extract more sophisticated attributes from VLT
    const garmentType = vltSpec.garmentType || vltSpec.garment_type || 'garment';
    const colors = vltSpec.colors || vltSpec.color_palette || {};
    const style = vltSpec.style || {};
    const attributes = vltSpec.attributes || {};
    
    logger.info('Generating enhanced VLT-based prompt', {
      userId,
      garmentType,
      hasColors: !!colors.primary,
      hasStyle: !!style.overall,
      hasAttributes: Object.keys(attributes).length > 0
    });
    
    // Build a more detailed prompt even without style clustering
    const coreElements = [
      'professional fashion photography',
      garmentType,
      attributes.silhouette ? `${attributes.silhouette} silhouette` : 'fitted silhouette',
      colors.primary ? `${colors.primary} tones` : 'neutral tones',
      style.overall ? `${style.overall} style` : 'contemporary style',
      'studio lighting',
      'clean background'
    ];
    
    const qualityModifiers = [
      'high fashion editorial',
      'magazine quality',
      'detailed craftsmanship',
      '8k resolution',
      'professional styling'
    ];
    
    // Select 2-3 quality modifiers to keep under word limit
    const selectedQuality = qualityModifiers.slice(0, 3);
    
    const mainPrompt = [...coreElements, ...selectedQuality].join(', ');
    const wordCount = mainPrompt.split(' ').length;
    
    logger.info('Generated enhanced VLT-based prompt', {
      promptLength: mainPrompt.length,
      wordCount: wordCount,
      hasColors: !!colors.primary,
      hasStyle: !!style.overall,
      userId
    });
    
    return {
      mainPrompt,
      negativePrompt: this._generateNegativePrompt(vltSpec, null),
      metadata: {
        templateId: 'enhanced_vlt_based',
        templateName: `Enhanced ${garmentType} Style`,
        description: 'Generated from VLT analysis without style clustering',
        source: 'vlt_analysis_enhanced',
        exploreMode: false,
        rlhfTokensUsed: [], // No RLHF tokens available without style profile
        components: {
          core: {
            text: coreElements.join(', '),
            editable: false,
            description: 'Base description from image analysis'
          },
          learned: {
            tokens: [],
            editable: true,
            description: 'AI-learned preferences (requires completed onboarding)'
          },
          exploratory: {
            tokens: [],
            editable: true,
            description: 'Experimental variations'
          },
          user: {
            tokens: [],
            editable: true,
            description: 'Your custom additions'
          }
        },
        vltAttributes: {
          garmentType,
          colors: colors.primary || 'neutral',
          style: style.overall || 'contemporary',
          silhouette: attributes.silhouette || 'fitted'
        },
        vltSource: vltSpec.id || 'unknown'
      }
    };
  }

  /**
   * Categorize tokens into RLHF categories for learning
   * @param {Array} tokens - List of tokens to categorize
   * @param {Object} vltSpec - VLT spec for context
   * @returns {Object} Tokens organized by category
   */
  _categorizeTokensForRLHF(tokens, vltSpec) {
    const categorized = {
      lighting: [],
      composition: [],
      style: [],
      quality: [],
      mood: [],
      modelPose: []
    };
    
    // Keyword mapping for categorization
    const categoryKeywords = {
      lighting: ['lighting', 'light', 'illumination', 'shadows', 'glow', 'golden hour', 'studio', 'natural', 'dramatic', 'soft', 'bright'],
      composition: ['shot', 'angle', 'framing', 'body', 'view', 'composition', 'overhead', 'flat lay', 'portrait'],
      style: ['minimalist', 'elegant', 'romantic', 'modern', 'casual', 'formal', 'bohemian', 'edgy', 'avant-garde', 'contemporary', 'vintage', 'classic'],
      quality: ['quality', 'resolution', 'professional', 'sharp', 'detailed', 'texture', 'studio', '8k', '4k', 'high-end', 'magazine'],
      mood: ['sophisticated', 'playful', 'dramatic', 'serene', 'bold', 'subtle', 'luxurious', 'calm', 'energetic', 'moody'],
      modelPose: ['pose', 'standing', 'seated', 'walking', 'dynamic', 'relaxed', 'confident', 'natural']
    };
    
    tokens.forEach(token => {
      const tokenLower = token.toLowerCase();
      let categorizedToken = false;
      
      // Try to match token to a category
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(kw => tokenLower.includes(kw))) {
          categorized[category].push(token);
          categorizedToken = true;
          break;
        }
      }
      
      // Default to style if no match
      if (!categorizedToken) {
        categorized.style.push(token);
      }
    });
    
    return categorized;
  }

  /**
   * Enhance template names using LLM for evocative, brand-aligned names
   * Runs async to not block template generation
   */
  async _enhanceTemplateNames(templates, userId) {
    const axios = require('axios');
    
    // Get brand context if available
    let brandContext = 'a fashion brand';
    // TODO: Fetch from user profile
    // const user = await getUserProfile(userId);
    // brandContext = user.brandName || user.companyName || 'a fashion brand';
    
    for (const [templateId, template] of Object.entries(templates)) {
      try {
        const enhancedName = await this._generateTemplateName(
          template.technicalName,
          template.structure,
          template.percentage,
          brandContext
        );
        
        template.name = enhancedName;
        template.nameSource = 'llm_generated';
        
        logger.info('Enhanced template name', {
          templateId,
          original: template.technicalName,
          enhanced: enhancedName
        });
        
      } catch (error) {
        logger.warn('Failed to enhance template name, keeping technical name', {
          templateId,
          error: error.message
        });
        template.nameSource = 'technical';
      }
    }
  }

  /**
   * Generate evocative template name using LLM
   */
  async _generateTemplateName(technicalDescription, structure, percentage, brandContext) {
    // Use OpenAI API or any LLM
    const openai = require('openai');
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    const client = new openai.OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Extract key attributes for context
    const styleWords = structure.style.join(', ');
    const colorWords = structure.color.join(', ');
    const garmentWords = structure.garment.join(', ');
    
    const prompt = `You are a creative fashion copywriter for ${brandContext}.

Given this fashion style analysis:
- Technical description: "${technicalDescription}"
- Style attributes: ${styleWords}
- Color palette: ${colorWords}
- Garment characteristics: ${garmentWords}
- Represents ${percentage.toFixed(0)}% of the brand's aesthetic

Generate a short, evocative name (2-3 words max) that captures the essence and vibe of this style.

The name should be:
- Memorable and distinctive
- Aligned with high-end fashion brand voice
- Evocative rather than purely descriptive
- Inspiring for designers

Examples of good names:
- "Midnight Sophisticate" (for elegant, black, evening wear)
- "Burgundy Muse" (for sophisticated, burgundy, A-line)
- "Urban Minimalist" (for modern, clean, black)
- "Ethereal Romance" (for soft, flowing, feminine)
- "Avant-Garde Rebel" (for bold, experimental, dramatic)

Generate ONE name only, no explanation. Format: Just the name.`;
    
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cheap for this task
      messages: [
        { role: 'system', content: 'You are a creative fashion copywriter specializing in brand voice and naming.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8, // Higher for more creative names
      max_tokens: 20
    });
    
    const generatedName = response.choices[0].message.content.trim();
    
    // Clean up (remove quotes, extra punctuation)
    return generatedName.replace(/["\']/g, '').trim();
  }
}

module.exports = new PromptTemplateService();
