/**
 * Trend-Aware Suggestion Engine
 * 
 * Generates contextual AI suggestions based on:
 * - User's style profile
 * - Current seasonal trends
 * - Portfolio gap analysis
 * - Fashion trend fusion (profile + trends)
 * 
 * Suggestion Types:
 * - Seasonal: Based on current trends for the season
 * - Profile-based: Aligned with user's dominant styles
 * - Gap analysis: Fill underrepresented categories
 * - Fusion: Trending styles that match user aesthetic
 */

const logger = require('../utils/logger');
const agentService = require('./agentService');

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
      includeTypes = ['seasonal', 'profile', 'gap', 'fusion']
    } = options;

    try {
      // Fetch user data
      const styleProfile = await this.getUserStyleProfile(userId);
      const recentActivity = await this.getUserRecentActivity(userId);
      
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
   */
  generateProfileBasedSuggestions(styleProfile) {
    if (!styleProfile || !styleProfile.dominantStyles) return [];

    const suggestions = [];
    const topStyles = styleProfile.dominantStyles.slice(0, 2);

    topStyles.forEach((style, index) => {
      suggestions.push({
        type: 'profile',
        priority: 0.85 - (index * 0.1),
        prompt: `More ${style} pieces - matches your aesthetic`,
        command: `make me 12 ${style} garments`,
        reasoning: `Aligns with your ${style} style preference`,
        metadata: {
          style,
          profileMatch: true,
          confidence: 0.85
        }
      });
    });

    // Add garment type preferences
    if (styleProfile.garmentPreferences) {
      const topGarment = styleProfile.garmentPreferences[0];
      suggestions.push({
        type: 'profile',
        priority: 0.8,
        prompt: `Fresh ${topGarment} designs`,
        command: `make me 15 ${topGarment}`,
        reasoning: `You frequently work with ${topGarment} designs`,
        metadata: {
          garmentType: topGarment,
          profileMatch: true,
          confidence: 0.8
        }
      });
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
      'dress', 'blazer', 'coat', 'pants', 'skirt', 'top', 'jumpsuit'
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
   * Get user's style profile
   */
  async getUserStyleProfile(userId) {
    try {
      const result = await agentService.getStyleProfile(userId);
      if (result.success && result.data) {
        return result.data.profile_data || result.data;
      }
      return null;
    } catch (error) {
      logger.warn('Failed to fetch style profile for suggestions', {
        userId,
        error: error.message
      });
      return null;
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
