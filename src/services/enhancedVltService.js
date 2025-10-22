/**
 * Enhanced VLT Service with Local Style Detection
 * 
 * Combines external VLT API with local fashion analysis for better
 * style signature detection (sporty chic, minimalist, etc.)
 */

const vltService = require('./vltService');
const fashionAnalysisService = require('./fashionAnalysisService');
const logger = require('../utils/logger');

class EnhancedVltService {
  constructor() {
    this.useHybridAnalysis = process.env.USE_HYBRID_ANALYSIS !== 'false';
    this.preferLocalAnalysis = process.env.PREFER_LOCAL_ANALYSIS === 'true';
    
    // Style keyword mappings for better detection
    this.styleKeywords = {
      'sporty': ['athletic', 'sporty', 'active', 'workout', 'gym', 'activewear', 'tracksuit'],
      'minimalist': ['minimalist', 'clean', 'simple', 'modern', 'sleek', 'understated'],
      'casual': ['casual', 'relaxed', 'comfortable', 'laid-back', 'everyday'],
      'chic': ['chic', 'sophisticated', 'stylish', 'fashionable', 'trendy'],
      'elegant': ['elegant', 'refined', 'graceful', 'polished', 'formal'],
      'edgy': ['edgy', 'bold', 'daring', 'punk', 'rock', 'alternative'],
      'romantic': ['romantic', 'feminine', 'soft', 'flowing', 'delicate', 'pretty'],
      'professional': ['professional', 'business', 'corporate', 'formal', 'work']
    };
    
    logger.info('Enhanced VLT Service initialized', {
      hybridAnalysis: this.useHybridAnalysis,
      preferLocal: this.preferLocalAnalysis
    });
  }

  /**
   * Enhanced batch analysis with hybrid approach
   * @param {string|Buffer} zipInput - ZIP file path or buffer
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Enhanced VLT result
   */
  async batchAnalyze(zipInput, options = {}) {
    logger.info('Starting enhanced VLT analysis', {
      hybridMode: this.useHybridAnalysis,
      model: options.model
    });

    let vltResult = null;
    let localResults = [];
    let analysisMethod = 'vlt_only';

    try {
      // Try VLT first unless we prefer local
      if (!this.preferLocalAnalysis) {
        try {
          vltResult = await vltService.batchAnalyze(zipInput, options);
          analysisMethod = 'vlt_primary';
          logger.info('VLT analysis completed', { recordCount: vltResult.records?.length });
        } catch (vltError) {
          logger.warn('VLT analysis failed, falling back to local', { error: vltError.message });
          this.preferLocalAnalysis = true; // Switch preference for this session
        }
      }

      // Use local analysis as primary or fallback
      if (!vltResult || this.useHybridAnalysis) {
        try {
          localResults = await this._analyzeWithLocal(zipInput);
          analysisMethod = vltResult ? 'hybrid' : 'local_only';
          logger.info('Local analysis completed', { recordCount: localResults.length });
        } catch (localError) {
          logger.warn('Local analysis failed', { error: localError.message });
          if (!vltResult) {
            throw new Error(`Both VLT and local analysis failed. VLT: ${vltError?.message}, Local: ${localError.message}`);
          }
        }
      }

      // Enhance results with hybrid approach
      const enhancedResult = this._combineResults(vltResult, localResults, analysisMethod);
      
      // Apply local style enhancement
      enhancedResult.records = enhancedResult.records.map(record => 
        this._enhanceStyleDetection(record)
      );

      // Regenerate summary with enhanced data
      enhancedResult.summary = this._generateEnhancedSummary(enhancedResult.records);
      enhancedResult.analysisMethod = analysisMethod;
      enhancedResult.enhanced = true;

      logger.info('Enhanced analysis completed', {
        method: analysisMethod,
        recordCount: enhancedResult.records.length,
        enhancedStyles: this._countEnhancedStyles(enhancedResult.records)
      });

      return enhancedResult;

    } catch (error) {
      logger.error('Enhanced VLT analysis failed completely', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze ZIP with local fashion analysis service
   * @private
   */
  async _analyzeWithLocal(zipInput) {
    const AdmZip = require('adm-zip');
    const fs = require('fs');
    
    // Handle different input types
    let zipBuffer;
    if (typeof zipInput === 'string') {
      zipBuffer = fs.readFileSync(zipInput);
    } else {
      zipBuffer = zipInput;
    }

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries().filter(entry => 
      !entry.isDirectory && 
      /\.(jpg|jpeg|png|webp)$/i.test(entry.entryName)
    );

    if (entries.length === 0) {
      throw new Error('No valid images found in ZIP file');
    }

    const results = [];
    
    // Process images with local analysis
    for (let i = 0; i < Math.min(entries.length, 100); i++) { // Limit to 100 images
      const entry = entries[i];
      try {
        const imageBuffer = entry.getData();
        const analysis = await fashionAnalysisService.analyzeImage(imageBuffer);
        
        results.push({
          ...analysis,
          imageId: entry.entryName,
          source: 'local_analysis'
        });

        // Rate limiting for Replicate API
        if (i < entries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        logger.warn('Local analysis failed for image', { 
          image: entry.entryName, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Combine VLT and local results
   * @private
   */
  _combineResults(vltResult, localResults, method) {
    if (!vltResult && localResults.length === 0) {
      throw new Error('No analysis results available');
    }

    // Use VLT as base if available
    if (vltResult) {
      const combined = { ...vltResult };
      
      // Enhance with local results if available
      if (localResults.length > 0) {
        combined.records = combined.records.map((vltRecord, index) => {
          const localRecord = localResults.find(lr => 
            lr.imageId === vltRecord.imageId || index < localResults.length
          ) || localResults[index % localResults.length];

          if (localRecord) {
            return {
              ...vltRecord,
              localAnalysis: {
                style: localRecord.style,
                confidence: localRecord.confidence,
                garmentType: localRecord.garmentType,
                modelSpecs: localRecord.modelSpecs
              }
            };
          }
          return vltRecord;
        });
      }
      
      return combined;
    }

    // Use local results as primary
    return {
      jobId: `local_${Date.now()}`,
      status: 'completed',
      backend: 'local_fashion_analysis',
      model: 'replicate_vision',
      timestamp: new Date().toISOString(),
      records: localResults.map(lr => ({
        imageId: lr.imageId,
        garmentType: lr.garmentType,
        silhouette: lr.silhouette,
        fabric: lr.fabric,
        colors: lr.colors,
        construction: lr.construction,
        style: lr.style,
        promptText: lr.promptText,
        confidence: lr.confidence,
        attributes: lr.attributes,
        neckline: lr.neckline,
        sleeveLength: lr.sleeveLength,
        length: lr.length,
        modelSpecs: lr.modelSpecs,
        source: 'local_analysis'
      }))
    };
  }

  /**
   * Enhance style detection with local keyword analysis
   * @private
   */
  _enhanceStyleDetection(record) {
    const enhanced = { ...record };
    
    // Analyze the original prompt text and VLT data for style keywords
    const textToAnalyze = [
      record.promptText || '',
      record.style?.aesthetic || '',
      record.style?.formality || '',
      record.style?.overall || '',
      record.localAnalysis?.style?.aesthetic || '',
      JSON.stringify(record.attributes || {})
    ].join(' ').toLowerCase();

    // Detect style signatures
    const detectedStyles = [];
    for (const [style, keywords] of Object.entries(this.styleKeywords)) {
      const matches = keywords.filter(keyword => textToAnalyze.includes(keyword));
      if (matches.length > 0) {
        detectedStyles.push({
          style,
          keywords: matches,
          confidence: matches.length / keywords.length
        });
      }
    }

    // Sort by confidence and take top styles
    detectedStyles.sort((a, b) => b.confidence - a.confidence);

    if (detectedStyles.length > 0) {
      const primaryStyle = detectedStyles[0];
      
      // Enhance style attributes
      enhanced.style = {
        ...enhanced.style,
        aesthetic: primaryStyle.style,
        detectedStyles: detectedStyles.slice(0, 3), // Top 3
        enhancedBy: 'local_keywords',
        confidence: primaryStyle.confidence
      };

      // Mark as enhanced
      enhanced.styleEnhanced = true;
      enhanced.originalStyle = record.style;
    }

    // Enhance formality based on detected styles
    if (detectedStyles.some(s => ['professional', 'elegant'].includes(s.style))) {
      enhanced.style.formality = 'formal';
    } else if (detectedStyles.some(s => ['casual', 'sporty'].includes(s.style))) {
      enhanced.style.formality = 'casual';
    }

    return enhanced;
  }

  /**
   * Generate enhanced summary with better style analysis
   * @private
   */
  _generateEnhancedSummary(records) {
    const summary = {
      totalImages: records.length,
      garmentTypes: {},
      dominantColors: {},
      fabricTypes: {},
      silhouettes: {},
      styleAesthetics: {},
      detectedStyleSignatures: {},
      averageConfidence: 0
    };

    let totalConfidence = 0;

    records.forEach(record => {
      // Count garment types
      if (record.garmentType) {
        summary.garmentTypes[record.garmentType] = 
          (summary.garmentTypes[record.garmentType] || 0) + 1;
      }

      // Count colors
      if (record.colors?.primary) {
        summary.dominantColors[record.colors.primary] = 
          (summary.dominantColors[record.colors.primary] || 0) + 1;
      }

      // Count fabric types
      if (record.fabric?.type) {
        summary.fabricTypes[record.fabric.type] = 
          (summary.fabricTypes[record.fabric.type] || 0) + 1;
      }

      // Count silhouettes
      if (record.silhouette) {
        summary.silhouettes[record.silhouette] = 
          (summary.silhouettes[record.silhouette] || 0) + 1;
      }

      // Count enhanced style aesthetics
      if (record.style?.aesthetic) {
        summary.styleAesthetics[record.style.aesthetic] = 
          (summary.styleAesthetics[record.style.aesthetic] || 0) + 1;
      }

      // Count detected style signatures
      if (record.style?.detectedStyles) {
        record.style.detectedStyles.forEach(styleInfo => {
          summary.detectedStyleSignatures[styleInfo.style] = 
            (summary.detectedStyleSignatures[styleInfo.style] || 0) + 1;
        });
      }

      totalConfidence += record.confidence || 0.8;
    });

    summary.averageConfidence = records.length > 0 ? 
      (totalConfidence / records.length).toFixed(2) : 0;

    return summary;
  }

  /**
   * Count how many styles were enhanced
   * @private
   */
  _countEnhancedStyles(records) {
    return records.filter(r => r.styleEnhanced).length;
  }
}

module.exports = new EnhancedVltService();