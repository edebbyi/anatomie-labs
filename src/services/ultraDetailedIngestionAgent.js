/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ULTRA-DETAILED INGESTION AGENT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This replaces enhancedStyleDescriptorAgent.js with FORENSIC-LEVEL analysis.
 * 
 * CRITICAL IMPROVEMENTS:
 * - Captures ALL garment layers (shirt under jacket, etc.)
 * - Fabric properties (texture, drape, weight, sheen)
 * - Model demographics (ethnicity, body type, proportions)
 * - Detailed photography specs (shot type, angle, lighting, background)
 * - Color analysis with placement and percentages
 * - Construction details (seams, stitching, closures)
 * - Comprehensive validation and confidence scoring
 * 
 * WHY THIS MATTERS:
 * Weak ingestion = weak profiles = bad AI generation = frustrated users
 * Strong ingestion = rich profiles = precise AI generation = delighted users
 */

const db = require('./database');
const logger = require('../utils/logger');
const Replicate = require('replicate');

class UltraDetailedIngestionAgent {
  constructor() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('Replicate API token not configured');
    }
    this.replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ANALYZE PORTFOLIO (Main entry point - maintains compatibility)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async analyzePortfolio(portfolioId, progressCallback = null) {
    logger.info('Ultra-Detailed Ingestion: Starting portfolio analysis', { portfolioId });

    const images = await this.getPortfolioImages(portfolioId);
    
    if (images.length === 0) {
      throw new Error('No images found in portfolio');
    }

    const results = {
      analyzed: 0,
      failed: 0,
      descriptors: [],
      avgConfidence: 0,
      avgCompleteness: 0
    };

    const CONCURRENCY_LIMIT = parseInt(process.env.ANALYSIS_CONCURRENCY || '3', 10);
    const batches = [];
    
    for (let i = 0; i < images.length; i += CONCURRENCY_LIMIT) {
      batches.push(images.slice(i, i + CONCURRENCY_LIMIT));
    }

    logger.info('Ultra-Detailed Ingestion: Processing in parallel', {
      totalImages: images.length,
      batchCount: batches.length,
      concurrency: CONCURRENCY_LIMIT
    });

    let processedCount = 0;
    let totalConfidence = 0;
    let totalCompleteness = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      const batchPromises = batch.map(async (image, indexInBatch) => {
        try {
          const descriptor = await this.analyzeImage(image);
          results.descriptors.push(descriptor);
          results.analyzed++;
          processedCount++;
          
          totalConfidence += descriptor.metadata?.overall_confidence || 0;
          totalCompleteness += descriptor.completeness_percentage || 0;
          
          if (progressCallback) {
            progressCallback({
              current: processedCount,
              total: images.length,
              percentage: Math.round((processedCount / images.length) * 100),
              currentImage: image.filename,
              analyzed: results.analyzed,
              failed: results.failed,
              avgConfidence: (totalConfidence / results.analyzed).toFixed(2),
              avgCompleteness: (totalCompleteness / results.analyzed).toFixed(1)
            });
          }
          
          return { success: true, descriptor };
        } catch (error) {
          logger.error('Ultra-Detailed Ingestion: Failed to analyze image', { 
            imageId: image.id,
            filename: image.filename,
            error: error.message 
          });
          results.failed++;
          processedCount++;
          
          if (progressCallback) {
            progressCallback({
              current: processedCount,
              total: images.length,
              percentage: Math.round((processedCount / images.length) * 100),
              currentImage: image.filename,
              analyzed: results.analyzed,
              failed: results.failed,
              error: error.message
            });
          }
          
          return { success: false, error: error.message };
        }
      });

      await Promise.all(batchPromises);
      
      logger.info('Ultra-Detailed Ingestion: Batch complete', { 
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
        processed: processedCount,
        total: images.length
      });
    }

    results.avgConfidence = results.analyzed > 0 
      ? (totalConfidence / results.analyzed).toFixed(3) 
      : 0;
    results.avgCompleteness = results.analyzed > 0 
      ? (totalCompleteness / results.analyzed).toFixed(1) 
      : 0;

    logger.info('Ultra-Detailed Ingestion: Portfolio analysis complete', { 
      portfolioId,
      analyzed: results.analyzed,
      failed: results.failed,
      avgConfidence: results.avgConfidence,
      avgCompleteness: results.avgCompleteness
    });

    return results;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ANALYZE SINGLE IMAGE (Core analysis logic)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async analyzeImage(image) {
    const imageBuffer = await this.fetchImage(image.url_original);
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    logger.info('Ultra-Detailed Ingestion: Analyzing image', {
      imageId: image.id, 
      filename: image.filename
    });

    try {
      const output = await this.replicate.run(
        'google/gemini-2.5-flash',
        {
          input: {
            prompt: this.getComprehensivePrompt(),
            image: dataUri,
            max_output_tokens: 8192,
            temperature: 0.1
          }
        }
      );

      const responseText = Array.isArray(output) ? output.join('') : output;
      const analysis = this.parseJsonResponse(responseText);
      
      // Validate and calculate completeness
      const validation = this.validateAnalysis(analysis);
      analysis.completeness_percentage = parseFloat(validation.completenessScore.percentage);
      
      // Store in database with new ultra-detailed structure
      const descriptor = await this.saveDescriptor(image.id, image.user_id, analysis);
      
      logger.info('Ultra-Detailed Ingestion: Analysis complete', { 
        imageId: image.id,
        confidence: analysis.metadata?.overall_confidence,
        completeness: analysis.completeness_percentage,
        garmentCount: analysis.garments?.length || 0
      });

      // If confidence is low, retry once
      if (analysis.metadata?.overall_confidence < 0.70 && !image._retried) {
        logger.warn('Ultra-Detailed Ingestion: Low confidence, retrying', {
          imageId: image.id,
          confidence: analysis.metadata.overall_confidence
        });
        
        image._retried = true;
        return await this.analyzeImage(image);
      }

      return descriptor;
    } catch (error) {
      logger.error('Ultra-Detailed Ingestion: Analysis failed', { 
        imageId: image.id,
        filename: image.filename,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * COMPREHENSIVE ANALYSIS PROMPT
   * ═══════════════════════════════════════════════════════════════════════════
   */
  getComprehensivePrompt() {
    return `You are an expert fashion analyst with 20+ years of experience. Analyze this image with FORENSIC-LEVEL detail.

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════════

1. BE PRECISE: "Navy wool blazer" not "jacket", "ponte knit" not "fabric"
2. BE EXHAUSTIVE: Capture EVERY visible detail
3. BE HONEST: If unclear, mark as "not_visible" or null
4. DESCRIBE LAYERS: Shirt under jacket = 2 separate garment entries
5. ANALYZE CONSTRUCTION: Seams, stitching, closures, hardware
6. IDENTIFY FABRICS: Based on drape, texture, sheen
7. ASSESS DEMOGRAPHICS: Respectfully describe model characteristics
8. PHOTOGRAPHY SPECS: Shot type, angle, lighting, background

═══════════════════════════════════════════════════════════════════════════════
OUTPUT STRUCTURE - RETURN ONLY VALID JSON
═══════════════════════════════════════════════════════════════════════════════

{
  "executive_summary": {
    "one_sentence_description": "30-word summary",
    "key_garments": ["primary", "secondary"],
    "dominant_aesthetic": "overall vibe",
    "standout_detail": "unique feature"
  },

  "garments": [
    {
      "garment_id": "G1",
      "type": "specific garment type",
      "layer_order": 1,
      
      "fabric": {
        "primary_material": "specific fabric name",
        "fabric_weight": "light/medium/heavy/not_visible",
        "texture": "smooth/textured/ribbed/etc",
        "drape": "structured/fluid/crisp/soft/not_visible",
        "sheen": "matte/satin/glossy/metallic/not_visible",
        "stretch": "non-stretch/slight/moderate/high/not_visible",
        "opacity": "opaque/semi-sheer/sheer/not_visible"
      },

      "construction": {
        "seam_details": ["french seams", "topstitching"],
        "stitching_color": "thread color",
        "stitching_type": "straight/zigzag/decorative/not_visible",
        "closures": ["zipper: location, type", "buttons: count, material"],
        "hardware": ["buckles", "grommets"],
        "lining": "fully/partially/unlined/not_visible",
        "interfacing": "visible interfacing description",
        "finishing": ["raw hem", "bound edges"]
      },

      "silhouette": {
        "overall_shape": "boxy/fitted/oversized/A-line",
        "fit": "tight/slim/regular/loose/oversized",
        "length": "specific measurement reference",
        "proportions": "cropped/standard/elongated",
        "waist_definition": "cinched/natural/dropped/no waist"
      },

      "design_details": {
        "neckline": "crew/v-neck/scoop/square/boat/etc",
        "collar": "notched/shawl/mandarin/peter pan/none",
        "sleeves": {
          "type": "set-in/raglan/dolman/sleeveless",
          "length": "short/elbow/3-4/long",
          "cuff": "buttoned/ribbed/turned-up/none",
          "details": ["gathering", "pleats", "shoulder pads"]
        },
        "pockets": {
          "type": "patch/welt/slash/hidden/none",
          "count": 0,
          "placement": "hip/chest/side"
        },
        "hem": {
          "type": "straight/curved/asymmetric",
          "finish": "raw/stitched/rolled/bound"
        },
        "embellishments": ["embroidery", "beading"],
        "special_features": ["gathering", "pleats", "cutouts"]
      },

      "color_palette": [
        {
          "color_name": "navy blue",
          "hex_estimate": "#1a2b4c",
          "coverage_percentage": 70,
          "placement": "entire garment body",
          "color_role": "primary/accent/neutral"
        }
      ],

      "pattern": {
        "type": "solid/stripes/checks/floral/geometric/none",
        "scale": "micro/small/medium/large/not_applicable",
        "direction": "vertical/horizontal/diagonal/all-over",
        "repeat": "regular/irregular/not_applicable"
      },

      "condition_visible": "pristine/worn/distressed/vintage"
    }
  ],

  "model_demographics": {
    "ethnicity": {
      "observed_characteristics": "respectful description",
      "skin_tone": "very fair/fair/light medium/medium/tan/brown/deep brown",
      "skin_undertone": "cool/neutral/warm/not_visible"
    },
    "body_type": {
      "overall_build": "petite/slender/athletic/average/curvy/plus-size",
      "height_estimate": "petite/average/tall",
      "proportions": "short torso/balanced/long torso, short legs/balanced/long legs",
      "shoulder_width": "narrow/average/broad",
      "body_shape": "rectangle/triangle/inverted triangle/hourglass/oval"
    },
    "age_range": "teens/early 20s/late 20s/30s/40s/50+",
    "gender_presentation": "feminine/masculine/androgynous",
    "hair": {
      "color": "color description",
      "length": "short/medium/long",
      "texture": "straight/wavy/curly/coily",
      "style": "loose/updo/pulled back"
    },
    "notable_features": ["glasses", "tattoos"]
  },

  "photography": {
    "shot_composition": {
      "type": "full body/three-quarter/waist-up/close-up/detail",
      "orientation": "portrait/landscape/square",
      "framing": "centered/off-center/rule of thirds",
      "cropping": "none/tight/loose"
    },
    "camera_angle": {
      "vertical": "eye-level/high-angle/low-angle",
      "horizontal": "straight-on/3-4 angle/profile/back",
      "distance": "extreme close-up/close-up/medium/long shot"
    },
    "pose": {
      "body_position": "standing/sitting/walking/lying",
      "posture": "upright/slouched/leaning",
      "weight_distribution": "both feet/one hip",
      "arms": "at sides/crossed/hands on hips",
      "hands": "relaxed/in pockets/holding something",
      "head": "straight/tilted/turned",
      "gaze": "camera/away/down/up",
      "facial_expression": "neutral/smiling/serious",
      "body_language": "confident/relaxed/dynamic/static"
    },
    "lighting": {
      "type": "natural/studio/ambient/mixed",
      "quality": "hard/soft/diffused",
      "direction": "front/side/back/top/bottom",
      "color_temperature": "warm/neutral/cool",
      "shadows": "harsh/soft/minimal/none",
      "highlights": "specular/diffused/blown out/not_visible"
    },
    "background": {
      "type": "solid color/gradient/textured/location/studio",
      "color": "specific color",
      "complexity": "minimal/moderate/busy",
      "depth_of_field": "shallow/deep/not_applicable",
      "context": "indoor/outdoor/studio"
    },
    "image_quality": {
      "resolution": "high/medium/low",
      "sharpness": "sharp/soft/out of focus",
      "grain": "none/minimal/moderate/heavy",
      "color_accuracy": "natural/saturated/muted/filtered"
    }
  },

  "styling_context": {
    "accessories": {
      "jewelry": ["necklace: gold chain", "earrings: small hoops"],
      "bags": "crossbody bag, black leather",
      "shoes": "ankle boots, black leather",
      "belts": "none visible",
      "hats": "none visible",
      "scarves": "none visible",
      "eyewear": "none visible",
      "other": ["watch"]
    },
    "layering_logic": "how pieces work together",
    "color_coordination": "monochromatic/complementary/analogous/contrasting",
    "pattern_mixing": "yes/no",
    "fit_harmony": "description",
    "styling_approach": "minimalist/maximalist/eclectic/classic/trendy"
  },

  "contextual_attributes": {
    "season": "spring/summer/fall/winter/transitional/year-round",
    "occasion": "casual/business casual/business formal/cocktail/evening",
    "time_of_day": "morning/afternoon/evening/night/not_specified",
    "activity_suitability": "loungewear/activewear/workwear/eveningwear",
    "formality_level": "very casual/casual/smart casual/semi-formal/formal",
    "mood_aesthetic": "romantic/edgy/minimalist/bohemian/preppy",
    "style_tribe": "classic/contemporary/avant-garde/streetwear/athleisure",
    "trend_relevance": "timeless/current season/emerging trend/dated/vintage"
  },

  "technical_fashion_notes": {
    "garment_functionality": ["wrinkle-resistant", "water-repellent"],
    "construction_quality": "haute couture/ready-to-wear high/mid-tier/fast fashion",
    "design_innovation": "unique construction or design elements",
    "manufacturing_clues": "visible branding, made-to-measure indicators",
    "care_implications": "dry clean only/machine washable/delicate"
  },

  "metadata": {
    "analysis_timestamp": "ISO 8601 timestamp",
    "overall_confidence": 0.92,
    "low_confidence_attributes": [
      {
        "attribute": "fabric.stretch",
        "reason": "cannot assess from static image",
        "confidence": 0.40
      }
    ],
    "uncertain_details": ["Could not determine lining"],
    "assumptions_made": ["Assumed wool based on drape"],
    "recommendations": ["Re-analyze with higher resolution"]
  }
}

RETURN ONLY THE JSON. NO MARKDOWN. NO PREAMBLE.`;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * JSON PARSING & VALIDATION
   * ═══════════════════════════════════════════════════════════════════════════
   */
  parseJsonResponse(text) {
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No JSON found in response');
    }
    
    const jsonText = cleaned.slice(jsonStart, jsonEnd);
    return JSON.parse(jsonText);
  }

  validateAnalysis(data) {
    const requiredFields = [
      'executive_summary',
      'garments',
      'model_demographics',
      'photography',
      'styling_context',
      'contextual_attributes',
      'metadata'
    ];

    const missingFields = requiredFields.filter(field => !data[field]);
    
    const garmentIssues = [];
    if (data.garments && data.garments.length > 0) {
      data.garments.forEach((garment, idx) => {
        if (!garment.fabric || !garment.fabric.primary_material) {
          garmentIssues.push(`Garment ${idx + 1}: Missing fabric details`);
        }
        if (!garment.color_palette || garment.color_palette.length === 0) {
          garmentIssues.push(`Garment ${idx + 1}: Missing color information`);
        }
      });
    } else {
      garmentIssues.push('No garments analyzed');
    }

    const photoIssues = [];
    if (data.photography) {
      if (!data.photography.shot_composition?.type) {
        photoIssues.push('Missing shot type');
      }
      if (!data.photography.lighting?.type) {
        photoIssues.push('Missing lighting information');
      }
    }

    let score = 0;
    let maxScore = 100;

    // Executive summary (10 points)
    if (data.executive_summary?.one_sentence_description) score += 5;
    if (data.executive_summary?.key_garments?.length > 0) score += 3;
    if (data.executive_summary?.standout_detail) score += 2;

    // Garments (40 points)
    if (data.garments && data.garments.length > 0) {
      score += 10;
      data.garments.forEach(g => {
        if (g.fabric?.primary_material) score += 3;
        if (g.construction?.seam_details?.length > 0) score += 2;
        if (g.color_palette?.length > 0) score += 3;
        if (g.design_details) score += 2;
      });
      score = Math.min(score, 50); // Cap
    }

    // Photography (20 points)
    if (data.photography?.shot_composition?.type) score += 5;
    if (data.photography?.camera_angle) score += 5;
    if (data.photography?.lighting?.type) score += 5;
    if (data.photography?.background?.type) score += 5;

    // Model demographics (15 points)
    if (data.model_demographics?.ethnicity) score += 5;
    if (data.model_demographics?.body_type) score += 5;
    if (data.model_demographics?.age_range) score += 5;

    // Styling context (10 points)
    if (data.styling_context?.accessories) score += 5;
    if (data.styling_context?.layering_logic) score += 5;

    // Contextual attributes (5 points)
    if (data.contextual_attributes?.season) score += 2;
    if (data.contextual_attributes?.occasion) score += 2;
    if (data.contextual_attributes?.mood_aesthetic) score += 1;

    const isValid = missingFields.length === 0 && 
                    garmentIssues.length === 0 && 
                    photoIssues.length === 0;

    return {
      isValid,
      missingFields,
      garmentIssues,
      photoIssues,
      completenessScore: {
        score,
        maxScore,
        percentage: ((score / maxScore) * 100).toFixed(1)
      }
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * DATABASE OPERATIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async saveDescriptor(imageId, userId, analysis) {
    const query = `
      INSERT INTO ultra_detailed_descriptors (
        image_id,
        user_id,
        executive_summary,
        garments,
        model_demographics,
        photography,
        styling_context,
        contextual_attributes,
        technical_fashion_notes,
        metadata,
        completeness_percentage,
        overall_confidence
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (image_id) DO UPDATE SET
        executive_summary = EXCLUDED.executive_summary,
        garments = EXCLUDED.garments,
        model_demographics = EXCLUDED.model_demographics,
        photography = EXCLUDED.photography,
        styling_context = EXCLUDED.styling_context,
        contextual_attributes = EXCLUDED.contextual_attributes,
        technical_fashion_notes = EXCLUDED.technical_fashion_notes,
        metadata = EXCLUDED.metadata,
        completeness_percentage = EXCLUDED.completeness_percentage,
        overall_confidence = EXCLUDED.overall_confidence,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, [
      imageId,
      userId,
      JSON.stringify(analysis.executive_summary),
      JSON.stringify(analysis.garments),
      JSON.stringify(analysis.model_demographics),
      JSON.stringify(analysis.photography),
      JSON.stringify(analysis.styling_context),
      JSON.stringify(analysis.contextual_attributes),
      JSON.stringify(analysis.technical_fashion_notes),
      JSON.stringify(analysis.metadata),
      analysis.completeness_percentage || 0,
      analysis.metadata?.overall_confidence || 0.5
    ]);

    return result.rows[0];
  }

  async getPortfolioImages(portfolioId) {
    const query = `
      SELECT id, user_id, url_original, filename
      FROM portfolio_images
      WHERE portfolio_id = $1
      ORDER BY created_at
    `;

    const result = await db.query(query, [portfolioId]);
    return result.rows;
  }

  async fetchImage(url) {
    if (url.startsWith('http')) {
      const axios = require('axios');
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    }
    
    throw new Error('Invalid image URL');
  }
}

module.exports = new UltraDetailedIngestionAgent();
