/**
 * Trend Analysis Agent
 * 
 * Aggregates portfolio-level statistics and generates style clusters.
 * Creates comprehensive style profiles for users.
 */

const db = require('./database');
const logger = require('../utils/logger');
const Replicate = require('replicate');

class TrendAnalysisAgent {
  /**
   * Generate style profile from portfolio
   * @param {string} userId - User ID
   * @param {string} portfolioId - Portfolio ID
   * @returns {Promise<Object>} Style profile
   */
  async generateStyleProfile(userId, portfolioId) {
    logger.info('Trend Analysis Agent: Generating style profile', { userId, portfolioId });

    // Get all descriptors for the portfolio
    const descriptors = await this.getPortfolioDescriptors(portfolioId);
    
    if (descriptors.length === 0) {
      throw new Error('No image descriptors found. Run Style Descriptor Agent first.');
    }

    // Aggregate distributions
    const garmentDist = this.calculateDistribution(descriptors, 'garment_type');
    const colorDist = this.calculateColorDistribution(descriptors);
    const fabricDist = this.calculateDistribution(descriptors, 'fabric');
    const silhouetteDist = this.calculateDistribution(descriptors, 'silhouette');

    // Extract style labels
    const styleLabels = this.aggregateStyleLabels(descriptors);

    // Generate style clusters
    const clusters = this.generateClusters(descriptors, garmentDist, colorDist, fabricDist);

    // Use GPT-5 to enhance style labels and summary (if available)
    let enhancedLabels = styleLabels;
    let enhancedSummary = this.generateSummary(
      descriptors.length,
      styleLabels,
      garmentDist,
      colorDist,
      fabricDist
    );

    if (process.env.REPLICATE_API_TOKEN) {
      try {
        const gptEnhancement = await this.enhanceWithGPT5({
          styleLabels,
          garmentDist,
          colorDist,
          fabricDist,
          imageCount: descriptors.length
        });
        
        if (gptEnhancement.labels) {
          enhancedLabels = gptEnhancement.labels;
        }
        if (gptEnhancement.summary) {
          enhancedSummary = gptEnhancement.summary;
        }
      } catch (error) {
        logger.warn('GPT-5 enhancement failed, using statistical summary', { error: error.message });
      }
    }

    // Save to database
    const profile = await this.saveStyleProfile(userId, portfolioId, {
      style_labels: enhancedLabels,
      garment_distribution: garmentDist,
      color_distribution: colorDist,
      fabric_distribution: fabricDist,
      silhouette_distribution: silhouetteDist,
      clusters: clusters,
      summary_text: enhancedSummary,
      total_images: descriptors.length
    });

    logger.info('Trend Analysis Agent: Profile generated', { 
      userId,
      totalImages: descriptors.length,
      clusters: clusters.length
    });

    return profile;
  }

  /**
   * Calculate distribution for a field
   */
  calculateDistribution(descriptors, field) {
    const counts = {};
    let total = 0;

    for (const desc of descriptors) {
      const value = desc[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
        total++;
      }
    }

    // Convert to percentages
    const distribution = {};
    for (const [key, count] of Object.entries(counts)) {
      distribution[key] = parseFloat((count / total).toFixed(3));
    }

    // Sort by frequency
    return Object.fromEntries(
      Object.entries(distribution).sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Calculate color distribution (from color_palette arrays)
   */
  calculateColorDistribution(descriptors) {
    const counts = {};
    let total = 0;

    for (const desc of descriptors) {
      // Parse garments JSON if it's a string
      const garments = typeof desc.garments === 'string' 
        ? JSON.parse(desc.garments) 
        : desc.garments || [];
      
      // Iterate through each garment's color palette
      for (const garment of garments) {
        const colors = garment.color_palette || [];
        for (const color of colors) {
          // Extract color name from color object
          if (color && typeof color === 'object' && color.color_name) {
            const normalized = color.color_name.toLowerCase().trim();
            counts[normalized] = (counts[normalized] || 0) + 1;
            total++;
          } else if (color && typeof color === 'string') {
            // Fallback for string colors
            const normalized = color.toLowerCase().trim();
            counts[normalized] = (counts[normalized] || 0) + 1;
            total++;
          } else if (color && typeof color === 'object' && color.name) {
            // Another fallback for color objects with name property
            const normalized = color.name.toLowerCase().trim();
            counts[normalized] = (counts[normalized] || 0) + 1;
            total++;
          }
        }
      }
    }

    // Return empty object if no colors found
    if (total === 0) {
      return {};
    }

    const distribution = {};
    for (const [key, count] of Object.entries(counts)) {
      distribution[key] = parseFloat((count / total).toFixed(3));
    }

    return Object.fromEntries(
      Object.entries(distribution).sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Aggregate style labels across all images
   */
  aggregateStyleLabels(descriptors) {
    const labelCounts = {};
    
    for (const desc of descriptors) {
      // Extract style-related attributes from raw_analysis
      const rawAnalysis = desc.raw_analysis || {};
      
      // Extract style attributes
      const styleAttributes = [
        rawAnalysis.mood_aesthetic,
        rawAnalysis.style_tribe,
        rawAnalysis.styling_approach,
        rawAnalysis.formality_level
      ].filter(Boolean);
      
      // Count each unique style attribute
      for (const attr of styleAttributes) {
        // Split by common delimiters and clean up
        const labels = attr.split(/[,\/]/).map(l => l.trim().toLowerCase()).filter(Boolean);
        for (const label of labels) {
          // Skip generic terms
          if (!['not_specified', 'not_visible', 'none'].includes(label)) {
            labelCounts[label] = (labelCounts[label] || 0) + 1;
          }
        }
      }
    }

    // Calculate frequency-based scores
    const aggregated = [];
    for (const [name, count] of Object.entries(labelCounts)) {
      const frequency = count / descriptors.length;
      
      aggregated.push({
        name: this.capitalizeLabel(name),
        score: parseFloat(frequency.toFixed(3)),
        count,
        examples: []
      });
    }

    // Sort by count and take top 5
    return aggregated
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
  
  /**
   * Capitalize style label for display
   */
  capitalizeLabel(label) {
    return label
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate style clusters
   */
  generateClusters(descriptors, garmentDist, colorDist, fabricDist) {
    const clusters = [];

    // Cluster 1: Most common garment type + most common attributes
    const topGarment = Object.keys(garmentDist)[0];
    if (topGarment) {
      const garmentDescriptors = descriptors.filter(d => d.garment_type === topGarment);
      const topColors = this.getTopN(colorDist, 3);
      const topFabrics = this.getTopN(fabricDist, 2);

      clusters.push({
        name: `${topGarment} essentials`,
        weight: garmentDist[topGarment],
        signature_attributes: {
          garment_type: topGarment,
          colors: topColors,
          fabrics: topFabrics,
          silhouette: this.mostCommon(garmentDescriptors, 'silhouette')
        }
      });
    }

    // Cluster 2: Secondary style
    const secondGarment = Object.keys(garmentDist)[1];
    if (secondGarment) {
      const garmentDescriptors = descriptors.filter(d => d.garment_type === secondGarment);
      
      clusters.push({
        name: `${secondGarment} collection`,
        weight: garmentDist[secondGarment],
        signature_attributes: {
          garment_type: secondGarment,
          colors: this.getTopN(colorDist, 2),
          fabrics: this.getTopN(fabricDist, 2),
          silhouette: this.mostCommon(garmentDescriptors, 'silhouette')
        }
      });
    }

    return clusters;
  }

  /**
   * Get top N keys from distribution
   */
  getTopN(distribution, n) {
    return Object.keys(distribution).slice(0, n);
  }

  /**
   * Find most common value for a field in subset of descriptors
   */
  mostCommon(descriptors, field) {
    const counts = {};
    for (const desc of descriptors) {
      const value = desc[field];
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }

    let max = 0;
    let maxKey = null;
    for (const [key, count] of Object.entries(counts)) {
      if (count > max) {
        max = count;
        maxKey = key;
      }
    }

    return maxKey;
  }

  /**
   * Generate summary text
   */
  generateSummary(imageCount, styleLabels, garmentDist, colorDist, fabricDist) {
    const topStyles = styleLabels.map(l => l.name).slice(0, 3).join(', ');
    const topGarments = this.getTopN(garmentDist, 3);
    const topColors = this.getTopN(colorDist, 3);
    const topFabrics = this.getTopN(fabricDist, 3);

    const garmentPct = (garmentDist[topGarments[0]] * 100).toFixed(0);
    const colorPct = (colorDist[topColors[0]] * 100).toFixed(0);

    return `Based on ${imageCount} images, your style signature includes ${topStyles}. ` +
      `Your wardrobe is ${garmentPct}% ${topGarments[0]}s, with a preference for ` +
      `${topColors.join(', ')} tones. ` +
      `You favor ${topFabrics.join(', ')} fabrics.`;
  }

  /**
   * Save style profile to database
   */
  async saveStyleProfile(userId, portfolioId, profileData) {
    const query = `
      INSERT INTO style_profiles (
        user_id, portfolio_id, style_labels, garment_distribution,
        color_distribution, fabric_distribution, silhouette_distribution,
        clusters, summary_text, total_images
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id) DO UPDATE SET
        portfolio_id = EXCLUDED.portfolio_id,
        style_labels = EXCLUDED.style_labels,
        garment_distribution = EXCLUDED.garment_distribution,
        color_distribution = EXCLUDED.color_distribution,
        fabric_distribution = EXCLUDED.fabric_distribution,
        silhouette_distribution = EXCLUDED.silhouette_distribution,
        clusters = EXCLUDED.clusters,
        summary_text = EXCLUDED.summary_text,
        total_images = EXCLUDED.total_images,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      portfolioId,
      JSON.stringify(profileData.style_labels),
      JSON.stringify(profileData.garment_distribution),
      JSON.stringify(profileData.color_distribution),
      JSON.stringify(profileData.fabric_distribution),
      JSON.stringify(profileData.silhouette_distribution),
      JSON.stringify(profileData.clusters),
      profileData.summary_text,
      profileData.total_images
    ]);

    return result.rows[0];
  }

  /**
   * Get portfolio descriptors
   */
  async getPortfolioDescriptors(portfolioId) {
    const query = `
      SELECT d.*
      FROM ultra_detailed_descriptors d
      JOIN portfolio_images pi ON d.image_id = pi.id
      WHERE pi.portfolio_id = $1
    `;

    const result = await db.query(query, [portfolioId]);
    
    // Transform ultra-detailed descriptors to flat structure for aggregation
    return result.rows.map(row => {
      const garments = typeof row.garments === 'string' ? JSON.parse(row.garments) : row.garments;
      const primaryGarment = garments?.[0] || {};
      const executiveSummary = typeof row.executive_summary === 'string' ? JSON.parse(row.executive_summary) : row.executive_summary;
      const contextual = typeof row.contextual_attributes === 'string' ? JSON.parse(row.contextual_attributes) : row.contextual_attributes;
      const stylingContext = typeof row.styling_context === 'string' ? JSON.parse(row.styling_context) : row.styling_context;
      
      return {
        image_id: row.image_id,
        garment_type: primaryGarment.type || executiveSummary?.key_garments?.[0] || 'unknown',
        fabric: primaryGarment.fabric?.primary_material || 'unknown',
        silhouette: primaryGarment.silhouette?.overall_shape || 'unknown',
        garments: garments, // Include full garments array for color extraction
        contextual_attributes: contextual,
        styling_context: stylingContext,
        raw_analysis: {
          mood_aesthetic: contextual?.mood_aesthetic,
          style_tribe: contextual?.style_tribe,
          styling_approach: contextual?.styling_approach || stylingContext?.styling_approach,
          formality_level: contextual?.formality_level
        }
      };
    });
  }

  /**
   * Get user style profile
   */
  async getStyleProfile(userId) {
    const query = `
      SELECT * FROM style_profiles
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }
}

module.exports = new TrendAnalysisAgent();
