/**
 * Style Clustering Service
 * 
 * Integrates VLT analysis with Python Style Profiler and Pinecone
 * Creates user style clusters and provides coverage analysis
 */

const axios = require('axios');
const pineconeService = require('./pineconeService');
const portfolioService = require('./portfolioService');
const logger = require('../utils/logger');

class StyleClusteringService {
  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_ML_SERVICE_URL || 'http://localhost:8000';
    this.initialized = false;
  }

  /**
   * Initialize services
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await pineconeService.initialize();
      this.initialized = true;
      logger.info('Style Clustering Service initialized');
    } catch (error) {
      logger.error('Failed to initialize Style Clustering Service', { error: error.message });
      throw error;
    }
  }

  /**
   * Create style profile from VLT analysis results
   * @param {string} userId - User ID
   * @param {Object} vltResult - VLT analysis result
   * @returns {Promise<Object>} Style profile with clusters and coverage
   */
  async createStyleProfile(userId, vltResult) {
    await this.initialize();
    
    try {
      logger.info('Creating style profile', { 
        userId, 
        recordCount: vltResult.records?.length 
      });

      // Step 1: Save VLT analysis to database
      const saveResult = await portfolioService.saveBatchAnalysis(userId, vltResult);
      logger.info('VLT analysis saved to database', { 
        savedCount: saveResult.savedCount 
      });

      // Step 2: Create style clusters using Python ML service
      const styleProfile = await this._createStyleClusters(userId, vltResult.records);
      
      // Step 3: Generate and store embeddings in Pinecone
      const embeddingResults = await this._storeStyleEmbeddings(userId, vltResult.records, styleProfile);
      
      // Step 4: Analyze style coverage
      const coverageAnalysis = await this._analyzeStyleCoverage(userId, styleProfile);
      
      // Step 5: Create comprehensive profile
      const comprehensiveProfile = {
        userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // VLT Analysis Summary
        vltSummary: vltResult.summary,
        recordCount: vltResult.records.length,
        
        // Style Clusters (from Python ML service)
        styleClusters: styleProfile.clusters,
        clusterCount: styleProfile.n_clusters,
        
        // Coverage Analysis
        coverage: coverageAnalysis,
        
        // Embedding Information
        embeddings: {
          stored: embeddingResults.storedCount,
          failed: embeddingResults.failedCount,
          vectorIndexName: pineconeService.indexName
        },
        
        // Key Insights
        insights: {
          dominantStyle: this._getDominantStyle(styleProfile),
          styleSignatures: this._extractStyleSignatures(vltResult.records),
          diversityScore: styleProfile.statistics?.diversity_score || 0,
          clusterHealth: this._assessClusterHealth(styleProfile)
        }
      };

      // Step 6: Enrich profile with style tags based on actual portfolio records (no mock data)
      try {
        const styleTaggerAgent = require('./styleTaggerAgent');
        const aggregated = this._aggregateStyleAttributes(vltResult.records);
        const enrichment = styleTaggerAgent.analyzeAndEnrich(aggregated);

        // Attach enrichment at top level and under signature elements
        comprehensiveProfile.style_tags = enrichment.style_tags;
        comprehensiveProfile.garment_types = enrichment.garment_types;
        comprehensiveProfile.style_description = enrichment.style_description;

        comprehensiveProfile.signature_elements = {
          colors: aggregated.color_palette,
          silhouettes: aggregated.silhouettes,
          materials: aggregated.materials,
          patterns: aggregated.design_elements || []
        };

        logger.info('Style profile enriched with tags', {
          userId,
          tagCount: enrichment.style_tags?.length || 0,
          garmentTypes: enrichment.garment_types?.length || 0
        });
      } catch (enrichError) {
        logger.warn('Failed to enrich style profile with tags', {
          userId,
          error: enrichError.message
        });
      }

      // Save profile to database
      await this._saveStyleProfile(userId, comprehensiveProfile);
      
      logger.info('Style profile created successfully', { 
        userId,
        clusters: comprehensiveProfile.clusterCount,
        coverage: coverageAnalysis.overallCoverage,
        dominantStyle: comprehensiveProfile.insights.dominantStyle
      });

      return comprehensiveProfile;

    } catch (error) {
      logger.error('Failed to create style profile', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get existing style profile for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Style profile
   */
  async getStyleProfile(userId) {
    try {
      const db = require('./database');
      const result = await db.query(
        'SELECT * FROM user_style_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const profile = result.rows[0];
      return {
        userId: profile.user_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        ...JSON.parse(profile.profile_data)
      };

    } catch (error) {
      logger.error('Failed to get style profile', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update style profile with new VLT data
   * @param {string} userId - User ID
   * @param {Array} newRecords - New VLT records
   * @returns {Promise<Object>} Updated style profile
   */
  async updateStyleProfile(userId, newRecords) {
    await this.initialize();
    
    try {
      logger.info('Updating style profile', { userId, newRecords: newRecords.length });

      // Update clusters using Python ML service
      const updatedProfile = await this._updateStyleClusters(userId, newRecords);
      
      // Store new embeddings
      const embeddingResults = await this._storeStyleEmbeddings(userId, newRecords, updatedProfile);
      
      // Re-analyze coverage
      const coverageAnalysis = await this._analyzeStyleCoverage(userId, updatedProfile);
      
      // Update comprehensive profile
      const existingProfile = await this.getStyleProfile(userId);
      const updatedComprehensiveProfile = {
        ...existingProfile,
        updated_at: new Date().toISOString(),
        recordCount: existingProfile.recordCount + newRecords.length,
        styleClusters: updatedProfile.clusters,
        coverage: coverageAnalysis,
        insights: {
          ...existingProfile.insights,
          dominantStyle: this._getDominantStyle(updatedProfile),
          diversityScore: updatedProfile.statistics?.diversity_score || 0,
          clusterHealth: this._assessClusterHealth(updatedProfile)
        },
        embeddings: {
          stored: existingProfile.embeddings.stored + embeddingResults.storedCount,
          failed: existingProfile.embeddings.failed + embeddingResults.failedCount,
          vectorIndexName: pineconeService.indexName
        }
      };

      await this._saveStyleProfile(userId, updatedComprehensiveProfile);
      
      logger.info('Style profile updated successfully', { 
        userId,
        totalRecords: updatedComprehensiveProfile.recordCount,
        newCoverage: coverageAnalysis.overallCoverage
      });

      return updatedComprehensiveProfile;

    } catch (error) {
      logger.error('Failed to update style profile', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Find similar styles using Pinecone
   * @param {string} userId - User ID
   * @param {string} styleQuery - Style description to search for
   * @param {number} topK - Number of results to return
   * @returns {Promise<Array>} Similar styles
   */
  async findSimilarStyles(userId, styleQuery, topK = 10) {
    await this.initialize();
    
    try {
      // Generate embedding for query
      const queryEmbedding = await pineconeService.generateTextEmbedding(styleQuery);
      
      // Search in Pinecone
      const searchResults = await pineconeService.searchSimilarStyles(
        queryEmbedding,
        topK,
        { userId } // Filter by user
      );
      
      logger.info('Similar styles found', { 
        userId, 
        query: styleQuery,
        results: searchResults.length 
      });
      
      return searchResults;

    } catch (error) {
      logger.error('Failed to find similar styles', { 
        userId, 
        query: styleQuery, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create style clusters using Python ML service
   * @private
   */
  async _createStyleClusters(userId, vltRecords) {
    try {
      const response = await axios.post(`${this.pythonServiceUrl}/api/style-profile`, {
        userId: userId,
        records: vltRecords,
        options: {
          n_clusters: Math.min(5, Math.max(2, Math.floor(vltRecords.length / 10))) // Dynamic cluster count
        }
      }, {
        timeout: 60000 // 60 second timeout
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to create style clusters', { 
        userId, 
        error: error.message,
        pythonServiceUrl: this.pythonServiceUrl
      });
      throw new Error(`Python ML service error: ${error.message}`);
    }
  }

  /**
   * Update style clusters using Python ML service
   * @private
   */
  async _updateStyleClusters(userId, newRecords) {
    try {
      const response = await axios.post(`${this.pythonServiceUrl}/api/style-profile`, {
        user_id: userId,
        new_vlt_records: newRecords
      }, {
        timeout: 60000
      });

      return response.data;

    } catch (error) {
      logger.error('Failed to update style clusters', { userId, error: error.message });
      throw new Error(`Python ML service error: ${error.message}`);
    }
  }

  /**
   * Store style embeddings in Pinecone
   * @private
   */
  async _storeStyleEmbeddings(userId, vltRecords, styleProfile) {
    let storedCount = 0;
    let failedCount = 0;

    try {
      const vectors = [];
      
      for (let i = 0; i < vltRecords.length; i++) {
        const record = vltRecords[i];
        
        try {
          // Generate style description for embedding
          const styleDescription = this._generateStyleDescription(record);
          const embedding = await pineconeService.generateTextEmbedding(styleDescription);
          
          // Find which cluster this record belongs to
          const clusterInfo = styleProfile.clusters?.find(c => 
            c.representative_records?.includes(record.imageId)
          ) || { id: 0, style_summary: 'mixed' };
          
          vectors.push({
            id: `${userId}_${record.imageId}_${Date.now()}`,
            values: embedding,
            metadata: {
              userId,
              imageId: record.imageId,
              garmentType: record.garmentType,
              aesthetic: record.style?.aesthetic || 'unknown',
              cluster: clusterInfo.id,
              clusterSummary: clusterInfo.style_summary,
              styleDescription,
              createdAt: new Date().toISOString()
            }
          });
          
          storedCount++;

        } catch (error) {
          logger.warn('Failed to create embedding for record', { 
            userId, 
            imageId: record.imageId, 
            error: error.message 
          });
          failedCount++;
        }
      }

      // Store vectors in Pinecone in batches
      if (vectors.length > 0) {
        await pineconeService.upsertVectors(vectors);
        logger.info('Style embeddings stored in Pinecone', { 
          userId,
          stored: vectors.length
        });
      }

      return { storedCount, failedCount };

    } catch (error) {
      logger.error('Failed to store style embeddings', { userId, error: error.message });
      return { storedCount, failedCount: vltRecords.length };
    }
  }

  /**
   * Analyze style coverage
   * @private
   */
  async _analyzeStyleCoverage(userId, styleProfile) {
    try {
      const clusters = styleProfile.clusters || [];
      const totalRecords = styleProfile.n_records || 0;
      
      // Calculate coverage metrics
      const coverage = {
        overallCoverage: this._calculateOverallCoverage(clusters, totalRecords),
        clusterDistribution: clusters.map(cluster => ({
          clusterId: cluster.id,
          styleSummary: cluster.style_summary,
          percentage: cluster.percentage,
          size: cluster.size,
          confidence: cluster.centroid_confidence
        })),
        gaps: this._identifyStyleGaps(clusters),
        recommendations: this._generateCoverageRecommendations(clusters)
      };

      return coverage;

    } catch (error) {
      logger.error('Failed to analyze style coverage', { userId, error: error.message });
      return {
        overallCoverage: 0,
        clusterDistribution: [],
        gaps: [],
        recommendations: []
      };
    }
  }

  /**
   * Save style profile to database
   * @private
   */
  async _saveStyleProfile(userId, profileData) {
    try {
      const db = require('./database');
      
      await db.query(`
        INSERT INTO user_style_profiles (user_id, profile_data, created_at, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) 
        DO UPDATE SET profile_data = $2, updated_at = $4
      `, [
        userId,
        JSON.stringify(profileData),
        profileData.created_at,
        profileData.updated_at
      ]);

    } catch (error) {
      logger.error('Failed to save style profile', { userId, error: error.message });
      throw error;
    }
  }

  // Helper methods

  _generateStyleDescription(record) {
    const parts = [];
    
    if (record.style?.aesthetic) parts.push(`${record.style.aesthetic} style`);
    if (record.garmentType) parts.push(record.garmentType);
    if (record.silhouette) parts.push(`${record.silhouette} silhouette`);
    if (record.colors?.primary) parts.push(`${record.colors.primary} color`);
    if (record.fabric?.type) parts.push(`${record.fabric.type} fabric`);
    
    return parts.join(', ');
  }

  _getDominantStyle(styleProfile) {
    if (!styleProfile.clusters || styleProfile.clusters.length === 0) {
      return 'unknown';
    }
    
    // Find the largest cluster
    const dominantCluster = styleProfile.clusters.reduce((max, cluster) => 
      cluster.size > max.size ? cluster : max
    );
    
    return dominantCluster.style_summary || 'mixed';
  }

  _extractStyleSignatures(vltRecords) {
    const signatures = {};
    
    vltRecords.forEach(record => {
      if (record.style?.aesthetic) {
        signatures[record.style.aesthetic] = (signatures[record.style.aesthetic] || 0) + 1;
      }
    });
    
    return Object.entries(signatures)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([style, count]) => ({ style, count }));
  }

  _assessClusterHealth(styleProfile) {
    if (!styleProfile.clusters) return 'poor';
    
    const avgConfidence = styleProfile.clusters.reduce(
      (sum, cluster) => sum + (cluster.centroid_confidence || 0), 0
    ) / styleProfile.clusters.length;
    
    if (avgConfidence > 0.8) return 'excellent';
    if (avgConfidence > 0.6) return 'good';
    if (avgConfidence > 0.4) return 'fair';
    return 'poor';
  }

  _calculateOverallCoverage(clusters, totalRecords) {
    if (!clusters || clusters.length === 0 || totalRecords === 0) return 0;
    
    // Coverage based on how well distributed the clusters are
    const evenDistribution = 100 / clusters.length;
    const coverage = clusters.reduce((sum, cluster) => {
      const deviation = Math.abs(cluster.percentage - evenDistribution);
      return sum + Math.max(0, evenDistribution - deviation);
    }, 0);
    
    return Math.round(coverage);
  }

  _identifyStyleGaps(clusters) {
    // Identify potential style gaps based on cluster analysis
    const commonStyles = ['sporty', 'minimalist', 'elegant', 'casual', 'professional'];
    const presentStyles = new Set(
      clusters.map(c => c.style_summary?.toLowerCase()).filter(Boolean)
    );
    
    return commonStyles.filter(style => !presentStyles.has(style));
  }

  _generateCoverageRecommendations(clusters) {
    const recommendations = [];
    
    // Recommend diversification if clusters are too similar
    const uniqueStyles = new Set(clusters.map(c => c.style_summary));
    if (uniqueStyles.size < clusters.length * 0.7) {
      recommendations.push({
        type: 'diversification',
        message: 'Consider adding more diverse styles to expand your aesthetic range'
      });
    }
    
    // Recommend strengthening if clusters are too small
    const smallClusters = clusters.filter(c => c.percentage < 15);
    if (smallClusters.length > 0) {
      recommendations.push({
        type: 'strengthen',
        message: `Consider developing ${smallClusters[0].style_summary} style further`
      });
    }
    
    return recommendations;
  }

  /**
   * Aggregate style attributes from VLT records into a profile-like object
   * Used to generate style tags (colors, silhouettes, materials, design elements)
   * @private
   */
  _aggregateStyleAttributes(vltRecords) {
    const colors = new Set();
    const silhouettes = new Set();
    const materials = new Set();
    const designElements = new Set();

    vltRecords.forEach(rec => {
      // Colors
      if (rec.colors?.primary) colors.add(String(rec.colors.primary).toLowerCase());
      if (rec.colors?.secondary) colors.add(String(rec.colors.secondary).toLowerCase());

      // Silhouettes
      if (rec.silhouette) silhouettes.add(String(rec.silhouette).toLowerCase());
      if (rec.attributes?.silhouette) silhouettes.add(String(rec.attributes.silhouette).toLowerCase());

      // Materials / Fabrics
      if (rec.fabric?.type) materials.add(String(rec.fabric.type).toLowerCase());
      if (rec.fabric?.name) materials.add(String(rec.fabric.name).toLowerCase());

      // Design elements / style descriptors
      if (rec.style?.aesthetic) designElements.add(String(rec.style.aesthetic).toLowerCase());
      if (rec.style?.overall) designElements.add(String(rec.style.overall).toLowerCase());
      if (rec.style?.mood) designElements.add(String(rec.style.mood).toLowerCase());
      if (Array.isArray(rec.attributes?.details)) {
        rec.attributes.details.forEach(d => designElements.add(String(d).toLowerCase()));
      }
    });

    // Return in the format expected by StyleTaggerAgent
    return {
      color_palette: Array.from(colors).slice(0, 12),
      silhouettes: Array.from(silhouettes).slice(0, 12),
      materials: Array.from(materials).slice(0, 12),
      design_elements: Array.from(designElements).slice(0, 16)
    };
  }
}

module.exports = new StyleClusteringService();
