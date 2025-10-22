/**
 * Fashion Analysis Service
 * 
 * Analyzes fashion images directly using Replicate's vision models
 * Bypasses VLT tool for more reliable and faster analysis
 */

const Replicate = require('replicate');
const logger = require('../utils/logger');
const pineconeService = require('./pineconeService');

class FashionAnalysisService {
  constructor() {
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    
    // Use a fast, reliable vision model
    this.model = 'yorickvp/llava-13b:b5f6212d032508382d61ff00469ddda3e32fd8a0e75dc39d8a4191bb742157fb';
    
    logger.info('FashionAnalysisService initialized with Replicate vision model');
  }

  /**
   * Analyze a single fashion image
   * @param {Buffer|string} image - Image buffer or base64 string
   * @returns {Promise<Object>} Fashion attributes
   */
  async analyzeImage(image) {
    try {
      const imageDataUri = this._prepareImage(image);
      
      const prompt = `Analyze this fashion image and identify the EXACT STYLE AESTHETIC. Pay special attention to style signatures:

GARMENT IDENTIFICATION:
- DRESS: Single-piece garment covering torso and lower body
- SUIT/TWO-PIECE: Matching jacket + pants/skirt (coordinated set)
- OUTFIT: Separate pieces worn together (different colors/fabrics)
- TOP: Upper garment only (blouse, shirt, sweater, tank, etc.)
- PANTS/BOTTOMS: Lower garment only (trousers, jeans, shorts, skirt)
- JACKET/OUTERWEAR: Layer piece (blazer, cardigan, coat, etc.)

STYLE AESTHETIC ANALYSIS (Most Important):
Look at the overall vibe and classify the primary aesthetic:

🏃‍♀️ SPORTY/ATHLETIC: Activewear, athleisure, workout clothes, performance fabrics, athletic brands, sneakers, leggings, sports bras, track suits, gym wear, yoga pants, running shorts

✨ MINIMALIST: Clean lines, simple silhouettes, neutral colors, understated elegance, modern simplicity, no excessive details, geometric shapes, monochromatic

👔 PROFESSIONAL/BUSINESS: Office wear, corporate attire, blazers, button-downs, pencil skirts, tailored pants, structured shoulders, conservative cuts

💄 CHIC/SOPHISTICATED: Polished, refined, fashion-forward, trendy but elegant, well-tailored, premium fabrics, stylish accessories

🌸 ROMANTIC/FEMININE: Flowing fabrics, florals, pastels, ruffles, lace, soft textures, delicate details, flowy silhouettes

🔥 EDGY/BOLD: Leather, dark colors, asymmetric cuts, studs, zippers, punk-inspired, rock aesthetic, bold patterns

👕 CASUAL/EVERYDAY: Relaxed fit, comfortable fabrics, jeans, t-shirts, sneakers, laid-back styling, weekend wear

🎭 AVANT-GARDE/ARTISTIC: Experimental cuts, unusual proportions, artistic elements, conceptual design, unconventional styling

ANALYZE THE IMAGE:
1. **Primary Style Aesthetic**: [Choose the MAIN category that best describes the overall vibe]
2. **Secondary Style**: [If applicable, what's the secondary influence?]
3. **Garment Type**: [Be precise - suit vs outfit vs dress]
4. **Silhouette**: [fitted, loose, oversized, structured, flowing, etc.]
5. **Color Palette**: [Primary and secondary colors]
6. **Fabric/Texture**: [Material type and texture]
7. **Key Details**: [What makes this style distinctive?]
8. **Formality Level**: [casual, business-casual, formal, athletic, etc.]
9. **Target Occasion**: [work, gym, date, everyday, special event, etc.]
10. **Brand/Designer Vibe**: [luxury, high-street, athletic brand, fast fashion, etc.]

FORMAT: Respond with clear categories and be specific about the style aesthetic. If you see athletic wear, say "sporty" or "athletic". If you see clean, simple lines, say "minimalist".

Example:
Primary Style Aesthetic: sporty
Secondary Style: minimalist
Garment Type: two-piece
Silhouette: fitted
Color Palette: black and white
Fabric/Texture: performance knit
Key Details: athletic branding, moisture-wicking fabric
Formality Level: athletic
Target Occasion: gym, workout
Brand/Designer Vibe: athletic brand`;

      const output = await this.replicate.run(this.model, {
        input: {
          image: imageDataUri,
          prompt: prompt,
          max_tokens: 300,
        }
      });

      const responseText = Array.isArray(output) ? output.join('') : output;
      
      // Parse the response into structured data
      const parsed = this._parseAnalysis(responseText);
      
      const result = {
        garmentType: parsed.garmentType || 'outfit',
        silhouette: parsed.silhouette || 'fitted',
        fabric: {
          type: parsed.fabricType || 'cotton',
          texture: parsed.texture || 'smooth',
          weight: parsed.weight || 'medium',
          finish: parsed.finish || 'matte'
        },
        colors: {
          primary: parsed.primaryColor || 'black',
          secondary: parsed.secondaryColor || null,
          pattern: parsed.pattern ? { type: parsed.pattern } : null
        },
        construction: {
          seams: parsed.seams || 'standard',
          closure: parsed.closure || 'zipper',
          details: parsed.keyDetails ? [parsed.keyDetails] : []
        },
        style: {
          aesthetic: parsed.aesthetic || 'casual',
          secondary: parsed.secondaryAesthetic || null,
          formality: parsed.formality || 'casual',
          season: parsed.season || 'all-season',
          overall: parsed.aesthetic || 'contemporary',
          mood: parsed.brandVibe || 'modern',
          occasion: parsed.occasion || 'everyday',
          enhancedDetection: true
        },
        neckline: parsed.neckline || 'crew',
        sleeveLength: parsed.sleeveLength || 'short',
        length: parsed.length || 'midi',
        modelSpecs: {
          gender: parsed.modelGender || 'female',
          ageRange: parsed.modelAgeRange || 'adult',
          poseType: parsed.modelPose || 'standing',
          shotType: parsed.shotType || 'full body',
          ethnicity: parsed.modelEthnicity || 'diverse'
        },
        promptText: this._generateEnhancedPrompt(parsed),
        confidence: 0.90, // Higher confidence with enhanced analysis
        attributes: {
          ...parsed.attributes,
          enhancedAnalysis: true,
          primaryAesthetic: parsed.aesthetic,
          secondaryAesthetic: parsed.secondaryAesthetic,
          detectedOccasion: parsed.occasion,
          brandVibe: parsed.brandVibe
        }
      };
      
      // Generate CLIP embedding for style similarity
      try {
        await pineconeService.initialize();
        const styleDescription = this._generateStyleDescription(result);
        result.embedding = await pineconeService.generateTextEmbedding(styleDescription);
        result.embeddings = {
          styleEmbedding: result.embedding,
          styleDescription: styleDescription,
          generatedAt: new Date().toISOString()
        };
        logger.info('Generated style embedding for analysis', { 
          aesthetic: result.style.aesthetic,
          embeddingSize: result.embedding?.length 
        });
      } catch (error) {
        logger.warn('Failed to generate style embedding', { error: error.message });
        // Continue without embedding - don't fail the analysis
      }
      
      return result;
      
    } catch (error) {
      logger.error('Image analysis failed', { error: error.message });
      
      // Return fallback data instead of failing
      return this._getFallbackAnalysis();
    }
  }

  /**
   * Analyze multiple images in batch
   * @param {Array<Buffer|string>} images - Array of image buffers
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Array<Object>>} Array of fashion attributes
   */
  async analyzeBatch(images, onProgress) {
    const results = [];
    
    for (let i = 0; i < images.length; i++) {
      try {
        const analysis = await this.analyzeImage(images[i]);
        results.push({
          ...analysis,
          imageId: `image-${i + 1}`,
          index: i
        });
        
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: images.length,
            progress: Math.round(((i + 1) / images.length) * 100)
          });
        }
        
        // Rate limiting - Replicate has limits
        if (i < images.length - 1) {
          await this._delay(1000); // 1 second between requests
        }
        
      } catch (error) {
        logger.error('Batch analysis item failed', { index: i, error: error.message });
        results.push({
          ...this._getFallbackAnalysis(),
          imageId: `image-${i + 1}`,
          index: i,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Parse enhanced vision model output with better style detection
   * @private
   */
  _parseAnalysis(text) {
    const parsed = {
      attributes: {}
    };
    
    // Enhanced style aesthetic extraction (primary focus)
    const primaryStyleMatch = text.match(/primary\s+style\s+aesthetic[:\s]+([a-z\/\-\s]+?)(?:\n|,|\.|$)/i);
    if (primaryStyleMatch) {
      const styleText = primaryStyleMatch[1].trim().toLowerCase();
      // Normalize common variations
      if (styleText.includes('sporty') || styleText.includes('athletic')) {
        parsed.aesthetic = 'sporty';
      } else if (styleText.includes('minimalist') || styleText.includes('minimal')) {
        parsed.aesthetic = 'minimalist';
      } else if (styleText.includes('professional') || styleText.includes('business')) {
        parsed.aesthetic = 'professional';
      } else if (styleText.includes('chic') || styleText.includes('sophisticated')) {
        parsed.aesthetic = 'chic';
      } else if (styleText.includes('romantic') || styleText.includes('feminine')) {
        parsed.aesthetic = 'romantic';
      } else if (styleText.includes('edgy') || styleText.includes('bold')) {
        parsed.aesthetic = 'edgy';
      } else if (styleText.includes('casual') || styleText.includes('everyday')) {
        parsed.aesthetic = 'casual';
      } else if (styleText.includes('avant') || styleText.includes('artistic')) {
        parsed.aesthetic = 'avant-garde';
      } else {
        // Take first significant word
        parsed.aesthetic = styleText.split(/[\s\/]/)[0];
      }
    }
    
    // Extract secondary style
    const secondaryStyleMatch = text.match(/secondary\s+style[:\s]+([a-z\/\-\s]+?)(?:\n|,|\.|$)/i);
    if (secondaryStyleMatch) {
      parsed.secondaryAesthetic = secondaryStyleMatch[1].trim().toLowerCase();
    }
    
    // Extract garment type with better parsing
    const garmentMatch = text.match(/garment\s+type[:\s]+([a-z\s\-\/]+?)(?:\n|\.|,|formality|silhouette|\d)/i);
    if (garmentMatch) {
      const garmentType = garmentMatch[1].trim().toLowerCase();
      // Normalize variations
      if (garmentType.includes('two') || garmentType.includes('suit') || garmentType.includes('matching set')) {
        parsed.garmentType = 'two-piece';
      } else if (garmentType.includes('outfit') || garmentType.includes('separate')) {
        parsed.garmentType = 'outfit';
      } else if (garmentType.includes('dress') && !garmentType.includes('address')) {
        parsed.garmentType = 'dress';
      } else {
        // Take first meaningful word
        const words = garmentType.split(/[\s\/]/);
        parsed.garmentType = words[0] || 'outfit';
      }
    }
    
    // Extract silhouette
    const silhouetteMatch = text.match(/silhouette[:\s]+([a-z\-\s]+?)(?:\n|,|\.|$)/i);
    if (silhouetteMatch) parsed.silhouette = silhouetteMatch[1].trim().toLowerCase();
    
    // Extract color palette
    const colorPaletteMatch = text.match(/color\s+palette[:\s]+([a-z\s,\-]+?)(?:\n|\.|fabric|key)/i);
    if (colorPaletteMatch) {
      const colors = colorPaletteMatch[1].toLowerCase().split(/[,\s]+/).filter(c => c.length > 2);
      parsed.primaryColor = colors[0] || 'black';
      parsed.secondaryColor = colors[1] || null;
    }
    
    // Fallback to individual color extraction
    if (!parsed.primaryColor) {
      const primaryColorMatch = text.match(/primary[:\s]+([a-z]+)/i);
      if (primaryColorMatch) parsed.primaryColor = primaryColorMatch[1].toLowerCase();
    }
    
    // Extract fabric/texture
    const fabricMatch = text.match(/fabric\/texture[:\s]+([a-z\s]+?)(?:\n|,|\.|key)/i);
    if (fabricMatch) {
      parsed.fabricType = fabricMatch[1].trim().toLowerCase().split(' ')[0];
    }
    
    // Extract formality level
    const formalityMatch = text.match(/formality\s+level[:\s]+([a-z\-\s]+?)(?:\n|,|\.|target)/i);
    if (formalityMatch) {
      parsed.formality = formalityMatch[1].trim().toLowerCase();
    }
    
    // Extract target occasion
    const occasionMatch = text.match(/target\s+occasion[:\s]+([a-z\s,\-]+?)(?:\n|\.|brand|$)/i);
    if (occasionMatch) {
      parsed.occasion = occasionMatch[1].trim().toLowerCase();
    }
    
    // Extract key details
    const detailsMatch = text.match(/key\s+details[:\s]+([^\n]+)/i);
    if (detailsMatch) {
      parsed.keyDetails = detailsMatch[1].trim();
    }
    
    // Extract brand/designer vibe
    const brandVibeMatch = text.match(/brand\/designer\s+vibe[:\s]+([a-z\s\-]+?)(?:\n|\.|$)/i);
    if (brandVibeMatch) {
      parsed.brandVibe = brandVibeMatch[1].trim().toLowerCase();
    }
    
    // Legacy extractors for backward compatibility
    if (!parsed.aesthetic) {
      const oldStyleMatch = text.match(/style\s+aesthetic[:\s]+([a-z]+)/i);
      if (oldStyleMatch) parsed.aesthetic = oldStyleMatch[1].toLowerCase();
    }
    
    const necklineMatch = text.match(/neckline[:\s]+([a-z\-]+)/i);
    if (necklineMatch) parsed.neckline = necklineMatch[1].toLowerCase();
    
    const sleeveMatch = text.match(/sleeve\s+length[:\s]+([a-z\-]+)/i);
    if (sleeveMatch) parsed.sleeveLength = sleeveMatch[1].toLowerCase();
    
    const lengthMatch = text.match(/length[:\s]+([a-z\-]+)/i);
    if (lengthMatch) parsed.length = lengthMatch[1].toLowerCase();
    
    // Store enhanced analysis text for debugging
    parsed.attributes = {
      analysisText: text,
      enhancedParsing: true,
      detectedAesthetic: parsed.aesthetic,
      detectedGarmentType: parsed.garmentType
    };
    
    return parsed;
  }

  /**
   * Generate an enhanced prompt from parsed fashion data with better style representation
   * @private
   */
  _generateEnhancedPrompt(parsed) {
    const parts = [];
    
    // Start with primary style aesthetic (most important)
    if (parsed.aesthetic) {
      parts.push(`${parsed.aesthetic} style`);
      
      // Add secondary aesthetic if available
      if (parsed.secondaryAesthetic && parsed.secondaryAesthetic !== parsed.aesthetic) {
        parts.push(`with ${parsed.secondaryAesthetic} influences`);
      }
    }
    
    // Model specifications (if not flat lay)
    if (parsed.shotType !== 'flat lay' && parsed.modelGender && parsed.modelGender !== 'none') {
      parts.push(`${parsed.modelGender} model`);
      
      if (parsed.modelAgeRange && parsed.modelAgeRange !== 'n/a') {
        parts.push(parsed.modelAgeRange);
      }
    }
    
    // Garment details
    if (parsed.garmentType) {
      parts.push(parsed.garmentType);
    }
    
    if (parsed.silhouette) {
      parts.push(`${parsed.silhouette} silhouette`);
    }
    
    if (parsed.primaryColor) {
      parts.push(`in ${parsed.primaryColor}`);
      if (parsed.secondaryColor) {
        parts.push(`and ${parsed.secondaryColor}`);
      }
    }
    
    if (parsed.fabricType) {
      parts.push(`${parsed.fabricType} fabric`);
    }
    
    // Add key details if available
    if (parsed.keyDetails) {
      parts.push(parsed.keyDetails.toLowerCase());
    }
    
    // Add formality and occasion context
    if (parsed.formality) {
      parts.push(`${parsed.formality} wear`);
    }
    
    if (parsed.occasion) {
      parts.push(`for ${parsed.occasion}`);
    }
    
    // Brand/designer vibe
    if (parsed.brandVibe) {
      parts.push(`${parsed.brandVibe} aesthetic`);
    }
    
    // Pose and shot type
    if (parsed.modelPose && parsed.modelPose !== 'n/a') {
      parts.push(`${parsed.modelPose} pose`);
    }
    
    if (parsed.shotType) {
      parts.push(parsed.shotType);
    }
    
    // Photography quality
    parts.push('professional fashion photography');
    parts.push('studio lighting');
    parts.push('high resolution');
    
    return parts.join(', ');
  }
  
  /**
   * Generate a style description for CLIP embeddings
   * @private
   */
  _generateStyleDescription(result) {
    const parts = [];
    
    // Primary style aesthetic
    if (result.style?.aesthetic) {
      parts.push(`${result.style.aesthetic} style`);
    }
    
    // Secondary aesthetic
    if (result.style?.secondary) {
      parts.push(`${result.style.secondary} influence`);
    }
    
    // Garment type and silhouette
    if (result.garmentType) {
      parts.push(result.garmentType);
    }
    
    if (result.silhouette) {
      parts.push(`${result.silhouette} silhouette`);
    }
    
    // Colors
    if (result.colors?.primary) {
      parts.push(`${result.colors.primary} color`);
    }
    
    // Fabric
    if (result.fabric?.type) {
      parts.push(`${result.fabric.type} fabric`);
    }
    
    // Formality and occasion
    if (result.style?.formality) {
      parts.push(`${result.style.formality} formality`);
    }
    
    if (result.style?.occasion) {
      parts.push(`for ${result.style.occasion}`);
    }
    
    // Model context
    if (result.modelSpecs?.gender) {
      parts.push(`${result.modelSpecs.gender} model`);
    }
    
    return parts.join(', ');
  }
  
  /**
   * Generate a prompt from parsed fashion data (legacy method for compatibility)
   * @private
   */
  _generatePrompt(parsed) {
    return this._generateEnhancedPrompt(parsed);
  }

  /**
   * Get fallback analysis when vision API fails
   * @private
   */
  _getFallbackAnalysis() {
    const styles = ['minimalist', 'elegant', 'casual', 'romantic', 'edgy'];
    const garments = ['dress', 'top', 'skirt', 'pants', 'jacket'];
    const colors = ['black', 'white', 'navy', 'gray', 'beige'];
    const silhouettes = ['fitted', 'loose', 'oversized', 'A-line', 'straight'];
    
    const randomStyle = styles[Math.floor(Math.random() * styles.length)];
    const randomGarment = garments[Math.floor(Math.random() * garments.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomSilhouette = silhouettes[Math.floor(Math.random() * silhouettes.length)];
    
    const genders = ['female', 'male'];
    const poses = ['standing', 'seated', 'walking'];
    const shots = ['full body', '3/4 body', 'upper body'];
    
    const randomGender = genders[Math.floor(Math.random() * genders.length)];
    const randomPose = poses[Math.floor(Math.random() * poses.length)];
    const randomShot = shots[Math.floor(Math.random() * shots.length)];
    
    return {
      garmentType: randomGarment,
      silhouette: randomSilhouette,
      fabric: {
        type: 'cotton',
        texture: 'smooth',
        weight: 'medium',
        finish: 'matte'
      },
      colors: {
        primary: randomColor,
        secondary: null,
        pattern: null
      },
      construction: {
        seams: 'standard',
        closure: 'zipper',
        details: []
      },
      style: {
        aesthetic: randomStyle,
        formality: 'casual',
        season: 'all-season',
        overall: 'contemporary',
        mood: 'sophisticated'
      },
      neckline: 'crew',
      sleeveLength: 'short',
      length: 'midi',
      modelSpecs: {
        gender: randomGender,
        ageRange: 'adult',
        poseType: randomPose,
        shotType: randomShot,
        ethnicity: 'diverse'
      },
      promptText: `${randomGender} model, ${randomPose} pose, ${randomShot}, ${randomSilhouette} ${randomGarment} in ${randomColor}, ${randomStyle} style, professional fashion photography, studio lighting, high resolution`,
      confidence: 0.75,
      attributes: {
        fallback: true
      }
    };
  }

  /**
   * Prepare image for API
   * @private
   */
  _prepareImage(image) {
    if (typeof image === 'string' && image.startsWith('data:')) {
      return image;
    }
    
    if (Buffer.isBuffer(image)) {
      const base64 = image.toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    }
    
    return image;
  }

  /**
   * Delay helper
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new FashionAnalysisService();
