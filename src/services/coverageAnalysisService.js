const logger = require('../utils/logger');
const db = require('./database');

/**
 * Stage 9: Coverage Analysis Service
 * Tracks VLT attribute coverage and identifies gaps for continuous improvement
 */
class CoverageAnalysisService {
  constructor() {
    // Target coverage percentages for each attribute
    this.targetCoverage = {
      garmentType: 80,
      silhouette: 75,
      fabrication: 70,
      neckline: 65,
      sleeves: 60,
      length: 60
    };

    // Attribute value taxonomies
    this.attributeTaxonomy = {
      garmentType: ['dress', 'top', 'bottom', 'outerwear', 'jumpsuit', 'set', 'bodysuit', 'romper'],
      silhouette: ['fitted', 'relaxed', 'oversized', 'a-line', 'empire', 'wrap', 'sheath', 'bodycon', 'shift'],
      fabrication: ['cotton', 'silk', 'denim', 'knit', 'leather', 'linen', 'synthetic', 'wool', 'cashmere', 'velvet'],
      neckline: ['crew', 'v-neck', 'scoop', 'square', 'off-shoulder', 'halter', 'turtleneck', 'cowl', 'boat'],
      sleeves: ['sleeveless', 'short', 'three-quarter', 'long', 'cap', 'bell', 'puff'],
      length: ['mini', 'knee', 'midi', 'maxi', 'ankle', 'floor']
    };
  }

  /**
   * Analyze coverage across VLT attributes
   * @param {Array} selectedImages - Images selected by DPP
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Coverage report
   */
  async analyzeCoverage(selectedImages, options = {}) {
    const { generationId, targetCount } = options;

    try {
      logger.info('Starting coverage analysis', {
        imageCount: selectedImages.length,
        generationId
      });

      // Extract attribute distribution
      const distribution = this.extractAttributeDistribution(selectedImages);

      // Calculate coverage metrics
      const coverageMetrics = this.calculateCoverageMetrics(distribution);

      // Identify gaps
      const gaps = this.identifyGaps(distribution, coverageMetrics);

      // Generate recommendations
      const recommendations = this.generateRecommendations(gaps);

      // Store coverage report in database
      if (generationId) {
        await this.storeCoverageReport(generationId, {
          distribution,
          metrics: coverageMetrics,
          gaps,
          recommendations
        });
      }

      logger.info('Coverage analysis completed', {
        diversityScore: coverageMetrics.overallDiversityScore,
        gapCount: gaps.length
      });

      return {
        distribution,
        metrics: coverageMetrics,
        gaps,
        recommendations,
        summary: this.generateSummary(coverageMetrics, gaps)
      };

    } catch (error) {
      logger.error('Coverage analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract attribute distribution from images
   * @param {Array} images - Images to analyze
   * @returns {Object} Distribution data
   */
  extractAttributeDistribution(images) {
    const distribution = {};

    // Initialize counters for each attribute
    Object.keys(this.attributeTaxonomy).forEach(attr => {
      distribution[attr] = {};
      this.attributeTaxonomy[attr].forEach(value => {
        distribution[attr][value] = 0;
      });
    });

    // Count occurrences
    images.forEach(image => {
      const vltSpecs = image.vltSpecs || image.validation?.vltSpecs || {};

      Object.keys(this.attributeTaxonomy).forEach(attr => {
        const value = vltSpecs[attr];
        if (value) {
          const normalized = value.toLowerCase().trim();
          
          // Match against taxonomy (fuzzy matching)
          this.attributeTaxonomy[attr].forEach(taxonomyValue => {
            if (normalized.includes(taxonomyValue) || taxonomyValue.includes(normalized)) {
              distribution[attr][taxonomyValue]++;
            }
          });
        }
      });
    });

    return distribution;
  }

  /**
   * Calculate coverage metrics
   * @param {Object} distribution - Attribute distribution
   * @returns {Object} Coverage metrics
   */
  calculateCoverageMetrics(distribution) {
    const metrics = {};

    Object.keys(distribution).forEach(attr => {
      const values = distribution[attr];
      const totalValues = Object.keys(values).length;
      const coveredValues = Object.values(values).filter(count => count > 0).length;
      const totalCount = Object.values(values).reduce((sum, count) => sum + count, 0);

      // Coverage percentage
      const coveragePercent = totalValues > 0 
        ? (coveredValues / totalValues * 100).toFixed(1)
        : 0;

      // Calculate entropy (diversity measure)
      const entropy = this.calculateEntropy(Object.values(values));

      // Calculate Gini coefficient (inequality measure)
      const giniCoefficient = this.calculateGini(Object.values(values));

      metrics[attr] = {
        totalValues,
        coveredValues,
        coveragePercent: parseFloat(coveragePercent),
        targetCoverage: this.targetCoverage[attr],
        meetsTarget: parseFloat(coveragePercent) >= this.targetCoverage[attr],
        totalCount,
        entropy: entropy.toFixed(3),
        giniCoefficient: giniCoefficient.toFixed(3),
        distribution: values
      };
    });

    // Calculate overall diversity score
    const avgCoverage = Object.values(metrics).reduce((sum, m) => 
      sum + m.coveragePercent, 0) / Object.keys(metrics).length;

    const avgEntropy = Object.values(metrics).reduce((sum, m) => 
      sum + parseFloat(m.entropy), 0) / Object.keys(metrics).length;

    metrics.overallDiversityScore = ((avgCoverage / 100) * 0.6 + (avgEntropy / 5) * 0.4).toFixed(2);
    metrics.avgCoveragePercent = avgCoverage.toFixed(1);

    return metrics;
  }

  /**
   * Calculate Shannon entropy for diversity
   * @param {Array} values - Count values
   * @returns {number} Entropy
   */
  calculateEntropy(values) {
    const total = values.reduce((sum, v) => sum + v, 0);
    if (total === 0) return 0;

    return values.reduce((entropy, count) => {
      if (count === 0) return entropy;
      const p = count / total;
      return entropy - p * Math.log2(p);
    }, 0);
  }

  /**
   * Calculate Gini coefficient for inequality
   * @param {Array} values - Count values
   * @returns {number} Gini coefficient (0 = perfect equality, 1 = perfect inequality)
   */
  calculateGini(values) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((sum, v) => sum + v, 0);

    if (total === 0) return 0;

    let sum = 0;
    sorted.forEach((value, i) => {
      sum += (2 * (i + 1) - n - 1) * value;
    });

    return sum / (n * total);
  }

  /**
   * Identify coverage gaps
   * @param {Object} distribution - Attribute distribution
   * @param {Object} metrics - Coverage metrics
   * @returns {Array} List of gaps
   */
  identifyGaps(distribution, metrics) {
    const gaps = [];

    Object.keys(distribution).forEach(attr => {
      const metric = metrics[attr];
      const values = distribution[attr];

      // Find uncovered values
      const uncovered = Object.keys(values).filter(value => values[value] === 0);

      // Find underrepresented values (< 5% of total)
      const totalCount = Object.values(values).reduce((sum, count) => sum + count, 0);
      const underrepresented = Object.keys(values).filter(value => {
        const count = values[value];
        return count > 0 && count < totalCount * 0.05;
      });

      if (uncovered.length > 0 || !metric.meetsTarget) {
        gaps.push({
          attribute: attr,
          severity: this.calculateGapSeverity(metric, uncovered.length),
          currentCoverage: metric.coveragePercent,
          targetCoverage: metric.targetCoverage,
          gap: (metric.targetCoverage - metric.coveragePercent).toFixed(1),
          uncoveredValues: uncovered,
          underrepresentedValues: underrepresented.map(value => ({
            value,
            count: values[value],
            percentage: ((values[value] / totalCount) * 100).toFixed(1)
          })),
          recommendedBoost: this.calculateRecommendedBoost(metric)
        });
      }
    });

    // Sort by severity
    gaps.sort((a, b) => {
      const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    return gaps;
  }

  /**
   * Calculate gap severity
   * @param {Object} metric - Coverage metric
   * @param {number} uncoveredCount - Number of uncovered values
   * @returns {string} Severity level
   */
  calculateGapSeverity(metric, uncoveredCount) {
    const gapPercent = metric.targetCoverage - metric.coveragePercent;

    if (gapPercent >= 30 || uncoveredCount >= 5) return 'critical';
    if (gapPercent >= 15 || uncoveredCount >= 3) return 'high';
    if (gapPercent >= 5 || uncoveredCount >= 1) return 'medium';
    return 'low';
  }

  /**
   * Calculate recommended weight boost for Stage 4
   * @param {Object} metric - Coverage metric
   * @returns {number} Recommended boost multiplier
   */
  calculateRecommendedBoost(metric) {
    const gapPercent = metric.targetCoverage - metric.coveragePercent;
    
    if (gapPercent >= 30) return 2.0;
    if (gapPercent >= 15) return 1.5;
    if (gapPercent >= 5) return 1.2;
    return 1.0;
  }

  /**
   * Generate recommendations based on gaps
   * @param {Array} gaps - Identified gaps
   * @returns {Array} Recommendations
   */
  generateRecommendations(gaps) {
    const recommendations = [];

    gaps.forEach(gap => {
      const rec = {
        priority: gap.severity,
        attribute: gap.attribute,
        action: 'boost_weight',
        targetValues: [...gap.uncoveredValues, ...gap.underrepresentedValues.map(u => u.value)],
        weightMultiplier: gap.recommendedBoost,
        expectedImpact: `Increase ${gap.attribute} coverage from ${gap.currentCoverage}% to ${gap.targetCoverage}%`,
        implementation: `Update Stage 4 prompt weights: increase ${gap.attribute} weight by ${((gap.recommendedBoost - 1) * 100).toFixed(0)}%`
      };

      recommendations.push(rec);
    });

    return recommendations;
  }

  /**
   * Generate summary text
   * @param {Object} metrics - Coverage metrics
   * @param {Array} gaps - Identified gaps
   * @returns {string} Summary text
   */
  generateSummary(metrics, gaps) {
    const avgCoverage = parseFloat(metrics.avgCoveragePercent);
    const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
    const highGaps = gaps.filter(g => g.severity === 'high').length;

    let status = 'Good';
    if (criticalGaps > 0) status = 'Critical';
    else if (highGaps > 0) status = 'Needs Improvement';
    else if (avgCoverage < 70) status = 'Fair';
    else if (avgCoverage >= 80) status = 'Excellent';

    return {
      status,
      overallScore: metrics.overallDiversityScore,
      avgCoverage: avgCoverage.toFixed(1),
      gapSummary: {
        critical: criticalGaps,
        high: highGaps,
        medium: gaps.filter(g => g.severity === 'medium').length,
        low: gaps.filter(g => g.severity === 'low').length
      },
      message: this.generateSummaryMessage(status, avgCoverage, gaps)
    };
  }

  /**
   * Generate summary message
   * @param {string} status - Overall status
   * @param {number} avgCoverage - Average coverage percentage
   * @param {Array} gaps - Identified gaps
   * @returns {string} Summary message
   */
  generateSummaryMessage(status, avgCoverage, gaps) {
    if (status === 'Excellent') {
      return `Coverage is excellent at ${avgCoverage.toFixed(1)}%. All targets met with good diversity.`;
    }
    if (status === 'Critical') {
      const criticalAttrs = gaps.filter(g => g.severity === 'critical').map(g => g.attribute);
      return `Critical gaps in ${criticalAttrs.join(', ')}. Immediate weight adjustments recommended.`;
    }
    if (status === 'Needs Improvement') {
      return `Coverage at ${avgCoverage.toFixed(1)}% with ${gaps.length} gaps identified. Consider weight adjustments.`;
    }
    return `Coverage at ${avgCoverage.toFixed(1)}%. Minor optimizations available.`;
  }

  /**
   * Store coverage report in database
   * @param {string} generationId - Generation ID
   * @param {Object} report - Coverage report
   */
  async storeCoverageReport(generationId, report) {
    try {
      const client = await db.getClient();
      try {
        await client.query(`
          INSERT INTO coverage_reports (
            generation_id,
            distribution,
            metrics,
            gaps,
            recommendations,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          generationId,
          JSON.stringify(report.distribution),
          JSON.stringify(report.metrics),
          JSON.stringify(report.gaps),
          JSON.stringify(report.recommendations)
        ]);

        logger.info('Coverage report stored', { generationId });

      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to store coverage report', { error: error.message });
      // Don't throw - allow analysis to continue even if storage fails
    }
  }

  /**
   * Get historical coverage trends
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Historical trends
   */
  async getCoverageTrends(options = {}) {
    const { days = 30, attribute = null } = options;

    try {
      const client = await db.getClient();
      try {
        const result = await client.query(`
          SELECT 
            DATE(created_at) as date,
            metrics,
            gaps
          FROM coverage_reports
          WHERE created_at >= NOW() - INTERVAL '${days} days'
          ORDER BY created_at ASC
        `);

        const trends = result.rows.map(row => {
          const metrics = row.metrics;
          const gaps = row.gaps;

          return {
            date: row.date,
            overallScore: parseFloat(metrics.overallDiversityScore),
            avgCoverage: parseFloat(metrics.avgCoveragePercent),
            gapCount: gaps.length,
            criticalGaps: gaps.filter(g => g.severity === 'critical').length,
            attributes: attribute ? {
              [attribute]: metrics[attribute]
            } : Object.keys(metrics).filter(k => k !== 'overallDiversityScore' && k !== 'avgCoveragePercent')
              .reduce((acc, k) => {
                acc[k] = metrics[k];
                return acc;
              }, {})
          };
        });

        return trends;

      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to get coverage trends', { error: error.message });
      throw error;
    }
  }

  /**
   * Update target coverage thresholds
   * @param {Object} targets - New target percentages
   */
  updateTargetCoverage(targets) {
    this.targetCoverage = { ...this.targetCoverage, ...targets };
    logger.info('Updated target coverage', { targets: this.targetCoverage });
  }
}

module.exports = new CoverageAnalysisService();
