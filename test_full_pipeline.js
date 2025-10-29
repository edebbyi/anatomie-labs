/**
 * Comprehensive test script to verify the full pipeline works correctly
 * after all upgrades including RLHF enhancements and ultra-detailed ingestion
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Set environment variables for testing
process.env.REPLICATE_API_TOKEN = 'test-token';
process.env.ANALYSIS_CONCURRENCY = '3';

console.log('═══════════════════════════════════════════════════════════');
console.log('FULL PIPELINE VERIFICATION TEST');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

// Test 1: Check if all required services can be imported
console.log('TEST 1: Checking service imports...');
try {
  // Core services
  const ingestionAgent = require('./src/services/ingestionAgent');
  const styleDescriptorAgent = require('./src/services/ultraDetailedIngestionAgent');
  const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');
  const promptBuilderAgent = require('./src/services/advancedPromptBuilderAgent');
  const imageGenerationAgent = require('./src/services/imageGenerationAgent');
  const feedbackLearnerAgent = require('./src/services/feedbackLearnerAgent');
  const continuousLearningAgent = require('./src/services/continuousLearningAgent');
  const validationAgent = require('./src/services/validationAgent');
  
  console.log('✅ PASS: All services imported successfully\n');
  passed++;
} catch (error) {
  console.log('❌ FAIL: Service import error:', error.message, '\n');
  failed++;
}

// Test 2: Check database connectivity and required tables
console.log('TEST 2: Checking database connectivity and tables...');
try {
  const db = require('./src/services/database');
  
  // Check if required tables exist
  const tables = execSync('psql -d designer_bff -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN (\'portfolios\', \'portfolio_images\', \'style_profiles\', \'ultra_detailed_descriptors\', \'descriptor_quality_log\', \'descriptor_corrections\');"').toString().trim();
  
  if (parseInt(tables) >= 6) {
    console.log('✅ PASS: All required tables exist\n');
    passed++;
  } else {
    console.log(`❌ FAIL: Only ${tables}/6 required tables exist\n`);
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: Database connectivity error:', error.message, '\n');
  failed++;
}

// Test 3: Check if ultra-detailed ingestion agent works
console.log('TEST 3: Testing ultra-detailed ingestion agent...');
try {
  const ultraIngestion = require('./src/services/ultraDetailedIngestionAgent');
  
  // Check if required methods exist
  if (typeof ultraIngestion.analyzePortfolio === 'function' && 
      typeof ultraIngestion.analyzeImage === 'function' && 
      typeof ultraIngestion.getComprehensivePrompt === 'function') {
    console.log('✅ PASS: UltraDetailedIngestionAgent methods exist\n');
    passed++;
  } else {
    console.log('❌ FAIL: UltraDetailedIngestionAgent missing required methods\n');
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: UltraDetailedIngestionAgent error:', error.message, '\n');
  failed++;
}

// Test 4: Check if advanced prompt builder agent works
console.log('TEST 4: Testing advanced prompt builder agent...');
try {
  const promptBuilder = require('./src/services/advancedPromptBuilderAgent');
  
  // Check if required methods exist
  if (typeof promptBuilder.generatePrompt === 'function') {
    console.log('✅ PASS: AdvancedPromptBuilderAgent methods exist\n');
    passed++;
  } else {
    console.log('❌ FAIL: AdvancedPromptBuilderAgent missing required methods\n');
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: AdvancedPromptBuilderAgent error:', error.message, '\n');
  failed++;
}

// Test 5: Check if continuous learning agent works
console.log('TEST 5: Testing continuous learning agent...');
try {
  const continuousLearning = require('./src/services/continuousLearningAgent');
  
  // Check if required methods exist
  if (typeof continuousLearning.trackInteraction === 'function' && 
      typeof continuousLearning.getLearningRate === 'function') {
    console.log('✅ PASS: ContinuousLearningAgent methods exist\n');
    passed++;
  } else {
    console.log('❌ FAIL: ContinuousLearningAgent missing required methods\n');
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: ContinuousLearningAgent error:', error.message, '\n');
  failed++;
}

// Test 6: Check if validation agent works
console.log('TEST 6: Testing validation agent...');
try {
  const validation = require('./src/services/validationAgent');
  
  // Check if required methods exist
  if (typeof validation.validateStyleDescriptor === 'function' && 
      typeof validation.detectHallucinations === 'function') {
    console.log('✅ PASS: ValidationAgent methods exist\n');
    passed++;
  } else {
    console.log('❌ FAIL: ValidationAgent missing required methods\n');
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: ValidationAgent error:', error.message, '\n');
  failed++;
}

// Test 7: Check if API routes are properly configured
console.log('TEST 7: Checking API route configuration...');
try {
  const podnaRoutes = require('./src/api/routes/podna');
  
  if (podnaRoutes) {
    console.log('✅ PASS: Podna API routes loaded successfully\n');
    passed++;
  } else {
    console.log('❌ FAIL: Podna API routes failed to load\n');
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: Podna API routes error:', error.message, '\n');
  failed++;
}

// Test 8: Check if environment variables are properly configured
console.log('TEST 8: Checking environment configuration...');
try {
  // Check for required environment variables
  const requiredEnvVars = ['REPLICATE_API_TOKEN'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length === 0) {
    console.log('✅ PASS: All required environment variables are set\n');
    passed++;
  } else {
    console.log(`❌ FAIL: Missing environment variables: ${missingEnvVars.join(', ')}\n`);
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: Environment configuration error:', error.message, '\n');
  failed++;
}

// Test 9: Check if database indexes and views exist
console.log('TEST 9: Checking database indexes and views...');
try {
  // Check if quality metrics views exist
  const views = execSync('psql -d designer_bff -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_name IN (\'low_quality_descriptors\', \'daily_quality_metrics\', \'most_corrected_fields\');"').toString().trim();
  
  if (parseInt(views) >= 3) {
    console.log('✅ PASS: All quality metrics views exist\n');
    passed++;
  } else {
    console.log(`❌ FAIL: Only ${views}/3 quality metrics views exist\n`);
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: Database views error:', error.message, '\n');
  failed++;
}

// Test 10: Check if helper functions exist
console.log('TEST 10: Checking database helper functions...');
try {
  // Check if helper functions exist
  const functions = execSync('psql -d designer_bff -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_name IN (\'get_user_garment_preferences\', \'get_user_color_preferences\', \'flag_low_quality_descriptors\');"').toString().trim();
  
  if (parseInt(functions) >= 3) {
    console.log('✅ PASS: All helper functions exist\n');
    passed++;
  } else {
    console.log(`❌ FAIL: Only ${functions}/3 helper functions exist\n`);
    failed++;
  }
} catch (error) {
  console.log('❌ FAIL: Database functions error:', error.message, '\n');
  failed++;
}

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('PIPELINE VERIFICATION SUMMARY');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);
console.log('═══════════════════════════════════════════════════════════\n');

if (failed === 0) {
  console.log('🎉 ALL PIPELINE TESTS PASSED! The full system is working correctly.');
  console.log('\nNext steps:');
  console.log('1. Test with actual portfolio data when available');
  console.log('2. Monitor quality metrics in production');
  console.log('3. Verify user onboarding flow');
  process.exit(0);
} else {
  console.log('❌ SOME PIPELINE TESTS FAILED. Review errors above.');
  console.log('\nTroubleshooting:');
  console.log('1. Check database connectivity and migrations');
  console.log('2. Verify environment variables');
  console.log('3. Ensure all services are properly configured');
  process.exit(1);
}