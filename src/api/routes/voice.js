const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const generationService = require('../../services/generationService');
const IntelligentPromptBuilder = require('../../services/IntelligentPromptBuilder');
const agentService = require('../../services/agentService');

// ========== IMPORTS ==========
const SpecificityAnalyzer = require('../../services/specificityAnalyzer');
const TrendAwareSuggestionEngine = require('../../services/trendAwareSuggestionEngine');
const queryProcessor = require('../../services/queryProcessingService');

const specificityAnalyzer = new SpecificityAnalyzer();
const suggestionEngine = new TrendAwareSuggestionEngine();
// =================================

const router = express.Router();

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'), false);
    }
  }
});

/**
 * POST /api/voice/process-text
 * Process text command (e.g., "make me 40 dresses")
 */
router.post('/process-text', asyncHandler(async (req, res) => {
  const { command, userId } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Command text is required'
    });
  }

  const uid = (req.user && req.user.id) || userId || req.query.userId || 'dev-test';

  logger.info('Processing voice text command', {
    userId: uid,
    command: command.substring(0, 100)
  });

  try {
    const parsedCommand = await parseVoiceCommand(command, uid);

    // Generate images based on parsed command
    let generationResult = null;
    if (parsedCommand.quantity > 0) {
      logger.info('Initiating image generation from voice command', {
        userId: uid,
        command: command.substring(0, 100),
        requestedQuantity: parsedCommand.quantity,
        displayQuery: parsedCommand.displayQuery,
        garmentType: parsedCommand.garmentType
      });

      try {
        // FIXED: Generate N unique prompts using the enhanced prompt as base
        // Create variations from the already-enhanced prompt from parseVoiceCommand
        const prompts = [];
        for (let i = 0; i < parsedCommand.quantity; i++) {
          // Use the enhanced prompt that was already generated with style profile + brand DNA
          const promptResult = await IntelligentPromptBuilder.generatePrompt(uid, {
            // Base the prompt on the already-enhanced request
            basePrompt: parsedCommand.enhancedPrompt,
            garmentType: parsedCommand.garmentType,
            
            // Preserve user modifiers and specificity from the parsed command
            userModifiers: parsedCommand.parsedPrompt?.userModifiers || [],
            
            // Use specificity analysis from voice command parsing
            specificityScore: parsedCommand.specificityAnalysis?.specificityScore || 0.5,
            creativity: parsedCommand.specificityAnalysis?.creativityTemp || 0.3,
            parsedUserPrompt: parsedCommand.parsedPrompt,
            
            // Generation settings for variety
            enforceBrandDNA: true,
            brandDNAStrength: 0.8,
            useCache: false, // Don't cache - we want variations
            variationSeed: Date.now() + i, // Unique seed for each
            generationIndex: i, // For model gender alternation
            enablePrecisionTokens: false
          });

          prompts.push({
            positive: promptResult.positive_prompt,
            negative: promptResult.negative_prompt,
            metadata: promptResult.metadata
          });

          logger.info(`Generated unique prompt ${i + 1}/${parsedCommand.quantity} from enhanced base`, {
            userId: uid,
            garmentType: parsedCommand.garmentType,
            baseEnhancedPrompt: parsedCommand.enhancedPrompt.substring(0, 60),
            promptPreview: promptResult.positive_prompt.substring(0, 80),
            specificity: parsedCommand.specificityAnalysis?.specificityScore
          });
        }

        // Generate images with individual prompts
        generationResult = await generationService.generateFromPrompt({
          userId: uid,
          prompts, // Pass array of unique prompts
          batchMode: true,
          individualPrompts: true,
          settings: {
            generationMethod: 'voice_command'
          }
        });

      } catch (genError) {
        logger.error('Image generation from voice command failed', {
          error: genError.message,
          parsedCommand
        });
      }
    }

    // Format generation result for frontend consumption
    let formattedGeneration = null;
    if (generationResult && generationResult.images) {
      // Convert images array to assets format expected by Home page
      formattedGeneration = {
        ...generationResult,
        assets: generationResult.images.map((img) => ({
          id: img.id,
          url: img.imageUrl || img.url,
          cdnUrl: img.imageUrl || img.url,
          prompt: img.prompt,
          promptText: img.prompt,
          metadata: img.metadata || {},
          createdAt: img.createdAt || new Date().toISOString(),
          origin: 'voice_command',
          tags: ['voice-generated']
        }))
      };

      logger.info('Formatted generation result for frontend', {
        userId: uid,
        imageCount: formattedGeneration.assets.length
      });
    }

    res.json({
      success: true,
      data: {
        // What the user said (for transparency)
        displayQuery: parsedCommand.displayQuery,
        originalCommand: command,

        // Enhanced prompt sent to API (for power users)
        enhancedPrompt: parsedCommand.enhancedPrompt,
        negativePrompt: parsedCommand.negativePrompt,

        // Parsed command details
        parsedCommand,

        // Generation results (formatted for frontend)
        generation: formattedGeneration,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Voice command processing failed', {
      userId: uid,
      command,
      error: error.message
    });
    throw error;
  }
}));

// ========== NEW ENDPOINT: GET SUGGESTIONS ==========
/**
 * GET /api/voice/suggestions
 * Get AI-generated suggestions based on profile + trends
 */
// Extracted suggestions handler so it can be mounted with or without auth.
const suggestionsHandler = asyncHandler(async (req, res) => {
  try {
    // Support both authenticated requests (req.user) and public requests
    // which may pass an optional userId via query parameter.
    const userId = (req.user && req.user.id) || req.query.userId || null;

    const suggestions = await suggestionEngine.generateSuggestions(userId);

    res.json({
      success: true,
      data: suggestions,
      meta: {
        season: suggestionEngine.currentSeason,
        count: suggestions.length
      }
    });
  } catch (error) {
    logger.error('Suggestion generation failed', {
      userId: (req.user && req.user.id) || req.query.userId || null,
      error: error.message
    });
    throw error;
  }
});

router.get('/suggestions', suggestionsHandler);
// ===================================================

/**
 * POST /api/voice/process-audio
 * Process audio file using speech-to-text
 */
router.post('/process-audio', upload.single('audio'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Audio file is required'
    });
  }

  const uid = (req.user && req.user.id) || req.body.userId || req.query.userId || 'dev-test';

  logger.info('Processing voice audio command', {
    userId: uid,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype
  });

  try {
    // Convert audio to text using Google Speech-to-Text
    const transcribedText = await transcribeAudio(req.file.buffer);
    
    // Parse with specificity analysis
    const parsedCommand = await parseVoiceCommand(transcribedText, uid);
    
    // Generate images
    let generationResult = null;
    if (parsedCommand.quantity > 0) {
      logger.info('Initiating image generation from voice audio', {
        userId: uid,
        quantity: parsedCommand.quantity,
        garmentType: parsedCommand.garmentType,
        usedStyleProfile: parsedCommand.usedStyleProfile,
        specificityScore: parsedCommand.specificityAnalysis?.specificityScore,
        creativityTemp: parsedCommand.specificityAnalysis?.creativityTemp
      });
      
      try {
        // Generate N unique prompts using the enhanced prompt as base
        // Create variations for batch audio generation
        const prompts = [];
        for (let i = 0; i < parsedCommand.quantity; i++) {
          // Use the enhanced prompt that was already generated with style profile + brand DNA
          const promptResult = await IntelligentPromptBuilder.generatePrompt(uid, {
            // Base the prompt on the already-enhanced request
            basePrompt: parsedCommand.enhancedPrompt,
            garmentType: parsedCommand.garmentType,
            
            // Preserve user modifiers and specificity from the parsed command
            userModifiers: parsedCommand.parsedPrompt?.userModifiers || [],
            
            // Use specificity analysis from voice command parsing
            specificityScore: parsedCommand.specificityAnalysis?.specificityScore || 0.5,
            creativity: parsedCommand.specificityAnalysis?.creativityTemp || 0.3,
            parsedUserPrompt: parsedCommand.parsedPrompt,
            
            // Generation settings for variety
            enforceBrandDNA: true,
            brandDNAStrength: 0.8,
            useCache: false, // Don't cache - we want variations
            variationSeed: Date.now() + i, // Unique seed for each
            generationIndex: i, // For model gender alternation
            enablePrecisionTokens: false
          });

          prompts.push({
            positive: promptResult.positive_prompt,
            negative: promptResult.negative_prompt,
            metadata: promptResult.metadata
          });

          logger.info(`Generated unique prompt ${i + 1}/${parsedCommand.quantity} from enhanced base (audio)`, {
            userId: uid,
            garmentType: parsedCommand.garmentType,
            baseEnhancedPrompt: parsedCommand.enhancedPrompt.substring(0, 60),
            promptPreview: promptResult.positive_prompt.substring(0, 80),
            specificity: parsedCommand.specificityAnalysis?.specificityScore
          });
        }

        generationResult = await generationService.generateFromPrompt({
          userId: uid,
          prompts, // Pass array of unique prompts
          batchMode: true,
          individualPrompts: true,
          settings: {
            generationMethod: 'voice_command'
          }
        });
      } catch (genError) {
        logger.error('Image generation from voice audio failed', {
          error: genError.message,
          parsedCommand
        });
      }
    }

    res.json({
      success: true,
      data: {
        transcribedText,
        parsedCommand,
        generation: generationResult,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Voice audio processing failed', {
      userId: uid,
      error: error.message
    });
    throw error;
  }
}));

/**
 * GET /api/voice/commands/examples
 * Get example voice commands
 */
router.get('/commands/examples', asyncHandler(async (req, res) => {
  const examples = [
    {
      category: 'Basic Generation',
      commands: [
        'Make me 10 dresses',
        'Create 5 summer tops',
        'Generate 20 evening gowns',
        'Design 15 casual shirts'
      ]
    },
    {
      category: 'Style Specific',
      commands: [
        'Make me 10 bohemian style dresses',
        'Create 5 minimalist black tops',
        'Generate 8 vintage inspired skirts',
        'Design 12 professional blazers'
      ]
    },
    {
      category: 'Highly Specific',
      commands: [
        'Make a sporty chic cashmere fitted dress',
        'Create exactly 3 navy blue structured blazers',
        'Design a flowing silk evening gown in burgundy'
      ]
    }
  ];

  res.json({
    success: true,
    data: examples
  });
}));

// ========== HELPER: Generate Display Query ==========
/**
 * Generate human-readable display query from parsed command
 * Shows user what we understood from their request
 * @param {Object} params - Parsed command components
 * @returns {string} Human-readable query
 */
function generateDisplayQuery(params) {
  const {
    action,
    quantity,
    garmentType,
    styles = [],
    colors = [],
    fabrics = [],
    occasions = [],
    constructionDetails = [],
    styleModifiers = []
  } = params;

  let query = '';

  // Action
  if (action === 'create' || action === 'generate' || action === 'make') {
    query = 'Generate';
  } else if (action === 'show') {
    query = 'Show';
  } else {
    query = action.charAt(0).toUpperCase() + action.slice(1);
  }

  // Quantity
  if (quantity > 1) {
    query += ` ${quantity}`;
  } else {
    query += ' a';
  }

  // Style modifiers (e.g., "moto", "bomber")
  if (styleModifiers.length > 0) {
    query += ` ${styleModifiers.join(' ')}`;
  }

  // Styles (e.g., "bohemian", "minimalist")
  if (styles.length > 0) {
    query += ` ${styles.join(' ')}`;
  }

  // Colors
  if (colors.length > 0) {
    query += ` ${colors.join(' and ')}`;
  }

  // Garment type
  query += ` ${garmentType}`;
  if (quantity > 1 && !garmentType.endsWith('s')) {
    query += 's';
  }

  // Fabrics
  if (fabrics.length > 0) {
    query += ` in ${fabrics.join(' and ')}`;
  }

  // Construction details
  if (constructionDetails.length > 0) {
    query += ` with ${constructionDetails.join(' and ')}`;
  }

  // Occasions
  if (occasions.length > 0) {
    query += ` for ${occasions.join(' and ')} occasions`;
  }

  return query;
}

// ========== ENHANCED parseVoiceCommand FUNCTION ==========
/**
 * Parse voice command with specificity analysis
 * @param {string} command - Natural language command
 * @param {string} userId - User ID to fetch style profile
 * @returns {Object} Parsed command structure with specificity analysis
 */
async function parseVoiceCommand(command, userId = null) {
  const cleanCommand = command.toLowerCase().trim();
  
  // Process command using QueryProcessingService
  let processedQuery;
  try {
    processedQuery = await queryProcessor.processQuery(cleanCommand, userId);
  } catch (error) {
    logger.error('Query processing failed, using fallback parsing', {
      error: error.message,
      command: cleanCommand
    });
    // Fallback to basic parsing if query processor fails
    processedQuery = {
      success: true,
      originalQuery: cleanCommand,
      queryType: 'specific',
      intent: { action: 'make', count: 1, specificity: 'specific', confidence: 0.5 },
      entities: {
        count: 1,
        garmentType: 'dress',
        styles: [],
        colors: [],
        fabrics: [],
        occasions: [],
        constructionDetails: [],
        styleModifiers: []
      },
      structuredQuery: { count: 1 }
    };
  }

  // Extract core information from processed query
  const quantity = processedQuery.entities.count || processedQuery.structuredQuery?.count || 1;
  const action = processedQuery.intent?.action || 'create';
  let garmentType = processedQuery.entities.garmentType;
  // Infer garment type directly from the user's phrasing when the query processor returns something generic
  const inferredGarment = inferGarmentTypeFromCommand(cleanCommand);
  if ((!garmentType || garmentType === 'outfit' || garmentType === 'dress') && inferredGarment) {
    logger.info('Garment type overridden by direct command inference', {
      originalGarmentType: garmentType,
      inferredGarment
    });
    garmentType = inferredGarment;
  }

  // Normalize garment type early to avoid accidental ReferenceErrors later
  const normalizedGarmentType = normalizeGarmentType(garmentType || 'outfit');

  // Get structured data from processed query
  const {
    styles: qpStyles = [],
    colors: qpColors = [],
    fabrics: qpFabrics = [],
    occasions: qpOccasions = [],
    constructionDetails: qpConstructionDetails = [],
    styleModifiers: qpStyleModifiers = []
  } = processedQuery.entities;

  // Fallback extractions to capture literal user descriptors missed by the LLM parser
  const styles = qpStyles.length > 0 ? qpStyles : extractStyles(cleanCommand);
  const colors = qpColors.length > 0 ? qpColors : extractColors(cleanCommand);
  const fabrics = qpFabrics.length > 0 ? qpFabrics : extractFabrics(cleanCommand);
  const occasions = qpOccasions.length > 0 ? qpOccasions : extractOccasions(cleanCommand);
  const constructionDetails = qpConstructionDetails.length > 0
    ? qpConstructionDetails
    : extractConstructionDetails(cleanCommand);
  const styleModifiers = qpStyleModifiers.length > 0
    ? qpStyleModifiers
    : extractStyleModifiers(cleanCommand);

  // Use processed query's specificity analysis
  const specificityAnalysis = processedQuery.specificity || specificityAnalyzer.analyzeCommand(command, {
    colors,
    styles,
    fabrics,
    modifiers: [...styles, ...colors, ...fabrics],
    occasions,
    count: quantity
  });

  logger.info('Command processed and analyzed', {
    command: command.substring(0, 50),
    quantity,
    garmentType,
    specificityScore: specificityAnalysis.specificityScore.toFixed(3),
    queryType: processedQuery.queryType,
    mode: specificityAnalysis.mode
  });
  // ===============================================

  // Ensure downstream prompt builder honors literal intent from this command
  const baseModifiers = processedQuery.entities.modifiers || [];
  const aggregatedModifiers = Array.from(
    new Set([
      ...baseModifiers,
      ...styles,
      ...styleModifiers,
      ...constructionDetails,
      ...colors,
      ...fabrics,
      ...occasions
    ].filter(Boolean))
  );

  const parsedPromptPayload = {
    text: command,
    garmentType: normalizedGarmentType,
    colors,
    fabrics,
    styleAdjectives: styles,
    styleModifiers,
    constructionDetails,
    userModifiers: aggregatedModifiers,
    occasion: occasions[0] || processedQuery.entities.occasion,
    season: processedQuery.entities.season,
    specificity: mapSpecificityLevel(specificityAnalysis.specificityScore),
    specificityScore: specificityAnalysis.specificityScore,
    count: quantity
  };
  processedQuery.entities.modifiers = aggregatedModifiers;

  // Fetch user's style profile and generate prompt
  let styleProfile = null;
  let enhancedPrompt = null;
  let negativePrompt = null;
  
  if (userId) {
    try {
      const profileResult = await agentService.getStyleProfile(userId);
      if (profileResult.success && profileResult.data) {
        styleProfile = profileResult.data.profile_data || profileResult.data;
        
        // Extract and prepare brand DNA
        const brandDNA = await IntelligentPromptBuilder.extractBrandDNA(styleProfile);
        
        // Prepare style preferences from profile
        const stylePreferences = IntelligentPromptBuilder.extractStylePreferences(styleProfile);

        // Generate enhanced prompt using style profile as the base
        const generatedPrompt = await IntelligentPromptBuilder.generatePrompt(userId, {
          // Base garment request
          garmentType: processedQuery.entities.garmentType,
          quantity: quantity,
          
          // Style profile integration
          styleProfile: stylePreferences,
          brandDNA: brandDNA,
          enforceBrandDNA: true, // Always use brand DNA as base
          
          // Query-specific modifications
          queryType: processedQuery.queryType,
          specificityScore: specificityAnalysis.specificityScore,
          mode: specificityAnalysis.mode,
          creativity: specificityAnalysis.creativityTemp,
          
          // User modifications (if any)
          userModifiers: parsedPromptPayload.userModifiers,
          respectUserIntent: specificityAnalysis.specificityScore > 0.7,
          parsedUserPrompt: parsedPromptPayload,
          
          // Additional context
          season: processedQuery.entities.season,
          occasion: processedQuery.entities.occasion,
          
          // Generation settings
          useCache: false, // Ensure fresh prompts for each generation
          variationSeed: Date.now(),
          enablePrecisionTokens: false
        });
        // =====================================================================
        
        enhancedPrompt = generatedPrompt.positive_prompt;
        negativePrompt = generatedPrompt.negative_prompt;
        
        logger.info('Voice command enhanced with user style profile', {
          userId,
          command: command.substring(0, 50),
          promptPreview: enhancedPrompt.substring(0, 80),
          usedBrandDNA: !!brandDNA,
          styleProfileApplied: true,
          baseCreativity: specificityAnalysis.creativityTemp,
          userModificationsApplied: processedQuery.entities.modifiers?.length > 0
        });
      } else {
        logger.warn('No style profile found, using basic prompt', { userId });
      }
    } catch (error) {
      logger.error('Failed to fetch style profile for voice command', {
        userId,
        error: error.message
      });
    }
  }
  
  // Fallback: Use default style profile if user's is not available
  if (!enhancedPrompt) {
    const defaultPrompt = await IntelligentPromptBuilder.generatePrompt(null, {
      garmentType: processedQuery.entities.garmentType,
      quantity: quantity,
      useDefaultProfile: true,
      queryType: processedQuery.queryType,
      specificityScore: specificityAnalysis.specificityScore,
      userModifiers: parsedPromptPayload.userModifiers,
      mode: 'balanced',
      parsedUserPrompt: parsedPromptPayload,
      enablePrecisionTokens: false
    });
    
    enhancedPrompt = defaultPrompt.positive_prompt;
    negativePrompt = defaultPrompt.negative_prompt;
    
    logger.info('Using default style profile for prompt generation', { 
      userId: userId || 'none',
      garmentType: processedQuery.entities.garmentType
    });
  }

  // Generate human-readable display query from parsed command
  const displayQuery = generateDisplayQuery({
    action,
    quantity,
    garmentType: normalizedGarmentType,
    styles,
    colors,
    fabrics,
    occasions,
    constructionDetails,
    styleModifiers
  });

  return {
    action,
    quantity,
    garmentType: normalizedGarmentType,
    attributes: {
      styles,
      colors,
      fabrics,
      occasions,
      constructionDetails,  // NEW
      styleModifiers        // NEW
    },
    parsedPrompt: parsedPromptPayload,
    specificityAnalysis, // NEW: Include full analysis
    displayQuery,         // NEW: Human-readable query for UI
    vltSpecification: enhancedPrompt,
    enhancedPrompt,
    negativePrompt,
    usedStyleProfile: !!styleProfile,
    confidence: calculateConfidence(cleanCommand, {
      action,
      quantity,
      garmentType: normalizedGarmentType,
      styles,
      colors,
      fabrics,
      occasions,
      constructionDetails,  // NEW
      styleModifiers        // NEW
    })
  };
}
// =========================================================

// Keep all existing helper functions (extractStyles, extractColors, etc.)
function extractStyles(command) {
  const styleKeywords = [
    'bohemian', 'boho', 'minimalist', 'vintage', 'retro', 'modern', 'contemporary',
    'classic', 'traditional', 'casual', 'formal', 'elegant', 'chic', 'trendy',
    'professional', 'business', 'streetwear', 'gothic', 'romantic', 'edgy',
    'sporty', 'athletic', 'preppy', 'grunge', 'punk', 'feminine', 'masculine',
    'androgynous', 'avant-garde', 'artsy', 'sophisticated', 'luxe', 'refined'
  ];

  return styleKeywords.filter(style => command.includes(style));
}

function extractColors(command) {
  const colorKeywords = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'navy', 'maroon', 'teal', 'coral',
    'pastel', 'bright', 'dark', 'light', 'neon', 'earth tone', 'neutral',
    'burgundy', 'charcoal', 'sage', 'olive', 'taupe', 'cream', 'ivory',
    'champagne', 'gold', 'silver', 'bronze', 'copper', 'emerald', 'sapphire',
    'ruby', 'pearl', 'onyx', 'camel', 'khaki', 'rust', 'terracotta'
  ];

  return colorKeywords.filter(color => command.includes(color));
}

function extractFabrics(command) {
  const fabricKeywords = [
    'silk', 'cotton', 'wool', 'denim', 'linen', 'polyester', 'chiffon',
    'satin', 'velvet', 'leather', 'cashmere', 'jersey', 'tweed', 'lace',
    'neoprene', 'scuba', 'ponte', 'technical', 'performance', 'stretch',
    'mesh', 'organza', 'taffeta', 'brocade', 'damask', 'flannel', 'fleece',
    'canvas', 'corduroy', 'suede', 'faux leather', 'vegan leather',
    'merino', 'alpaca', 'mohair', 'angora', 'viscose', 'rayon', 'modal'
  ];

  return fabricKeywords.filter(fabric => command.includes(fabric));
}

function extractOccasions(command) {
  const occasionKeywords = [
    'wedding', 'party', 'work', 'business', 'casual', 'formal', 'evening',
    'cocktail', 'summer', 'winter', 'spring', 'fall', 'vacation', 'date',
    'interview', 'meeting', 'conference', 'gala', 'prom', 'graduation',
    'brunch', 'dinner', 'lunch', 'office', 'weekend', 'travel', 'resort'
  ];

  return occasionKeywords.filter(occasion => command.includes(occasion));
}

// NEW: Extract construction details like "two-way zips", "quilted", "ribbed"
function extractConstructionDetails(command) {
  const constructionKeywords = [
    'two-way zip', 'two way zip', 'zipper', 'zip', 'button', 'snap',
    'hook and eye', 'magnetic closure', 'tie', 'lace-up', 'buckle',
    'quilted', 'padded', 'lined', 'unlined', 'double-faced', 'reversible',
    'pleated', 'gathered', 'ruched', 'smocked', 'shirred', 'tucked',
    'darted', 'seamed', 'princess seam', 'french seam', 'flat-felled',
    'topstitched', 'blind hem', 'raw hem', 'frayed', 'distressed',
    'ribbed', 'cable knit', 'pointelle', 'jacquard', 'intarsia',
    'pockets', 'patch pocket', 'welt pocket', 'slash pocket', 'hidden pocket',
    'collar', 'notched collar', 'shawl collar', 'mandarin collar', 'peter pan',
    'hood', 'hoodie', 'drawstring', 'adjustable', 'removable',
    'cuffs', 'ribbed cuffs', 'buttoned cuffs', 'elastic cuffs'
  ];

  return constructionKeywords.filter(detail => command.includes(detail));
}

// NEW: Extract style modifiers like "moto", "bomber", "trench"
function extractStyleModifiers(command) {
  const styleModifierKeywords = [
    'moto', 'bomber', 'trench', 'parka', 'utility', 'military',
    'safari', 'blazer', 'boyfriend', 'oversized', 'cropped', 'longline',
    'biker', 'aviator', 'varsity', 'letterman', 'peacoat', 'duffle',
    'kimono', 'caftan', 'tunic', 'shift', 'sheath', 'wrap', 'bodycon',
    'a-line', 'fit and flare', 'empire', 'trapeze', 'swing', 'pencil',
    'maxi', 'midi', 'mini', 'knee-length', 'ankle-length', 'floor-length',
    'sleeveless', 'short sleeve', 'long sleeve', '3/4 sleeve', 'cap sleeve',
    'halter', 'off-shoulder', 'one-shoulder', 'strapless', 'spaghetti strap',
    'v-neck', 'scoop neck', 'crew neck', 'boat neck', 'square neck', 'sweetheart',
    'high-waisted', 'mid-rise', 'low-rise', 'high-low', 'asymmetric'
  ];

  return styleModifierKeywords.filter(modifier => command.includes(modifier));
}

function normalizeGarmentType(garmentType) {
  const mappings = {
    'dresses': 'dress',
    'tops': 'top',
    'shirts': 'shirt',
    'blouses': 'blouse',
    'skirts': 'skirt',
    'jackets': 'jacket',
    'coats': 'coat',
    'suits': 'suit',
    'gowns': 'gown',
    'outfits': 'outfit'  // This mapping is correct
  };
  
  return mappings[garmentType] || garmentType;
}

function inferGarmentTypeFromCommand(command) {
  const garmentDictionary = {
    jacket: ['jacket', 'jackets', 'blazer', 'blazers', 'bomber', 'bomber jacket', 'moto jacket', 'denim jacket', 'leather jacket', 'trench', 'trench coat', 'parka', 'windbreaker'],
    coat: ['coat', 'coats', 'overcoat', 'topcoat', 'outercoat'],
    dress: ['dress', 'dresses', 'gown', 'gowns', 'sheath', 'slip dress'],
    outfit: ['outfit', 'outfits', 'look', 'looks', 'ensemble'],
    suit: ['suit', 'suits', 'pantsuit', 'skirt suit'],
    skirt: ['skirt', 'skirts'],
    pants: ['pants', 'trousers', 'slacks', 'jeans'],
    top: ['top', 'tops', 'shirt', 'shirts', 'blouse', 'blouses', 'tee', 't-shirt'],
    shorts: ['shorts', 'bermuda shorts'],
    jumpsuit: ['jumpsuit', 'romper', 'rompers', 'catsuit'],
    swimwear: ['swimsuit', 'swimwear', 'bikini', 'bikinis']
  };

  for (const [canonical, variations] of Object.entries(garmentDictionary)) {
    for (const variation of variations) {
      const pattern = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(command)) {
        return canonical;
      }
    }
  }

  return null;
}

function mapSpecificityLevel(score) {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function generateVLTSpecification(params) {
  const { garmentType, styles, colors, fabrics, occasions, constructionDetails, styleModifiers } = params;

  let specification = garmentType;

  // Special handling for 'outfit' to make it more descriptive
  if (garmentType === 'outfit') {
    specification = 'fashion outfit'; // Make it more descriptive for image generation
  }

  // Add style modifiers first (e.g., "moto", "bomber")
  if (styleModifiers && styleModifiers.length > 0) {
    specification = `${styleModifiers.join(' ')} ${specification}`;
  }

  if (styles.length > 0) {
    specification = `${styles.join(' ')} ${specification}`;
  }

  if (colors.length > 0) {
    specification = `${colors.join(' ')} ${specification}`;
  }

  if (fabrics.length > 0) {
    specification = `${specification} made from ${fabrics.join(' and ')}`;
  }

  // Add construction details (e.g., "two-way zips", "quilted")
  if (constructionDetails && constructionDetails.length > 0) {
    specification = `${specification} with ${constructionDetails.join(' and ')}`;
  }

  if (occasions.length > 0) {
    specification = `${specification} suitable for ${occasions.join(' and ')} occasions`;
  }

  specification += ', professional fashion photography, studio lighting, high resolution';

  return specification;
}

function calculateConfidence(originalCommand, parsedData) {
  let confidence = 0.5;
  
  if (parsedData.quantity > 0) confidence += 0.1;
  if (parsedData.garmentType !== 'dress') confidence += 0.1;
  if (parsedData.styles.length > 0) confidence += 0.1;
  if (parsedData.colors.length > 0) confidence += 0.1;
  if (parsedData.fabrics.length > 0) confidence += 0.1;
  if (parsedData.occasions.length > 0) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

async function transcribeAudio(audioBuffer) {
  logger.info('Transcribing audio (mock implementation)');
  return "make me 10 bohemian style dresses";
}

module.exports = router;
