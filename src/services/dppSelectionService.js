const logger = require('../utils/logger');

/**
 * Stage 9: Determinantal Point Processes (DPP) Selection Service
 * Selects the most diverse subset from validated images using DPP sampling
 */
class DPPSelectionService {
  constructor() {
    // Feature weights for diversity calculation
    this.featureWeights = {
      garmentType: 1.0,
      silhouette: 0.9,
      fabrication: 0.8,
      neckline: 0.7,
      sleeves: 0.6,
      length: 0.5,
      color: 0.4,
      pattern: 0.3
    };
  }

  /**
   * Select diverse images using DPP
   * @param {Array} validatedImages - Array of validated images with VLT specs
   * @param {number} targetCount - Number of images to select
   * @param {Object} options - Selection options
   * @returns {Object} Selection result with chosen images and diversity metrics
   */
  async selectDiverseImages(validatedImages, targetCount, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting DPP selection', {
        inputCount: validatedImages.length,
        targetCount,
        options
      });

      // Step 1: Convert VLT specs to feature vectors
      const featureVectors = this.convertToFeatureVectors(validatedImages);

      // Step 2: Calculate similarity/kernel matrix
      const kernelMatrix = this.calculateKernelMatrix(featureVectors);

      // Step 3: Apply DPP sampling to select diverse subset
      const selectedIndices = this.dppSampling(kernelMatrix, targetCount);

      // Step 4: Extract selected images
      const selectedImages = selectedIndices.map(idx => validatedImages[idx]);

      // Step 5: Calculate diversity metrics
      const diversityMetrics = this.calculateDiversityMetrics(
        selectedImages,
        validatedImages
      );

      const duration = Date.now() - startTime;

      logger.info('DPP selection completed', {
        selectedCount: selectedImages.length,
        diversityScore: diversityMetrics.diversityScore,
        duration
      });

      return {
        selected: selectedImages,
        metrics: diversityMetrics,
        metadata: {
          inputCount: validatedImages.length,
          selectedCount: selectedImages.length,
          targetCount,
          selectionRate: (selectedImages.length / validatedImages.length * 100).toFixed(1),
          duration
        }
      };

    } catch (error) {
      logger.error('DPP selection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Convert VLT specs to feature vectors
   * @param {Array} images - Images with VLT specifications
   * @returns {Array} Feature vectors
   */
  convertToFeatureVectors(images) {
    return images.map(image => {
      const vltSpecs = image.vltSpecs || image.validation?.vltSpecs || {};
      
      // Extract key attributes and create one-hot encodings
      const features = {
        // Garment types
        garmentType: this.oneHotEncode(vltSpecs.garmentType, [
          'dress', 'top', 'bottom', 'outerwear', 'jumpsuit', 'set'
        ]),
        
        // Silhouettes
        silhouette: this.oneHotEncode(vltSpecs.silhouette, [
          'fitted', 'relaxed', 'oversized', 'a-line', 'empire', 'wrap', 'sheath'
        ]),
        
        // Fabrications
        fabrication: this.oneHotEncode(vltSpecs.fabrication, [
          'cotton', 'silk', 'denim', 'knit', 'leather', 'linen', 'synthetic'
        ]),
        
        // Necklines
        neckline: this.oneHotEncode(vltSpecs.neckline, [
          'crew', 'v-neck', 'scoop', 'square', 'off-shoulder', 'halter', 'turtleneck'
        ]),
        
        // Sleeves
        sleeves: this.oneHotEncode(vltSpecs.sleeves, [
          'sleeveless', 'short', 'three-quarter', 'long', 'cap'
        ]),
        
        // Length
        length: this.oneHotEncode(vltSpecs.length, [
          'mini', 'knee', 'midi', 'maxi', 'ankle'
        ]),
        
        // Quality score (normalized)
        qualityScore: (image.validation?.overallScore || 70) / 100
      };

      // Flatten to single vector with weights applied
      const vector = [];
      Object.keys(features).forEach(key => {
        const weight = this.featureWeights[key] || 1.0;
        if (Array.isArray(features[key])) {
          features[key].forEach(val => vector.push(val * weight));
        } else {
          vector.push(features[key] * weight);
        }
      });

      return {
        imageId: image.id,
        vector,
        metadata: {
          vltSpecs,
          qualityScore: image.validation?.overallScore
        }
      };
    });
  }

  /**
   * One-hot encode a value
   * @param {string} value - Value to encode
   * @param {Array} categories - All possible categories
   * @returns {Array} One-hot encoded vector
   */
  oneHotEncode(value, categories) {
    if (!value) return categories.map(() => 0);
    
    const normalized = value.toLowerCase().trim();
    return categories.map(cat => {
      // Fuzzy matching for partial matches
      return normalized.includes(cat) || cat.includes(normalized) ? 1 : 0;
    });
  }

  /**
   * Calculate kernel (similarity) matrix using RBF kernel
   * @param {Array} featureVectors - Feature vectors
   * @returns {Array} Kernel matrix
   */
  calculateKernelMatrix(featureVectors) {
    const n = featureVectors.length;
    const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
    
    const sigma = 1.0; // RBF kernel bandwidth

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          // Diagonal: quality score influences selection probability
          const quality = featureVectors[i].metadata.qualityScore || 70;
          matrix[i][j] = quality / 100;
        } else {
          // Off-diagonal: similarity between images
          const similarity = this.calculateSimilarity(
            featureVectors[i].vector,
            featureVectors[j].vector,
            sigma
          );
          matrix[i][j] = similarity;
          matrix[j][i] = similarity;
        }
      }
    }

    return matrix;
  }

  /**
   * Calculate RBF similarity between two vectors
   * @param {Array} v1 - First vector
   * @param {Array} v2 - Second vector
   * @param {number} sigma - Bandwidth parameter
   * @returns {number} Similarity score
   */
  calculateSimilarity(v1, v2, sigma) {
    const squaredDistance = v1.reduce((sum, val, idx) => {
      const diff = val - v2[idx];
      return sum + diff * diff;
    }, 0);

    return Math.exp(-squaredDistance / (2 * sigma * sigma));
  }

  /**
   * DPP sampling using greedy selection algorithm
   * (Approximation for computational efficiency)
   * @param {Array} kernelMatrix - Kernel matrix
   * @param {number} k - Number of items to select
   * @returns {Array} Selected indices
   */
  dppSampling(kernelMatrix, k) {
    const n = kernelMatrix.length;
    const selected = [];
    const remaining = Array.from({ length: n }, (_, i) => i);

    // Greedy approximation: iteratively select item that maximizes marginal gain
    while (selected.length < k && remaining.length > 0) {
      let bestIdx = -1;
      let bestScore = -Infinity;

      for (const idx of remaining) {
        const score = this.calculateMarginalGain(kernelMatrix, selected, idx);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }

      if (bestIdx !== -1) {
        selected.push(bestIdx);
        remaining.splice(remaining.indexOf(bestIdx), 1);
      } else {
        break;
      }
    }

    return selected;
  }

  /**
   * Calculate marginal gain of adding an item to the selected set
   * @param {Array} kernelMatrix - Kernel matrix
   * @param {Array} selected - Already selected indices
   * @param {number} candidate - Candidate index to add
   * @returns {number} Marginal gain score
   */
  calculateMarginalGain(kernelMatrix, selected, candidate) {
    if (selected.length === 0) {
      // First selection: use quality score (diagonal)
      return kernelMatrix[candidate][candidate];
    }

    // Quality contribution
    let qualityScore = kernelMatrix[candidate][candidate];

    // Diversity contribution (penalize similarity to already selected)
    let diversityPenalty = 0;
    for (const selectedIdx of selected) {
      diversityPenalty += kernelMatrix[candidate][selectedIdx];
    }
    diversityPenalty /= selected.length;

    // Balance quality and diversity
    return qualityScore * 0.6 - diversityPenalty * 0.4;
  }

  /**
   * Calculate diversity metrics for selected set
   * @param {Array} selectedImages - Selected images
   * @param {Array} allImages - All available images
   * @returns {Object} Diversity metrics
   */
  calculateDiversityMetrics(selectedImages, allImages) {
    // Calculate coverage for each attribute
    const coverage = {};
    const attributes = ['garmentType', 'silhouette', 'fabrication', 'neckline', 'sleeves', 'length'];

    attributes.forEach(attr => {
      const allValues = new Set();
      const selectedValues = new Set();

      allImages.forEach(img => {
        const value = img.vltSpecs?.[attr] || img.validation?.vltSpecs?.[attr];
        if (value) allValues.add(value.toLowerCase());
      });

      selectedImages.forEach(img => {
        const value = img.vltSpecs?.[attr] || img.validation?.vltSpecs?.[attr];
        if (value) selectedValues.add(value.toLowerCase());
      });

      coverage[attr] = {
        total: allValues.size,
        covered: selectedValues.size,
        coverage: allValues.size > 0 ? (selectedValues.size / allValues.size * 100).toFixed(1) : 0,
        values: Array.from(selectedValues)
      };
    });

    // Calculate overall diversity score (0-1)
    const avgCoverage = attributes.reduce((sum, attr) => {
      return sum + parseFloat(coverage[attr].coverage);
    }, 0) / attributes.length;

    const diversityScore = (avgCoverage / 100).toFixed(2);

    // Calculate average pairwise distance in selected set
    const avgDistance = this.calculateAveragePairwiseDistance(selectedImages);

    return {
      diversityScore: parseFloat(diversityScore),
      avgCoverage: avgCoverage.toFixed(1),
      avgPairwiseDistance: avgDistance.toFixed(3),
      attributeCoverage: coverage,
      qualityStats: {
        avgScore: (selectedImages.reduce((sum, img) => 
          sum + (img.validation?.overallScore || 70), 0) / selectedImages.length).toFixed(1),
        minScore: Math.min(...selectedImages.map(img => img.validation?.overallScore || 70)),
        maxScore: Math.max(...selectedImages.map(img => img.validation?.overallScore || 70))
      }
    };
  }

  /**
   * Calculate average pairwise distance in selected set
   * @param {Array} images - Selected images
   * @returns {number} Average distance
   */
  calculateAveragePairwiseDistance(images) {
    if (images.length < 2) return 0;

    const vectors = this.convertToFeatureVectors(images);
    let totalDistance = 0;
    let count = 0;

    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        const distance = this.euclideanDistance(
          vectors[i].vector,
          vectors[j].vector
        );
        totalDistance += distance;
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  /**
   * Calculate Euclidean distance between two vectors
   * @param {Array} v1 - First vector
   * @param {Array} v2 - Second vector
   * @returns {number} Distance
   */
  euclideanDistance(v1, v2) {
    return Math.sqrt(v1.reduce((sum, val, idx) => {
      const diff = val - v2[idx];
      return sum + diff * diff;
    }, 0));
  }

  /**
   * Update feature weights (for tuning)
   * @param {Object} weights - New weights
   */
  updateFeatureWeights(weights) {
    this.featureWeights = { ...this.featureWeights, ...weights };
    logger.info('Updated feature weights', { weights: this.featureWeights });
  }
}

module.exports = new DPPSelectionService();
