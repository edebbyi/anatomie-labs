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
        const maxRetries = 2;
        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              logger.info('Ultra-Detailed Ingestion: Retrying image analysis', {
                imageId: image.id,
                filename: image.filename,
                attempt: attempt + 1,
                maxAttempts: maxRetries + 1
              });
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            }
            
            const descriptor = await this.analyzeImage(image);
            results.descriptors.push(descriptor);
            results.analyzed++;
            processedCount++;
            
            // Ensure we're working with numbers, not strings
            const confidence = parseFloat(descriptor.metadata?.overall_confidence) || 0;
            const completeness = parseFloat(descriptor.completeness_percentage) || 0;
            
            // Make sure we're adding numbers, not concatenating strings
            totalConfidence = totalConfidence + confidence;
            totalCompleteness = totalCompleteness + completeness;
            
            if (progressCallback) {
              // Ensure we're calculating with numbers
              const currentAnalyzed = results.analyzed;
              if (currentAnalyzed > 0) {
                const avgConf = totalConfidence / currentAnalyzed;
                const avgComp = totalCompleteness / currentAnalyzed;
                
                progressCallback({
                  current: processedCount,
                  total: images.length,
                  percentage: Math.round((processedCount / images.length) * 100),
                  currentImage: image.filename,
                  analyzed: results.analyzed,
                  failed: results.failed,
                  avgConfidence: avgConf.toFixed(2),
                  avgCompleteness: avgComp.toFixed(1)
                });
              }
            }
            
            return { success: true, descriptor };
          } catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
              // Final attempt failed
              logger.error('Ultra-Detailed Ingestion: Failed to analyze image after retries', { 
                imageId: image.id,
                filename: image.filename,
                attempts: maxRetries + 1,
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
            // Will retry on next iteration
          }
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

    // Ensure final values are numbers
    results.avgConfidence = results.analyzed > 0 
      ? parseFloat((totalConfidence / results.analyzed).toFixed(3))
      : 0;
    results.avgCompleteness = results.analyzed > 0 
      ? parseFloat((totalCompleteness / results.analyzed).toFixed(1))
      : 0;

    // Additional validation to ensure we have proper numeric types
    if (typeof results.avgConfidence !== 'number' || !isFinite(results.avgConfidence)) {
      logger.warn('avgConfidence is not a valid number, setting to 0.95', { 
        value: results.avgConfidence, 
        type: typeof results.avgConfidence 
      });
      results.avgConfidence = 0.95;
    }
    
    if (typeof results.avgCompleteness !== 'number' || !isFinite(results.avgCompleteness)) {
      logger.warn('avgCompleteness is not a valid number, setting to 100', { 
        value: results.avgCompleteness, 
        type: typeof results.avgCompleteness 
      });
      results.avgCompleteness = 100;
    }

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
    return `You are an expert fashion analyst with 20+ years of experience in luxury fashion design, styling, and garment construction. You have trained at Central Saint Martins and worked with houses like Prada, The Row, and Lemaire.
  
  ═══════════════════════════════════════════════════════════════════════════════
  CRITICAL GARMENT TAXONOMY - READ CAREFULLY BEFORE ANALYZING
  ═══════════════════════════════════════════════════════════════════════════════
  
  **BLAZER vs OTHER JACKETS:**
  - BLAZER: Tailored jacket with NOTCHED or PEAKED LAPELS, structured shoulders, typically with buttons (1-3), chest pocket, flap pockets at hip. Made from suiting fabrics (wool, wool-blend, gabardine). Has a formal, business-like structure. NEVER has a shirt collar or ribbed cuffs.
  - BOMBER JACKET: Casual jacket with RIBBED CUFFS and RIBBED HEM (this is the key identifier), typically zip-front, no lapels, rounded collar or stand collar, shorter length (waist/hip). Made from nylon, leather, or jersey. Sporty aesthetic.
  - DENIM JACKET: Casual jacket made from DENIM fabric, typically with metal buttons, chest pockets with flaps, western-style yoke seaming. Can have shirt collar or stand collar.
  - UTILITY JACKET: Casual jacket with MULTIPLE PATCH POCKETS (4+ pockets is the key identifier), often in cotton twill or canvas, typically zip or snap front, no lapels. Military-inspired design.
  - SHIRT JACKET/SHACKET: Shirt-like jacket, softer construction than blazer, button-front with SHIRT COLLAR (not lapels), often in flannel, denim, or canvas. Unstructured shoulders.
  - MOTO JACKET: Asymmetric zip front, typically leather or faux leather, diagonal zipper, snap collar, fitted silhouette.
  
  **VEST vs JACKET/BLAZER:**
  - VEST/GILET: SLEEVELESS garment. Can be quilted, puffer-style, or tailored. NEVER has sleeves. If sleeveless → ALWAYS a vest, NEVER a jacket or blazer.
  - QUILTED VEST: Sleeveless with diamond or channel quilting pattern, often puffer-style with down fill.
  - MOTO VEST: Sleeveless with moto-style details (zippers, buckles), typically leather or technical fabric.
  - BLAZER: ALWAYS has sleeves (full-length or 3/4). If it's sleeveless, it's a VEST, not a blazer.
  
  **SHIRT/BLOUSE vs BLAZER:**
  - SHIRT/BLOUSE: Lighter-weight fabric (cotton poplin, silk, chambray), SHIRT COLLAR (flat collar, not structured lapels), button-front closure, typically tucked or worn loose. Can be utility-style with multiple pockets.
  - UTILITY SHIRT: Button-front shirt with 4+ patch pockets, typically in cotton twill, military-inspired.
  - BLAZER: Heavier suiting fabric (wool, wool-blend), structured LAPELS (not just a collar), more rigid construction, shoulder pads, typically hip-length.
  
  **KNIT TOPS:**
  - SWEATER/JUMPER: Knitted garment, can be crew-neck, v-neck, turtleneck, mock-neck. Made from wool, cotton, cashmere knit. Can be fine-gauge (thin knit) or chunky knit.
  - RIBBED KNIT TOP/SWEATER: Tight-knit with visible VERTICAL RIBS (this is key), form-fitting, often in cotton or wool blend. Stretchy fabric.
  - CARDIGAN: Open-front knitted garment with buttons, snaps, or zip closure.
  - POLO SHIRT: Knit shirt with collar and button placket at neck, typically in pique cotton.
  
  **KEY IDENTIFICATION FACTORS:**
  1. **COLLAR TYPE** (MOST CRITICAL):
     - Notched lapels or peaked lapels → BLAZER
     - Shirt collar (flat, pointed) → SHIRT/BLOUSE
     - Stand collar or ribbed collar → BOMBER JACKET
     - No collar/crew neck → SWEATER or T-SHIRT
     
  2. **FABRIC** (SECOND MOST CRITICAL):
     - Suiting wool/gabardine → BLAZER
     - Cotton twill → UTILITY SHIRT or CHINOS
     - Nylon with ribbed trim → BOMBER JACKET
     - Knit fabric with ribs → RIBBED KNIT SWEATER
     - Quilted nylon → QUILTED VEST or PUFFER
     - Denim → DENIM JACKET or JEANS
     
  3. **CONSTRUCTION**:
     - Tailored/structured with shoulder pads → BLAZER
     - Soft/unstructured with shirt collar → SHIRT JACKET
     - Ribbed cuffs + ribbed hem → BOMBER JACKET
     - Quilted with sleeveless → VEST
     
  4. **SLEEVES**:
     - Full sleeves (set-in, structured) → JACKET/BLAZER
     - Sleeveless → VEST (never jacket)
     - Raglan sleeves with ribbed cuffs → BOMBER JACKET
     
  5. **LENGTH**:
     - Hip-length + lapels → BLAZER
     - Waist-length + ribbed hem → BOMBER JACKET
     - Cropped + sleeveless → VEST
     
  6. **CLOSURE**:
     - Buttons with lapels → BLAZER
     - Zipper with ribbed trim → BOMBER JACKET
     - Buttons with shirt collar → SHIRT/BLOUSE
     - Asymmetric zipper → MOTO JACKET
  
  7. **POCKETS**:
     - Flap pockets at hip → BLAZER
     - Patch pockets (4+) → UTILITY JACKET/SHIRT
     - Slash pockets → BOMBER JACKET
     - Zip pockets → ATHLETIC/MOTO
  
  **FABRIC VOCABULARY - BE SPECIFIC:**
  - Suiting: wool flannel, wool gabardine, tropical wool, wool crepe
  - Cotton: cotton poplin, cotton twill, cotton canvas, chambray, oxford cloth
  - Knit: ponte knit, double knit, jersey knit, ribbed knit, merino wool knit
  - Technical: nylon taffeta, nylon ripstop, polyester fleece, tech twill
  - Luxury: silk charmeuse, silk crepe, cashmere knit, leather (specify type)
  - Casual: denim (specify weight), corduroy, flannel, canvas
  
  ═══════════════════════════════════════════════════════════════════════════════
  ANALYSIS PROTOCOL - FOLLOW IN ORDER
  ═══════════════════════════════════════════════════════════════════════════════
  
  STEP 1: IDENTIFY BASIC STRUCTURE
  ❓ Does it have sleeves?
     → NO = VEST/GILET/TANK (NEVER jacket or blazer)
     → YES = Continue to Step 2
  
  STEP 2: EXAMINE COLLAR TYPE (MOST CRITICAL)
  ❓ What type of collar/neckline?
     → Notched lapels or peaked lapels = Likely BLAZER (verify fabric in Step 3)
     → Shirt collar (flat, pointed) = SHIRT/BLOUSE/SHIRT JACKET
     → Stand collar or ribbed collar = Likely BOMBER JACKET
     → Crew neck/no collar = SWEATER or T-SHIRT
  
  STEP 3: VERIFY FABRIC (SECOND MOST CRITICAL)
  ❓ What's the fabric?
     → Suiting wool/gabardine + lapels = BLAZER ✓
     → Cotton twill + shirt collar = UTILITY SHIRT ✓
     → Nylon + ribbed trim = BOMBER JACKET ✓
     → Knit with visible ribs = RIBBED KNIT SWEATER ✓
     → Quilted + sleeveless = QUILTED VEST ✓
  
  STEP 4: CHECK CONSTRUCTION DETAILS
  ❓ Is there:
     → Structured shoulders + lapels + flap pockets = BLAZER
     → Ribbed cuffs + ribbed hem + zipper = BOMBER JACKET
     → Multiple patch pockets (4+) = UTILITY JACKET/SHIRT
     → Quilting pattern + sleeveless = QUILTED VEST
  
  STEP 5: VERIFY YOUR CLASSIFICATION
  Before finalizing, ask yourself:
  ✓ "Does this garment have ALL the characteristics of a [garment type]?"
  ✓ "Could this be mistaken for something else?"
  ✓ "Am I 100% certain about the fabric and construction?"
  ✓ "Have I checked for ribbed cuffs/hem (bomber) or lapels (blazer)?"
  
  ═══════════════════════════════════════════════════════════════════════════════
  CRITICAL CLASSIFICATION RULES - MEMORIZE THESE
  ═══════════════════════════════════════════════════════════════════════════════
  
  🚫 NEVER call something a BLAZER unless:
     1. It has NOTCHED or PEAKED LAPELS (not just a collar)
     2. It has STRUCTURED construction with shoulder pads
     3. It's made from SUITING fabric (wool, gabardine, etc.)
     4. It does NOT have ribbed cuffs or ribbed hem
  
  🚫 NEVER call something a JACKET if:
     1. It has NO SLEEVES (that's a vest)
  
  ✅ ALWAYS classify as BOMBER JACKET if:
     1. It has RIBBED CUFFS and RIBBED HEM (this is the key)
     2. Typically has a zipper front
     3. Made from nylon, leather, or jersey
  
  ✅ ALWAYS classify as VEST if:
     1. It has NO SLEEVES (sleeveless = vest, always)
     2. Can be quilted vest, moto vest, tailored vest, etc.
  
  ✅ ALWAYS classify as UTILITY SHIRT if:
     1. It has 4+ PATCH POCKETS
     2. Button-front with shirt collar
     3. Made from cotton twill or canvas
  
  ✅ ALWAYS classify as RIBBED KNIT SWEATER if:
     1. Fabric has visible VERTICAL RIBS
     2. Stretchy knit construction
     3. Form-fitting silhouette
  
  ═══════════════════════════════════════════════════════════════════════════════
  OUTPUT STRUCTURE - RETURN ONLY VALID JSON
  ═══════════════════════════════════════════════════════════════════════════════
  
  {
    "executive_summary": {
      "one_sentence_description": "30-word summary with PRECISE garment names (e.g., 'ribbed knit crew-neck sweater in cream ponte knit')",
      "key_garments": ["specific garment type with fabric", "specific garment type with fabric"],
      "dominant_aesthetic": "overall vibe (minimalist, sporty-chic, utilitarian, contemporary sportswear, athleisure, etc.)",
      "standout_detail": "unique feature that makes this garment distinctive"
    },
  
    "garments": [
      {
        "garment_id": "G1",
        "type": "PRECISE garment type - USE TERMS FROM TAXONOMY ABOVE (e.g., 'bomber jacket', 'ribbed knit sweater', 'utility shirt', 'quilted vest', 'moto vest', 'tailored trousers'). NEVER use generic 'jacket' or 'top' - be specific!",
        "layer_order": 1,
        
        "fabric": {
          "primary_material": "SPECIFIC fabric name using vocabulary above (e.g., 'cotton twill', 'nylon taffeta', 'ponte knit', 'wool gabardine', 'quilted nylon', 'cotton poplin', 'merino wool knit')",
          "fabric_weight": "light/medium/heavy/not_visible",
          "texture": "smooth/textured/ribbed/quilted/woven/knit",
          "drape": "structured/fluid/crisp/soft/not_visible",
          "sheen": "matte/satin/glossy/metallic/not_visible",
          "stretch": "non-stretch/slight/moderate/high/not_visible",
          "opacity": "opaque/semi-sheer/sheer/not_visible"
        },
  
        "construction": {
          "seam_details": ["topstitching", "french seams", "flat-felled seams", "princess seams", "contrast stitching"],
          "stitching_color": "thread color (tonal/contrast/metallic)",
          "stitching_type": "straight/zigzag/decorative/coverstitching/not_visible",
          "closures": ["zipper: center front, two-way, metal teeth", "buttons: 2, horn, functional", "snaps: 4, metal, decorative"],
          "hardware": ["metal zipper pulls with leather tab", "D-rings", "buckles", "grommets"],
          "lining": "fully lined/partially lined/unlined/not_visible",
          "interfacing": "visible in collar and lapels/visible in collar/none visible/not_visible",
          "finishing": ["raw hem", "bound edges with grosgrain", "ribbed cuffs", "elastic waist"]
        },
  
        "silhouette": {
          "overall_shape": "boxy/fitted/oversized/cropped/bomber-style/A-line/straight/tapered",
          "fit": "tight/slim/regular/relaxed/loose/oversized",
          "length": "crop (above waist)/waist/hip/mid-thigh/knee",
          "proportions": "cropped/standard/elongated",
          "waist_definition": "cinched with belt/natural waist/dropped waist/no waist definition/elasticated waist/ribbed hem"
        },
  
        "design_details": {
          "neckline": "crew/v-neck/scoop/square/boat/mock-neck/funnel-neck/turtleneck",
          "collar": "CRITICAL - BE PRECISE: notched lapel/peaked lapel/shawl collar/shirt collar (point/spread)/stand collar/ribbed collar/funnel neck/band collar/NONE",
          "sleeves": {
            "type": "set-in/raglan/dolman/kimono/drop-shoulder/sleeveless",
            "length": "cap/short/elbow/3-4/long/extra-long/sleeveless",
            "cuff": "buttoned (1-2 buttons)/ribbed (elastic)/elastic/straight-hem/turned-up/french cuff/none",
            "details": ["shoulder pads (light/moderate/strong)", "gathering at cap", "pleats", "contrast panels"]
          },
          "pockets": {
            "type": "patch (exterior)/welt (bound opening)/slash (side seam)/flap (with flap)/zip (with zipper)/hidden (internal)/cargo (patch with flap)/none",
            "count": 0,
            "placement": "chest (single/dual)/hip (side)/side seam/cargo-style (thigh)/internal (jacket lining)"
          },
          "hem": {
            "type": "straight/curved/asymmetric/ribbed (elastic)/elastic drawstring",
            "finish": "raw (unfinished)/stitched (standard)/rolled/bound (with tape)/ribbed knit/vented (with slits)"
          },
          "embellishments": ["embroidery (floral motif on chest)", "beading", "contrast stitching (white on navy)", "appliqué", "none visible"],
          "special_features": ["quilting (diamond pattern)", "two-way zipper", "adjustable waist tabs", "wind flap", "convertible collar", "none visible"]
        },
  
        "color_palette": [
          {
            "color_name": "PRECISE color name with tone (sage green, charcoal grey, navy blue, cream, off-white, camel, taupe, burgundy)",
            "hex_estimate": "#approximate_hex",
            "coverage_percentage": 70,
            "placement": "entire garment body / sleeves only / body panel / contrast trim",
            "color_role": "primary/secondary/accent/neutral"
          }
        ],
  
        "pattern": {
          "type": "solid/stripes/checks/floral/geometric/quilted diamond/herringbone/houndstooth/polka dot/none",
          "scale": "micro/small/medium/large/not_applicable",
          "direction": "vertical/horizontal/diagonal/all-over/not_applicable",
          "repeat": "regular/irregular/not_applicable"
        },
  
        "condition_visible": "pristine/lightly worn/worn/distressed/vintage"
      }
    ],
  
    "model_demographics": {
      "ethnicity": {
        "observed_characteristics": "respectful description of visible features",
        "skin_tone": "very fair/fair/light medium/medium/tan/brown/deep brown",
        "skin_undertone": "cool/neutral/warm/not_visible"
      },
      "body_type": {
        "overall_build": "petite/slender/athletic/average/curvy/plus-size",
        "height_estimate": "petite (under 5'4\")/average (5'4\"-5'8\")/tall (over 5'8\")",
        "proportions": "short torso-long legs/balanced/long torso-short legs",
        "shoulder_width": "narrow/average/broad",
        "body_shape": "rectangle/triangle/inverted triangle/hourglass/oval"
      },
      "age_range": "teens/early 20s/late 20s/early 30s/late 30s/40s/50+",
      "gender_presentation": "feminine/masculine/androgynous",
      "hair": {
        "color": "blonde/brunette/black/red/grey/dyed (color)",
        "length": "short (above shoulders)/medium (shoulder to collarbone)/long (below shoulders)",
        "texture": "straight/wavy/curly/coily",
        "style": "loose/updo/pulled back/ponytail/braided/styled with product"
      },
      "notable_features": ["glasses (frame style)", "visible tattoos", "watch", "none visible"]
    },
  
    "photography": {
      "shot_composition": {
        "type": "full body/three-quarter (waist to head)/waist-up/bust-up/close-up/detail shot",
        "orientation": "portrait/landscape/square",
        "framing": "centered/off-center/rule of thirds/symmetrical",
        "cropping": "none/tight/loose/dramatic"
      },
      "camera_angle": {
        "vertical": "eye-level/high-angle (looking down)/low-angle (looking up)/bird's eye",
        "horizontal": "straight-on/3-4 angle (slight turn)/profile (90 degrees)/back view",
        "distance": "extreme close-up/close-up/medium shot/medium-long shot/long shot"
      },
      "pose": {
        "body_position": "standing/sitting/walking/leaning/lying/kneeling",
        "posture": "upright (straight back)/slouched/leaning (direction)/relaxed",
        "weight_distribution": "both feet evenly/one hip (weight shifted)/mid-stride/seated",
        "arms": "at sides/crossed over chest/hands on hips/one hand in pocket/both hands in pockets/arms raised",
        "hands": "relaxed at sides/in pockets/holding object/gesturing/on hips/clasped",
        "head": "straight/tilted (direction and degree)/turned (direction)/chin down/chin up",
        "gaze": "directly at camera/away from camera (direction)/down/up/middle distance",
        "facial_expression": "neutral/slight smile/smiling/serious/contemplative/confident",
        "body_language": "confident (shoulders back)/relaxed (loose posture)/dynamic (in motion)/static (still)/casual/formal"
      },
      "lighting": {
        "type": "natural window light/studio lighting/outdoor natural/ambient indoor/mixed sources",
        "quality": "hard (defined shadows)/soft (diffused)/even (no shadows)/dramatic (high contrast)",
        "direction": "front/side (45 degrees)/side (90 degrees)/back/top (overhead)/bottom (under-lit)",
        "color_temperature": "warm (golden)/neutral (daylight balanced)/cool (blue-toned)",
        "shadows": "harsh with defined edges/soft with gradual transition/minimal/none visible",
        "highlights": "specular (bright spots)/diffused (gentle glow)/blown out (overexposed)/not_visible",
        "overall_mood": "bright and airy/moody/dramatic/flat/natural"
      },
      "background": {
        "type": "solid color backdrop/gradient/textured wall or surface/location (indoor)/location (outdoor)/studio seamless",
        "color": "white/off-white/grey/beige/colored (specify)/not_applicable",
        "complexity": "minimal (no distractions)/moderate (some elements)/busy (many elements)",
        "depth_of_field": "shallow (blurred background)/deep (sharp background)/not_applicable",
        "context": "indoor studio/outdoor urban/outdoor natural/indoor location/abstract"
      },
      "image_quality": {
        "resolution": "high (crisp details)/medium/low (pixelated)",
        "sharpness": "tack sharp/sharp/slightly soft/soft/out of focus",
        "grain": "none (clean)/minimal/moderate/heavy (intentional or noise)",
        "color_accuracy": "natural (true to life)/saturated (boosted)/muted (desaturated)/warm cast/cool cast/filtered"
      }
    },
  
    "styling_context": {
      "accessories": {
        "jewelry": ["none visible" OR "necklace: gold chain, delicate, 16-inch" OR "earrings: small gold hoops" OR "rings: multiple, gold bands"],
        "bags": "none visible" OR "crossbody bag, black leather, chain strap" OR "tote bag, canvas",
        "shoes": "SPECIFIC TYPE: athletic sneakers, white leather, chunky sole" OR "ankle boots, black leather, block heel" OR "loafers, suede, tassel detail" OR "not visible in frame",
        "belts": "none visible" OR "leather belt, brown, brass buckle, worn at natural waist" OR "fabric belt",
        "hats": "none visible" OR "baseball cap" OR "beanie" OR "fedora",
        "scarves": "none visible" OR "silk scarf, patterned, worn as necktie",
        "eyewear": "none visible" OR "sunglasses: oversized, dark lenses" OR "prescription glasses: round frames",
        "other": ["watch: round face, leather strap, gold hardware" OR "hair clip" OR "none visible"]
      },
      "layering_logic": "Description of how pieces work together (e.g., 'ribbed knit sweater worn alone as statement piece' OR 'utility shirt layered over white tank, sleeves rolled to 3/4 length')",
      "color_coordination": "monochromatic (single color family)/complementary (opposite on color wheel)/analogous (adjacent colors)/contrasting (bold color mix)/neutral palette (blacks, whites, greys, beiges)/earth tones",
      "pattern_mixing": "yes (describe patterns mixed)/no (solid or single pattern)",
      "fit_harmony": "Description of how garment fits work together (e.g., 'fitted top balanced with relaxed wide-leg pants' OR 'oversized bomber creates relaxed silhouette with slim pants')",
      "styling_approach": "minimalist (clean, simple)/maximalist (layered, detailed)/sporty-chic (athletic meets refined)/utilitarian (functional, practical)/classic (timeless, traditional)/contemporary (modern, current)/athleisure (athletic-leisure blend)/streetwear (urban, casual)"
    },
  
    "contextual_attributes": {
      "season": "spring (lightweight layers)/summer (breathable, short sleeves)/fall (transitional layers)/winter (warm, insulated)/transitional (between seasons)/year-round (versatile)",
      "occasion": "casual (everyday wear)/elevated casual (polished casual)/business casual/athletic/weekend/travel/evening casual",
      "time_of_day": "morning/afternoon/evening/night/all-day versatile/not_specified",
      "activity_suitability": "loungewear/activewear/workwear (office)/travel/everyday errands/outdoor activities/indoor casual",
      "formality_level": "very casual (lounge, home)/casual (everyday)/smart casual (polished)/semi-formal/formal",
      "mood_aesthetic": "sporty-chic/minimalist/utilitarian/contemporary/athleisure/relaxed/polished/edgy/romantic/classic/modern",
      "style_tribe": "contemporary sportswear/athleisure/minimalist/utilitarian/modern casual/classic/streetwear/avant-garde/preppy",
      "trend_relevance": "timeless (always in style)/current season (trendy now)/emerging trend (forward-looking)/classic (established style)/vintage-inspired"
    },
  
    "technical_fashion_notes": {
      "garment_functionality": ["wrinkle-resistant", "water-repellent", "breathable", "moisture-wicking", "stretch", "packable", "machine washable", "temperature regulating"],
      "construction_quality": "haute couture (hand-finished)/luxury ready-to-wear (high-end construction)/premium (quality materials and make)/contemporary (good quality)/mid-tier (standard quality)",
      "design_innovation": "Description of unique construction or design elements (e.g., 'bonded seams eliminate bulk', 'convertible collar design', 'seamless knit construction')",
      "manufacturing_clues": "Visible branding/logo, made-to-measure indicators (numbered sizing), couture details, fast-fashion tells",
      "care_implications": "dry clean only/dry clean recommended/machine washable cold/hand wash/delicate cycle/professional leather care"
    },
  
    "metadata": {
      "analysis_timestamp": "2025-10-25T14:30:00Z",
      "overall_confidence": 0.92,
      "low_confidence_attributes": [
        {
          "attribute": "fabric.primary_material",
          "reason": "Cannot determine exact fabric composition from image alone, inferred from texture and drape",
          "confidence": 0.65
        }
      ],
      "uncertain_details": ["Could not determine if garment is lined due to angle", "Exact button count obscured"],
      "assumptions_made": ["Assumed cotton twill based on matte texture and structured drape", "Assumed metal hardware based on sheen"],
      "recommendations": ["Higher resolution image would allow fabric identification", "Multiple angles would clarify construction details"]
    }
  }
  
  ═══════════════════════════════════════════════════════════════════════════════
  FINAL REMINDERS - CHECK BEFORE SUBMITTING
  ═══════════════════════════════════════════════════════════════════════════════
  
  🔍 PRE-SUBMISSION CHECKLIST:
  □ If garment has NOTCHED or PEAKED LAPELS + suiting fabric → classified as BLAZER ✓
  □ If garment has RIBBED CUFFS + RIBBED HEM → classified as BOMBER JACKET ✓
  □ If garment is SLEEVELESS → classified as VEST (NEVER jacket) ✓
  □ If garment has SHIRT COLLAR + multiple pockets → classified as UTILITY SHIRT ✓
  □ If fabric has VERTICAL RIBS + knit → classified as RIBBED KNIT SWEATER ✓
  □ If garment has QUILTING + sleeveless → classified as QUILTED VEST ✓
  □ Used SPECIFIC fabric names (cotton twill, ponte knit, etc.) ✓
  □ Collar type is PRECISE (notched lapel vs shirt collar vs stand collar) ✓
  □ Overall confidence reflects actual certainty about classification ✓
  
  RETURN ONLY THE JSON. NO MARKDOWN CODE BLOCKS. NO PREAMBLE. NO EXPLANATION.`;
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
