/**
 * IMPROVED Trend Analysis Agent
 * 
 * Extracts RICH aesthetic themes from ultra-detailed descriptors
 * instead of just basic aggregations
 */

const db = require('./database');
const logger = require('../utils/logger');

class ImprovedTrendAnalysisAgent {
  /**
   * Generate enhanced style profile from ultra-detailed descriptors
   */
  async generateEnhancedStyleProfile(userId, portfolioId) {
    logger.info('Improved Trend Analysis: Generating enhanced profile', { userId, portfolioId });

    const descriptors = await this.getUltraDetailedDescriptors(portfolioId);
    
    if (descriptors.length === 0) {
      throw new Error('No ultra-detailed descriptors found. Run Ultra-Detailed Ingestion first.');
    }

    // NEW: Extract rich aesthetic themes
    const aestheticThemes = this.extractAestheticThemes(descriptors);
    
    // NEW: Extract construction patterns
    const constructionPatterns = this.extractConstructionPatterns(descriptors);
    
    // NEW: Extract signature pieces
    const signaturePieces = this.extractSignaturePieces(descriptors);
    
    // Existing: Calculate distributions
    const garmentDist = this.calculateDistribution(descriptors, 'garment_type');
    const colorDist = this.calculateColorDistribution(descriptors);
    const fabricDist = this.calculateFabricDistribution(descriptors);
    const silhouetteDist = this.calculateSilhouetteDistribution(descriptors);

    // NEW: Generate rich summary
    const richSummary = this.generateRichSummary({
      descriptors,
      aestheticThemes,
      constructionPatterns,
      signaturePieces,
      garmentDist,
      colorDist
    });

    // Generate style tags from aesthetic themes
    const styleTags = aestheticThemes.slice(0, 5).map(theme => theme.name);

    // Save to database
    const profile = await this.saveEnhancedProfile(userId, portfolioId, {
      // Existing fields
      garment_distribution: garmentDist,
      color_distribution: colorDist,
      fabric_distribution: fabricDist,
      silhouette_distribution: silhouetteDist,

      // NEW fields
      aesthetic_themes: aestheticThemes,
      construction_patterns: constructionPatterns,
      signature_pieces: signaturePieces,
      rich_summary: richSummary,
      style_tags: styleTags,

      total_images: descriptors.length,
      avg_confidence: this.calculateAvgConfidence(descriptors),
      avg_completeness: this.calculateAvgCompleteness(descriptors)
    });

    logger.info('Improved Trend Analysis: Enhanced profile complete', { 
      userId,
      aestheticThemes: aestheticThemes.length,
      signaturePieces: signaturePieces.length
    });

    return profile;
  }

  /**
   * Normalize style tags for TEXT[] storage (dedupe, trim, limit size)
   */
  sanitizeStyleTags(styleTags) {
    if (!styleTags) {
      return [];
    }

    let tags = styleTags;

    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) {
          tags = parsed;
        } else if (typeof parsed === 'string') {
          tags = [parsed];
        } else {
          tags = [tags];
        }
      } catch (_error) {
        tags = tags
          .split(/[,;/]/)
          .map(tag => tag.trim())
          .filter(Boolean);
      }
    }

    if (!Array.isArray(tags)) {
      return [];
    }

    const seen = new Set();
    const cleaned = [];

    tags.forEach(tag => {
      let value = null;

      if (typeof tag === 'string') {
        value = tag;
      } else if (tag && typeof tag.name === 'string') {
        value = tag.name;
      }

      if (!value) {
        return;
      }

      const normalized = value.trim().replace(/\s+/g, ' ');
      if (!normalized) {
        return;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      cleaned.push(normalized.slice(0, 120));
    });

    return cleaned;
  }

  /**
   * Extract aesthetic themes (sporty-chic, equestrian, minimalist, etc.)
   */
  extractAestheticThemes(descriptors) {
    const themes = new Map();
    
    descriptors.forEach(desc => {
      const contextual = desc.contextual_attributes || {};
      const styling = desc.styling_context || {};
      const executive = desc.executive_summary || {};
      
      // Collect all aesthetic descriptors
      const aesthetics = [
        contextual.mood_aesthetic,
        contextual.style_tribe,
        styling.styling_approach,
        executive.dominant_aesthetic,
        contextual.formality_level
      ].filter(Boolean);
      
      aesthetics.forEach(aesthetic => {
        // Split compound descriptors (e.g., "sporty-chic, elevated")
        const parts = aesthetic.split(/[,\/]/).map(p => p.trim().toLowerCase());
        
        parts.forEach(part => {
          if (!part || part === 'not_specified') return;
          
          if (!themes.has(part)) {
            themes.set(part, {
              name: part,
              count: 0,
              examples: [],
              garment_types: new Set(),
              construction_details: new Set()
            });
          }
          
          const theme = themes.get(part);
          theme.count++;
          
          // Add example garment
          if (theme.examples.length < 3) {
            const garmentDesc = executive.key_garments?.[0] || desc.garments?.[0]?.type;
            if (garmentDesc) {
              theme.examples.push(garmentDesc);
            }
          }
          
          // Track garment types for this aesthetic
          if (desc.garments?.[0]?.type) {
            theme.garment_types.add(desc.garments[0].type);
          }
          
          // Track construction details
          const construction = desc.garments?.[0]?.construction;
          if (construction) {
            [...(construction.seam_details || []), ...(construction.hardware || [])]
              .slice(0, 2)
              .forEach(detail => theme.construction_details.add(detail));
          }
        });
      });
    });
    
    // Convert to array with metadata
    return Array.from(themes.values())
      .map(theme => ({
        name: this.capitalizePhrase(theme.name),
        count: theme.count,
        strength: theme.count / descriptors.length,
        frequency: (theme.count / descriptors.length * 100).toFixed(0) + '%',
        examples: theme.examples,
        garment_types: Array.from(theme.garment_types),
        construction_details: Array.from(theme.construction_details).slice(0, 3),
        description: this.getAestheticDescription(theme.name)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  /**
   * Extract construction patterns (quilting, pocket types, closures)
   */
  extractConstructionPatterns(descriptors) {
    const patterns = new Map();
    
    descriptors.forEach(desc => {
      desc.garments?.forEach(garment => {
        const construction = garment.construction || {};
        
        // Collect all construction details
        const details = [
          ...(construction.seam_details || []),
          ...(construction.closures || []),
          ...(construction.hardware || []),
          ...(construction.finishing || [])
        ];
        
        details.forEach(detail => {
          if (!detail || detail === 'none') return;
          
          if (!patterns.has(detail)) {
            patterns.set(detail, {
              name: detail,
              count: 0,
              garment_types: new Set(),
              aesthetics: new Set()
            });
          }
          
          const pattern = patterns.get(detail);
          pattern.count++;
          
          // Track which garments use this detail
          if (garment.type) {
            pattern.garment_types.add(garment.type);
          }
          
          // Track aesthetic context
          const aesthetic = desc.contextual_attributes?.mood_aesthetic;
          if (aesthetic) {
            pattern.aesthetics.add(aesthetic);
          }
        });
      });
    });
    
    return Array.from(patterns.values())
      .map(p => ({
        name: p.name,
        count: p.count,
        frequency: (p.count / descriptors.length * 100).toFixed(0) + '%',
        garment_types: Array.from(p.garment_types),
        aesthetics: Array.from(p.aesthetics)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }

  /**
   * Extract signature pieces (high-confidence, distinctive items)
   */
  extractSignaturePieces(descriptors) {
    return descriptors
      .filter(d => 
        d.overall_confidence > 0.75 && 
        d.completeness_percentage > 70 &&
        d.garments && 
        d.garments.length > 0
      )
      .map(d => {
        const garment = d.garments[0];
        const executive = d.executive_summary || {};
        
        return {
          image_id: d.image_id,
          garment_type: garment.type,
          description: executive.one_sentence_description,
          standout_detail: executive.standout_detail,
          fabric: garment.fabric?.primary_material,
          fabric_properties: {
            texture: garment.fabric?.texture,
            drape: garment.fabric?.drape,
            sheen: garment.fabric?.sheen
          },
          construction_highlights: [
            ...(garment.construction?.seam_details || []),
            ...(garment.construction?.closures || []),
            ...(garment.construction?.hardware || [])
          ].slice(0, 3),
          colors: garment.color_palette?.map(c => ({
            name: c.color_name,
            hex: c.hex_estimate,
            coverage: c.coverage_percentage
          })) || [],
          aesthetic: d.contextual_attributes?.mood_aesthetic,
          styling_approach: d.styling_context?.styling_approach,
          confidence: d.overall_confidence,
          completeness: d.completeness_percentage
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8);
  }

  /**
   * Calculate fabric distribution from ultra-detailed descriptors
   */
  calculateFabricDistribution(descriptors) {
    const counts = {};
    let total = 0;

    descriptors.forEach(desc => {
      desc.garments?.forEach(garment => {
        const fabric = garment.fabric?.primary_material;
        if (fabric) {
          counts[fabric] = (counts[fabric] || 0) + 1;
          total++;
        }
      });
    });

    if (total === 0) return {};

    const distribution = {};
    for (const [key, count] of Object.entries(counts)) {
      distribution[key] = parseFloat((count / total).toFixed(3));
    }

    return Object.fromEntries(
      Object.entries(distribution).sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Calculate silhouette distribution
   */
  calculateSilhouetteDistribution(descriptors) {
    const counts = {};
    let total = 0;

    descriptors.forEach(desc => {
      desc.garments?.forEach(garment => {
        const silhouette = garment.silhouette?.overall_shape;
        if (silhouette) {
          counts[silhouette] = (counts[silhouette] || 0) + 1;
          total++;
        }
      });
    });

    if (total === 0) return {};

    const distribution = {};
    for (const [key, count] of Object.entries(counts)) {
      distribution[key] = parseFloat((count / total).toFixed(3));
    }

    return Object.fromEntries(
      Object.entries(distribution).sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Calculate color distribution from ultra-detailed descriptors
   */
  calculateColorDistribution(descriptors) {
    const counts = {};
    let total = 0;

    descriptors.forEach(desc => {
      desc.garments?.forEach(garment => {
        const colors = garment.color_palette || [];
        colors.forEach(color => {
          const colorName = color.color_name?.toLowerCase();
          if (colorName) {
            // Weight by coverage percentage
            const weight = (color.coverage_percentage || 100) / 100;
            counts[colorName] = (counts[colorName] || 0) + weight;
            total += weight;
          }
        });
      });
    });

    if (total === 0) return {};

    const distribution = {};
    for (const [key, count] of Object.entries(counts)) {
      distribution[key] = parseFloat((count / total).toFixed(3));
    }

    return Object.fromEntries(
      Object.entries(distribution).sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Calculate garment type distribution
   */
  calculateDistribution(descriptors, field) {
    const counts = {};
    let total = 0;

    descriptors.forEach(desc => {
      const value = desc[field] || desc.garments?.[0]?.type;
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
        total++;
      }
    });

    if (total === 0) return {};

    const distribution = {};
    for (const [key, count] of Object.entries(counts)) {
      distribution[key] = parseFloat((count / total).toFixed(3));
    }

    return Object.fromEntries(
      Object.entries(distribution).sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Generate rich summary text
   */
  generateRichSummary(data) {
    const { descriptors, aestheticThemes, constructionPatterns, signaturePieces, garmentDist, colorDist } = data;
    
    const topAesthetic = aestheticThemes[0]?.name || 'contemporary';
    const secondAesthetic = aestheticThemes[1]?.name;
    const topGarment = Object.keys(garmentDist)[0];
    const topColor = Object.keys(colorDist)[0];
    const topConstruction = constructionPatterns[0]?.name;
    
    const garmentPct = (garmentDist[topGarment] * 100).toFixed(0);
    const colorPct = (colorDist[topColor] * 100).toFixed(0);
    
    let summary = `Your style signature is **${topAesthetic}**`;
    
    if (secondAesthetic) {
      summary += ` with **${secondAesthetic}** influences`;
    }
    
    summary += `. Based on ${descriptors.length} images, your wardrobe centers on ${topGarment}s (${garmentPct}%), `;
    summary += `featuring ${topColor} tones (${colorPct}%). `;
    
    if (topConstruction) {
      summary += `Distinctive details include ${topConstruction}`;
      
      if (constructionPatterns[1]) {
        summary += ` and ${constructionPatterns[1].name}`;
      }
      
      summary += '. ';
    }
    
    if (signaturePieces.length > 0) {
      const standoutPiece = signaturePieces[0];
      summary += `Your signature piece: ${standoutPiece.garment_type} featuring ${standoutPiece.standout_detail || standoutPiece.description}.`;
    }
    
    return summary;
  }

  /**
   * Get aesthetic description
   */
  getAestheticDescription(aesthetic) {
    const descriptions = {
      'minimalist': 'Clean lines, restrained palette, focus on quality and cut',
      'sporty-chic': 'Athletic influences elevated with sophisticated styling',
      'equestrian': 'Refined utility with equestrian-inspired details and structured silhouettes',
      'sophisticated': 'Polished, refined, and thoughtfully composed',
      'monochromatic': 'Unified color stories with tonal variation and depth',
      'classic': 'Timeless pieces with enduring appeal and traditional construction',
      'contemporary': 'Modern interpretations of established silhouettes',
      'elevated casual': 'Relaxed pieces styled with intention and attention to detail',
      'tailored': 'Precise fit, structured construction, architectural lines',
      'utilitarian': 'Functional details, practical design, purposeful construction'
    };
    
    return descriptions[aesthetic] || 'A distinctive element of your personal style';
  }

  /**
   * Capitalize phrase
   */
  capitalizePhrase(str) {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-');
  }

  /**
   * Calculate average confidence
   */
  calculateAvgConfidence(descriptors) {
    if (descriptors.length === 0) return 0;
    const sum = descriptors.reduce((acc, d) => acc + (d.overall_confidence || 0), 0);
    let avg = sum / descriptors.length;
    // Clamp to valid range for DECIMAL(4,3) - values from 0.000 to 9.999
    avg = Math.min(Math.max(avg, 0), 9.999);
    return parseFloat(avg.toFixed(3));
  }

  /**
   * Calculate average completeness
   */
  calculateAvgCompleteness(descriptors) {
    if (descriptors.length === 0) return 0;
    const sum = descriptors.reduce((acc, d) => acc + (d.completeness_percentage || 0), 0);
    let avg = sum / descriptors.length;
    // Clamp to valid range for DECIMAL(5,2) - values from 0.00 to 999.99
    avg = Math.min(Math.max(avg, 0), 999.99);
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Get user's style profile
   */
  async getStyleProfile(userId) {
    const query = `
      SELECT * FROM style_profiles
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get ultra-detailed descriptors
   */
  async getUltraDetailedDescriptors(portfolioId) {
    const query = `
      SELECT
        d.*,
        pi.url_original as image_url
      FROM ultra_detailed_descriptors d
      JOIN portfolio_images pi ON d.image_id = pi.id
      WHERE pi.portfolio_id = $1
      ORDER BY d.overall_confidence DESC, d.completeness_percentage DESC
    `;

    const result = await db.query(query, [portfolioId]);
    return result.rows;
  }

  /**
   * Save enhanced profile
   */
  async saveEnhancedProfile(userId, portfolioId, data) {
    // Validate and clamp numeric values to prevent overflow across schema variants
    let validatedAvgConfidence = parseFloat(data.avg_confidence || 0);
    if (isNaN(validatedAvgConfidence)) validatedAvgConfidence = 0;
    // Cap at 9.999 to match DECIMAL(4,3) column definition
    validatedAvgConfidence = Math.min(Math.max(validatedAvgConfidence, 0), 9.999);
    validatedAvgConfidence = parseFloat(validatedAvgConfidence.toFixed(3));
    
    let validatedAvgCompleteness = parseFloat(data.avg_completeness || 0);
    if (isNaN(validatedAvgCompleteness)) validatedAvgCompleteness = 0;
    // Cap at 999.99 to match DECIMAL(5,2) column definition
    validatedAvgCompleteness = Math.min(Math.max(validatedAvgCompleteness, 0), 999.99);
    validatedAvgCompleteness = parseFloat(validatedAvgCompleteness.toFixed(2));
    
    // Additional validation to ensure we have proper numeric types
    if (typeof validatedAvgConfidence !== 'number' || !isFinite(validatedAvgConfidence)) {
      logger.warn('avg_confidence is not a valid number, setting to 0', { value: data.avg_confidence, validated: validatedAvgConfidence });
      validatedAvgConfidence = 0;
    }
    
    if (typeof validatedAvgCompleteness !== 'number' || !isFinite(validatedAvgCompleteness)) {
      logger.warn('avg_completeness is not a valid number, setting to 0', { value: data.avg_completeness, validated: validatedAvgCompleteness });
      validatedAvgCompleteness = 0;
    }
    
    const validatedData = {
      ...data,
      avg_confidence: validatedAvgConfidence,
      avg_completeness: validatedAvgCompleteness
    };

    const styleTagsArray = this.sanitizeStyleTags(data.style_tags);
    validatedData.style_tags = styleTagsArray;
    
    const query = `
      INSERT INTO style_profiles (
        user_id,
        portfolio_id,
        garment_distribution,
        color_distribution,
        fabric_distribution,
        silhouette_distribution,
        aesthetic_themes,
        construction_patterns,
        signature_pieces,
        summary_text,
        total_images,
        avg_confidence,
        avg_completeness,
        style_tags
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      ON CONFLICT (user_id) DO UPDATE SET
        portfolio_id = EXCLUDED.portfolio_id,
        garment_distribution = EXCLUDED.garment_distribution,
        color_distribution = EXCLUDED.color_distribution,
        fabric_distribution = EXCLUDED.fabric_distribution,
        silhouette_distribution = EXCLUDED.silhouette_distribution,
        aesthetic_themes = EXCLUDED.aesthetic_themes,
        construction_patterns = EXCLUDED.construction_patterns,
        signature_pieces = EXCLUDED.signature_pieces,
        summary_text = EXCLUDED.summary_text,
        total_images = EXCLUDED.total_images,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_completeness = EXCLUDED.avg_completeness,
        style_tags = EXCLUDED.style_tags,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    let result;
    try {
      result = await db.query(query, [
        userId,
        portfolioId,
        JSON.stringify(data.garment_distribution),
        JSON.stringify(data.color_distribution),
        JSON.stringify(data.fabric_distribution),
        JSON.stringify(data.silhouette_distribution),
        JSON.stringify(data.aesthetic_themes),
        JSON.stringify(data.construction_patterns),
        JSON.stringify(data.signature_pieces),
        data.rich_summary,
        data.total_images,
        validatedData.avg_confidence,
        validatedData.avg_completeness,
        styleTagsArray
      ]);
    } catch (e) {
      // Defensive retry: if any numeric overflow slips through, set fields to NULL
      logger.warn('Numeric overflow on style_profiles insert, retrying with NULLs', {
        error: e.message,
        avg_confidence: validatedData.avg_confidence,
        avg_completeness: validatedData.avg_completeness,
        avg_confidence_type: typeof validatedData.avg_confidence,
        avg_completeness_type: typeof validatedData.avg_completeness
      });
      const fallbackQuery = `
        INSERT INTO style_profiles (
          user_id, portfolio_id, garment_distribution, color_distribution, fabric_distribution,
          silhouette_distribution, aesthetic_themes, construction_patterns, signature_pieces,
          summary_text, total_images, avg_confidence, avg_completeness, style_tags
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NULL, NULL, $12)
        ON CONFLICT (user_id) DO UPDATE SET
          portfolio_id = EXCLUDED.portfolio_id,
          garment_distribution = EXCLUDED.garment_distribution,
          color_distribution = EXCLUDED.color_distribution,
          fabric_distribution = EXCLUDED.fabric_distribution,
          silhouette_distribution = EXCLUDED.silhouette_distribution,
          aesthetic_themes = EXCLUDED.aesthetic_themes,
          construction_patterns = EXCLUDED.construction_patterns,
          signature_pieces = EXCLUDED.signature_pieces,
          summary_text = EXCLUDED.summary_text,
          total_images = EXCLUDED.total_images,
          avg_confidence = NULL,
          avg_completeness = NULL,
          style_tags = EXCLUDED.style_tags,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`;
      result = await db.query(fallbackQuery, [
        userId,
        portfolioId,
        JSON.stringify(data.garment_distribution),
        JSON.stringify(data.color_distribution),
        JSON.stringify(data.fabric_distribution),
        JSON.stringify(data.silhouette_distribution),
        JSON.stringify(data.aesthetic_themes),
        JSON.stringify(data.construction_patterns),
        JSON.stringify(data.signature_pieces),
        data.rich_summary,
        data.total_images,
        styleTagsArray
      ]);
    }

    return result.rows[0];
  }
}

module.exports = new ImprovedTrendAnalysisAgent();
