const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Stage 3: Query Processing Service
 * Parses natural language commands and determines query type
 * Converts informal requests into structured VLT specifications
 * 
 * Example transformations:
 * "Make me 10 dresses" → Exploratory query with count=10, garmentType=dress, stratified sampling
 * "Create 50 blue evening gowns" → Specific query with VLT filters, targeted retrieval
 * "Surprise me with outfits" → Exploratory query, diverse sampling across all garment types
 */
class QueryProcessingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    // Query type indicators
    this.exploratoryKeywords = [
      'surprise', 'random', 'varied', 'diverse', 'explore', 'discover',
      'different', 'mix', 'variety', 'batch', 'collection'
    ];
    
    this.specificKeywords = [
      'blue', 'red', 'evening', 'casual', 'formal', 'silk', 'velvet',
      'fitted', 'loose', 'vintage', 'modern', 'elegant', 'edgy'
    ];
  }

  /**
   * Process natural language query
   * @param {string} userQuery - Raw user query/voice command
   * @param {string} userId - User ID for personalization
   * @returns {Promise<Object>} Processed query with intent and structured data
   */
  async processQuery(userQuery, userId = null) {
    logger.info('Processing natural language query', {
      query: userQuery,
      userId
    });

    try {
      // Step 1: Parse intent using LLM
      const intent = await this.parseIntent(userQuery);
      
      // Step 2: Extract entities using NER
      const entities = await this.extractEntities(userQuery);
      
      // Step 3: Determine query type
      const queryType = this.determineQueryType(userQuery, entities);
      
      // Step 4: Build structured query
      const structuredQuery = this.buildStructuredQuery(
        intent,
        entities,
        queryType,
        userId
      );

      logger.info('Query processing complete', {
        originalQuery: userQuery,
        queryType,
        intentAction: intent.action,
        count: structuredQuery.count
      });

      return {
        success: true,
        originalQuery: userQuery,
        queryType,
        intent,
        entities,
        structuredQuery
      };

    } catch (error) {
      logger.error('Query processing failed', {
        query: userQuery,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Parse user intent using LLM
   * @param {string} query - User query
   * @returns {Promise<Object>} Intent object
   */
  async parseIntent(query) {
    const prompt = `You are a fashion design assistant. Parse this user command and extract:
1. Action (generate/create/make/design)
2. Count (number of items requested)
3. Specificity level (specific vs exploratory)

User command: "${query}"

Respond in JSON format:
{
  "action": "generate",
  "count": 10,
  "specificity": "exploratory",
  "confidence": 0.95
}`;

    try {
      if (!this.openaiApiKey) {
        logger.warn('No OpenAI API key available, using fallback intent parsing');
        return this.fallbackIntentParsing(query);
      }

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are a fashion design assistant specializing in parsing natural language commands.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 200
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const intent = JSON.parse(content);

      return intent;

    } catch (error) {
      logger.warn('LLM intent parsing failed, using fallback', {
        error: error.message
      });
      return this.fallbackIntentParsing(query);
    }
  }

  /**
   * Extract fashion entities using NER-like approach
   * @param {string} query - User query
   * @returns {Promise<Object>} Extracted entities
   */
  async extractEntities(query) {
    const prompt = `Extract fashion-related entities from this command:

User command: "${query}"

Extract and categorize:
- Garment types (dress, gown, blazer, etc.)
- Colors (blue, red, burgundy, etc.)
- Styles (elegant, casual, modern, etc.)
- Fabrics (silk, velvet, cotton, etc.)
- Quantities/counts

Respond in JSON format:
{
  "garmentType": "evening gown",
  "colors": ["blue", "navy"],
  "styles": ["elegant", "formal"],
  "fabrics": ["silk"],
  "count": 20,
  "modifiers": ["structured", "fitted"]
}`;

    try {
      if (!this.openaiApiKey) {
        logger.warn('No OpenAI API key available, using fallback entity extraction');
        return this.fallbackEntityExtraction(query);
      }

      const response = await axios.post(
        this.apiUrl,
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are an expert in fashion terminology and Named Entity Recognition.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      const entities = JSON.parse(content);

      return entities;

    } catch (error) {
      logger.warn('LLM entity extraction failed, using fallback', {
        error: error.message
      });
      return this.fallbackEntityExtraction(query);
    }
  }

  /**
   * Determine if query is specific or exploratory
   * @param {string} query - User query
   * @param {Object} entities - Extracted entities
   * @returns {string} 'specific' or 'exploratory'
   */
  determineQueryType(query, entities) {
    const queryLower = query.toLowerCase();
    
    // Check for exploratory indicators
    const hasExploratoryKeyword = this.exploratoryKeywords.some(keyword => 
      queryLower.includes(keyword)
    );
    
    // Check for specific attributes
    const hasSpecificAttributes = 
      (entities.colors && entities.colors.length > 0) ||
      (entities.styles && entities.styles.length > 0) ||
      (entities.fabrics && entities.fabrics.length > 0);
    
    // Decision logic
    if (hasExploratoryKeyword && !hasSpecificAttributes) {
      return 'exploratory';
    } else if (hasSpecificAttributes) {
      return 'specific';
    } else if (entities.count && entities.count > 10) {
      // Large batches are typically exploratory
      return 'exploratory';
    }
    
    return 'specific'; // Default to specific
  }

  /**
   * Build structured query from parsed data
   * @param {Object} intent - Parsed intent
   * @param {Object} entities - Extracted entities
   * @param {string} queryType - Query type
   * @param {string} userId - User ID
   * @returns {Object} Structured query ready for Stage 4
   */
  buildStructuredQuery(intent, entities, queryType, userId) {
    const query = {
      userId,
      type: queryType,
      count: entities.count || intent.count || 1,
      confidence: intent.confidence || 0.8
    };

    if (queryType === 'specific') {
      // Mode A: Targeted Retrieval
      query.mode = 'targeted';
      query.vltSpec = this.buildVLTSpec(entities);
      query.strategy = {
        type: 'hybrid_search',
        useSemanticVector: true,
        useMetadataFilters: true,
        overGenerationPercent: 20 // Generate 20% extra for quality control
      };

    } else {
      // Mode B: Exploratory Sampling
      query.mode = 'exploratory';
      query.samplingStrategy = this.buildSamplingStrategy(entities);
      query.strategy = {
        type: 'stratified_sampling',
        diversityTarget: 'high',
        useStyleClusters: true,
        overGenerationPercent: 20
      };
    }

    return query;
  }

  /**
   * Build VLT specification from entities
   * @param {Object} entities - Extracted entities
   * @returns {Object} VLT spec
   */
  buildVLTSpec(entities) {
    const spec = {};

    if (entities.garmentType) {
      spec.garmentType = entities.garmentType;
    }

    if (entities.colors && entities.colors.length > 0) {
      spec.colors = {
        primary: entities.colors[0],
        palette: entities.colors
      };
    }

    if (entities.styles && entities.styles.length > 0) {
      spec.style = {
        aesthetic: entities.styles[0],
        formality: this.inferFormality(entities.styles)
      };
    }

    if (entities.fabrics && entities.fabrics.length > 0) {
      spec.fabric = {
        type: entities.fabrics[0]
      };
    }

    if (entities.modifiers && entities.modifiers.length > 0) {
      spec.modifiers = entities.modifiers;
    }

    return spec;
  }

  /**
   * Build sampling strategy for exploratory queries
   * @param {Object} entities - Extracted entities
   * @returns {Object} Sampling strategy
   */
  buildSamplingStrategy(entities) {
    const strategy = {
      stratification: {
        byGarmentType: true,
        byStyleCluster: true,
        byColorFamily: entities.colors && entities.colors.length > 0
      },
      distribution: {
        // Default distribution across garment types
        dress: 0.45,
        blazer: 0.30,
        gown: 0.15,
        other: 0.10
      },
      mutation: {
        enabled: true,
        temperatureBased: true,
        temperature: 0.7 // Medium creativity
      },
      gapAnalysis: {
        enabled: true,
        useHistoricalData: true
      }
    };

    // Adjust if specific garment type requested
    if (entities.garmentType) {
      strategy.distribution = {
        [entities.garmentType]: 1.0
      };
      strategy.stratification.byGarmentType = false;
    }

    return strategy;
  }

  /**
   * Fallback intent parsing (rule-based)
   * @param {string} query - User query
   * @returns {Object} Intent
   */
  fallbackIntentParsing(query) {
    const countMatch = query.match(/(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 1;
    
    const queryLower = query.toLowerCase();
    const hasExplore = this.exploratoryKeywords.some(kw => queryLower.includes(kw));
    
    return {
      action: 'generate',
      count,
      specificity: hasExplore ? 'exploratory' : 'specific',
      confidence: 0.6
    };
  }

  /**
   * Fallback entity extraction (rule-based)
   * @param {string} query - User query
   * @returns {Object} Entities
   */
  fallbackEntityExtraction(query) {
    const queryLower = query.toLowerCase();
    const countMatch = query.match(/(\d+)/);
    
    const entities = {
      count: countMatch ? parseInt(countMatch[1]) : null,
      colors: [],
      styles: [],
      fabrics: [],
      modifiers: []
    };

    // Detect garment type
    if (queryLower.includes('dress')) entities.garmentType = 'dress';
    else if (queryLower.includes('gown')) entities.garmentType = 'evening gown';
    else if (queryLower.includes('blazer')) entities.garmentType = 'blazer';

    // Detect colors (basic)
    const colors = ['blue', 'red', 'green', 'black', 'white', 'burgundy', 'navy'];
    colors.forEach(color => {
      if (queryLower.includes(color)) entities.colors.push(color);
    });

    // Detect styles
    const styles = ['elegant', 'casual', 'formal', 'modern', 'vintage'];
    styles.forEach(style => {
      if (queryLower.includes(style)) entities.styles.push(style);
    });

    return entities;
  }

  /**
   * Infer formality from style keywords
   * @param {Array<string>} styles - Style keywords
   * @returns {string} Formality level
   */
  inferFormality(styles) {
    const formalKeywords = ['formal', 'elegant', 'sophisticated', 'evening'];
    const casualKeywords = ['casual', 'relaxed', 'everyday'];
    
    const hasFormal = styles.some(s => formalKeywords.includes(s.toLowerCase()));
    const hasCasual = styles.some(s => casualKeywords.includes(s.toLowerCase()));
    
    if (hasFormal) return 'formal';
    if (hasCasual) return 'casual';
    return 'semi-formal';
  }

  /**
   * Validate and sanitize structured query
   * @param {Object} structuredQuery - Query to validate
   * @returns {Object} Validated query
   */
  validateQuery(structuredQuery) {
    // Enforce count limits
    if (structuredQuery.count > 120) {
      logger.warn('Query count exceeds limit, capping at 120', {
        originalCount: structuredQuery.count
      });
      structuredQuery.count = 120;
    }

    if (structuredQuery.count < 1) {
      structuredQuery.count = 1;
    }

    return structuredQuery;
  }
}

module.exports = new QueryProcessingService();
