/**
 * Test Suite for Stage 11: Analytics Insights Service
 * Tests for insights generation and personalized recommendations
 */

const analyticsInsightsService = require('../src/services/analyticsInsightsService');
const db = require('../src/services/database');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/services/database');
jest.mock('../src/utils/logger');

describe('Analytics Insights Service', () => {
  const mockUserId = 'test-user-456';
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    db.getClient = jest.fn().mockResolvedValue(mockClient);
  });

  describe('getUserInsightsDashboard', () => {
    it('should return complete insights dashboard', async () => {
      // Mock all underlying method calls
      jest.spyOn(analyticsInsightsService, 'getStyleEvolution').mockResolvedValue({
        weeklyData: [],
        attributeTrends: {},
        preferenceShifts: []
      });

      jest.spyOn(analyticsInsightsService, 'getClusterPerformance').mockResolvedValue({
        profiles: [],
        bestProfile: null,
        globalAverages: {}
      });

      jest.spyOn(analyticsInsightsService, 'getAttributeSuccessRates').mockResolvedValue({
        topPerformers: [],
        byAttribute: {},
        insights: []
      });

      jest.spyOn(analyticsInsightsService, 'getPersonalizedRecommendations').mockResolvedValue([]);

      const result = await analyticsInsightsService.getUserInsightsDashboard(mockUserId);

      expect(result).toHaveProperty('userId', mockUserId);
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('styleEvolution');
      expect(result).toHaveProperty('clusterPerformance');
      expect(result).toHaveProperty('attributeSuccess');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(analyticsInsightsService, 'getStyleEvolution')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        analyticsInsightsService.getUserInsightsDashboard(mockUserId)
      ).rejects.toThrow('Database error');
    });
  });

  describe('getStyleEvolution', () => {
    it('should retrieve and analyze style evolution', async () => {
      const mockFeedbackData = {
        rows: [
          {
            week: '2024-01-01',
            vlt_attributes: {
              color: 'blue',
              style: 'minimalist'
            },
            total_feedback: '10',
            outlier_count: '6',
            avg_rating: '4.2'
          },
          {
            week: '2024-01-08',
            vlt_attributes: {
              color: 'red',
              style: 'bohemian'
            },
            total_feedback: '8',
            outlier_count: '5',
            avg_rating: '4.0'
          }
        ]
      };

      mockClient.query.mockResolvedValue(mockFeedbackData);

      const result = await analyticsInsightsService.getStyleEvolution(mockUserId);

      expect(result).toHaveProperty('weeklyData');
      expect(result).toHaveProperty('attributeTrends');
      expect(result).toHaveProperty('preferenceShifts');
      expect(result).toHaveProperty('timeRange', '90 days');
      expect(result.weeklyData).toHaveLength(2);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getClusterPerformance', () => {
    it('should retrieve cluster performance with global comparison', async () => {
      const mockProfileData = {
        rows: [
          {
            style_profile: 'minimalist',
            total_generations: '50',
            outlier_count: '30',
            outlier_rate: '60.0',
            avg_clip_score: '0.78',
            avg_user_rating: '4.2',
            top_attributes: { color: 'blue' }
          }
        ]
      };

      const mockGlobalData = {
        rows: [
          {
            style_profile: 'minimalist',
            global_avg_rate: '55.0'
          }
        ]
      };

      mockClient.query
        .mockResolvedValueOnce(mockProfileData)
        .mockResolvedValueOnce(mockGlobalData);

      const result = await analyticsInsightsService.getClusterPerformance(mockUserId);

      expect(result).toHaveProperty('profiles');
      expect(result).toHaveProperty('bestProfile');
      expect(result).toHaveProperty('globalAverages');
      expect(result.profiles[0]).toHaveProperty('performance');
      expect(result.profiles[0]).toHaveProperty('vsGlobalAverage');
      expect(result.profiles[0].performsAboveAverage).toBe(true);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getAttributeSuccessRates', () => {
    it('should retrieve and group attribute success rates', async () => {
      const mockAttributeData = {
        rows: [
          {
            attribute_name: 'color',
            attribute_value: 'blue',
            total_occurrences: '20',
            outlier_count: '14',
            outlier_rate: '70.0',
            avg_clip_score: '0.80',
            avg_user_rating: '4.5'
          },
          {
            attribute_name: 'style',
            attribute_value: 'minimalist',
            total_occurrences: '25',
            outlier_count: '15',
            outlier_rate: '60.0',
            avg_clip_score: '0.75',
            avg_user_rating: '4.2'
          }
        ]
      };

      mockClient.query.mockResolvedValue(mockAttributeData);

      const result = await analyticsInsightsService.getAttributeSuccessRates(mockUserId);

      expect(result).toHaveProperty('topPerformers');
      expect(result).toHaveProperty('byAttribute');
      expect(result).toHaveProperty('insights');
      expect(result.topPerformers).toHaveLength(2);
      expect(result.byAttribute).toHaveProperty('color');
      expect(result.byAttribute).toHaveProperty('style');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getPersonalizedRecommendations', () => {
    it('should generate try_new recommendations', async () => {
      const mockUntriedAttributes = {
        rows: [
          {
            attribute_name: 'color',
            attribute_value: 'emerald',
            outlier_rate: '65.0'
          }
        ]
      };

      mockClient.query
        .mockResolvedValueOnce(mockUntriedAttributes) // Untried attributes
        .mockResolvedValueOnce({ rows: [] }) // Underperforming
        .mockResolvedValueOnce({ rows: [] }); // Successful

      const result = await analyticsInsightsService.getPersonalizedRecommendations(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('type', 'try_new');
      expect(result[0]).toHaveProperty('priority', 'high');
      expect(result[0]).toHaveProperty('message');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should generate improve_style recommendations', async () => {
      const mockUnderperforming = {
        rows: [
          {
            vlt_attributes: { style: 'bohemian' },
            success_rate: 25.0
          }
        ]
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Untried
        .mockResolvedValueOnce(mockUnderperforming) // Underperforming
        .mockResolvedValueOnce({ rows: [] }); // Successful

      const result = await analyticsInsightsService.getPersonalizedRecommendations(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('type', 'improve_style');
      expect(result[0]).toHaveProperty('priority', 'medium');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should generate double_down recommendations', async () => {
      const mockSuccessful = {
        rows: [
          {
            attr_key: 'color',
            attr_value: 'blue',
            usage_count: '5',
            success_rate: 75.0
          }
        ]
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Untried
        .mockResolvedValueOnce({ rows: [] }) // Underperforming
        .mockResolvedValueOnce(mockSuccessful); // Successful

      const result = await analyticsInsightsService.getPersonalizedRecommendations(mockUserId);

      expect(result).toBeInstanceOf(Array);
      expect(result[0]).toHaveProperty('type', 'double_down');
      expect(result[0]).toHaveProperty('priority', 'high');
      expect(result[0]).toHaveProperty('successRate');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockClient.query.mockRejectedValue(new Error('DB error'));

      const result = await analyticsInsightsService.getPersonalizedRecommendations(mockUserId);

      expect(result).toEqual([]);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    describe('identifyPreferenceShifts', () => {
      it('should identify improving trend', () => {
        const weeklyData = [
          { outlierRate: '40' },
          { outlierRate: '42' },
          { outlierRate: '45' },
          { outlierRate: '48' },
          { outlierRate: '52' },
          { outlierRate: '55' },
          { outlierRate: '58' },
          { outlierRate: '60' }
        ];

        const shifts = analyticsInsightsService.identifyPreferenceShifts(weeklyData, {});

        expect(shifts).toBeInstanceOf(Array);
        expect(shifts.length).toBeGreaterThan(0);
        expect(shifts[0]).toHaveProperty('type', 'improving');
        expect(shifts[0]).toHaveProperty('message');
      });

      it('should identify declining trend', () => {
        const weeklyData = [
          { outlierRate: '60' },
          { outlierRate: '58' },
          { outlierRate: '55' },
          { outlierRate: '52' },
          { outlierRate: '48' },
          { outlierRate: '45' },
          { outlierRate: '42' },
          { outlierRate: '40' }
        ];

        const shifts = analyticsInsightsService.identifyPreferenceShifts(weeklyData, {});

        expect(shifts).toBeInstanceOf(Array);
        expect(shifts[0]).toHaveProperty('type', 'declining');
      });

      it('should return empty for insufficient data', () => {
        const weeklyData = [
          { outlierRate: '50' },
          { outlierRate: '51' }
        ];

        const shifts = analyticsInsightsService.identifyPreferenceShifts(weeklyData, {});

        expect(shifts).toEqual([]);
      });
    });

    describe('classifyPerformance', () => {
      it('should classify performance levels correctly', () => {
        expect(analyticsInsightsService.classifyPerformance(70)).toBe('excellent');
        expect(analyticsInsightsService.classifyPerformance(50)).toBe('good');
        expect(analyticsInsightsService.classifyPerformance(30)).toBe('fair');
        expect(analyticsInsightsService.classifyPerformance(15)).toBe('needs_improvement');
      });
    });

    describe('generateAttributeRecommendation', () => {
      it('should generate appropriate recommendations', () => {
        const highRec = analyticsInsightsService.generateAttributeRecommendation(
          'color', 'blue', 75
        );
        expect(highRec).toContain('Highly recommended');

        const moderateRec = analyticsInsightsService.generateAttributeRecommendation(
          'style', 'minimalist', 55
        );
        expect(moderateRec).toContain('Consider using');

        const cautionRec = analyticsInsightsService.generateAttributeRecommendation(
          'fabric', 'silk', 25
        );
        expect(cautionRec).toContain('Use cautiously');
      });
    });

    describe('generateAttributeInsights', () => {
      it('should generate insights from attribute data', () => {
        const attributes = [
          {
            attribute: 'color',
            value: 'blue',
            outlierRate: 75,
            totalOccurrences: 30
          },
          {
            attribute: 'style',
            value: 'vintage',
            outlierRate: 25,
            totalOccurrences: 25
          }
        ];

        const insights = analyticsInsightsService.generateAttributeInsights(attributes);

        expect(insights).toBeInstanceOf(Array);
        expect(insights.length).toBeGreaterThan(0);
        expect(insights[0]).toHaveProperty('type');
        expect(insights[0]).toHaveProperty('message');
      });
    });

    describe('calculateOverallHealth', () => {
      it('should calculate health score', () => {
        const data = {
          clusterPerformance: {
            bestProfile: { outlierRate: '65.0' }
          },
          styleEvolution: {
            preferenceShifts: [{ type: 'improving' }]
          }
        };

        const health = analyticsInsightsService.calculateOverallHealth(data);

        expect(health).toHaveProperty('score');
        expect(health).toHaveProperty('rating');
        expect(parseInt(health.score)).toBeGreaterThanOrEqual(0);
        expect(parseInt(health.score)).toBeLessThanOrEqual(100);
      });
    });

    describe('generateInsightsSummary', () => {
      it('should generate comprehensive summary', () => {
        const data = {
          styleEvolution: {
            preferenceShifts: [
              {
                type: 'improving',
                message: 'Your style is improving'
              }
            ]
          },
          clusterPerformance: {
            bestProfile: {
              styleProfile: 'minimalist',
              outlierRate: '65.0'
            }
          },
          attributeSuccess: {
            insights: [
              {
                type: 'top_performer',
                message: 'Blue performs great',
                importance: 'high'
              }
            ]
          }
        };

        const summary = analyticsInsightsService.generateInsightsSummary(data);

        expect(summary).toHaveProperty('insights');
        expect(summary).toHaveProperty('overallHealth');
        expect(summary).toHaveProperty('actionableItems');
        expect(summary.insights).toBeInstanceOf(Array);
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      analyticsInsightsService.clearCache();
      // Just verify it doesn't throw
      expect(logger.info).toHaveBeenCalledWith('Insights cache cleared');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow', async () => {
      // Mock all database queries
      mockClient.query.mockImplementation((query) => {
        if (query.includes('user_feedback')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('style_profile_success')) {
          return Promise.resolve({ rows: [] });
        }
        if (query.includes('vlt_attribute_success')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const dashboard = await analyticsInsightsService.getUserInsightsDashboard(mockUserId);

      expect(dashboard).toBeDefined();
      expect(dashboard.userId).toBe(mockUserId);
      expect(dashboard.summary).toBeDefined();
    });
  });
});
