/**
 * ENHANCED IntelligentPromptBuilder
 * 
 * This file shows the changes needed to your existing IntelligentPromptBuilder.
 * Focus on the generatePrompt() method - add creativity and respectUserIntent parameters.
 */

const logger = require('../utils/logger');

class IntelligentPromptBuilder {
  constructor() {
    // Existing configuration...
  }

  /**
   * ENHANCED generatePrompt method
   * 
   * NEW PARAMETERS:
   * @param {number} options.creativity - Creativity temperature (0.3 - 1.2)
   * @param {boolean} options.respectUserIntent - If true, weight user modifiers heavily
   * 
   * CHANGES TO MAKE:
   * 1. Accept creativity and respectUserIntent in options
   * 2. Adjust user modifier weighting based on respectUserIntent
   * 3. Add variation instructions based on creativity level
   */
  generatePrompt(styleProfile, options = {}) {
    const {
      index = 0,
      exploreMode = false,
      userModifiers = [],
      
      // ========== NEW PARAMETERS ==========
      creativity = 0.7,              // Default balanced creativity
      respectUserIntent = false,     // Strict adherence to user descriptors
      // ====================================
      
      // Existing parameters...
    } = options;

    logger.info('Generating prompt with specificity parameters', {
      creativity,
      respectUserIntent,
      exploreMode,
      userModifierCount: userModifiers.length
    });

    // ========== NEW: DETERMINE USER MODIFIER WEIGHTING ==========
    // If user gave specific command (high specificity), weight their terms more heavily
    const userModifierWeight = respectUserIntent ? 2.0 : 1.0;
    
    // Determine variation strength based on creativity
    const variationStrength = this.getVariationStrength(creativity);
    // ============================================================

    // Build base prompt from style profile (existing logic)
    let prompt = this.buildBasePromptFromProfile(styleProfile);

    // ========== ENHANCED: APPLY USER MODIFIERS WITH WEIGHTING ==========
    if (userModifiers.length > 0) {
      // Remove any empty or duplicate modifiers
      const cleanedModifiers = [...new Set(
        userModifiers.filter(m => m && m.trim().length > 0)
      )];

      if (respectUserIntent) {
        // HIGH SPECIFICITY: Strong weighting on user terms
        logger.info('Applying user modifiers with high weighting', {
          weight: userModifierWeight,
          modifiers: cleanedModifiers
        });
        
        const weightedModifiers = cleanedModifiers.map(modifier => 
          `(${modifier}:${userModifierWeight})`
        );
        prompt += ', ' + weightedModifiers.join(', ');
        
      } else {
        // LOW SPECIFICITY: Normal weighting, more creative freedom
        logger.info('Applying user modifiers with standard weighting', {
          modifiers: cleanedModifiers
        });
        
        prompt += ', ' + cleanedModifiers.join(', ');
      }
    }
    // ===================================================================

    // ========== NEW: ADD VARIATION INSTRUCTIONS ==========
    // Guide the AI on how creative vs literal to be
    if (variationStrength === 'high') {
      prompt += ', explore creative variations, interpret broadly, diverse interpretations';
      logger.debug('Added high variation instructions');
      
    } else if (variationStrength === 'medium') {
      prompt += ', balanced interpretation, some creative freedom';
      logger.debug('Added medium variation instructions');
      
    } else if (variationStrength === 'low') {
      prompt += ', precise execution, literal interpretation, exact specifications';
      logger.debug('Added low variation instructions');
    }
    // ====================================================

    // Add quality markers (existing logic)
    prompt += ', professional fashion photography, studio lighting, high resolution';

    // Generate negative prompt (existing logic)
    const negativePrompt = this.buildNegativePrompt();

    logger.info('Prompt generation complete', {
      promptLength: prompt.length,
      creativity,
      variationStrength,
      userModifierWeight
    });

    return {
      mainPrompt: prompt,
      negativePrompt,
      metadata: {
        creativity,
        variationStrength,
        respectUserIntent,
        userModifierCount: userModifiers.length
      }
    };
  }

  /**
   * NEW METHOD: Map creativity temperature to variation strength
   */
  getVariationStrength(creativity) {
    if (creativity >= 1.0) {
      return 'high';      // Very exploratory
    } else if (creativity >= 0.6) {
      return 'medium';    // Balanced
    } else {
      return 'low';       // Precise, literal
    }
  }

  /**
   * EXISTING METHOD: Build base prompt from style profile
   * (Keep your existing implementation)
   */
  buildBasePromptFromProfile(styleProfile) {
    // Your existing logic to convert style profile to base prompt
    // This should remain unchanged
    
    let basePrompt = '';
    
    if (styleProfile.dominantStyles && styleProfile.dominantStyles.length > 0) {
      basePrompt += styleProfile.dominantStyles[0];
    }
    
    if (styleProfile.colorPalette && styleProfile.colorPalette.length > 0) {
      basePrompt += ', ' + styleProfile.colorPalette.slice(0, 3).join(', ');
    }
    
    // Add more from your style profile structure...
    
    return basePrompt;
  }

  /**
   * EXISTING METHOD: Build negative prompt
   * (Keep your existing implementation)
   */
  buildNegativePrompt() {
    return 'blurry, low quality, pixelated, distorted, bad anatomy, poorly rendered, ' +
           'unprofessional, amateur, poorly lit';
  }

  // ... rest of your existing methods ...
}

module.exports = new IntelligentPromptBuilder();


/**
 * SUMMARY OF CHANGES TO MAKE TO YOUR EXISTING FILE:
 * 
 * 1. In generatePrompt() method, ADD to options destructuring:
 *    - creativity = 0.7
 *    - respectUserIntent = false
 * 
 * 2. ADD the getVariationStrength() method (copy from above)
 * 
 * 3. MODIFY user modifier application section:
 *    - Calculate userModifierWeight based on respectUserIntent
 *    - Apply weighting syntax: (modifier:weight) for high specificity
 * 
 * 4. ADD variation instructions at end of prompt based on creativity level
 * 
 * 5. ENHANCE logging to include new parameters
 * 
 * That's it! The rest of your prompt builder logic remains unchanged.
 */
