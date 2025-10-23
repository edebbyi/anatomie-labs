/**
 * Quick test script to verify the ultra-detailed ingestion agent upgrade
 */

const ultraIngestion = require('./src/services/ultraDetailedIngestionAgent');
const db = require('./src/services/database');

async function runQuickTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('ULTRA-DETAILED INGESTION AGENT - QUICK TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Test 1: Database Tables Exist
    console.log('TEST 1: Checking database tables...');
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('ultra_detailed_descriptors', 'descriptor_quality_log', 'descriptor_corrections')
    `);
    
    if (tables.rows.length === 3) {
      console.log('✅ PASS: All required tables exist\n');
    } else {
      console.log(`❌ FAIL: Only ${tables.rows.length}/3 tables exist\n`);
      process.exit(1);
    }

    // Test 2: Indexes Exist
    console.log('TEST 2: Checking indexes...');
    const indexes = await db.query(`
      SELECT COUNT(*) as index_count
      FROM pg_indexes 
      WHERE tablename = 'ultra_detailed_descriptors'
    `);
    
    if (indexes.rows[0].index_count >= 10) {
      console.log(`✅ PASS: ${indexes.rows[0].index_count} indexes created\n`);
    } else {
      console.log(`⚠️  WARNING: Only ${indexes.rows[0].index_count} indexes (expected 10+)\n`);
    }

    // Test 3: Helper Functions Exist
    console.log('TEST 3: Checking helper functions...');
    const functions = await db.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name IN ('get_user_garment_preferences', 'get_user_color_preferences', 'flag_low_quality_descriptors')
    `);
    
    if (functions.rows.length === 3) {
      console.log('✅ PASS: All helper functions exist\n');
    } else {
      console.log(`❌ FAIL: Only ${functions.rows.length}/3 functions exist\n`);
      process.exit(1);
    }

    // Test 4: Quality Metrics Views
    console.log('TEST 4: Checking quality metrics views...');
    const views = await db.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name IN ('low_quality_descriptors', 'daily_quality_metrics', 'most_corrected_fields')
    `);
    
    if (views.rows.length === 3) {
      console.log('✅ PASS: All quality metric views exist\n');
    } else {
      console.log(`❌ FAIL: Only ${views.rows.length}/3 views exist\n`);
      process.exit(1);
    }

    // Test 5: Agent Instantiation
    console.log('TEST 5: Testing agent instantiation...');
    if (ultraIngestion) {
      console.log('✅ PASS: UltraDetailedIngestionAgent instantiated successfully\n');
    } else {
      console.log('❌ FAIL: Could not instantiate UltraDetailedIngestionAgent\n');
      process.exit(1);
    }

    // Test 6: Agent Methods Exist
    console.log('TEST 6: Testing agent methods...');
    if (typeof ultraIngestion.analyzePortfolio === 'function' && typeof ultraIngestion.analyzeImage === 'function') {
      console.log('✅ PASS: Required methods exist\n');
    } else {
      console.log('❌ FAIL: Required methods missing\n');
      process.exit(1);
    }

    console.log('🎉 ALL QUICK TESTS PASSED! Upgrade appears to be working correctly.');
    console.log('\nNext steps:');
    console.log('1. Add images to a portfolio for full testing');
    console.log('2. Run the full migration test with --portfolioId when images are available');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run quick test
runQuickTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});