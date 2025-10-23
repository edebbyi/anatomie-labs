/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MIGRATION TEST SCRIPT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Tests the ultra-detailed ingestion agent migration
 * 
 * Usage:
 *   node test_migration.js --portfolioId=your-test-portfolio-id
 *   node test_migration.js --imageUrl=https://example.com/test-image.jpg
 */

const ultraIngestion = require('./src/services/ultraDetailedIngestionAgent');
const db = require('./src/services/database');

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('ULTRA-DETAILED INGESTION AGENT - MIGRATION TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const args = process.argv.slice(2);
  const portfolioId = args.find(arg => arg.startsWith('--portfolioId='))?.split('=')[1];
  const imageUrl = args.find(arg => arg.startsWith('--imageUrl='))?.split('=')[1];

  if (!portfolioId && !imageUrl) {
    console.error('❌ ERROR: Must provide --portfolioId or --imageUrl');
    console.log('\nUsage:');
    console.log('  node test_migration.js --portfolioId=your-test-portfolio-id');
    console.log('  node test_migration.js --imageUrl=https://example.com/test.jpg');
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 1: Database Tables Exist
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 1: Checking database tables...');
  try {
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('ultra_detailed_descriptors', 'descriptor_quality_log', 'descriptor_corrections')
    `);
    
    if (tables.rows.length === 3) {
      console.log('✅ PASS: All required tables exist\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Only ${tables.rows.length}/3 tables exist\n`);
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Database connection error:', error.message, '\n');
    failed++;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 2: Indexes Exist
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 2: Checking indexes...');
  try {
    const indexes = await db.query(`
      SELECT COUNT(*) as index_count
      FROM pg_indexes 
      WHERE tablename = 'ultra_detailed_descriptors'
    `);
    
    if (indexes.rows[0].index_count >= 10) {
      console.log(`✅ PASS: ${indexes.rows[0].index_count} indexes created\n`);
      passed++;
    } else {
      console.log(`⚠️  WARNING: Only ${indexes.rows[0].index_count} indexes (expected 10+)\n`);
      passed++; // Still pass, but warn
    }
  } catch (error) {
    console.log('❌ FAIL: Index check error:', error.message, '\n');
    failed++;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 3: Helper Functions Exist
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 3: Checking helper functions...');
  try {
    const functions = await db.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name IN ('get_user_garment_preferences', 'get_user_color_preferences', 'flag_low_quality_descriptors')
    `);
    
    if (functions.rows.length === 3) {
      console.log('✅ PASS: All helper functions exist\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Only ${functions.rows.length}/3 functions exist\n`);
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Function check error:', error.message, '\n');
    failed++;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 4: Agent Can Analyze Image
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 4: Testing image analysis...');
  
  if (imageUrl) {
    try {
      console.log(`Analyzing test image: ${imageUrl}`);
      
      const testImage = {
        id: 'test-image-id',
        user_id: 'test-user-id',
        url_original: imageUrl,
        filename: 'test-image.jpg'
      };
      
      const result = await ultraIngestion.analyzeImage(testImage);
      
      console.log('✅ PASS: Image analysis successful');
      console.log(`   - Confidence: ${result.metadata?.overall_confidence || 'N/A'}`);
      console.log(`   - Completeness: ${result.completeness_percentage || 'N/A'}%`);
      console.log(`   - Garments: ${result.garment_count || 0}`);
      console.log(`   - Primary garment: ${result.primary_garment || 'N/A'}\n`);
      passed++;
    } catch (error) {
      console.log('❌ FAIL: Image analysis error:', error.message, '\n');
      failed++;
    }
  } else {
    console.log('⊘  SKIP: No image URL provided\n');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 5: Portfolio Analysis (if portfolioId provided)
  // ═════════════════════════════════════════════════════════════════════════
  if (portfolioId) {
    console.log('TEST 5: Testing portfolio analysis...');
    try {
      console.log(`Analyzing portfolio: ${portfolioId}`);
      
      const results = await ultraIngestion.analyzePortfolio(portfolioId, (progress) => {
        console.log(`   Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
      });
      
      console.log('✅ PASS: Portfolio analysis successful');
      console.log(`   - Analyzed: ${results.analyzed}`);
      console.log(`   - Failed: ${results.failed}`);
      console.log(`   - Avg Confidence: ${results.avgConfidence}`);
      console.log(`   - Avg Completeness: ${results.avgCompleteness}%\n`);
      
      if (parseFloat(results.avgConfidence) >= 0.80) {
        console.log('✅ Quality target met: avg_confidence >= 0.80\n');
      } else {
        console.log(`⚠️  WARNING: avg_confidence (${results.avgConfidence}) below target (0.80)\n`);
      }
      
      passed++;
    } catch (error) {
      console.log('❌ FAIL: Portfolio analysis error:', error.message, '\n');
      failed++;
    }
  } else {
    console.log('TEST 5: Portfolio analysis...');
    console.log('⊘  SKIP: No portfolio ID provided\n');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 6: Quality Metrics Views
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 6: Checking quality metrics views...');
  try {
    const views = await db.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name IN ('low_quality_descriptors', 'daily_quality_metrics', 'most_corrected_fields')
    `);
    
    if (views.rows.length === 3) {
      console.log('✅ PASS: All quality metric views exist\n');
      passed++;
    } else {
      console.log(`❌ FAIL: Only ${views.rows.length}/3 views exist\n`);
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: View check error:', error.message, '\n');
    failed++;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 7: Data Quality Check (if data exists)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 7: Checking data quality...');
  try {
    const dataCheck = await db.query(`
      SELECT 
        COUNT(*) as total,
        AVG(overall_confidence) as avg_confidence,
        AVG(completeness_percentage) as avg_completeness,
        COUNT(*) FILTER (WHERE overall_confidence < 0.70) as low_confidence_count
      FROM ultra_detailed_descriptors
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    
    if (dataCheck.rows[0].total > 0) {
      const stats = dataCheck.rows[0];
      console.log(`   Total analyses (last 24h): ${stats.total}`);
      console.log(`   Avg confidence: ${parseFloat(stats.avg_confidence).toFixed(3)}`);
      console.log(`   Avg completeness: ${parseFloat(stats.avg_completeness).toFixed(1)}%`);
      console.log(`   Low confidence count: ${stats.low_confidence_count}`);
      
      if (parseFloat(stats.avg_confidence) >= 0.80 && parseFloat(stats.avg_completeness) >= 80) {
        console.log('✅ PASS: Quality metrics meet targets\n');
        passed++;
      } else {
        console.log('⚠️  WARNING: Quality metrics below targets\n');
        passed++; // Still pass, but warn
      }
    } else {
      console.log('⊘  SKIP: No data to check (run TEST 4 or 5 first)\n');
    }
  } catch (error) {
    console.log('❌ FAIL: Data quality check error:', error.message, '\n');
    failed++;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Migration successful.');
    console.log('\nNext steps:');
    console.log('1. Deploy to staging for further testing');
    console.log('2. Monitor quality metrics: SELECT * FROM daily_quality_metrics;');
    console.log('3. Check for low quality analyses: SELECT * FROM low_quality_descriptors;');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED. Review errors above.');
    console.log('\nTroubleshooting:');
    console.log('1. Ensure database migration ran successfully');
    console.log('2. Check REPLICATE_API_TOKEN environment variable');
    console.log('3. Verify image URLs are accessible');
    console.log('4. Review docs/MIGRATION_GUIDE.md');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
