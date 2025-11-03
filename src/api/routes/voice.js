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
        requestedQuantity: parsedCommand.quantity
      });

      // Ensure we generate the requested number of separate images
      const generationOptions = {
        numberOfImages: parsedCommand.quantity,
        separateGeneration: true, // Force separate generations
        enhancedPrompt: parsedCommand.enhancedPrompt
      };
      
      try {
        generationResult = await generationService.generateFromPrompt({
        prompt: parsedCommand.enhancedPrompt,
        negativePrompt: parsedCommand.negativePrompt,
        ...generationOptions,
        userId: uid,
        batchMode: true, // Enable batch mode for multiple images
        individualPrompts: true // Generate unique prompt for each image
      });
      } catch (genError) {
        logger.error('Image generation from voice command failed', {
          error: genError.message,
          parsedCommand
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        originalCommand: command,
        parsedCommand,
        generation: generationResult,
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
        generationResult = await generationService.generateFromPrompt({
          userId: uid,
          prompt: parsedCommand.enhancedPrompt,
          negativePrompt: parsedCommand.negativePrompt,
          settings: {
            count: parsedCommand.quantity,
            provider: 'google-imagen',
            quality: 'standard'
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
  const processedQuery = await queryProcessor.processQuery(cleanCommand, userId);
  
  // Extract core information from processed query
  const quantity = processedQuery.entities.quantity || 1;
  const action = processedQuery.intent?.action || 'create';
  const garmentType = processedQuery.entities.garmentType;
  // Normalize garment type early to avoid accidental ReferenceErrors later
  const normalizedGarmentType = normalizeGarmentType(garmentType || 'outfit');

  // Get structured data from processed query
  const {
    styles = [],
    colors = [],
    fabrics = [],
    occasions = [],
    constructionDetails = [],
    styleModifiers = []
  } = processedQuery.entities;

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
          quantity: processedQuery.entities.quantity || 1,
          
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
          userModifiers: processedQuery.entities.modifiers || [],
          respectUserIntent: specificityAnalysis.specificityScore > 0.7,
          
          // Additional context
          season: processedQuery.entities.season,
          occasion: processedQuery.entities.occasion,
          
          // Generation settings
          useCache: false, // Ensure fresh prompts for each generation
          variationSeed: Date.now()
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
      quantity: processedQuery.entities.quantity || 1,
      useDefaultProfile: true,
      queryType: processedQuery.queryType,
      specificityScore: specificityAnalysis.specificityScore,
      userModifiers: processedQuery.entities.modifiers || [],
      mode: 'balanced'
    });
    
    enhancedPrompt = defaultPrompt.positive_prompt;
    negativePrompt = defaultPrompt.negative_prompt;
    
    logger.info('Using default style profile for prompt generation', { 
      userId: userId || 'none',
      garmentType: processedQuery.entities.garmentType
    });
  }

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
    specificityAnalysis, // NEW: Include full analysis
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
