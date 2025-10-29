const logger = require('../utils/logger');
const agentService = require('./agentService');
const db = require('./database');

class TrendAwareSuggestionEngine {
  constructor() {
    this.currentSeason = this.detectSeason();
    this.trendDatabase = this.loadTrends();
    
    logger.info('Suggestion engine initialized', {
      season: this.currentSeason
    });
  }

  /**
   * Generate personalized suggestions for a user
   * @param {string} userId - User ID
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of suggestion objects
   */
  async generateSuggestions(userId, options = {}) {
    const {
      maxSuggestions = 6,
      includeTypes = ['seasonal', 'profile', 'gap', 'fusion', 'history']
    } = options;

    try {
      // Fetch user data
      const styleProfile = await this.getUserStyleProfile(userId);
      const recentActivity = await this.getUserRecentActivity(userId);
      const userHistory = await this.getUserGenerationHistory(userId);
      
      const suggestions = [];

      // 1. SEASONAL SUGGESTIONS
      if (includeTypes.includes('seasonal')) {
        const seasonalSuggestions = this.generateSeasonalSuggestions(styleProfile);
        suggestions.push(...seasonalSuggestions);
      }

      // 2. PROFILE-BASED SUGGESTIONS
      if (includeTypes.includes('profile') && styleProfile) {
        const profileSuggestions = this.generateProfileBasedSuggestions(styleProfile);
        suggestions.push(...profileSuggestions);
      }

      // 3. GAP ANALYSIS SUGGESTIONS
      if (includeTypes.includes('gap') && recentActivity) {
        const gapSuggestions = this.generateGapAnalysisSuggestions(
          styleProfile,
          recentActivity
        );
        suggestions.push(...gapSuggestions);
      }

      // 4. FUSION SUGGESTIONS (Trend + Profile)
      if (includeTypes.includes('fusion') && styleProfile) {
        const fusionSuggestions = this.generateFusionSuggestions(
          styleProfile,
          this.trendDatabase[this.currentSeason]
        );
        suggestions.push(...fusionSuggestions);
      }

      // 5. HISTORY-BASED SUGGESTIONS (NEW: Based on past requests)
      if (includeTypes.includes('history') && userHistory) {
        const historySuggestions = this.generateHistoryBasedSuggestions(
          styleProfile,
          userHistory
        );
        suggestions.push(...historySuggestions);
      }

      // Rank and limit suggestions
      const rankedSuggestions = this.rankSuggestions(suggestions, styleProfile);
      const finalSuggestions = rankedSuggestions.slice(0, maxSuggestions);

      logger.info('Suggestions generated', {
        userId,
        totalGenerated: suggestions.length,
        returned: finalSuggestions.length,
        types: finalSuggestions.map(s => s.type)
      });

      return finalSuggestions;

    } catch (error) {
      logger.error('Suggestion generation failed', {
        userId,
        error: error.message
      });
      
      // Return fallback suggestions
      return this.getFallbackSuggestions();
    }
  }

  /**
   * Generate seasonal trend suggestions
   */
  generateSeasonalSuggestions(styleProfile) {
    const seasonalTrends = this.trendDatabase[this.currentSeason];
    if (!seasonalTrends) return [];

    const suggestions = [];

    // Main seasonal trend
    suggestions.push({
      type: 'seasonal',
      priority: 0.9,
      prompt: `Try ${seasonalTrends.keyTrend} - trending now for ${this.currentSeason}`,
      command: `make me 10 ${seasonalTrends.keyTrend} outfits`,
      reasoning: `Popular trend for ${this.currentSeason} 2025`,
      metadata: {
        season: this.currentSeason,
        trend: seasonalTrends.keyTrend,
        confidence: 0.9
      }
    });

    // Secondary trends
    if (seasonalTrends.trends && seasonalTrends.trends.length > 0) {
      const topTrends = seasonalTrends.trends.slice(0, 2);
      topTrends.forEach(trend => {
        suggestions.push({
          type: 'seasonal',
          priority: trend.relevance || 0.7,
          prompt: `Explore ${trend.name} - ${trend.description}`,
          command: `make me 8 ${trend.name} pieces`,
          reasoning: `Trending for ${this.currentSeason}`,
          metadata: {
            season: this.currentSeason,
            trend: trend.name,
            confidence: trend.relevance
          }
        });
      });
    }

    return suggestions;
  }

  /**
   * Generate profile-based suggestions
   * FIXED: Now uses aesthetic_themes instead of just dominantStyles
   */
  generateProfileBasedSuggestions(styleProfile) {
    if (!styleProfile) return [];

    const suggestions = [];

    // FIXED: Use aesthetic_themes if available (richer data)
    if (styleProfile.aesthetic_themes && styleProfile.aesthetic_themes.length > 0) {
      const topAesthetics = styleProfile.aesthetic_themes.slice(0, 2);

      topAesthetics.forEach((aesthetic, index) => {
        const aestheticName = aesthetic.name || aesthetic.aesthetic || aesthetic;
        const confidence = aesthetic.strength || aesthetic.confidence || 0.85;

        suggestions.push({
          type: 'profile',
          priority: confidence - (index * 0.1),
          prompt: `More ${aestheticName} pieces - matches your aesthetic DNA`,
          command: `make me 12 ${aestheticName} garments`,
          reasoning: `Aligns with your ${aestheticName} aesthetic profile (${(confidence * 100).toFixed(0)}% confidence)`,
          metadata: {
            aesthetic: aestheticName,
            profileMatch: true,
            confidence: confidence,
            source: 'aesthetic_themes'
          }
        });
      });
    } else if (styleProfile.dominantStyles && styleProfile.dominantStyles.length > 0) {
      // Fallback to dominantStyles if aesthetic_themes not available
      const topStyles = styleProfile.dominantStyles.slice(0, 2);

      topStyles.forEach((style, index) => {
        suggestions.push({
          type: 'profile',
          priority: 0.85 - (index * 0.1),
          prompt: `More ${style} pieces - matches your style`,
          command: `make me 12 ${style} garments`,
          reasoning: `Aligns with your ${style} style preference`,
          metadata: {
            style,
            profileMatch: true,
            confidence: 0.85,
            source: 'dominant_styles'
          }
        });
      });
    }

    // FIXED: Use garment_distribution for better suggestions
    if (styleProfile.garment_distribution) {
      const garmentDist = typeof styleProfile.garment_distribution === 'string'
        ? JSON.parse(styleProfile.garment_distribution)
        : styleProfile.garment_distribution;

      const topGarments = Object.entries(garmentDist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

      topGarments.forEach(([garment, frequency], index) => {
        suggestions.push({
          type: 'profile',
          priority: 0.8 - (index * 0.05),
          prompt: `Fresh ${garment} designs`,
          command: `make me 15 ${garment}`,
          reasoning: `You frequently work with ${garment} designs (${(frequency * 100).toFixed(0)}% of portfolio)`,
          metadata: {
            garmentType: garment,
            frequency: frequency,
            profileMatch: true,
            confidence: 0.8,
            source: 'garment_distribution'
          }
        });
      });
    }

    // FIXED: Use fabric_distribution for material-based suggestions
    if (styleProfile.fabric_distribution) {
      const fabricDist = typeof styleProfile.fabric_distribution === 'string'
        ? JSON.parse(styleProfile.fabric_distribution)
        : styleProfile.fabric_distribution;

      const topFabrics = Object.entries(fabricDist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

      if (topFabrics.length > 0) {
        const [topFabric, frequency] = topFabrics[0];

        suggestions.push({
          type: 'profile',
          priority: 0.75,
          prompt: `Explore ${topFabric} designs - your signature material`,
          command: `make me 10 ${topFabric} pieces`,
          reasoning: `${topFabric} appears in ${(frequency * 100).toFixed(0)}% of your designs`,
          metadata: {
            fabric: topFabric,
            frequency: frequency,
            profileMatch: true,
            confidence: 0.75,
            source: 'fabric_distribution'
          }
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate gap analysis suggestions
   */
  generateGapAnalysisSuggestions(styleProfile, recentActivity) {
    const gaps = this.analyzePortfolioGaps(styleProfile, recentActivity);
    if (!gaps || gaps.missingCategories.length === 0) return [];

    const suggestions = [];

    gaps.missingCategories.slice(0, 2).forEach((category, index) => {
      suggestions.push({
        type: 'gap',
        priority: 0.75 - (index * 0.1),
        prompt: `Explore ${category} - underrepresented in your collection`,
        command: `make me 10 ${category}`,
        reasoning: `Fill gaps in your design portfolio`,
        metadata: {
          category,
          gapType: 'missing',
          confidence: 0.75
        }
      });
    });

    return suggestions;
  }

  /**
   * Generate fusion suggestions (trend + profile)
   */
  generateFusionSuggestions(styleProfile, seasonalTrends) {
    if (!styleProfile || !seasonalTrends) return [];

    const suggestions = [];
    const userStyles = styleProfile.dominantStyles || [];
    
    // Find trends that align with user's style
    if (seasonalTrends.trends) {
      seasonalTrends.trends.forEach(trend => {
        const compatibility = this.calculateTrendCompatibility(
          trend,
          userStyles
        );

        if (compatibility > 0.6) {
          suggestions.push({
            type: 'fusion',
            priority: compatibility,
            prompt: `${trend.name} - perfect for your ${userStyles[0]} style`,
            command: `make me 10 ${trend.name} outfits`,
            reasoning: `Trending style that matches your aesthetic (${(compatibility * 100).toFixed(0)}% match)`,
            metadata: {
              trend: trend.name,
              userStyle: userStyles[0],
              compatibility,
              confidence: compatibility
            }
          });
        }
      });
    }

    return suggestions;
  }

  /**
   * Generate history-based suggestions (NEW)
   * Based on past user requests and generative commands
   */
  generateHistoryBasedSuggestions(styleProfile, userHistory) {
    if (!userHistory || userHistory.length === 0) return [];

    const suggestions = [];
    
    // Get most frequent garment types from history
    const garmentTypeCounts = {};
    const styleCounts = {};
    const colorCounts = {};
    
    userHistory.forEach(item => {
      // Count garment types
      if (item.garmentType) {
        garmentTypeCounts[item.garmentType] = (garmentTypeCounts[item.garmentType] || 0) + 1;
      }
      
      // Count styles
      if (item.styles && Array.isArray(item.styles)) {
        item.styles.forEach(style => {
          styleCounts[style] = (styleCounts[style] || 0) + 1;
        });
      }
      
      // Count colors
      if (item.colors && Array.isArray(item.colors)) {
        item.colors.forEach(color => {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        });
      }
    });
    
    // Get top 2 garment types
    const sortedGarmentTypes = Object.entries(garmentTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
      
    // Get top 2 styles
    const sortedStyles = Object.entries(styleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
      
    // Get top 2 colors
    const sortedColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    
    // Generate suggestions based on frequent patterns
    sortedGarmentTypes.forEach(([garmentType, count], index) => {
      suggestions.push({
        type: 'history',
        priority: 0.7 - (index * 0.1),
        prompt: `More ${garmentType} designs like before`,
        command: `make me 10 ${garmentType}`,
        reasoning: `Based on your previous requests for ${garmentType} (${count} times)`,
        metadata: {
          garmentType,
          frequency: count,
          confidence: 0.7
        }
      });
    });
    
    // Combine styles and garment types for more specific suggestions
    if (sortedStyles.length > 0 && sortedGarmentTypes.length > 0) {
      const topStyle = sortedStyles[0][0];
      const topGarment = sortedGarmentTypes[0][0];
      
      suggestions.push({
        type: 'history',
        priority: 0.65,
        prompt: `More ${topStyle} ${topGarment} like last time`,
        command: `make me 8 ${topStyle} ${topGarment}`,
        reasoning: `Combine your favorite style (${topStyle}) with garment type (${topGarment})`,
        metadata: {
          style: topStyle,
          garmentType: topGarment,
          confidence: 0.65
        }
      });
    }
    
    // Add color-based suggestions if we have style profile
    if (styleProfile && sortedColors.length > 0) {
      const topColor = sortedColors[0][0];
      suggestions.push({
        type: 'history',
        priority: 0.6,
        prompt: `Try ${topColor} variations - matches your preferences`,
        command: `make me 10 ${topColor} outfits`,
        reasoning: `Based on your frequent use of ${topColor} in past requests`,
        metadata: {
          color: topColor,
          confidence: 0.6
        }
      });
    }

    return suggestions;
  }

  /**
   * Rank suggestions by priority and relevance
   */
  rankSuggestions(suggestions, styleProfile) {
    return suggestions
      .map(suggestion => {
        // Adjust priority based on user profile fit
        let adjustedPriority = suggestion.priority;
        
        if (suggestion.type === 'profile' || suggestion.type === 'fusion') {
          adjustedPriority += 0.1; // Boost personalized suggestions
        }
        
        // Boost history-based suggestions as they're highly personalized
        if (suggestion.type === 'history') {
          adjustedPriority += 0.05;
        }
        
        return {
          ...suggestion,
          finalPriority: adjustedPriority
        };
      })
      .sort((a, b) => b.finalPriority - a.finalPriority);
  }

  /**
   * Analyze portfolio gaps
   */
  analyzePortfolioGaps(styleProfile, recentActivity) {
    const allCategories = [
      'dress', 'blazer', 'coat', 'pants', 'skirt', 'top', 'jumpsuit', 'outfit'
    ];
    
    const recentCategories = new Set(
      (recentActivity?.garmentTypes || []).map(g => g.toLowerCase())
    );

    const missingCategories = allCategories.filter(
      cat => !recentCategories.has(cat)
    );

    return {
      missingCategories,
      underrepresented: missingCategories.slice(0, 3),
      coverage: recentCategories.size / allCategories.length
    };
  }

  /**
   * Calculate compatibility between trend and user style
   */
  calculateTrendCompatibility(trend, userStyles) {
    if (!userStyles || userStyles.length === 0) return 0.5;

    // Simple keyword matching for MVP
    // In production, use embedding similarity
    const trendKeywords = trend.name.toLowerCase().split(' ');
    const styleKeywords = userStyles.join(' ').toLowerCase().split(' ');

    let matches = 0;
    trendKeywords.forEach(keyword => {
      if (styleKeywords.some(style => style.includes(keyword) || keyword.includes(style))) {
        matches++;
      }
    });

    const compatibility = Math.min(matches / trendKeywords.length, 1.0);
    return compatibility;
  }

  /**
   * Get user's enhanced style profile with all JSONB fields
   * FIXED: Now fetches aesthetic_themes, construction_patterns, and other rich data
   */
  async getUserStyleProfile(userId) {
    try {
      // First try to get from agentService
      const result = await agentService.getStyleProfile(userId);
      if (result.success && result.data) {
        const profile = result.data.profile_data || result.data;

        // If profile has rich data, return it
        if (profile.aesthetic_themes || profile.construction_patterns) {
          logger.info('Enhanced style profile loaded for suggestions', {
            userId,
            hasAestheticThemes: !!profile.aesthetic_themes,
            hasConstructionPatterns: !!profile.construction_patterns,
            hasGarmentDistribution: !!profile.garment_distribution
          });
          return profile;
        }

        // Otherwise fetch directly from database to get JSONB fields
        const db = require('../utils/database');
        const dbResult = await db.query(`
          SELECT
            user_id,
            garment_distribution,
            color_distribution,
            fabric_distribution,
            silhouette_distribution,
            aesthetic_themes,
            construction_patterns,
            dominant_styles,
            avg_confidence,
            total_images,
            updated_at
          FROM style_profiles
          WHERE user_id = $1
        `, [userId]);

        if (dbResult.rows.length > 0) {
          const enrichedProfile = dbResult.rows[0];

          // Parse JSONB fields
          return {
            ...enrichedProfile,
            garment_distribution: this.safeParseJSON(enrichedProfile.garment_distribution, {}),
            color_distribution: this.safeParseJSON(enrichedProfile.color_distribution, {}),
            fabric_distribution: this.safeParseJSON(enrichedProfile.fabric_distribution, {}),
            silhouette_distribution: this.safeParseJSON(enrichedProfile.silhouette_distribution, {}),
            aesthetic_themes: this.safeParseJSON(enrichedProfile.aesthetic_themes, []),
            construction_patterns: this.safeParseJSON(enrichedProfile.construction_patterns, []),
            dominant_styles: this.safeParseJSON(enrichedProfile.dominant_styles, [])
          };
        }
      }

      return null;
    } catch (error) {
      logger.warn('Failed to fetch enhanced style profile for suggestions', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Helper: Safely parse JSON with fallback
   */
  safeParseJSON(str, defaultValue) {
    if (!str) return defaultValue;
    if (typeof str === 'object') return str;
    try {
      return JSON.parse(str);
    } catch (error) {
      logger.warn('Failed to parse JSON', { error: error.message });
      return defaultValue;
    }
  }

  /**
   * Get user's recent activity
   */
  async getUserRecentActivity(userId) {
    // Mock implementation - replace with actual database query
    // In production, query generations table for last 30 days
    try {
      // const db = require('./database');
      // const result = await db.query(`
      //   SELECT DISTINCT garment_type, COUNT(*) as count
      //   FROM generations
      //   WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
      //   GROUP BY garment_type
      // `, [userId]);
      
      // For now, return mock data
      return {
        garmentTypes: ['dress', 'blazer'],
        totalGenerations: 42,
        period: '30 days'
      };
    } catch (error) {
      logger.warn('Failed to fetch recent activity', {
        userId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get user's generation history (NEW)
   * Query past voice commands and generation requests
   */
  async getUserGenerationHistory(userId) {
    try {
      // Query voice commands and parsed commands from the last 60 days
      const result = await db.query(`
        SELECT 
          vc.original_text,
          vc.parsed_command,
          vc.created_at
        FROM voice_commands vc
        WHERE vc.user_id = $1 
        AND vc.created_at > NOW() - INTERVAL '60 days'
        ORDER BY vc.created_at DESC
        LIMIT 20
      `, [userId]);

      // Transform the data into a more usable format
      const history = result.rows.map(row => {
        try {
          const parsedCommand = typeof row.parsed_command === 'string' 
            ? JSON.parse(row.parsed_command) 
            : row.parsed_command;
            
          return {
            originalText: row.original_text,
            garmentType: parsedCommand.garmentType,
            styles: parsedCommand.attributes?.styles || [],
            colors: parsedCommand.attributes?.colors || [],
            fabrics: parsedCommand.attributes?.fabrics || [],
            quantity: parsedCommand.quantity,
            createdAt: row.created_at
          };
        } catch (parseError) {
          logger.warn('Failed to parse voice command', {
            userId,
            commandId: row.id,
            error: parseError.message
          });
          return null;
        }
      }).filter(Boolean);

      logger.info('User generation history fetched', {
        userId,
        count: history.length
      });

      return history;
    } catch (error) {
      logger.warn('Failed to fetch user generation history', {
        userId,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Detect current season
   */
  detectSeason() {
    const month = new Date().getMonth(); // 0-11
    
    // Meteorological seasons
    if (month >= 2 && month <= 4) return 'spring';  // Mar, Apr, May
    if (month >= 5 && month <= 7) return 'summer';  // Jun, Jul, Aug
    if (month >= 8 && month <= 10) return 'fall';   // Sep, Oct, Nov
    return 'winter';                                 // Dec, Jan, Feb
  }

  /**
   * Load trend database
   * Override this method to use external JSON file or API
   */
  loadTrends() {
    // Option: Load from external file
    // const fs = require('fs');
    // return JSON.parse(fs.readFileSync('./data/fashion_trends.json', 'utf8'));

    // Default: Inline trend database
    return {
      spring: {
        keyTrend: 'garden party elegance',
        colors: ['sage green', 'lavender', 'cream', 'butter yellow'],
        fabrics: ['linen', 'cotton voile', 'silk organza'],
        trends: [
          {
            name: 'garden party elegance',
            description: 'Flowing silhouettes, floral motifs, romantic details',
            relevance: 0.92
          },
          {
            name: 'quiet luxury',
            description: 'Understated elegance, premium materials, minimal branding',
            relevance: 0.88
          },
          {
            name: 'coastal grandmother',
            description: 'Relaxed sophistication, nautical touches, timeless pieces',
            relevance: 0.75
          }
        ]
      },
      
      summer: {
        keyTrend: 'breezy maximalism',
        colors: ['coral', 'turquoise', 'white', 'sunset orange'],
        fabrics: ['lightweight linen', 'cotton gauze', 'mesh'],
        trends: [
          {
            name: 'breezy maximalism',
            description: 'Bold prints, layered textures, statement accessories',
            relevance: 0.90
          },
          {
            name: 'resort wear',
            description: 'Vacation-ready pieces, effortless elegance, travel-friendly',
            relevance: 0.85
          }
        ]
      },
      
      fall: {
        keyTrend: 'fisherman style',
        colors: ['burgundy', 'forest green', 'camel', 'chocolate brown'],
        fabrics: ['chunky knits', 'wool', 'corduroy', 'tweed'],
        trends: [
          {
            name: 'fisherman style',
            description: 'Oversized sweaters, cable knits, nautical influences, cozy layers',
            relevance: 0.95
          },
          {
            name: 'dark academia',
            description: 'Scholarly aesthetic, structured blazers, plaid patterns',
            relevance: 0.82
          },
          {
            name: 'quiet luxury',
            description: 'Understated elegance, premium materials, timeless investment pieces',
            relevance: 0.90
          }
        ]
      },
      
      winter: {
        keyTrend: 'cozy maximalism',
        colors: ['deep red', 'emerald', 'chocolate', 'charcoal'],
        fabrics: ['mohair', 'shearling', 'velvet', 'cashmere'],
        trends: [
          {
            name: 'cozy maximalism',
            description: 'Layered textures, oversized silhouettes, luxe comfort',
            relevance: 0.93
          },
          {
            name: 'alpine luxury',
            description: 'Ski-inspired elegance, technical fabrics, après-ski chic',
            relevance: 0.80
          }
        ]
      }
    };
  }

  /**
   * Fallback suggestions when profile unavailable
   */
  getFallbackSuggestions() {
    const seasonalTrends = this.trendDatabase[this.currentSeason];
    
    return [
      {
        type: 'seasonal',
        priority: 0.9,
        prompt: `Try ${seasonalTrends.keyTrend} - trending now`,
        command: `make me 10 ${seasonalTrends.keyTrend} outfits`,
        reasoning: `Popular trend for ${this.currentSeason}`,
        metadata: { season: this.currentSeason }
      },
      {
        type: 'exploratory',
        priority: 0.7,
        prompt: 'Surprise me with diverse designs',
        command: 'make me 15 varied outfits',
        reasoning: 'Explore different styles and silhouettes',
        metadata: { exploratory: true }
      },
      {
        type: 'classic',
        priority: 0.6,
        prompt: 'Timeless wardrobe essentials',
        command: 'make me 10 classic pieces',
        reasoning: 'Build foundational designs',
        metadata: { classic: true }
      }
    ];
  }

  /**
   * Get trend details for a specific trend name
   */
  getTrendDetails(trendName) {
    const seasons = Object.keys(this.trendDatabase);
    
    for (const season of seasons) {
      const seasonData = this.trendDatabase[season];
      const trend = seasonData.trends?.find(
        t => t.name.toLowerCase() === trendName.toLowerCase()
      );
      
      if (trend) {
        return {
          ...trend,
          season,
          colors: seasonData.colors,
          fabrics: seasonData.fabrics
        };
      }
    }
    
    return null;
  }
}

module.exports = TrendAwareSuggestionEngine;