/**
 * Test Suite for Stage 11: Analytics Service
 * Tests for style evolution, cluster performance, and insights
 */

const analyticsService = require('../src/services/analyticsService');
const db = require('../src/services/database');
const logger = require('../src/utils/logger');

// Mock database
jest.mock('../src/services/database');
jest.mock('../src/utils/logger');

describe('Analytics Service', () => {
  const mockUserId = 'test-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserDashboard', () => {
    it('should return comprehensive dashboard data', async () => {
      // Mock all the underlying calls
      const mockStyleEvolution = {
        snapshots: [],
        currentState: {},
        trend: { direction: 'improving', strength: 0.5 },
        insights: []
      };

      const mockClusterPerf = {
        clusters: [],
        summary: {}
      };

      const mockAttrSuccess = {
        byAttribute: {},
        topPerformers: [],
        insights: []
      };

      const mockInsights = [];
      const mockRecommendations = [];

      // Mock the service methods
      jest.spyOn(analyticsService, 'getStyleEvolution').mockResolvedValue(mockStyleEvolution);
      jest.spyOn(analyticsService, 'getClusterPerformance').mockResolvedValue(mockClusterPerf);
      jest.spyOn(analyticsService, 'getAttributeSuccessRates').mockResolvedValue(mockAttrSuccess);
      jest.spyOn(analyticsService, 'getRecentInsights').mockResolvedValue(mockInsights);
      jest.spyOn(analyticsService, 'getRecommendations').mockResolvedValue(mockRecommendations);

      const result = await analyticsService.getUserDashboard(mockUserId, { days: 30 });

      expect(result).toHaveProperty('userId', mockUserId);
      expect(result).toHaveProperty('styleEvolution');
      expect(result).toHaveProperty('clusterPerformance');
      expect(result).toHaveProperty('attributeSuccess');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('generatedAt');
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(analyticsService, 'getStyleEvolution').mockRejectedValue(new Error('DB error'));

      await expect(
        analyticsService.getUserDashboard(mockUserId)
      ).rejects.toThrow('DB error');
    });
  });

  describe('getStyleEvolution', () => {
    it('should retrieve style evolution data', async () => {
      const mockData = {
        rows: [
          {
            snapshot_date: '2024-01-15',
            cluster_distribution: { cluster_1: 5, cluster_2: 3 },
            dominant_colors: { blue: 4, red: 3 },
            dominant_styles: { minimalist: 5, bohemian: 2 },
            outlier_rate: '45.00',
            avg_clip_score: '0.75',
            trend_direction: 'improving',
            trend_strength: '0.5'
          }
        ]
      };

      db.query.mockResolvedValue(mockData);

      const result = await analyticsService.getStyleEvolution(mockUserId, 30);

      expect(result).toHaveProperty('snapshots');
      expect(result).toHaveProperty('currentState');
      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('insights');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM style_evolution'),
        [mockUserId, 30]
      );
    });

    it('should generate initial snapshot if none exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No snapshots
      jest.spyOn(analyticsService, 'captureStyleSnapshot').mockResolvedValue({});
      db.query.mockResolvedValueOnce({ rows: [] }); // Recursive call returns empty

      const result = await analyticsService.getStyleEvolution(mockUserId, 30);

      expect(analyticsService.captureStyleSnapshot).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('captureStyleSnapshot', () => {
    it('should capture and store style snapshot', async () => {
      const mockGenerations = {
        rows: [
          {
            style_cluster_id: 1,
            vlt_spec: {
              colors: { primary: 'blue' },
              style: { aesthetic: 'minimalist' },
              silhouette: 'a-line',
              fabric: { type: 'cotton' }
            },
            is_outlier: true,
            clip_score: 0.75,
            user_rating: 4
          },
          {
            style_cluster_id: 1,
            vlt_spec: {
              colors: { primary: 'blue' },
              style: { aesthetic: 'minimalist' }
            },
            is_outlier: false,
            clip_score: 0.65,
            user_rating: 3
          }
        ]
      };

      db.query.mockResolvedValueOnce(mockGenerations); // Get generations
      db.query.mockResolvedValueOnce({ rows: [] }); // Insert snapshot

      const result = await analyticsService.captureStyleSnapshot(mockUserId);

      expect(result).toHaveProperty('userId', mockUserId);
      expect(result).toHaveProperty('totalGenerations', 2);
      expect(result).toHaveProperty('totalOutliers', 1);
      expect(result).toHaveProperty('outlierRate', '50.00');
    });

    it('should return null if no recent data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await analyticsService.captureStyleSnapshot(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getClusterPerformance', () => {
    it('should retrieve cluster performance data', async () => {
      const mockData = {
        rows: [
          {
            cluster_id: 1,
            cluster_name: 'minimalist',
            total_generations: 50,
            total_outliers: 30,
            outlier_rate: '60.00',
            avg_clip_score: '0.78',
            best_provider: 'imagen'
          },
          {
            cluster_id: 2,
            cluster_name: 'bohemian',
            total_generations: 30,
            total_outliers: 12,
            outlier_rate: '40.00',
            avg_clip_score: '0.72',
            best_provider: 'flux'
          }
        ]
      };

      db.query.mockResolvedValue(mockData);

      const result = await analyticsService.getClusterPerformance(mockUserId, 30);

      expect(result).toHaveProperty('clusters');
      expect(result.clusters).toHaveLength(2);
      expect(result).toHaveProperty('summary');
      expect(result.summary.bestPerforming.cluster).toBe('minimalist');
    });
  });

  describe('getAttributeSuccessRates', () => {
    it('should retrieve attribute success rates', async () => {
      const mockData = {
        rows: [
          {
            attribute_name: 'color',
            attribute_value: 'blue',
            outlier_count: 25,
            total_count: 50,
            outlier_rate: '50.00',
            avg_clip_score: '0.75',
            avg_user_rating: '4.0'
          },
          {
            attribute_name: 'style',
            attribute_value: 'minimalist',
            outlier_count: 35,
            total_count: 60,
            outlier_rate: '58.33',
            avg_clip_score: '0.78',
            avg_user_rating: '4.2'
          }
        ]
      };

      db.query.mockResolvedValue(mockData);

      const result = await analyticsService.getAttributeSuccessRates(mockUserId);

      expect(result).toHaveProperty('byAttribute');
      expect(result).toHaveProperty('topPerformers');
      expect(result).toHaveProperty('insights');
      expect(result.topPerformers).toHaveLength(2);
    });
  });

  describe('generateInsights', () => {
    it('should generate actionable insights', async () => {
      const mockStyleEvolution = {
        trend: { direction: 'improving' }
      };

      const mockClusterPerf = {
        clusters: [
          {
            cluster_name: 'minimalist',
            outlier_rate: '65.00'
          }
        ]
      };

      const mockAttrSuccess = {
        topPerformers: [
          {
            attribute: 'color',
            value: 'blue',
            outlierRate: 70
          }
        ]
      };

      jest.spyOn(analyticsService, 'getStyleEvolution').mockResolvedValue(mockStyleEvolution);
      jest.spyOn(analyticsService, 'getClusterPerformance').mockResolvedValue(mockClusterPerf);
      jest.spyOn(analyticsService, 'getAttributeSuccessRates').mockResolvedValue(mockAttrSuccess);
      jest.spyOn(analyticsService, 'storeInsight').mockResolvedValue();

      const result = await analyticsService.generateInsights(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('type');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('confidence');
    });
  });

  describe('Helper Methods', () => {
    describe('_calculateEvolutionTrend', () => {
      it('should calculate improving trend', () => {
        const snapshots = [
          { outlier_rate: '60.00' },
          { outlier_rate: '58.00' },
          { outlier_rate: '55.00' },
          { outlier_rate: '52.00' },
          { outlier_rate: '50.00' },
          { outlier_rate: '48.00' },
          { outlier_rate: '45.00' }
        ];

        const trend = analyticsService._calculateEvolutionTrend(snapshots);

        expect(trend.direction).toBe('improving');
        expect(trend.strength).toBeGreaterThan(0);
      });

      it('should return stable for insufficient data', () => {
        const snapshots = [{ outlier_rate: '50.00' }];

        const trend = analyticsService._calculateEvolutionTrend(snapshots);

        expect(trend.direction).toBe('stable');
        expect(trend.strength).toBe(0);
      });
    });

    describe('_classifyPerformance', () => {
      it('should classify excellent performance', () => {
        expect(analyticsService._classifyPerformance('65.00')).toBe('excellent');
        expect(analyticsService._classifyPerformance(70)).toBe('excellent');
      });

      it('should classify good performance', () => {
        expect(analyticsService._classifyPerformance('50.00')).toBe('good');
        expect(analyticsService._classifyPerformance(45)).toBe('good');
      });

      it('should classify average performance', () => {
        expect(analyticsService._classifyPerformance('35.00')).toBe('average');
      });

      it('should classify poor performance', () => {
        expect(analyticsService._classifyPerformance('20.00')).toBe('poor');
        expect(analyticsService._classifyPerformance(15)).toBe('poor');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete analytics workflow', async () => {
      // Mock all database calls
      db.query.mockImplementation((query) => {
        if (query.includes('style_evolution')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('cluster_performance')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('vlt_attribute_success')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('insights_cache')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('personalized_recommendations')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      jest.spyOn(analyticsService, 'captureStyleSnapshot').mockResolvedValue({});

      const dashboard = await analyticsService.getUserDashboard(mockUserId);

      expect(dashboard).toBeDefined();
      expect(dashboard.userId).toBe(mockUserId);
    });
  });
});
