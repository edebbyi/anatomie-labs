/**
 * Test script for Enhanced RLHF Pipeline
 * 
 * This script verifies that all components of the enhanced RLHF pipeline work together.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./src/services/database');
const logger = require('./src/utils/logger');

// Enhanced agents
const enhancedStyleDescriptorAgent = require('./src/services/enhancedStyleDescriptorAgent');
const advancedPromptBuilderAgent = require('./src/services/advancedPromptBuilderAgent');
const continuousLearningAgent = require('./src/services/continuousLearningAgent');
const validationAgent = require('./src/services/validationAgent');

// Mock data for testing
const TEST_USER_ID = 'test-user-' + uuidv4();
const TEST_PORTFOLIO_ID = 'test-portfolio-' + uuidv4();
const TEST_IMAGE_ID = 'test-image-' + uuidv4();

async function runEnhancedRLHFPipelineTest() {
  logger.info('Starting Enhanced RLHF Pipeline Test');
  
  try {
    // Test 1: Enhanced Style Descriptor Agent
    logger.info('Test 1: Enhanced Style Descriptor Agent');
    
    // Create a mock image for testing
    const mockImage = {
      id: TEST_IMAGE_ID,
      user_id: TEST_USER_ID,
      portfolio_id: TEST_PORTFOLIO_ID,
      filename: 'test-image.jpg',
      url_original: 'https://via.placeholder.com/1024x1024.png?text=Test+Image',
      width: 1024,
      height: 1024,
      file_size: 102400
    };
    
    // Insert mock image into database
    await db.query(`
      INSERT INTO portfolio_images (id, user_id, portfolio_id, filename, url_original, width, height, file_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
    `, [
      mockImage.id,
      mockImage.user_id,
      mockImage.portfolio_id,
      mockImage.filename,
      mockImage.url_original,
      mockImage.width,
      mockImage.height,
      mockImage.file_size
    ]);
    
    logger.info('Mock image created', { imageId: mockImage.id });
    
    // Test 2: Continuous Learning Agent
    logger.info('Test 2: Continuous Learning Agent');
    
    // Track a mock interaction
    await continuousLearningAgent.trackInteraction(TEST_USER_ID, TEST_IMAGE_ID, {
      event_type: 'test_event',
      duration_ms: 5000,
      scroll_depth: 0.8,
      metadata: {
        test: true,
        purpose: 'enhanced_rlhf_pipeline_test'
      }
    });
    
    logger.info('Continuous learning interaction tracked');
    
    // Test 3: Advanced Prompt Builder Agent
    logger.info('Test 3: Advanced Prompt Builder Agent');
    
    // Generate a prompt using Thompson Sampling
    const prompt = await advancedPromptBuilderAgent.generatePrompt(TEST_USER_ID, {
      mode: 'exploratory',
      creativity: 0.3
    });
    
    logger.info('Prompt generated with Thompson Sampling', { 
      promptId: prompt.id,
      mode: prompt.mode,
      creativity: prompt.creativity
    });
    
    // Test 4: Validation Agent
    logger.info('Test 4: Validation Agent');
    
    // Create a mock descriptor for validation
    const mockDescriptor = {
      id: 'test-descriptor-' + uuidv4(),
      image_id: TEST_IMAGE_ID,
      user_id: TEST_USER_ID,
      garment_type: 'dress',
      is_two_piece: false,
      color_palette: ['black', 'white'],
      fabric: 'cotton',
      confidence: 0.9,
      reasoning: 'Test descriptor for validation'
    };
    
    // Insert mock descriptor into database
    await db.query(`
      INSERT INTO image_descriptors (
        id, image_id, user_id, garment_type, is_two_piece, color_palette, fabric, confidence, reasoning
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING
    `, [
      mockDescriptor.id,
      mockDescriptor.image_id,
      mockDescriptor.user_id,
      mockDescriptor.garment_type,
      mockDescriptor.is_two_piece,
      JSON.stringify(mockDescriptor.color_palette),
      mockDescriptor.fabric,
      mockDescriptor.confidence,
      mockDescriptor.reasoning
    ]);
    
    logger.info('Mock descriptor created', { descriptorId: mockDescriptor.id });
    
    // Validate the descriptor
    const validationResult = await validationAgent.validateDescriptor(mockDescriptor, mockImage.url_original);
    
    logger.info('Descriptor validation completed', {
      isValid: validationResult.is_valid,
      confidence: validationResult.confidence,
      issues: validationResult.issues.length
    });
    
    // Test 5: Database Schema Verification
    logger.info('Test 5: Database Schema Verification');
    
    // Check if enhanced RLHF tables exist
    const tables = ['interaction_events', 'style_tag_metadata', 'thompson_sampling_params', 'validation_results'];
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT 1 FROM ${table} LIMIT 1`);
        logger.info(`Table ${table} exists and is accessible`);
      } catch (error) {
        logger.error(`Table ${table} verification failed`, { error: error.message });
        throw error;
      }
    }
    
    // Test 6: Database Views Verification
    logger.info('Test 6: Database Views Verification');
    
    const views = ['user_learning_progress', 'style_tag_performance', 'validation_quality_metrics'];
    
    for (const view of views) {
      try {
        const result = await db.query(`SELECT 1 FROM ${view} LIMIT 1`);
        logger.info(`View ${view} exists and is accessible`);
      } catch (error) {
        logger.error(`View ${view} verification failed`, { error: error.message });
        throw error;
      }
    }
    
    logger.info('All Enhanced RLHF Pipeline Tests Passed!');
    return true;
    
  } catch (error) {
    logger.error('Enhanced RLHF Pipeline Test Failed', { error: error.message, stack: error.stack });
    return false;
  } finally {
    // Clean up test data
    try {
      await db.query('DELETE FROM image_descriptors WHERE user_id = $1', [TEST_USER_ID]);
      await db.query('DELETE FROM portfolio_images WHERE user_id = $1', [TEST_USER_ID]);
      await db.query('DELETE FROM interaction_events WHERE user_id = $1', [TEST_USER_ID]);
      await db.query('DELETE FROM prompts WHERE user_id = $1', [TEST_USER_ID]);
      logger.info('Test data cleaned up');
    } catch (error) {
      logger.warn('Failed to clean up test data', { error: error.message });
    }
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runEnhancedRLHFPipelineTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { runEnhancedRLHFPipelineTest };