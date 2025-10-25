const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const generationService = require('../../services/generationService');
const IntelligentPromptBuilder = require('../../services/IntelligentPromptBuilder');
const agentService = require('../../services/agentService');

// ========== NEW IMPORTS ==========
const SpecificityAnalyzer = require('../../services/specificityAnalyzer');
const TrendAwareSuggestionEngine = require('../../services/trendAwareSuggestionEngine');

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

  logger.info('Processing voice text command', {
    userId: req.user.id,
    command: command.substring(0, 100)
  });

  try {
    const parsedCommand = await parseVoiceCommand(command, userId || req.user.id);
    
    // Generate images based on parsed command
    let generationResult = null;
    if (parsedCommand.quantity > 0) {
      logger.info('Initiating image generation from voice command', {
        userId: userId || req.user.id,
        quantity: parsedCommand.quantity,
        garmentType: parsedCommand.garmentType,
        usedStyleProfile: parsedCommand.usedStyleProfile,
        // NEW: Log specificity analysis
        specificityScore: parsedCommand.specificityAnalysis?.specificityScore,
        creativityTemp: parsedCommand.specificityAnalysis?.creativityTemp,
        mode: parsedCommand.specificityAnalysis?.mode
      });
      
      try {
        generationResult = await generationService.generateFromPrompt({
          userId: userId || req.user.id,
          prompt: parsedCommand.enhancedPrompt,
          negativePrompt: parsedCommand.negativePrompt,
          settings: {
            count: parsedCommand.quantity,
            provider: 'google-imagen',
            quality: 'standard'
          }
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
      userId: req.user.id,
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
router.get('/suggestions', asyncHandler(async (req, res) => {
  try {
    const suggestions = await suggestionEngine.generateSuggestions(req.user.id);
    
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
      userId: req.user.id,
      error: error.message
    });
    throw error;
  }
}));
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

  logger.info('Processing voice audio command', {
    userId: req.user.id,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype
  });

  try {
    // Convert audio to text using Google Speech-to-Text
    const transcribedText = await transcribeAudio(req.file.buffer);
    
    // Parse with specificity analysis
    const parsedCommand = await parseVoiceCommand(transcribedText, req.user.id);
    
    // Generate images
    let generationResult = null;
    if (parsedCommand.quantity > 0) {
      logger.info('Initiating image generation from voice audio', {
        userId: req.user.id,
        quantity: parsedCommand.quantity,
        garmentType: parsedCommand.garmentType,
        usedStyleProfile: parsedCommand.usedStyleProfile,
        specificityScore: parsedCommand.specificityAnalysis?.specificityScore,
        creativityTemp: parsedCommand.specificityAnalysis?.creativityTemp
      });
      
      try {
        generationResult = await generationService.generateFromPrompt({
          userId: req.user.id,
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
      userId: req.user.id,
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
  
  // Extract quantity
  const quantityMatch = cleanCommand.match(/(\d+)/);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;

  // Extract action verb
  const actionWords = ['make', 'create', 'generate', 'design', 'produce'];
  const action = actionWords.find(word => cleanCommand.includes(word)) || 'create';

  // Extract garment type
  const garmentTypes = [
    'dress', 'dresses', 'top', 'tops', 'shirt', 'shirts', 'blouse', 'blouses',
    'skirt', 'skirts', 'pants', 'jacket', 'jackets', 'coat', 'coats',
    'suit', 'suits', 'gown', 'gowns', 'outfit', 'outfits'
  ];
  
  const garmentType = garmentTypes.find(type => cleanCommand.includes(type)) || 'dress';
  const normalizedGarmentType = normalizeGarmentType(garmentType);

  // Extract style attributes
  const styles = extractStyles(cleanCommand);
  const colors = extractColors(cleanCommand);
  const fabrics = extractFabrics(cleanCommand);
  const occasions = extractOccasions(cleanCommand);

  // ========== NEW: SPECIFICITY ANALYSIS ==========
  const specificityAnalysis = specificityAnalyzer.analyzeCommand(command, {
    colors,
    styles,
    fabrics,
    modifiers: [...styles, ...colors, ...fabrics],
    occasions,
    count: quantity
  });

  logger.info('Command specificity analyzed', {
    command: command.substring(0, 50),
    specificityScore: specificityAnalysis.specificityScore.toFixed(3),
    creativityTemp: specificityAnalysis.creativityTemp.toFixed(3),
    mode: specificityAnalysis.mode,
    reasoning: specificityAnalysis.reasoning
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
        
        // Build user modifiers from voice command
        const userModifiers = [
          normalizedGarmentType,
          ...styles,
          ...colors,
          ...fabrics,
          ...occasions
        ].filter(Boolean);
        
        // ========== NEW: PASS SPECIFICITY ANALYSIS TO PROMPT BUILDER ==========
        const generatedPrompt = await IntelligentPromptBuilder.generatePrompt(userId, {
          garmentType: normalizedGarmentType,
          season: null,
          occasion: null,
          creativity: specificityAnalysis.creativityTemp,              // NEW
          useCache: true,
          variationSeed: Date.now() % 1000,
          userModifiers: userModifiers.length > 0 ? userModifiers : undefined
        });
        // =====================================================================
        
        enhancedPrompt = generatedPrompt.positive_prompt;
        negativePrompt = generatedPrompt.negative_prompt;
        
        logger.info('Voice command enhanced with user style profile', {
          userId,
          command: command.substring(0, 50),
          promptPreview: enhancedPrompt.substring(0, 80),
          creativityUsed: specificityAnalysis.creativityTemp
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
  
  // Fallback: Generate basic VLT specification if no style profile available
  if (!enhancedPrompt) {
    enhancedPrompt = generateVLTSpecification({
      garmentType: normalizedGarmentType,
      quantity,
      styles,
      colors,
      fabrics,
      occasions
    });
    negativePrompt = 'blurry, low quality, pixelated, distorted, bad anatomy, poorly rendered';
    logger.info('Using fallback VLT prompt without style profile', { userId: userId || 'none' });
  }

  return {
    action,
    quantity,
    garmentType: normalizedGarmentType,
    attributes: {
      styles,
      colors,
      fabrics,
      occasions
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
      occasions
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
    'sporty' // Added
  ];
  
  return styleKeywords.filter(style => command.includes(style));
}

function extractColors(command) {
  const colorKeywords = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'navy', 'maroon', 'teal', 'coral',
    'pastel', 'bright', 'dark', 'light', 'neon', 'earth tone', 'neutral',
    'burgundy' // Added
  ];
  
  return colorKeywords.filter(color => command.includes(color));
}

function extractFabrics(command) {
  const fabricKeywords = [
    'silk', 'cotton', 'wool', 'denim', 'linen', 'polyester', 'chiffon',
    'satin', 'velvet', 'leather', 'cashmere', 'jersey', 'tweed', 'lace'
  ];
  
  return fabricKeywords.filter(fabric => command.includes(fabric));
}

function extractOccasions(command) {
  const occasionKeywords = [
    'wedding', 'party', 'work', 'business', 'casual', 'formal', 'evening',
    'cocktail', 'summer', 'winter', 'spring', 'fall', 'vacation', 'date',
    'interview', 'meeting', 'conference', 'gala', 'prom', 'graduation'
  ];
  
  return occasionKeywords.filter(occasion => command.includes(occasion));
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
  const { garmentType, styles, colors, fabrics, occasions } = params;
  
  let specification = garmentType;
  
  // Special handling for 'outfit' to make it more descriptive
  if (garmentType === 'outfit') {
    specification = 'fashion outfit'; // Make it more descriptive for image generation
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