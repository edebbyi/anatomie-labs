const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const generationService = require('../../services/generationService');
const promptGeneratorAgent = require('../../services/promptGeneratorAgent');
const agentService = require('../../services/agentService');

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
    command: command.substring(0, 100) // Log first 100 chars
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
        usedStyleProfile: parsedCommand.usedStyleProfile
      });
      
      try {
        generationResult = await generationService.generateFromPrompt({
          userId: userId || req.user.id,
          prompt: parsedCommand.enhancedPrompt, // Use style-profile-based prompt
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
        // Continue with response even if generation fails
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
    
    // Parse the transcribed text with user ID for style profile
    const parsedCommand = await parseVoiceCommand(transcribedText, req.user.id);
    
    // Generate images based on parsed command
    let generationResult = null;
    if (parsedCommand.quantity > 0) {
      logger.info('Initiating image generation from voice audio', {
        userId: req.user.id,
        quantity: parsedCommand.quantity,
        garmentType: parsedCommand.garmentType,
        usedStyleProfile: parsedCommand.usedStyleProfile
      });
      
      try {
        generationResult = await generationService.generateFromPrompt({
          userId: req.user.id,
          prompt: parsedCommand.enhancedPrompt, // Use style-profile-based prompt
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
        // Continue with response even if generation fails
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
      category: 'Color Specific',
      commands: [
        'Make me 10 red dresses',
        'Create 5 navy blue suits',
        'Generate 15 pastel colored tops',
        'Design 8 earth tone jackets'
      ]
    },
    {
      category: 'Fabric Specific',
      commands: [
        'Make me 10 silk dresses',
        'Create 5 cotton summer tops',
        'Generate 12 wool winter coats',
        'Design 8 denim jackets'
      ]
    },
    {
      category: 'Occasion Specific',
      commands: [
        'Make me 10 wedding guest dresses',
        'Create 5 business casual outfits',
        'Generate 8 cocktail dresses',
        'Design 15 workout clothes'
      ]
    }
  ];

  res.json({
    success: true,
    data: examples
  });
}));

/**
 * GET /api/voice/commands/patterns
 * Get supported command patterns
 */
router.get('/commands/patterns', asyncHandler(async (req, res) => {
  const patterns = {
    basic: {
      pattern: '[action] [quantity] [garment_type]',
      examples: ['make 10 dresses', 'create 5 tops', 'generate 20 skirts'],
      required: ['action', 'quantity', 'garment_type']
    },
    styled: {
      pattern: '[action] [quantity] [style] [garment_type]',
      examples: ['make 10 bohemian dresses', 'create 5 minimalist tops'],
      required: ['action', 'quantity', 'style', 'garment_type']
    },
    colored: {
      pattern: '[action] [quantity] [color] [garment_type]',
      examples: ['make 10 red dresses', 'create 5 blue tops'],
      required: ['action', 'quantity', 'color', 'garment_type']
    },
    detailed: {
      pattern: '[action] [quantity] [style] [color] [fabric] [garment_type] for [occasion]',
      examples: ['make 10 elegant red silk dresses for evening events'],
      required: ['action', 'quantity', 'garment_type']
    }
  };

  res.json({
    success: true,
    data: {
      patterns,
      supportedActions: ['make', 'create', 'generate', 'design', 'produce'],
      supportedGarments: ['dress', 'top', 'skirt', 'pants', 'jacket', 'coat', 'shirt', 'blouse'],
      supportedStyles: ['bohemian', 'minimalist', 'vintage', 'modern', 'classic', 'casual', 'formal'],
      supportedColors: ['red', 'blue', 'green', 'black', 'white', 'navy', 'pastel', 'bright'],
      supportedFabrics: ['silk', 'cotton', 'wool', 'denim', 'linen', 'polyester', 'chiffon']
    }
  });
}));

/**
 * Parse voice command into structured format
 * @param {string} command - Natural language command
 * @param {string} userId - User ID to fetch style profile
 * @returns {Object} Parsed command structure
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

  // Fetch user's style profile and generate prompt using their actual style
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
        
        // Use prompt generator agent with user's style profile
        const generatedPrompt = promptGeneratorAgent.generatePrompt(styleProfile, {
          index: 0,
          exploreMode: false,
          userModifiers
        });
        
        enhancedPrompt = generatedPrompt.mainPrompt;
        negativePrompt = generatedPrompt.negativePrompt;
        
        logger.info('Voice command enhanced with user style profile', {
          userId,
          command: command.substring(0, 50),
          promptPreview: enhancedPrompt.substring(0, 80)
        });
      } else {
        logger.warn('No style profile found, using basic prompt for voice command', { userId });
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
    vltSpecification: enhancedPrompt, // For backwards compatibility
    enhancedPrompt, // New field - prompt based on style profile
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

/**
 * Extract style keywords from command
 */
function extractStyles(command) {
  const styleKeywords = [
    'bohemian', 'boho', 'minimalist', 'vintage', 'retro', 'modern', 'contemporary',
    'classic', 'traditional', 'casual', 'formal', 'elegant', 'chic', 'trendy',
    'professional', 'business', 'streetwear', 'gothic', 'romantic', 'edgy'
  ];
  
  return styleKeywords.filter(style => command.includes(style));
}

/**
 * Extract color keywords from command
 */
function extractColors(command) {
  const colorKeywords = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'navy', 'maroon', 'teal', 'coral',
    'pastel', 'bright', 'dark', 'light', 'neon', 'earth tone', 'neutral'
  ];
  
  return colorKeywords.filter(color => command.includes(color));
}

/**
 * Extract fabric keywords from command
 */
function extractFabrics(command) {
  const fabricKeywords = [
    'silk', 'cotton', 'wool', 'denim', 'linen', 'polyester', 'chiffon',
    'satin', 'velvet', 'leather', 'cashmere', 'jersey', 'tweed', 'lace'
  ];
  
  return fabricKeywords.filter(fabric => command.includes(fabric));
}

/**
 * Extract occasion keywords from command
 */
function extractOccasions(command) {
  const occasionKeywords = [
    'wedding', 'party', 'work', 'business', 'casual', 'formal', 'evening',
    'cocktail', 'summer', 'winter', 'spring', 'fall', 'vacation', 'date',
    'interview', 'meeting', 'conference', 'gala', 'prom', 'graduation'
  ];
  
  return occasionKeywords.filter(occasion => command.includes(occasion));
}

/**
 * Normalize garment type to singular form
 */
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
    'outfits': 'outfit'
  };
  
  return mappings[garmentType] || garmentType;
}

/**
 * Generate VLT specification for image generation
 */
function generateVLTSpecification(params) {
  const { garmentType, styles, colors, fabrics, occasions } = params;
  
  let specification = garmentType;
  
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
  
  // Add professional photography context
  specification += ', professional fashion photography, studio lighting, high resolution';
  
  return specification;
}

/**
 * Calculate confidence score for parsed command
 */
function calculateConfidence(originalCommand, parsedData) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on recognized elements
  if (parsedData.quantity > 0) confidence += 0.1;
  if (parsedData.garmentType !== 'dress') confidence += 0.1; // Default fallback
  if (parsedData.styles.length > 0) confidence += 0.1;
  if (parsedData.colors.length > 0) confidence += 0.1;
  if (parsedData.fabrics.length > 0) confidence += 0.1;
  if (parsedData.occasions.length > 0) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

/**
 * Transcribe audio to text using Google Speech-to-Text
 * @param {Buffer} audioBuffer - Audio file buffer
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(audioBuffer) {
  // Mock implementation - replace with actual Google Speech-to-Text API call
  logger.info('Transcribing audio (mock implementation)');
  
  // In production, this would use Google Cloud Speech-to-Text:
  /*
  const speech = require('@google-cloud/speech');
  const client = new speech.SpeechClient();
  
  const request = {
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 16000,
      languageCode: 'en-US',
    },
  };
  
  const [response] = await client.recognize(request);
  return response.results[0]?.alternatives[0]?.transcript || '';
  */
  
  // Mock response for development
  return "make me 10 bohemian style dresses";
}

module.exports = router;