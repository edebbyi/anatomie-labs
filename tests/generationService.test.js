/**
 * Test Suite for Generation Service
 * Tests for image generation pipeline, cost handling, and asset management
 */

const GenerationService = require('../src/services/generationService');
const db = require('../src/services/database');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/services/database');
jest.mock('../src/utils/logger');
jest.mock('../src/services/vltService');
jest.mock('../src/services/promptEnhancementService');
jest.mock('../src/services/IntelligentPromptBuilder');
jest.mock('../src/services/personaService');
jest.mock('../src/services/modelRoutingService');
jest.mock('../src/services/rlhfService');
jest.mock('../src/services/validationService');
jest.mock('../src/services/dppSelectionService');
jest.mock('../src/services/coverageAnalysisService');
jest.mock('../src/services/r2Storage');
jest.mock('../src/adapters/imagenAdapter');

describe('Generation Service', () => {
  let generationService;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    generationService = new GenerationService();
    
    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    db.getClient = jest.fn().mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('completeGeneration', () => {
    it('should complete generation with cost', async () => {
      // Arrange
      const generationId = 'gen-123';
      const cost = 5.75;
      const assets = [{ id: 1, url: 'https://example.com/image.png' }];
      const metadata = { provider: 'google-imagen', quality: 'high' };
      
      const mockResult = {
        rows: [{
          id: generationId,
          status: 'completed',
          cost_cents: 575,
          pipeline_data: JSON.stringify(metadata),
          updated_at: new Date().toISOString()
        }]
      };
      
      mockClient.query.mockResolvedValue(mockResult);

      // Act
      const result = await generationService.completeGeneration({
        generationId,
        assets,
        cost,
        metadata
      });

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE generations'),
        expect.arrayContaining([generationId, 575])
      );
      expect(result.status).toBe('completed');
      expect(result.assets).toEqual(assets);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle null or undefined cost', async () => {
      // Arrange
      const generationId = 'gen-456';
      const assets = [];
      const metadata = {};
      
      const mockResult = {
        rows: [{
          id: generationId,
          status: 'completed',
          cost_cents: null,
          pipeline_data: JSON.stringify(metadata)
        }]
      };
      
      mockClient.query.mockResolvedValue(mockResult);

      // Act
      const result = await generationService.completeGeneration({
        generationId,
        assets,
        cost: null,
        metadata
      });

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE generations'),
        expect.arrayContaining([generationId, null])
      );
      expect(result.status).toBe('completed');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should convert cost from dollars to cents correctly', async () => {
      // Arrange
      const generationId = 'gen-789';
      const testCases = [
        { cost: 1.0, expectedCents: 100 },
        { cost: 5.75, expectedCents: 575 },
        { cost: 0.99, expectedCents: 99 },
        { cost: 10.555, expectedCents: 1056 }, // Rounds to nearest cent
      ];

      for (const testCase of testCases) {
        mockClient.query.mockClear();
        
        const mockResult = {
          rows: [{
            id: generationId,
            status: 'completed',
            cost_cents: testCase.expectedCents
          }]
        };
        
        mockClient.query.mockResolvedValue(mockResult);

        // Act
        await generationService.completeGeneration({
          generationId,
          assets: [],
          cost: testCase.cost,
          metadata: {}
        });

        // Assert
        const callArgs = mockClient.query.mock.calls[0][1];
        expect(callArgs[1]).toBe(testCase.expectedCents);
      }
    });

    it('should release database client on error', async () => {
      // Arrange
      const generationId = 'gen-error';
      const dbError = new Error('Database connection failed');
      
      mockClient.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        generationService.completeGeneration({
          generationId,
          assets: [],
          cost: 5.0,
          metadata: {}
        })
      ).rejects.toThrow('Database connection failed');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('updateGenerationStage', () => {
    it('should update generation pipeline stage', async () => {
      // Arrange
      const generationId = 'gen-stage-123';
      const stageData = {
        stage: 'vlt_complete',
        vltSpec: { colors: ['blue', 'red'], style: 'casual' }
      };

      mockClient.query.mockResolvedValue({ rows: [] });

      // Act
      await generationService.updateGenerationStage(generationId, stageData);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_data'),
        expect.arrayContaining([generationId, JSON.stringify(stageData)])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle empty stage data', async () => {
      // Arrange
      const generationId = 'gen-stage-empty';
      const stageData = {};

      mockClient.query.mockResolvedValue({ rows: [] });

      // Act
      await generationService.updateGenerationStage(generationId, stageData);

      // Assert
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should merge pipeline data with existing data', async () => {
      // Arrange
      const generationId = 'gen-merge';
      const newStageData = { routing: { provider: 'google-imagen' } };

      mockClient.query.mockResolvedValue({ rows: [] });

      // Act
      await generationService.updateGenerationStage(generationId, newStageData);

      // Assert
      const queryCall = mockClient.query.mock.calls[0];
      expect(queryCall[0]).toContain('||'); // JSON merge operator
    });
  });

  describe('createGenerationRecord', () => {
    it('should create generation record', async () => {
      // Arrange
      const generationId = 'gen-create-123';
      const userId = 'user-456';
      const status = 'processing';
      const settings = { count: 1, provider: 'google-imagen' };

      const mockResult = {
        rows: [{
          id: generationId,
          user_id: userId,
          status,
          settings: JSON.stringify(settings),
          created_at: new Date().toISOString()
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      // Act
      const result = await generationService.createGenerationRecord({
        generationId,
        userId,
        status,
        settings
      });

      // Assert
      expect(result.id).toBe(generationId);
      expect(result.user_id).toBe(userId);
      expect(result.status).toBe(status);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO generations'),
        expect.arrayContaining([generationId, userId, status])
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle generation record creation without userId', async () => {
      // Arrange
      const generationId = 'gen-no-user';
      const status = 'pending';
      const settings = {};

      const mockResult = {
        rows: [{
          id: generationId,
          user_id: null,
          status,
          settings: JSON.stringify(settings)
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      // Act
      const result = await generationService.createGenerationRecord({
        generationId,
        userId: null,
        status,
        settings
      });

      // Assert
      expect(result.user_id).toBeNull();
      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should return created record with all fields', async () => {
      // Arrange
      const mockResult = {
        rows: [{
          id: 'gen-123',
          user_id: 'user-123',
          status: 'completed',
          settings: '{}',
          pipeline_data: '{}',
          created_at: '2025-11-03T12:00:00Z',
          updated_at: '2025-11-03T12:05:00Z'
        }]
      };

      mockClient.query.mockResolvedValue(mockResult);

      // Act
      const result = await generationService.createGenerationRecord({
        generationId: 'gen-123',
        userId: 'user-123',
        status: 'completed',
        settings: {}
      });

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('created_at');
    });
  });

  describe('failGeneration', () => {
    it('should fail generation with error message', async () => {
      // Arrange
      const generationId = 'gen-fail-123';
      const error = new Error('Generation failed due to API timeout');

      mockClient.query.mockResolvedValue({ rows: [] });

      // Act
      await generationService.failGeneration(generationId, error);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE generations'),
        expect.arrayContaining([generationId, 'Generation failed due to API timeout'])
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.anything()
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should set status to failed', async () => {
      // Arrange
      const generationId = 'gen-fail-status';
      const error = new Error('Test error');

      mockClient.query.mockResolvedValue({ rows: [] });

      // Act
      await generationService.failGeneration(generationId, error);

      // Assert
      const queryCall = mockClient.query.mock.calls[0][0];
      expect(queryCall).toContain("status = 'failed'");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle long error messages', async () => {
      // Arrange
      const generationId = 'gen-long-error';
      const longErrorMessage = 'A'.repeat(1000);
      const error = new Error(longErrorMessage);

      mockClient.query.mockResolvedValue({ rows: [] });

      // Act
      await generationService.failGeneration(generationId, error);

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([generationId, longErrorMessage])
      );
    });
  });

  describe('error handling', () => {
    it('should handle database error on generation completion', async () => {
      // Arrange
      const generationId = 'gen-db-error';
      const dbError = new Error('column "cost" of relation "generations" does not exist');
      
      mockClient.query.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        generationService.completeGeneration({
          generationId,
          assets: [],
          cost: 5.0,
          metadata: {}
        })
      ).rejects.toThrow('column "cost" of relation "generations" does not exist');
    });

    it('should always release client even on database error', async () => {
      // Arrange
      mockClient.query.mockRejectedValue(new Error('Connection timeout'));

      // Act
      try {
        await generationService.createGenerationRecord({
          generationId: 'gen-error',
          userId: 'user-error',
          status: 'pending',
          settings: {}
        });
      } catch (e) {
        // Expected to throw
      }

      // Assert
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle getClient failure', async () => {
      // Arrange
      db.getClient.mockRejectedValue(new Error('Connection pool exhausted'));

      // Act & Assert
      await expect(
        generationService.completeGeneration({
          generationId: 'gen-123',
          assets: [],
          cost: 5.0,
          metadata: {}
        })
      ).rejects.toThrow('Connection pool exhausted');
    });
  });

  describe('Helper: getAdapter', () => {
    it('should return correct adapter for provider', () => {
      // Arrange
      const providerId = 'google-imagen';

      // Act
      const adapter = generationService.getAdapter(providerId);

      // Assert
      expect(adapter).toBeDefined();
    });

    it('should return undefined for unknown provider', () => {
      // Act
      const adapter = generationService.getAdapter('unknown-provider-xyz');

      // Assert
      expect(adapter).toBeUndefined();
    });
  });

  describe('Pipeline Cost Validation', () => {
    it('should use cost_cents column only', async () => {
      // Arrange
      const generationId = 'gen-cost-validation';
      const cost = 12.99;
      const expectedCents = 1299;

      mockClient.query.mockResolvedValue({
        rows: [{
          id: generationId,
          cost_cents: expectedCents,
          status: 'completed'
        }]
      });

      // Act
      await generationService.completeGeneration({
        generationId,
        assets: [],
        cost,
        metadata: {}
      });

      // Assert
      const query = mockClient.query.mock.calls[0][0];
      expect(query).toContain('cost_cents');
      expect(query).not.toContain('cost ='); // Should not try to update 'cost' column
      expect(query).toContain('pipeline_data'); // Should use pipeline_data
    });

    it('should not reference missing cost column', async () => {
      // Arrange
      const generationId = 'gen-no-cost-col';

      mockClient.query.mockResolvedValue({
        rows: [{
          id: generationId,
          status: 'completed'
        }]
      });

      // Act
      const result = await generationService.completeGeneration({
        generationId,
        assets: [],
        cost: null,
        metadata: {}
      });

      // Assert
      const query = mockClient.query.mock.calls[0][0];
      // Ensure we're not trying to update a 'cost' column (without _cents suffix)
      const setClauses = query.match(/SET\s+([\s\S]*?)\s+WHERE/)[1];
      expect(setClauses).not.toMatch(/\bcost\s*=/);
    });
  });
});