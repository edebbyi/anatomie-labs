const vltService = require('./vltService');
const promptEnhancementService = require('./promptEnhancementService');
const promptGenerationService = require('./IntelligentPromptBuilder');
const personaService = require('./personaService');
const routingService = require('./modelRoutingService');
const rlhfService = require('./rlhfService');
const validationService = require('./validationService');
const dppSelectionService = require('./dppSelectionService');
const coverageAnalysisService = require('./coverageAnalysisService');
const r2Service = require('./r2Storage');
const imagenAdapter = require('../adapters/imagenAdapter');
const geminiAdapter = require('../adapters/geminiAdapter');
const stableDiffusionAdapter = require('../adapters/stableDiffusionAdapter');
const dalleAdapter = require('../adapters/dalleAdapter');
const db = require('./database');
const logger = require('../utils/logger');

/**
 * Generation Orchestrator Service
 * Coordinates the full pipeline from VLT analysis to image generation
 */
class GenerationService {
  constructor() {
    this.adapters = {
      'google-imagen': imagenAdapter,        // Default - Highest quality
      'google-gemini': geminiAdapter,        // Ultra-fast & cheap
      'stable-diffusion-xl': stableDiffusionAdapter,  // Cost-effective
      'openai-dalle3': dalleAdapter          // Creative alternative
    };
    
    // Default provider
    this.defaultProvider = 'google-imagen';
  }

  /**
   * Generate image from uploaded file or VLT specification
   * @param {Object} params - Generation parameters
   * @param {string} params.userId - User ID
   * @param {Buffer} params.imageFile - Uploaded image file (optional)
   * @param {Object} params.vltSpec - Pre-computed VLT spec (optional)
   * @param {Object} params.settings - Generation settings
   * @param {number} params.settings.count - Number of images requested (default: 1)
   * @param {number} params.settings.bufferPercent - Over-generation buffer % (default: 20)
   * @returns {Promise<Object>} Generation result
   */
  async generateFromImage(params) {
    const {
      userId,
      imageFile,
      vltSpec: providedVltSpec,
      settings = {}
    } = params;

    // Calculate over-generation count
    const requestedCount = settings.count || 1;
    const bufferPercent = settings.bufferPercent || 20; // 20% buffer by default
    const generateCount = Math.ceil(requestedCount * (1 + bufferPercent / 100));

    logger.info('Generation with over-generation buffer', {
      requestedCount,
      generateCount,
      bufferPercent
    });

    const generationId = this.generateId();
    
    logger.info('Starting image generation', {
      generationId,
      userId,
      hasImageFile: !!imageFile,
      hasVltSpec: !!providedVltSpec
    });

    try {
      // Create generation record
      const generation = await this.createGenerationRecord({
        generationId,
        userId,
        status: 'processing',
        settings
      });

      // Stage 1: VLT Analysis
      let vltSpec = providedVltSpec;
      if (!vltSpec && imageFile) {
        logger.info('Running VLT analysis', { generationId });
        vltSpec = await vltService.analyzeImage(imageFile, {
          backend: settings.vltBackend || 'gemini'
        });
        
        await this.updateGenerationStage(generationId, {
          stage: 'vlt_complete',
          vltSpec
        });
      }

      if (!vltSpec) {
        throw new Error('Either imageFile or vltSpec must be provided');
      }

      // Stage 2: Generate Fashion Prompt from VLT using Template System
      logger.info('Generating fashion prompt from VLT with RLHF', { generationId });
      const promptTemplateService = require('./promptTemplateService');
      
      // Get user's style profile (from Stage 2 ML service if available)
      let styleProfile = settings.styleProfile;
      if (!styleProfile && userId) {
        // Fetch from Python ML service
        const axios = require('axios');
        try {
          const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
          const response = await axios.get(`${mlServiceUrl}/api/style-profile/${userId}`);
          if (response.data && response.data.profile) {
            styleProfile = response.data.profile;
            logger.info('Fetched style profile from ML service', { 
              userId, 
              clusters: styleProfile.n_clusters,
              records: styleProfile.n_records
            });
          }
        } catch (error) {
          if (error.response?.status === 404) {
            logger.info('No style profile found for user, will use generic templates', { userId });
          } else {
            logger.warn('Failed to fetch style profile from ML service, using generic templates', { 
              userId,
              error: error.message 
            });
          }
        }
      }
      
      const fashionPrompt = await promptTemplateService.generatePrompt(vltSpec, styleProfile, {
        userId: userId,
        exploreMode: settings.exploreMode,
        userModifiers: settings.userModifiers || []
      });

      // Enhance the fashion prompt if needed
      logger.info('Prompt generated with template system and RLHF weights', { 
        generationId,
        templateId: fashionPrompt.metadata.templateId,
        exploreMode: fashionPrompt.metadata.exploreMode,
        hasRLHFTokens: !!fashionPrompt.metadata.rlhfTokensUsed
      });
      
      const enhanced = {
        enhancements: [{
          original: { promptText: fashionPrompt.mainPrompt },
          enhanced: {
            mainPrompt: fashionPrompt.mainPrompt,
            negativePrompt: fashionPrompt.negativePrompt,
            keywords: fashionPrompt.metadata
          },
          templateMetadata: fashionPrompt.metadata
        }]
      };

      await this.updateGenerationStage(generationId, {
        stage: 'enhancement_complete',
        enhanced
      });

      // Stage 3: Persona Matching (optional) - DISABLED FOR NOW
      let personaMatch = null;
      // Persona matching temporarily disabled
      logger.info('Skipping persona matching (not implemented)', { generationId });

      // Stage 4: Model Routing
      logger.info('Routing to model', { generationId });
      const routing = await routingService.routePrompt(enhanced.enhancements[0], {
        strategy: settings.strategy || 'balanced',
        userId,
        forceProvider: settings.provider // Allow manual provider override
      });

      await this.updateGenerationStage(generationId, {
        stage: 'routing_complete',
        routing
      });

      // Stage 5: RLHF Optimization
      logger.info('Optimizing prompt with RLHF', { generationId });
      const optimized = await rlhfService.optimizePrompt(enhanced.enhancements[0], {
        userId,
        personaData: personaMatch,
        targetQuality: settings.targetQuality || 0.85
      });

      await this.updateGenerationStage(generationId, {
        stage: 'rlhf_complete',
        optimized
      });

      // Stage 6: Image Generation
      logger.info('Generating image', {
        generationId,
        provider: routing.provider.id
      });

      const finalPrompt = optimized.optimizedPrompt.enhanced?.mainPrompt || 
                          optimized.optimizedPrompt.mainPrompt;
      const negativePrompt = optimized.optimizedPrompt.enhanced?.negativePrompt;

      const adapter = this.getAdapter(routing.provider.id);
      if (!adapter) {
        throw new Error(`No adapter available for provider: ${routing.provider.id}`);
      }

      const generationResult = await adapter.generate({
        prompt: finalPrompt,
        negativePrompt,
        settings: {
          count: requestedCount, // Pass the requested count to adapter
          quality: settings.quality || 'standard',
          size: settings.size || 'square',
          style: settings.dalleStyle || 'vivid'
        }
      });

      if (!generationResult.success) {
        throw new Error(`Generation failed: ${generationResult.error}`);
      }

      await this.updateGenerationStage(generationId, {
        stage: 'generation_complete',
        generationResult
      });

      // Stage 7: Upload to R2 and store metadata
      logger.info('Uploading to R2', { generationId });
      const allUploadedAssets = await this.uploadAndStoreAssets({
        generationId,
        userId,
        images: generationResult.images,
        provider: routing.provider,
        vltSpec,
        optimized,
        routing,
        promptId: settings.promptId || generationId, // Use promptId from settings or fallback to generationId
        mainPrompt: settings.mainPrompt || finalPrompt, // Pass the actual prompt text used
        negativePrompt: settings.negativePrompt || negativePrompt, // Pass negative prompt
        promptMetadata: settings.promptMetadata || {} // Pass prompt metadata
      });

      // Stage 8: Validate and filter to return best N images
      let finalAssets = allUploadedAssets;
      if (settings.autoValidate !== false && requestedCount < allUploadedAssets.length) {
        logger.info('Filtering images with validation', {
          generationId,
          requested: requestedCount,
          generated: allUploadedAssets.length
        });

        finalAssets = await this.filterAndReturnBestImages(
          generationId,
          allUploadedAssets,
          requestedCount,
          vltSpec
        );

        logger.info('Validation filtering complete', {
          generationId,
          returned: finalAssets.length,
          discarded: allUploadedAssets.length - finalAssets.length
        });
      } else if (requestedCount < allUploadedAssets.length) {
        // No validation, just return first N
        finalAssets = allUploadedAssets.slice(0, requestedCount);
      }

      // Complete generation
      const completedGeneration = await this.completeGeneration({
        generationId,
        assets: finalAssets,
        cost: generationResult.cost,
        metadata: {
          vltSpec,
          enhanced: enhanced.enhancements[0],
          personaMatch,
          routing,
          optimized,
          generationResult,
          rlhfTokensUsed: fashionPrompt.metadata.rlhfTokensUsed, // Track for feedback
          overGeneration: {
            requested: requestedCount,
            generated: allUploadedAssets.length,
            returned: finalAssets.length
          }
        }
      });

      logger.info('Image generation completed', {
        generationId,
        userId,
        assetCount: finalAssets.length,
        cost: generationResult.cost
      });

      return {
        success: true,
        generationId,
        assets: finalAssets.map(asset => ({
          id: asset.id,
          url: asset.cdn_url,
          filename: asset.r2_key,
          metadata: asset.metadata
        })),
        metadata: {
          totalGenerated: allUploadedAssets.length,
          requested: requestedCount,
          returned: finalAssets.length,
          provider: routing.provider.name,
          cost: generationResult.cost,
          vltSpec,
          routing
        },
        generation: completedGeneration
      };

    } catch (error) {
      logger.error('Image generation failed', {
        generationId,
        userId,
        error: error.message,
        stack: error.stack
      });

      // Update generation status to failed
      await this.failGeneration(generationId, error);

      throw error;
    }
  }

  /**
   * Generate image from text query (uses agent system)
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Generation result
   */
  async generateFromQuery(params) {
    const {
      userId,
      query,
      settings = {}
    } = params;

    const generationId = this.generateId();

    logger.info('Starting query-based generation with agent system', {
      generationId,
      userId,
      queryLength: query.length
    });

    try {
      // Create generation record
      const generation = await this.createGenerationRecord({
        generationId,
        userId,
        status: 'processing',
        settings
      });

      // Get user's enhanced style profile for prompt generation
      const IntelligentPromptBuilder = require('./IntelligentPromptBuilder');
      let styleProfile = settings.styleProfile;
      let brandDNA = null;
      let interpretation = null;

      if (!styleProfile && userId) {
        try {
          // Get enhanced style profile with ultra-detailed descriptors
          styleProfile = await IntelligentPromptBuilder.getEnhancedStyleProfile(userId);

          if (styleProfile) {
            logger.info('Enhanced style profile loaded for query generation', {
              userId,
              totalImages: styleProfile.total_images || 0,
              aestheticThemes: styleProfile.aesthetic_themes?.length || 0
            });
          }
        } catch (error) {
          logger.warn('Failed to load enhanced style profile for query', {
            userId,
            error: error.message
          });
        }
      }

      // Extract brand DNA from style profile
      if (styleProfile && userId) {
        try {
          brandDNA = IntelligentPromptBuilder.extractBrandDNA(styleProfile);
          logger.info('Brand DNA extracted', {
            userId,
            primaryAesthetic: brandDNA?.primaryAesthetic,
            signatureColors: brandDNA?.signatureColors?.length || 0
          });
        } catch (error) {
          logger.warn('Failed to extract brand DNA', {
            userId,
            error: error.message
          });
        }
      }

      let fashionPrompt;

      // STEP 1: Interpret user's natural language prompt using promptEnhancementService
      // This works even without userId - it will use fallback interpretation
      const promptEnhancementService = require('./promptEnhancementService');

      try {
        interpretation = await promptEnhancementService.interpretUserPrompt(
          query,
          brandDNA,
          { includeEnhancedSuggestion: true }
        );

        logger.info('Prompt interpreted successfully', {
          generationId,
          userId: userId || 'anonymous',
          garmentType: interpretation.garmentType,
          specificity: interpretation.specificity,
          modifierCount: interpretation.userModifiers?.length || 0,
          recommendedCreativity: interpretation.recommendedCreativity,
          fallback: interpretation.fallback || false
        });

        // STEP 2: Generate enhanced prompt using IntelligentPromptBuilder with parsed attributes
        if (userId) {
          // With userId: Use full IntelligentPromptBuilder with style profile
          try {
            const promptResult = await IntelligentPromptBuilder.generatePrompt(userId, {
              garmentType: interpretation.garmentType,
              season: null,
              occasion: interpretation.occasion,
              creativity: interpretation.recommendedCreativity || 0.7,
              useCache: false,
              variationSeed: Date.now() % 1000,
              userModifiers: interpretation.userModifiers || [],
              respectUserIntent: interpretation.specificity === 'high', // Only literal for high specificity
              parsedUserPrompt: interpretation, // Pass full interpretation
              brandDNA: brandDNA,
              enforceBrandDNA: true,
              brandDNAStrength: interpretation.specificity === 'low' ? 0.9 :
                               interpretation.specificity === 'medium' ? 0.6 : 0.3
            });

            if (promptResult && promptResult.positive) {
              fashionPrompt = {
                mainPrompt: promptResult.positive,
                negativePrompt: promptResult.negative,
                metadata: {
                  source: 'intelligent_prompt_builder_with_interpretation',
                  originalQuery: query,
                  interpretation: {
                    garmentType: interpretation.garmentType,
                    specificity: interpretation.specificity,
                    creativity: interpretation.recommendedCreativity,
                    brandDNAStrength: interpretation.specificity === 'low' ? 0.9 :
                                     interpretation.specificity === 'medium' ? 0.6 : 0.3,
                    fallback: interpretation.fallback || false
                  },
                  enhancedSuggestion: interpretation.enhancedSuggestion,
                  ...promptResult.metadata
                }
              };

              logger.info('Generated enhanced prompt from query with style profile', {
                generationId,
                userId,
                query,
                specificity: interpretation.specificity,
                brandDNAStrength: fashionPrompt.metadata.interpretation.brandDNAStrength,
                promptPreview: fashionPrompt.mainPrompt.substring(0, 100)
              });
            } else {
              throw new Error('IntelligentPromptBuilder returned invalid result');
            }
          } catch (error) {
            logger.warn('Failed to use IntelligentPromptBuilder, falling back to basic prompt building', {
              generationId,
              userId,
              error: error.message
            });

            // Fallback: Build prompt from interpretation without style profile
            const attributes = [];

            // Add garment type
            if (interpretation && interpretation.garmentType) {
              attributes.push(interpretation.garmentType);
            }

            // Add colors
            if (interpretation && interpretation.colors && interpretation.colors.length > 0) {
              attributes.push(...interpretation.colors);
            }

            // Add style adjectives
            if (interpretation && interpretation.styleAdjectives && interpretation.styleAdjectives.length > 0) {
              attributes.push(...interpretation.styleAdjectives);
            }

            // Add fabrics
            if (interpretation && interpretation.fabrics && interpretation.fabrics.length > 0) {
              attributes.push(...interpretation.fabrics);
            }

            // Build prompt from interpreted attributes
            const attributeString = attributes.join(', ');
            const fallbackMainPrompt = `professional fashion photography, ${attributeString}, studio lighting, high quality, detailed, sharp focus`;

            fashionPrompt = {
              mainPrompt: fallbackMainPrompt,
              negativePrompt: 'blurry, low quality, pixelated, distorted, bad anatomy, deformed',
              metadata: {
                source: 'interpretation_fallback_from_style_profile_error',
                originalQuery: query,
                interpretation: interpretation ? {
                  garmentType: interpretation.garmentType,
                  specificity: interpretation.specificity,
                  creativity: interpretation.recommendedCreativity,
                  fallback: interpretation.fallback || false
                } : null,
                enhancedSuggestion: interpretation ? interpretation.enhancedSuggestion : null,
                styleProfileError: error.message
              }
            };

            logger.info('Generated prompt from interpretation (fallback from style profile error)', {
              generationId,
              userId,
              query,
              specificity: interpretation ? interpretation.specificity : 'unknown',
              attributeCount: attributes.length,
              promptPreview: fashionPrompt && fashionPrompt.mainPrompt ? fashionPrompt.mainPrompt.substring(0, Math.min(100, fashionPrompt.mainPrompt.length)) : 'N/A'
            });
          }
        } else {
          logger.info('No userId, building prompt from interpretation without style profile', {
            generationId,
            query
          });
          // Without userId: Build prompt from interpretation without style profile
          const attributes = [];

          // Add garment type
          if (interpretation && interpretation.garmentType) {
            attributes.push(interpretation.garmentType);
          }

          // Add colors
          if (interpretation && interpretation.colors && interpretation.colors.length > 0) {
            attributes.push(...interpretation.colors);
          }

          // Add style adjectives
          if (interpretation && interpretation.styleAdjectives && interpretation.styleAdjectives.length > 0) {
            attributes.push(...interpretation.styleAdjectives);
          }

          // Add fabrics
          if (interpretation && interpretation.fabrics && interpretation.fabrics.length > 0) {
            attributes.push(...interpretation.fabrics);
          }

          // Build prompt from interpreted attributes
          const attributeString = attributes.join(', ');
          const noUserMainPrompt = `professional fashion photography, ${attributeString}, studio lighting, high quality, detailed, sharp focus`;

          fashionPrompt = {
            mainPrompt: noUserMainPrompt,
            negativePrompt: 'blurry, low quality, pixelated, distorted, bad anatomy, deformed',
            metadata: {
              source: 'interpretation_without_style_profile',
              originalQuery: query,
              interpretation: interpretation ? {
                garmentType: interpretation.garmentType,
                specificity: interpretation.specificity,
                creativity: interpretation.recommendedCreativity,
                fallback: interpretation.fallback || false
              } : null,
              enhancedSuggestion: interpretation ? interpretation.enhancedSuggestion : null
            }
          };

          logger.info('Generated prompt from interpretation without style profile', {
            generationId,
            query,
            specificity: interpretation ? interpretation.specificity : 'unknown',
            attributeCount: attributes.length,
            promptPreview: fashionPrompt.mainPrompt ? fashionPrompt.mainPrompt.substring(0, Math.min(100, fashionPrompt.mainPrompt.length)) : 'N/A'
          });
        }

      } catch (error) {
        logger.warn('Failed to interpret prompt, falling back to basic enhancement', {
          generationId,
          userId: userId || 'anonymous',
          error: error.message
        });

        // Fallback: Use basic keyword extraction
        const userModifiers = query.split(' ').filter(word => word.length > 3);

        if (userId) {
          try {
            const promptResult = await IntelligentPromptBuilder.generatePrompt(userId, {
              garmentType: null,
              season: null,
              occasion: null,
              creativity: settings.creativity || 0.7,
              useCache: false,
              variationSeed: Date.now() % 1000,
              userModifiers: userModifiers.length > 0 ? userModifiers : undefined,
              respectUserIntent: true,
              parsedUserPrompt: { text: query },
              brandDNA: brandDNA,
              enforceBrandDNA: false
            });

            fashionPrompt = {
              mainPrompt: promptResult.positive,
              negativePrompt: promptResult.negative,
              metadata: {
                source: 'intelligent_prompt_builder_fallback',
                originalQuery: query,
                ...promptResult.metadata
              }
            };
          } catch (fallbackError) {
            logger.error('IntelligentPromptBuilder fallback failed', {
              error: fallbackError.message
            });
            fashionPrompt = {
              mainPrompt: `professional fashion photography, ${query}, studio lighting, high quality`,
              negativePrompt: 'blurry, low quality, pixelated, distorted, bad anatomy',
              metadata: {
                source: 'basic_fallback',
                originalQuery: query,
                error: fallbackError.message
              }
            };
          }
        } else {
          // No userId and interpretation failed - use basic prompt
          fashionPrompt = {
            mainPrompt: `professional fashion photography, ${query}, studio lighting, high quality`,
            negativePrompt: 'blurry, low quality, pixelated, distorted, bad anatomy',
            metadata: {
              source: 'basic_fallback_no_user',
              originalQuery: query,
              error: error.message
            }
          };
        }
      }

      await this.updateGenerationStage(generationId, {
        stage: 'prompt_generation_complete',
        query,
        fashionPrompt
      });

      // Route to model
      const enhancedPrompt = {
        original: { promptText: query },
        enhanced: {
          mainPrompt: fashionPrompt.mainPrompt,
          negativePrompt: fashionPrompt.negativePrompt,
          keywords: fashionPrompt.metadata
        },
        templateMetadata: fashionPrompt.metadata
      };

      const routing = await routingService.routePrompt(enhancedPrompt, {
        strategy: settings.strategy || 'balanced',
        userId,
        forceProvider: settings.provider
      });

      await this.updateGenerationStage(generationId, {
        stage: 'routing_complete',
        routing
      });

      // Generate images
      const adapter = this.getAdapter(routing.provider.id);
      if (!adapter) {
        throw new Error(`No adapter available for provider: ${routing.provider.id}`);
      }

      const generationResult = await adapter.generate({
        prompt: fashionPrompt.mainPrompt,
        negativePrompt: fashionPrompt.negativePrompt,
        settings
      });

      if (!generationResult.success) {
        throw new Error(`Generation failed: ${generationResult.error}`);
      }

      // Upload and store
      const uploadedAssets = await this.uploadAndStoreAssets({
        generationId,
        userId,
        images: generationResult.images,
        provider: routing.provider,
        routing,
        mainPrompt: fashionPrompt.mainPrompt,
        negativePrompt: fashionPrompt.negativePrompt,
        promptMetadata: {
          source: 'agent_generated',
          originalQuery: query,
          usedStyleProfile: !!styleProfile
        }
      });

      // Complete
      const completedGeneration = await this.completeGeneration({
        generationId,
        assets: uploadedAssets,
        cost: generationResult.cost,
        metadata: {
          query,
          prompt: fashionPrompt.mainPrompt,
          negativePrompt: fashionPrompt.negativePrompt,
          routing,
          generationResult,
          usedStyleProfile: !!styleProfile
        }
      });

      logger.info('Query-based generation completed', {
        generationId,
        userId,
        assetCount: uploadedAssets.length
      });

      return completedGeneration;

    } catch (error) {
      logger.error('Query-based generation failed', {
        generationId,
        error: error.message
      });

      await this.failGeneration(generationId, error);
      throw error;
    }
  }

  /**
   * Generate image from direct prompt (bypass VLT)
   * FIXED VERSION - Now properly uses IntelligentPromptBuilder with style profile
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Generation result
   */
  async generateFromPrompt(params) {
    const {
      userId,
      prompt,
      negativePrompt,
      settings = {}
    } = params;

    const generationId = this.generateId();

    logger.info('Starting prompt-based generation', {
      generationId,
      userId,
      promptLength: prompt.length,
      hasCreativity: !!settings.creativity,
      respectUserIntent: !!settings.respectUserIntent
    });

    try {
      // Create generation record
      const generation = await this.createGenerationRecord({
        generationId,
        userId,
        status: 'processing',
        settings,
        skipVlt: true
      });

      // FIXED: Instead of creating mock enhanced prompt, use IntelligentPromptBuilder
      let enhancedPrompt;
      let finalNegativePrompt = negativePrompt;
      let promptMetadata = {};

      if (userId && settings.creativity !== undefined) {
        // Use IntelligentPromptBuilder for style-aware generation
        try {
          logger.info('Using IntelligentPromptBuilder for prompt-based generation', {
            generationId,
            userId,
            creativity: settings.creativity
          });

          // Get enhanced style profile
          const styleProfile = await promptGenerationService.getEnhancedStyleProfile(userId);

          if (styleProfile) {
            // Extract brand DNA
            const brandDNA = promptGenerationService.extractBrandDNA(styleProfile);

            logger.info('Brand DNA extracted for prompt generation', {
              generationId,
              hasBrandDNA: !!brandDNA,
              primaryAesthetic: brandDNA?.primaryAesthetic,
              confidence: brandDNA?.overallConfidence
            });

            // Parse user modifiers from the prompt text
            const userModifiers = this.extractModifiersFromPrompt(prompt);

            // Generate enhanced prompt using IntelligentPromptBuilder
            const generatedPrompt = await promptGenerationService.generatePrompt(userId, {
              garmentType: this.detectGarmentType(prompt),
              season: null,
              occasion: null,
              creativity: settings.creativity || 0.5,
              useCache: true,
              variationSeed: Date.now() % 1000,
              userModifiers: userModifiers.length > 0 ? userModifiers : undefined,
              respectUserIntent: settings.respectUserIntent || false,
              brandDNA: brandDNA,
              enforceBrandDNA: settings.creativity < 0.5 // Low creativity = enforce brand DNA
            });

            enhancedPrompt = {
              original: { promptText: prompt },
              enhanced: {
                mainPrompt: generatedPrompt.positive_prompt,
                negativePrompt: generatedPrompt.negative_prompt,
                keywords: []
              },
              metadata: generatedPrompt.metadata,
              brandDNA: brandDNA
            };

            finalNegativePrompt = generatedPrompt.negative_prompt;
            promptMetadata = {
              source: 'intelligent_prompt_builder',
              usedStyleProfile: true,
              hasBrandDNA: !!brandDNA,
              creativity: settings.creativity,
              respectUserIntent: settings.respectUserIntent,
              ...generatedPrompt.metadata
            };

            logger.info('Enhanced prompt generated with IntelligentPromptBuilder', {
              generationId,
              userId,
              promptPreview: generatedPrompt.positive_prompt.substring(0, 80),
              creativityUsed: settings.creativity,
              brandConsistency: generatedPrompt.metadata?.brandConsistency
            });

          } else {
            logger.warn('No style profile found, using original prompt', {
              generationId,
              userId
            });

            // Fallback to original prompt
            enhancedPrompt = {
              original: { promptText: prompt },
              enhanced: {
                mainPrompt: prompt,
                negativePrompt: negativePrompt || '',
                keywords: []
              }
            };

            promptMetadata = {
              source: 'direct_prompt',
              usedStyleProfile: false
            };
          }

        } catch (error) {
          logger.error('Failed to use IntelligentPromptBuilder, falling back to original prompt', {
            generationId,
            userId,
            error: error.message
          });

          // Fallback to original prompt
          enhancedPrompt = {
            original: { promptText: prompt },
            enhanced: {
              mainPrompt: prompt,
              negativePrompt: negativePrompt || '',
              keywords: []
            }
          };

          promptMetadata = {
            source: 'direct_prompt_fallback',
            error: error.message
          };
        }

      } else {
        // No creativity specified or no userId - use original prompt
        logger.info('Using original prompt without IntelligentPromptBuilder', {
          generationId,
          reason: !userId ? 'no_user_id' : 'no_creativity_setting'
        });

        enhancedPrompt = {
          original: { promptText: prompt },
          enhanced: {
            mainPrompt: prompt,
            negativePrompt: negativePrompt || '',
            keywords: []
          }
        };

        promptMetadata = {
          source: 'direct_prompt',
          usedStyleProfile: false
        };
      }

      // Route to model
      const routing = await routingService.routePrompt(enhancedPrompt, {
        strategy: settings.strategy || 'balanced',
        userId,
        forceProvider: settings.provider
      });

      await this.updateGenerationStage(generationId, {
        stage: 'routing_complete',
        routing
      });

      // Generate
      const adapter = this.getAdapter(routing.provider.id);
      if (!adapter) {
        throw new Error(`No adapter available for provider: ${routing.provider.id}`);
      }

      const finalMainPrompt = enhancedPrompt.enhanced.mainPrompt;
      const generationResult = await adapter.generate({
        prompt: finalMainPrompt,
        negativePrompt: finalNegativePrompt,
        settings
      });

      if (!generationResult.success) {
        throw new Error(`Generation failed: ${generationResult.error}`);
      }

      await this.updateGenerationStage(generationId, {
        stage: 'generation_complete',
        generationResult
      });

      // Upload and store
      const uploadedAssets = await this.uploadAndStoreAssets({
        generationId,
        userId,
        images: generationResult.images,
        provider: routing.provider,
        routing,
        mainPrompt: finalMainPrompt,
        negativePrompt: finalNegativePrompt,
        promptMetadata: promptMetadata
      });

      // Complete
      const completedGeneration = await this.completeGeneration({
        generationId,
        assets: uploadedAssets,
        cost: generationResult.cost,
        metadata: {
          prompt: finalMainPrompt,
          negativePrompt: finalNegativePrompt,
          routing,
          generationResult,
          promptMetadata
        }
      });

      // Auto-validate if enabled (non-blocking)
      if (settings.autoValidate !== false) {
        this.validateGenerationAsync(generationId, uploadedAssets, null)
          .catch(error => {
            logger.error('Auto-validation failed (non-blocking)', {
              generationId,
              error: error.message
            });
          });
      }

      logger.info('Prompt-based generation completed', {
        generationId,
        userId,
        assetCount: uploadedAssets.length,
        usedIntelligentPromptBuilder: promptMetadata.usedStyleProfile
      });

      return completedGeneration;

    } catch (error) {
      logger.error('Prompt-based generation failed', {
        generationId,
        error: error.message
      });

      await this.failGeneration(generationId, error);
      throw error;
    }
  }

  /**
   * Helper: Extract modifiers from prompt text for IntelligentPromptBuilder
   */
  extractModifiersFromPrompt(prompt) {
    const modifiers = [];
    const promptLower = prompt.toLowerCase();

    // Extract colors
    const colors = ['black', 'white', 'navy', 'burgundy', 'charcoal', 'beige', 'camel', 'gray', 'grey', 'brown', 'red', 'blue', 'green'];
    colors.forEach(color => {
      if (promptLower.includes(color)) modifiers.push(color);
    });

    // Extract styles
    const styles = ['casual', 'formal', 'elegant', 'sporty', 'chic', 'minimalist', 'bohemian', 'vintage', 'modern', 'classic'];
    styles.forEach(style => {
      if (promptLower.includes(style)) modifiers.push(style);
    });

    // Extract fabrics
    const fabrics = ['silk', 'cotton', 'wool', 'cashmere', 'linen', 'denim', 'leather', 'velvet'];
    fabrics.forEach(fabric => {
      if (promptLower.includes(fabric)) modifiers.push(fabric);
    });

    // Extract garment-specific modifiers
    const garmentModifiers = ['fitted', 'oversized', 'structured', 'flowing', 'tailored', 'relaxed'];
    garmentModifiers.forEach(modifier => {
      if (promptLower.includes(modifier)) modifiers.push(modifier);
    });

    return [...new Set(modifiers)]; // Remove duplicates
  }

  /**
   * Helper: Detect garment type from prompt text
   */
  detectGarmentType(prompt) {
    const promptLower = prompt.toLowerCase();
    const garmentTypes = ['dress', 'blazer', 'jacket', 'coat', 'top', 'shirt', 'blouse', 'skirt', 'pants', 'suit', 'outfit'];

    for (const garment of garmentTypes) {
      if (promptLower.includes(garment)) {
        return garment;
      }
    }

    return 'outfit'; // Default fallback
  }

  /**
   * Get generation status
   */
  async getGeneration(generationId) {
    const client = await db.getClient();
    
    try {
      const result = await client.query(`
        SELECT 
          g.*,
          json_agg(
            json_build_object(
              'id', ga.id,
              'url', ga.cdn_url,
              'type', ga.asset_type,
              'size', ga.file_size
            )
          ) FILTER (WHERE ga.id IS NOT NULL) as assets
        FROM generations g
        LEFT JOIN generation_assets ga ON g.id = ga.generation_id
        WHERE g.id = $1
        GROUP BY g.id
      `, [generationId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * List user's generations
   */
  async listGenerations(userId, options = {}) {
    const { limit = 20, offset = 0, status } = options;
    
    const client = await db.getClient();
    
    try {
      let query = `
        SELECT 
          g.*,
          COUNT(ga.id) as asset_count
        FROM generations g
        LEFT JOIN generation_assets ga ON g.id = ga.generation_id
        WHERE g.user_id = $1
      `;
      
      const params = [userId];
      
      if (status) {
        params.push(status);
        query += ` AND g.status = $${params.length}`;
      }
      
      query += `
        GROUP BY g.id
        ORDER BY g.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      
      params.push(limit, offset);
      
      const result = await client.query(query, params);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Get adapter for provider
   */
  getAdapter(providerId) {
    return this.adapters[providerId];
  }

  /**
   * Helper: Create generation record
   */
  async createGenerationRecord(params) {
    const client = await db.getClient();
    
    try {
      const result = await client.query(`
        INSERT INTO generations (
          id, user_id, status, settings, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `, [
        params.generationId,
        params.userId,
        params.status,
        JSON.stringify(params.settings)
      ]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Update generation stage
   */
  async updateGenerationStage(generationId, stageData) {
    const client = await db.getClient();
    
    try {
      await client.query(`
        UPDATE generations
        SET 
          pipeline_data = COALESCE(pipeline_data, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
        WHERE id = $1
      `, [generationId, JSON.stringify(stageData)]);
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Upload and store assets
   */
  async uploadAndStoreAssets(params) {
    const { generationId, userId, images, provider } = params;
    const uploadedAssets = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      
      try {
        // Download image from provider URL
        const response = await fetch(image.url);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Upload to R2
        const key = `generations/${userId}/${generationId}/${i}.png`;
        const uploadResult = await r2Service.uploadImage(buffer, key, {
          contentType: 'image/png',
          metadata: {
            generationId,
            provider: provider.id,
            index: i
          }
        });

        // Store in database - both generation_assets AND images tables
        const client = await db.getClient();
        try {
          // Insert into generation_assets table
          const assetResult = await client.query(`
            INSERT INTO generation_assets (
              generation_id, r2_key, cdn_url, asset_type,
              file_size, provider_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `, [
            generationId,
            uploadResult.key,
            uploadResult.cdnUrl,
            'image',
            buffer.length,
            provider.id,
            JSON.stringify({ revisedPrompt: image.revisedPrompt })
          ]);
          
          // ALSO insert into images table for gallery display
          // Include promptId and prompt text in vlt_analysis for pairing and display
          const vltAnalysis = {
            ...(params.vltSpec || {}),
            promptId: params.promptId || null, // Store prompt ID for pairing
            promptText: params.mainPrompt || image.revisedPrompt || 'Generated image', // Store actual prompt text (now passed directly)
            mainPrompt: params.mainPrompt || image.revisedPrompt, // Store main prompt
            negativePrompt: params.negativePrompt || '', // Store negative prompt if available
            promptMetadata: params.promptMetadata || {}, // Store prompt metadata
            generationIndex: i,
            generatedAt: new Date().toISOString(),
            model: provider.id,
            tags: [
              params.vltSpec?.garment_type || 'fashion',
              params.vltSpec?.style?.aesthetic || params.vltSpec?.aesthetic || 'contemporary'
            ].filter(Boolean)
          };
          
          await client.query(`
            INSERT INTO images (
              user_id, r2_key, r2_bucket, cdn_url,
              original_size, format, vlt_analysis, generation_cost
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            userId,
            uploadResult.key,
            process.env.R2_BUCKET_NAME || 'anatomie-lab',
            uploadResult.cdnUrl,
            buffer.length,
            'png',
            JSON.stringify(vltAnalysis),
            0.030 // Imagen 4 Ultra cost per image
          ]);

          uploadedAssets.push(assetResult.rows[0]);
        } finally {
          client.release();
        }
      } catch (error) {
        logger.error('Failed to upload asset', {
          generationId,
          imageIndex: i,
          error: error.message
        });
      }
    }

    return uploadedAssets;
  }

  /**
   * Helper: Complete generation
   */
  async completeGeneration(params) {
    const { generationId, assets, cost, metadata } = params;
    
    const client = await db.getClient();
    
    try {
      // Convert cost from dollars to cents for cost_cents column (if cost is provided)
      const costCents = cost ? Math.round(cost * 100) : null;
      
      const result = await client.query(`
        UPDATE generations
        SET 
          status = 'completed',
          cost_cents = $2,
          pipeline_data = $3,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [generationId, costCents, JSON.stringify(metadata)]);

      return {
        ...result.rows[0],
        assets
      };
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Fail generation
   */
  async failGeneration(generationId, error) {
    const client = await db.getClient();
    
    try {
      await client.query(`
        UPDATE generations
        SET 
          status = 'failed',
          error_message = $2,
          updated_at = NOW()
        WHERE id = $1
      `, [generationId, error.message]);
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Filter validated images and return best N
   * Also feeds discarded images to RLHF as negative examples
   * @param {string} generationId - Generation ID
   * @param {Array} assets - All generated assets
   * @param {number} requestedCount - Number of images user requested
   * @param {Object} targetSpec - Original VLT spec
   * @returns {Promise<Array>} Best N validated assets
   */
  async filterAndReturnBestImages(generationId, assets, requestedCount, targetSpec) {
    try {
      logger.info('Filtering images with validation', {
        generationId,
        totalAssets: assets.length,
        requestedCount
      });

      // Validate all assets
      const validationResults = [];
      for (const asset of assets) {
        try {
          const validation = await validationService.validateGeneration(
            generationId,
            asset.id,
            targetSpec
          );
          validationResults.push({
            asset,
            validation
          });
        } catch (error) {
          logger.error('Validation failed for asset', {
            generationId,
            assetId: asset.id,
            error: error.message
          });
          // Still include but with low score
          validationResults.push({
            asset,
            validation: {
              overallScore: 0,
              consistencyScore: 0,
              isRejected: true,
              rejectionReason: 'Validation error: ' + error.message
            }
          });
        }
      }

      // Sort by overall score (best first)
      validationResults.sort((a, b) => 
        (b.validation.overallScore || 0) - (a.validation.overallScore || 0)
      );

      // Split into returned and discarded
      const returned = validationResults.slice(0, requestedCount);
      const discarded = validationResults.slice(requestedCount);

      logger.info('Image filtering complete', {
        generationId,
        returned: returned.length,
        discarded: discarded.length,
        avgReturnedScore: returned.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / returned.length,
        avgDiscardedScore: discarded.length > 0 ? discarded.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / discarded.length : 0
      });

      // Feed discarded images to RLHF as negative examples
      if (discarded.length > 0) {
        await this.feedDiscardedToRLHF(generationId, discarded, targetSpec);
      }

      // Update generation metadata with filtering stats
      const client = await db.getClient();
      try {
        await client.query(`
          UPDATE generations
          SET pipeline_data = pipeline_data || jsonb_build_object(
            'filtering', jsonb_build_object(
              'requested', $2,
              'generated', $3,
              'returned', $4,
              'discarded', $5,
              'avg_returned_score', $6,
              'avg_discarded_score', $7
            )
          )
          WHERE id = $1
        `, [
          generationId,
          requestedCount,
          assets.length,
          returned.length,
          discarded.length,
          returned.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / returned.length,
          discarded.length > 0 ? discarded.reduce((sum, r) => sum + (r.validation.overallScore || 0), 0) / discarded.length : null
        ]);
      } finally {
        client.release();
      }

      // Return only the asset objects (without validation data)
      return returned.map(r => r.asset);

    } catch (error) {
      logger.error('Failed to filter validated images', {
        generationId,
        error: error.message
      });
      // On failure, just return first N assets
      return assets.slice(0, requestedCount);
    }
  }

  /**
   * Helper: Feed discarded images to RLHF as negative examples
   * @param {string} generationId - Generation ID
   * @param {Array} discarded - Discarded image results
   * @param {Object} targetSpec - Target specification
   */
  async feedDiscardedToRLHF(generationId, discarded, targetSpec) {
    try {
      logger.info('Feeding discarded images to RLHF', {
        generationId,
        count: discarded.length
      });

      const client = await db.getClient();

      // Store negative feedback for each discarded image
      for (const item of discarded) {
        const { asset, validation } = item;

        // Create negative feedback entry
        await client.query(`
          INSERT INTO rlhf_feedback (
            generation_id,
            asset_id,
            feedback_type,
            feedback_source,
            quality_score,
            validation_score,
            is_negative_example,
            metadata,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
          generationId,
          asset.id,
          'discarded',
          'validation_filter',
          validation.overallScore || 0,
          validation.consistencyScore || 0,
          true, // Mark as negative example
          JSON.stringify({
            reason: 'Filtered out during over-generation',
            validationData: {
              overallScore: validation.overallScore,
              consistencyScore: validation.consistencyScore,
              styleScore: validation.styleConsistencyScore,
              isOutlier: validation.isOutlier,
              isRejected: validation.isRejected,
              rejectionReason: validation.rejectionReason
            },
            targetSpec: targetSpec ? {
              attributeCount: Object.keys(targetSpec.attributes || {}).length,
              style: targetSpec.style?.overall
            } : null
          })
        ]);
      }

      logger.info('Discarded images fed to RLHF', {
        generationId,
        feedbackCount: discarded.length
      });

      client.release();

    } catch (error) {
      logger.error('Failed to feed discarded images to RLHF', {
        generationId,
        error: error.message
      });
      // Non-critical error, don't throw
    }
  }

  /**
   * Helper: Validate generation asynchronously (Stage 8)
   * @param {string} generationId - Generation ID
   * @param {Array} assets - Generated assets
   * @param {Object} targetSpec - Original VLT spec for comparison
   */
  async validateGenerationAsync(generationId, assets, targetSpec) {
    try {
      logger.info('Starting auto-validation', {
        generationId,
        assetCount: assets.length,
        hasTargetSpec: !!targetSpec
      });

      // Validate each asset
      for (const asset of assets) {
        try {
          await validationService.validateGeneration(generationId, asset.id, targetSpec);
          
          logger.info('Asset validated', {
            generationId,
            assetId: asset.id
          });
        } catch (error) {
          logger.error('Asset validation failed', {
            generationId,
            assetId: asset.id,
            error: error.message
          });
        }
      }

      // Check if any validations failed and update generation status if needed
      const client = await db.getClient();
      try {
        const validationResults = await client.query(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN is_rejected = TRUE THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN is_flagged = TRUE THEN 1 ELSE 0 END) as flagged,
            AVG(overall_score) as avg_score
          FROM validation_results
          WHERE generation_id = $1 AND status = 'completed'
        `, [generationId]);

        const stats = validationResults.rows[0];
        
        // Update generation metadata with validation stats
        if (stats.total > 0) {
          await client.query(`
            UPDATE generations
            SET pipeline_data = pipeline_data || jsonb_build_object(
              'validation', jsonb_build_object(
                'total', $2::int,
                'rejected', $3::int,
                'flagged', $4::int,
                'avgScore', $5::numeric,
                'validated_at', NOW()
              )
            )
            WHERE id = $1
          `, [
            generationId,
            parseInt(stats.total),
            parseInt(stats.rejected),
            parseInt(stats.flagged),
            parseFloat(stats.avg_score)
          ]);

          logger.info('Generation validation completed', {
            generationId,
            ...stats
          });
        }
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('Async validation failed', {
        generationId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Helper: Store DPP selection results (Stage 9)
   * @param {string} generationId - Generation ID
   * @param {Object} dppData - DPP selection data
   */
  async storeDPPResults(generationId, dppData) {
    try {
      const client = await db.getClient();
      try {
        await client.query(`
          INSERT INTO dpp_selection_results (
            generation_id,
            input_count,
            target_count,
            selected_count,
            selected_asset_ids,
            rejected_asset_ids,
            diversity_score,
            avg_coverage,
            avg_pairwise_distance,
            avg_quality_score,
            min_quality_score,
            max_quality_score,
            attribute_coverage,
            selection_duration_ms,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          ON CONFLICT (generation_id) DO UPDATE SET
            input_count = EXCLUDED.input_count,
            selected_count = EXCLUDED.selected_count,
            diversity_score = EXCLUDED.diversity_score
        `, [
          generationId,
          dppData.inputCount,
          dppData.targetCount,
          dppData.selectedCount,
          dppData.selectedAssetIds,
          dppData.rejectedAssetIds,
          dppData.metrics.diversityScore,
          parseFloat(dppData.metrics.avgCoverage),
          parseFloat(dppData.metrics.avgPairwiseDistance),
          parseFloat(dppData.metrics.qualityStats.avgScore),
          dppData.metrics.qualityStats.minScore,
          dppData.metrics.qualityStats.maxScore,
          JSON.stringify(dppData.metrics.attributeCoverage),
          dppData.duration
        ]);

        logger.info('DPP results stored', { generationId });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to store DPP results', {
        generationId,
        error: error.message
      });
      // Non-critical error, don't throw
    }
  }

  /**
   * Helper: Generate unique UUID
   */
  generateId() {
    // Generate a proper UUID v4
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
  }
}

module.exports = new GenerationService();
