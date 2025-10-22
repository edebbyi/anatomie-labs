const { Pinecone } = require('@pinecone-database/pinecone');
const logger = require('../utils/logger');

// CLIP model will be lazy-loaded with dynamic import
let pipelineModule = null;

/**
 * Pinecone Vector Storage Service
 * Manages CLIP embeddings for style matching and persona analysis
 */
class PineconeService {
  constructor() {
    this.client = null;
    this.index = null;
    this.clipModel = null;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'designer-bff-styles';
    this.dimension = 512; // CLIP ViT-B/32 embedding dimension
    
    this.initialized = false;
  }

  /**
   * Initialize Pinecone client and CLIP model
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Pinecone client
      if (!process.env.PINECONE_API_KEY) {
        logger.warn('PINECONE_API_KEY not configured. Vector storage disabled.');
        return;
      }

      this.client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });

      // Check if index exists, create if not
      await this.ensureIndexExists();

      // Get index instance
      this.index = this.client.index(this.indexName);

      logger.info('Pinecone initialized successfully', {
        indexName: this.indexName,
        dimension: this.dimension
      });

      this.initialized = true;

    } catch (error) {
      logger.error('Failed to initialize Pinecone', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Ensure Pinecone index exists
   */
  async ensureIndexExists() {
    try {
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);

      if (!indexExists) {
        logger.info('Creating Pinecone index', { indexName: this.indexName });
        
        await this.client.createIndex({
          name: this.indexName,
          dimension: this.dimension,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        await this.waitForIndexReady();
        
        logger.info('Pinecone index created successfully');
      } else {
        logger.info('Pinecone index already exists', { indexName: this.indexName });
      }
    } catch (error) {
      logger.error('Error ensuring index exists', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Wait for index to be ready
   */
  async waitForIndexReady() {
    const maxAttempts = 30;
    const delayMs = 2000;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const indexDescription = await this.client.describeIndex(this.indexName);
        if (indexDescription.status?.ready) {
          return;
        }
      } catch (error) {
        // Index might not be queryable yet
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    throw new Error('Index creation timeout');
  }

  /**
   * Load CLIP model for embeddings (lazy loading)
   */
  async loadCLIPModel() {
    if (this.clipModel) {
      return this.clipModel;
    }

    try {
      logger.info('Loading CLIP model...');
      
      // Lazy load the transformers module (ESM)
      if (!pipelineModule) {
        const transformers = await import('@xenova/transformers');
        pipelineModule = transformers.pipeline;
      }
      
      // Load CLIP vision model from HuggingFace
      this.clipModel = await pipelineModule(
        'feature-extraction',
        'Xenova/clip-vit-base-patch32'
      );
      
      logger.info('CLIP model loaded successfully');
      return this.clipModel;
      
    } catch (error) {
      logger.error('Failed to load CLIP model', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate CLIP embedding from text
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>}
   */
  async generateTextEmbedding(text) {
    try {
      const model = await this.loadCLIPModel();
      
      const output = await model(text, {
        pooling: 'mean',
        normalize: true
      });
      
      // Convert tensor to array
      const embedding = Array.from(output.data);
      
      return embedding.slice(0, this.dimension);
      
    } catch (error) {
      logger.error('Failed to generate text embedding', {
        text: text.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate CLIP embedding from image URL
   * @param {string} imageUrl - Image URL to embed
   * @returns {Promise<Array<number>>}
   */
  async generateImageEmbedding(imageUrl) {
    try {
      const model = await this.loadCLIPModel();
      
      // For now, using text-based approach
      // In production, you'd want to download and process the actual image
      logger.warn('Image embedding not fully implemented - using URL as text fallback');
      
      return await this.generateTextEmbedding(imageUrl);
      
    } catch (error) {
      logger.error('Failed to generate image embedding', {
        imageUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Upsert vectors to Pinecone
   * @param {Array<Object>} vectors - Array of {id, values, metadata}
   * @param {string} namespace - Namespace for organizing vectors
   * @returns {Promise<Object>}
   */
  async upsert(vectors, namespace = 'default') {
    await this.initialize();

    if (!this.index) {
      throw new Error('Pinecone not initialized');
    }

    try {
      logger.info('Upserting vectors to Pinecone', {
        count: vectors.length,
        namespace
      });

      const result = await this.index.namespace(namespace).upsert(vectors);
      
      logger.info('Vectors upserted successfully', {
        count: vectors.length,
        namespace
      });

      return result;

    } catch (error) {
      logger.error('Failed to upsert vectors', {
        count: vectors.length,
        namespace,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Query vectors from Pinecone
   * @param {Array<number>} vector - Query vector
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>}
   */
  async query(vector, options = {}) {
    await this.initialize();

    if (!this.index) {
      throw new Error('Pinecone not initialized');
    }

    const {
      namespace = 'default',
      topK = 10,
      filter = null,
      includeMetadata = true,
      includeValues = false
    } = options;

    try {
      logger.info('Querying Pinecone', {
        namespace,
        topK,
        hasFilter: !!filter
      });

      const queryResult = await this.index.namespace(namespace).query({
        vector,
        topK,
        filter,
        includeMetadata,
        includeValues
      });

      logger.info('Query completed', {
        matchCount: queryResult.matches?.length || 0
      });

      return queryResult.matches || [];

    } catch (error) {
      logger.error('Failed to query vectors', {
        namespace,
        topK,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Query by text (generates embedding and queries)
   * @param {string} text - Text query
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>}
   */
  async queryByText(text, options = {}) {
    const embedding = await this.generateTextEmbedding(text);
    return await this.query(embedding, options);
  }

  /**
   * Delete vectors from Pinecone
   * @param {Array<string>} ids - Vector IDs to delete
   * @param {string} namespace - Namespace
   * @returns {Promise<Object>}
   */
  async delete(ids, namespace = 'default') {
    await this.initialize();

    if (!this.index) {
      throw new Error('Pinecone not initialized');
    }

    try {
      logger.info('Deleting vectors from Pinecone', {
        count: ids.length,
        namespace
      });

      await this.index.namespace(namespace).deleteMany(ids);
      
      logger.info('Vectors deleted successfully', {
        count: ids.length,
        namespace
      });

    } catch (error) {
      logger.error('Failed to delete vectors', {
        count: ids.length,
        namespace,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete all vectors in a namespace
   * @param {string} namespace - Namespace to clear
   * @returns {Promise<void>}
   */
  async deleteNamespace(namespace) {
    await this.initialize();

    if (!this.index) {
      throw new Error('Pinecone not initialized');
    }

    try {
      logger.warn('Deleting entire namespace', { namespace });

      await this.index.namespace(namespace).deleteAll();
      
      logger.info('Namespace deleted successfully', { namespace });

    } catch (error) {
      logger.error('Failed to delete namespace', {
        namespace,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Fetch vectors by IDs
   * @param {Array<string>} ids - Vector IDs
   * @param {string} namespace - Namespace
   * @returns {Promise<Object>}
   */
  async fetch(ids, namespace = 'default') {
    await this.initialize();

    if (!this.index) {
      throw new Error('Pinecone not initialized');
    }

    try {
      const result = await this.index.namespace(namespace).fetch(ids);
      return result.records || {};

    } catch (error) {
      logger.error('Failed to fetch vectors', {
        count: ids.length,
        namespace,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get index statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    await this.initialize();

    if (!this.index) {
      throw new Error('Pinecone not initialized');
    }

    try {
      const stats = await this.index.describeIndexStats();
      
      return {
        dimension: stats.dimension,
        totalVectorCount: stats.totalRecordCount,
        namespaces: stats.namespaces || {},
        indexFullness: stats.indexFullness
      };

    } catch (error) {
      logger.error('Failed to get index stats', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Store user persona embedding
   * @param {string} userId - User ID
   * @param {string} personaName - Persona name
   * @param {Array<string>} prompts - Style prompts for this persona
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>}
   */
  async storePersonaEmbedding(userId, personaName, prompts, metadata = {}) {
    try {
      // Generate embeddings for all prompts
      const embeddings = await Promise.all(
        prompts.map(prompt => this.generateTextEmbedding(prompt))
      );

      // Average embeddings to create persona vector
      const avgEmbedding = this.averageEmbeddings(embeddings);

      const vectorId = `persona_${userId}_${personaName.replace(/\s+/g, '_')}`;

      await this.upsert([{
        id: vectorId,
        values: avgEmbedding,
        metadata: {
          userId,
          personaName,
          type: 'persona',
          promptCount: prompts.length,
          createdAt: new Date().toISOString(),
          ...metadata
        }
      }], 'personas');

      logger.info('Persona embedding stored', {
        userId,
        personaName,
        vectorId
      });

      return { vectorId, embedding: avgEmbedding };

    } catch (error) {
      logger.error('Failed to store persona embedding', {
        userId,
        personaName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find similar personas
   * @param {Array<number>} queryEmbedding - Query embedding vector
   * @param {string} userId - User ID to filter by (optional)
   * @param {number} topK - Number of results
   * @returns {Promise<Array<Object>>}
   */
  async findSimilarPersonas(queryEmbedding, userId = null, topK = 5) {
    const filter = userId ? { userId: { $eq: userId } } : null;

    const results = await this.query(queryEmbedding, {
      namespace: 'personas',
      topK,
      filter,
      includeMetadata: true
    });

    return results.map(match => ({
      personaName: match.metadata.personaName,
      userId: match.metadata.userId,
      similarity: match.score,
      metadata: match.metadata
    }));
  }

  /**
   * Average multiple embeddings
   * @param {Array<Array<number>>} embeddings - Array of embedding vectors
   * @returns {Array<number>}
   */
  averageEmbeddings(embeddings) {
    if (embeddings.length === 0) {
      throw new Error('No embeddings to average');
    }

    const dimension = embeddings[0].length;
    const avg = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        avg[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      avg[i] /= embeddings.length;
    }

    // Normalize
    const magnitude = Math.sqrt(avg.reduce((sum, val) => sum + val * val, 0));
    return avg.map(val => val / magnitude);
  }

  /**
   * Upsert vectors (alias for upsert for style clustering service)
   * @param {Array<Object>} vectors - Array of vectors
   * @param {string} namespace - Namespace
   * @returns {Promise<Object>}
   */
  async upsertVectors(vectors, namespace = 'styles') {
    return await this.upsert(vectors, namespace);
  }

  /**
   * Search similar styles with GMM cluster awareness
   * @param {Array<number>} queryEmbedding - Query embedding
   * @param {number} topK - Number of results
   * @param {Object} options - Search options including cluster preferences
   * @returns {Promise<Array>} Similar styles
   */
  async searchSimilarStyles(queryEmbedding, topK = 10, options = {}) {
    try {
      const { 
        filter = {}, 
        preferredClusters = null, 
        namespace = 'styles',
        diversifyResults = true,
        clusterWeighting = true 
      } = options;
      
      const queryOptions = {
        namespace,
        topK: diversifyResults ? topK * 2 : topK, // Get more results for diversification
        includeMetadata: true,
        includeValues: false
      };
      
      // Add filter if provided
      if (filter && Object.keys(filter).length > 0) {
        queryOptions.filter = filter;
      }
      
      const results = await this.query(queryEmbedding, queryOptions);
      
      let processedResults = results.map(match => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
        // Extract cluster information from metadata
        cluster: match.metadata?.cluster,
        clusterSummary: match.metadata?.clusterSummary,
        aesthetic: match.metadata?.aesthetic,
        styleProfile: this._mapToStyleProfile(match.metadata)
      }));
      
      // Apply cluster-aware ranking if enabled
      if (clusterWeighting && preferredClusters) {
        processedResults = this._applyClusterWeighting(processedResults, preferredClusters);
      }
      
      // Diversify results across style clusters if enabled
      if (diversifyResults) {
        processedResults = this._diversifyByStyleClusters(processedResults, topK);
      }
      
      return processedResults.slice(0, topK);
      
    } catch (error) {
      logger.error('Failed to search similar styles', { error: error.message });
      throw error;
    }
  }

  /**
   * Search by style profile name (e.g., "Minimalist Tailoring")
   * @param {string} styleProfileName - Style profile name
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching styles
   */
  async searchByStyleProfile(styleProfileName, options = {}) {
    try {
      const { topK = 10, userId = null, namespace = 'styles' } = options;
      
      // Create embedding from style profile name
      const queryEmbedding = await this.generateTextEmbedding(
        `${styleProfileName} fashion style clothing design`
      );
      
      // Build filter for the specific style profile
      const filter = {
        clusterSummary: { $eq: styleProfileName }
      };
      
      if (userId) {
        filter.userId = { $eq: userId };
      }
      
      const results = await this.searchSimilarStyles(queryEmbedding, topK, {
        filter,
        namespace,
        diversifyResults: false, // Don't diversify when searching specific style
        clusterWeighting: false
      });
      
      logger.info(`Found ${results.length} results for style profile: ${styleProfileName}`);
      
      return results;
      
    } catch (error) {
      logger.error('Failed to search by style profile', { 
        styleProfileName, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get style recommendations based on user's cluster profile
   * @param {string} userId - User ID
   * @param {Array} userStyleClusters - User's style cluster profile
   * @param {Object} options - Recommendation options
   * @returns {Promise<Array>} Style recommendations
   */
  async getStyleRecommendations(userId, userStyleClusters, options = {}) {
    try {
      const { topK = 20, diversify = true, excludeUserStyles = true } = options;
      
      // Create weighted query based on user's dominant style clusters
      const dominantStyles = userStyleClusters
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 3); // Top 3 styles
      
      let allRecommendations = [];
      
      // Search for each dominant style
      for (const cluster of dominantStyles) {
        const styleResults = await this.searchByStyleProfile(cluster.style_summary, {
          topK: Math.ceil(topK / dominantStyles.length),
          userId: excludeUserStyles ? null : userId, // Include or exclude user's own styles
          namespace: 'styles'
        });
        
        // Weight results by cluster importance
        const weightedResults = styleResults.map(result => ({
          ...result,
          recommendationScore: result.score * (cluster.percentage / 100),
          sourceCluster: cluster.style_summary,
          clusterWeight: cluster.percentage
        }));
        
        allRecommendations.push(...weightedResults);
      }
      
      // Exclude user's own styles if requested
      if (excludeUserStyles) {
        allRecommendations = allRecommendations.filter(rec => 
          !rec.metadata?.userId || rec.metadata.userId !== userId
        );
      }
      
      // Sort by recommendation score and diversify if requested
      allRecommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
      
      if (diversify) {
        allRecommendations = this._diversifyRecommendations(allRecommendations, topK);
      }
      
      return allRecommendations.slice(0, topK);
      
    } catch (error) {
      logger.error('Failed to get style recommendations', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get style statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Style statistics
   */
  async getUserStyleStats(userId) {
    try {
      // This would require querying Pinecone with filters
      // For now, return basic stats
      logger.info('Getting style stats for user', { userId });
      
      return {
        totalVectors: 0, // Would need to query Pinecone for actual count
        clusters: [],
        dominantStyle: 'unknown'
      };
      
    } catch (error) {
      logger.error('Failed to get user style stats', { userId, error: error.message });
      return { totalVectors: 0, clusters: [], dominantStyle: 'unknown' };
    }
  }

  /**
   * Health check for Pinecone service
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.initialize();
      
      if (!this.index) {
        return false;
      }

      const stats = await this.getStats();
      return stats !== null;

    } catch (error) {
      logger.error('Pinecone health check failed', {
        error: error.message
      });
      return false;
    }
  }

  // Helper methods for GMM cluster-aware operations

  /**
   * Map metadata to style profile for better categorization
   * @private
   */
  _mapToStyleProfile(metadata) {
    if (!metadata) return 'Unknown';
    
    // Try cluster summary first (from GMM)
    if (metadata.clusterSummary) {
      return metadata.clusterSummary;
    }
    
    // Fallback to aesthetic
    if (metadata.aesthetic) {
      return `${metadata.aesthetic.charAt(0).toUpperCase()}${metadata.aesthetic.slice(1)} Style`;
    }
    
    return 'Contemporary Mix';
  }

  /**
   * Apply cluster weighting to search results
   * @private
   */
  _applyClusterWeighting(results, preferredClusters) {
    const clusterWeights = new Map(preferredClusters.map(c => [c.style_summary, c.percentage / 100]));
    
    return results.map(result => {
      const clusterWeight = clusterWeights.get(result.clusterSummary) || 0.1;
      return {
        ...result,
        score: result.score * (1 + clusterWeight), // Boost score for preferred clusters
        clusterWeight
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Diversify results across different style clusters
   * @private
   */
  _diversifyByStyleClusters(results, targetCount) {
    const diversified = [];
    const clusterCounts = new Map();
    const maxPerCluster = Math.max(2, Math.floor(targetCount / 5)); // Max items per cluster
    
    for (const result of results) {
      const cluster = result.clusterSummary || result.styleProfile || 'Unknown';
      const currentCount = clusterCounts.get(cluster) || 0;
      
      if (currentCount < maxPerCluster) {
        diversified.push(result);
        clusterCounts.set(cluster, currentCount + 1);
        
        if (diversified.length >= targetCount) break;
      }
    }
    
    // Fill remaining slots with best results if needed
    if (diversified.length < targetCount) {
      for (const result of results) {
        if (!diversified.includes(result)) {
          diversified.push(result);
          if (diversified.length >= targetCount) break;
        }
      }
    }
    
    return diversified;
  }

  /**
   * Diversify recommendations to avoid over-concentration in single styles
   * @private
   */
  _diversifyRecommendations(recommendations, targetCount) {
    const diversified = [];
    const styleCounts = new Map();
    const maxPerStyle = Math.max(3, Math.floor(targetCount / 3)); // Allow up to 3 items per style
    
    for (const rec of recommendations) {
      const style = rec.sourceCluster || rec.styleProfile || 'Unknown';
      const currentCount = styleCounts.get(style) || 0;
      
      if (currentCount < maxPerStyle) {
        diversified.push(rec);
        styleCounts.set(style, currentCount + 1);
        
        if (diversified.length >= targetCount) break;
      }
    }
    
    return diversified;
  }
}

module.exports = new PineconeService();
