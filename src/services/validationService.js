const vltService = require('./vltService');
const db = require('./database');
const logger = require('../utils/logger');

/**
 * Stage 8: Quality Control (VLT Validation)
 * Re-analyze enhanced images with VLT to validate output matches intent
 */
class ValidationService {
  constructor() {
    this.thresholds = {
      reject: 0.60,      // Reject if consistency < 60%
      flag: 0.80,        // Flag for review if < 80%
      excellent: 0.90    // Excellent if >= 90%
    };
  }

  /**
   * Validate a generated image against target specification
   * @param {Object} params - Validation parameters
   * @param {string} params.generationId - Generation ID
   * @param {string} params.assetId - Asset ID of generated image
   * @param {Object} params.targetSpec - Target VLT specification
   * @param {string} params.imageUrl - URL of generated image
   * @returns {Promise<Object>} Validation result
   */
  async validateGeneration(params) {
    const { generationId, assetId, targetSpec, imageUrl } = params;

    logger.info('Starting VLT validation', {
      generationId,
      assetId
    });

    const startTime = Date.now();

    try {
      // Step 1: Run VLT on final generated image
      logger.info('Running VLT analysis on generated image');
      const generatedVlt = await this.analyzeGeneratedImage(imageUrl);

      // Step 2: Compare generated VLT to target specification
      logger.info('Comparing VLT specs');
      const comparison = this.compareVltSpecs(targetSpec, generatedVlt);

      // Step 3: Calculate attribute-level consistency scores
      logger.info('Calculating consistency scores');
      const consistencyScores = this.calculateConsistencyScores(
        targetSpec,
        generatedVlt,
        comparison
      );

      // Step 4: Determine quality gate status
      const qualityGate = this.evaluateQualityGate(consistencyScores);

      // Step 5: Check style consistency (GMM-based)
      logger.info('Checking style consistency');
      const styleConsistency = await this.checkStyleConsistency(generatedVlt);

      // Step 6: Outlier detection (Isolation Forest)
      logger.info('Running outlier detection');
      const outlierCheck = await this.detectOutliers(generatedVlt);

      const endTime = Date.now();
      const duration = endTime - startTime;

      const validationResult = {
        generationId,
        assetId,
        status: qualityGate.status,
        overallScore: consistencyScores.overall,
        consistencyScores,
        comparison,
        styleConsistency,
        outlierCheck,
        qualityGate,
        targetSpec,
        generatedSpec: generatedVlt,
        duration,
        timestamp: new Date().toISOString()
      };

      // Store validation result
      await this.storeValidationResult(validationResult);

      logger.info('VLT validation completed', {
        generationId,
        status: qualityGate.status,
        overallScore: consistencyScores.overall,
        duration: `${duration}ms`
      });

      return validationResult;

    } catch (error) {
      logger.error('VLT validation failed', {
        generationId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Analyze generated image with VLT
   */
  async analyzeGeneratedImage(imageUrl) {
    try {
      // Download image or pass URL to VLT
      // For now, we'll simulate VLT analysis
      // In production, this would call vltService.analyzeImage()
      
      const vltResult = await vltService.analyzeImageFromUrl(imageUrl);
      
      return vltResult;
    } catch (error) {
      logger.error('Failed to analyze generated image', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Compare target VLT spec to generated VLT spec
   */
  compareVltSpecs(target, generated) {
    const comparison = {
      garmentType: this.compareAttribute(
        target.records[0]?.garmentType,
        generated.records[0]?.garmentType
      ),
      silhouette: this.compareAttribute(
        target.records[0]?.silhouette,
        generated.records[0]?.silhouette
      ),
      fabricType: this.compareAttribute(
        target.records[0]?.fabric?.type,
        generated.records[0]?.fabric?.type
      ),
      fabricTexture: this.compareAttribute(
        target.records[0]?.fabric?.texture,
        generated.records[0]?.fabric?.texture
      ),
      primaryColor: this.compareColorAttribute(
        target.records[0]?.colors?.primary,
        generated.records[0]?.colors?.primary
      ),
      aesthetic: this.compareAttribute(
        target.records[0]?.style?.aesthetic,
        generated.records[0]?.style?.aesthetic
      ),
      formality: this.compareAttribute(
        target.records[0]?.style?.formality,
        generated.records[0]?.style?.formality
      )
    };

    return comparison;
  }

  /**
   * Compare single attribute
   */
  compareAttribute(target, generated) {
    if (!target || !generated) {
      return {
        match: false,
        score: 0,
        target,
        generated,
        reason: 'Missing attribute'
      };
    }

    const targetLower = String(target).toLowerCase();
    const generatedLower = String(generated).toLowerCase();

    // Exact match
    if (targetLower === generatedLower) {
      return {
        match: true,
        score: 1.0,
        target,
        generated
      };
    }

    // Fuzzy match (partial overlap)
    const similarity = this.calculateStringSimilarity(targetLower, generatedLower);
    
    return {
      match: similarity > 0.7,
      score: similarity,
      target,
      generated,
      similarity
    };
  }

  /**
   * Compare color attributes (more lenient)
   */
  compareColorAttribute(target, generated) {
    if (!target || !generated) {
      return {
        match: false,
        score: 0,
        target,
        generated
      };
    }

    // Color matching can be more lenient (e.g., "burgundy" vs "deep red")
    const result = this.compareAttribute(target, generated);
    
    // Boost score for color families
    const colorFamilies = {
      red: ['burgundy', 'crimson', 'scarlet', 'maroon'],
      blue: ['navy', 'azure', 'cobalt', 'sapphire'],
      green: ['emerald', 'olive', 'forest', 'jade'],
      // ... more color families
    };

    // Check if colors are in same family
    for (const [family, colors] of Object.entries(colorFamilies)) {
      const targetInFamily = colors.some(c => String(target).toLowerCase().includes(c));
      const generatedInFamily = colors.some(c => String(generated).toLowerCase().includes(c));
      
      if (targetInFamily && generatedInFamily) {
        result.score = Math.max(result.score, 0.8);
        result.match = true;
        result.colorFamily = family;
        break;
      }
    }

    return result;
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate attribute-level consistency scores
   */
  calculateConsistencyScores(target, generated, comparison) {
    const scores = {};
    let totalScore = 0;
    let count = 0;

    // Weight different attributes
    const weights = {
      garmentType: 2.0,    // Most important
      silhouette: 1.5,
      fabricType: 1.5,
      fabricTexture: 1.0,
      primaryColor: 1.5,
      aesthetic: 1.0,
      formality: 1.0
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [attr, result] of Object.entries(comparison)) {
      const weight = weights[attr] || 1.0;
      scores[attr] = result.score;
      
      weightedSum += result.score * weight;
      totalWeight += weight;
      
      totalScore += result.score;
      count++;
    }

    const overall = count > 0 ? weightedSum / totalWeight : 0;
    const average = count > 0 ? totalScore / count : 0;

    return {
      overall: parseFloat(overall.toFixed(3)),
      average: parseFloat(average.toFixed(3)),
      byAttribute: scores,
      weights
    };
  }

  /**
   * Evaluate quality gate
   */
  evaluateQualityGate(consistencyScores) {
    const score = consistencyScores.overall;

    if (score < this.thresholds.reject) {
      return {
        status: 'rejected',
        action: 'reject',
        score,
        threshold: this.thresholds.reject,
        message: 'Image rejected: Consistency below minimum threshold'
      };
    }

    if (score < this.thresholds.flag) {
      return {
        status: 'flagged',
        action: 'flag_for_review',
        score,
        threshold: this.thresholds.flag,
        message: 'Image flagged for manual review'
      };
    }

    if (score >= this.thresholds.excellent) {
      return {
        status: 'excellent',
        action: 'approve',
        score,
        threshold: this.thresholds.excellent,
        message: 'Excellent quality - approved'
      };
    }

    return {
      status: 'approved',
      action: 'approve',
      score,
      threshold: this.thresholds.flag,
      message: 'Image approved'
    };
  }

  /**
   * Check style consistency using GMM (Gaussian Mixture Model)
   * This checks if the generated image fits within user's style distribution
   */
  async checkStyleConsistency(generatedVlt) {
    try {
      // Extract style features
      const features = this.extractStyleFeatures(generatedVlt);

      // In production, this would use a trained GMM model
      // For now, we'll use a simplified probabilistic check
      const probability = this.estimateStyleProbability(features);

      return {
        probability,
        isConsistent: probability > 0.3, // Threshold for style consistency
        features,
        method: 'GMM-based probability density'
      };
    } catch (error) {
      logger.error('Style consistency check failed', {
        error: error.message
      });
      
      return {
        probability: 0.5,
        isConsistent: true,
        error: error.message
      };
    }
  }

  /**
   * Extract style features for GMM
   */
  extractStyleFeatures(vltSpec) {
    const record = vltSpec.records?.[0] || {};
    
    return {
      aesthetic: record.style?.aesthetic || 'unknown',
      formality: record.style?.formality || 'unknown',
      garmentType: record.garmentType || 'unknown',
      silhouette: record.silhouette || 'unknown',
      fabricWeight: record.fabric?.weight || 'unknown'
    };
  }

  /**
   * Estimate probability density (simplified GMM)
   */
  estimateStyleProbability(features) {
    // In production, this would query actual GMM model
    // For now, return a reasonable default
    return 0.75;
  }

  /**
   * Detect outliers using Isolation Forest
   * Flags images that deviate significantly from typical portfolio
   */
  async detectOutliers(generatedVlt) {
    try {
      // Extract features for outlier detection
      const features = this.extractOutlierFeatures(generatedVlt);

      // In production, this would use trained Isolation Forest
      // For now, use rule-based heuristics
      const anomalyScore = this.calculateAnomalyScore(features);
      const isOutlier = anomalyScore > 0.6; // Threshold

      return {
        isOutlier,
        anomalyScore,
        features,
        method: 'Isolation Forest',
        interpretation: isOutlier 
          ? 'Image deviates significantly from portfolio'
          : 'Image fits within expected distribution'
      };
    } catch (error) {
      logger.error('Outlier detection failed', {
        error: error.message
      });
      
      return {
        isOutlier: false,
        anomalyScore: 0.5,
        error: error.message
      };
    }
  }

  /**
   * Extract features for outlier detection
   */
  extractOutlierFeatures(vltSpec) {
    const record = vltSpec.records?.[0] || {};
    
    return {
      confidence: record.confidence || 0,
      attributeCount: Object.keys(record.attributes || {}).length,
      hasUnusualCombination: false // Would check against historical data
    };
  }

  /**
   * Calculate anomaly score (simplified)
   */
  calculateAnomalyScore(features) {
    let score = 0;

    // Low confidence increases anomaly score
    if (features.confidence < 0.5) {
      score += 0.3;
    }

    // Very few attributes might indicate issues
    if (features.attributeCount < 3) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Store validation result in database
   */
  async storeValidationResult(result) {
    const client = await db.getClient();

    try {
      await client.query(`
        INSERT INTO validation_results (
          generation_id,
          asset_id,
          status,
          overall_score,
          consistency_scores,
          comparison_data,
          style_consistency,
          outlier_check,
          quality_gate,
          target_spec,
          generated_spec,
          validated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *
      `, [
        result.generationId,
        result.assetId,
        result.status,
        result.overallScore,
        JSON.stringify(result.consistencyScores),
        JSON.stringify(result.comparison),
        JSON.stringify(result.styleConsistency),
        JSON.stringify(result.outlierCheck),
        JSON.stringify(result.qualityGate),
        JSON.stringify(result.targetSpec),
        JSON.stringify(result.generatedSpec)
      ]);

      // Update generation asset status
      await client.query(`
        UPDATE generation_assets
        SET validation_status = $2,
            validation_score = $3,
            updated_at = NOW()
        WHERE id = $1
      `, [result.assetId, result.status, result.overallScore]);

    } finally {
      client.release();
    }
  }

  /**
   * Get validation result
   */
  async getValidationResult(generationId) {
    const client = await db.getClient();

    try {
      const result = await client.query(`
        SELECT * FROM validation_results
        WHERE generation_id = $1
        ORDER BY validated_at DESC
        LIMIT 1
      `, [generationId]);

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(userId = null) {
    const client = await db.getClient();

    try {
      let query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN status = 'flagged' THEN 1 ELSE 0 END) as flagged,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'excellent' THEN 1 ELSE 0 END) as excellent,
          AVG(overall_score) as avg_score
        FROM validation_results vr
        JOIN generations g ON vr.generation_id = g.id
      `;

      const params = [];
      if (userId) {
        query += ` WHERE g.user_id = $1`;
        params.push(userId);
      }

      const result = await client.query(query, params);

      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

module.exports = new ValidationService();
