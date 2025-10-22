/**
 * Stage 8: Quality Control (VLT Validation) Test
 * 
 * Tests the validation service with real generation data
 */

require('dotenv').config();
const validationService = require('../src/services/validationService');
const generationService = require('../src/services/generationService');
const db = require('../src/utils/db');
const logger = require('../src/utils/logger');

/**
 * Test validation against a recent generation
 */
async function testValidationOnGeneration() {
  console.log('\n========================================');
  console.log('Stage 8: Validation Service Test');
  console.log('========================================\n');

  const client = await db.getClient();

  try {
    // 1. Find a recent completed generation
    console.log('1. Finding recent generation...');
    const genResult = await client.query(`
      SELECT 
        g.id,
        g.pipeline_data,
        ga.id as asset_id,
        ga.cdn_url,
        ga.provider_id
      FROM generations g
      JOIN generation_assets ga ON g.id = ga.generation_id
      WHERE g.status = 'completed'
      ORDER BY g.created_at DESC
      LIMIT 1
    `);

    if (genResult.rows.length === 0) {
      console.log('❌ No completed generations found. Run Stage 6 test first.');
      return;
    }

    const generation = genResult.rows[0];
    console.log('✅ Found generation:', generation.id);
    console.log('   Asset ID:', generation.asset_id);
    console.log('   Provider:', generation.provider_id);
    console.log('   CDN URL:', generation.cdn_url);

    // Extract VLT spec from pipeline data
    const pipelineData = typeof generation.pipeline_data === 'string' 
      ? JSON.parse(generation.pipeline_data) 
      : generation.pipeline_data;
    
    const targetSpec = pipelineData?.vltSpec || pipelineData?.vlt_complete?.vltSpec;

    console.log('\n2. Target VLT Spec:');
    if (targetSpec) {
      console.log('   Attributes:', Object.keys(targetSpec.attributes || {}).length);
      console.log('   Style:', targetSpec.style?.overall || 'N/A');
    } else {
      console.log('   ⚠️  No VLT spec found in pipeline data');
    }

    // 2. Run validation
    console.log('\n3. Running validation...');
    const startTime = Date.now();
    
    const validationResult = await validationService.validateGeneration(
      generation.id,
      generation.asset_id,
      targetSpec
    );

    const duration = Date.now() - startTime;

    // 3. Display results
    console.log('\n✅ Validation completed in', duration, 'ms');
    console.log('\n========================================');
    console.log('VALIDATION RESULTS');
    console.log('========================================\n');

    console.log('Overall Score:      ', validationResult.overallScore.toFixed(2), '/100');
    console.log('Consistency Score:  ', validationResult.consistencyScore.toFixed(2), '/100');
    console.log('Style Score:        ', validationResult.styleScore.toFixed(2), '/100');
    console.log('Is Outlier:         ', validationResult.isOutlier ? '⚠️  YES' : '✅ NO');
    console.log('Outlier Score:      ', validationResult.outlierScore.toFixed(4));
    console.log('Is Flagged:         ', validationResult.isFlagged ? '⚠️  YES' : '✅ NO');
    console.log('Is Rejected:        ', validationResult.isRejected ? '❌ YES' : '✅ NO');

    if (validationResult.rejectionReason) {
      console.log('Rejection Reason:   ', validationResult.rejectionReason);
    }

    // Attribute comparisons
    if (validationResult.attributeComparisons && validationResult.attributeComparisons.length > 0) {
      console.log('\n----------------------------------------');
      console.log('ATTRIBUTE COMPARISONS');
      console.log('----------------------------------------\n');

      const matched = validationResult.attributeComparisons.filter(a => a.isMatch);
      const mismatched = validationResult.attributeComparisons.filter(a => !a.isMatch);

      console.log(`Matched: ${matched.length}/${validationResult.attributeComparisons.length}`);
      console.log(`Mismatched: ${mismatched.length}/${validationResult.attributeComparisons.length}`);

      // Show top matches
      console.log('\nTop Matches:');
      matched
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 5)
        .forEach(attr => {
          console.log(`  ✅ ${attr.attributeName}: ${attr.targetValue} → ${attr.detectedValue}`);
          console.log(`     Similarity: ${attr.similarityScore.toFixed(2)}, Type: ${attr.matchType}`);
        });

      // Show mismatches
      if (mismatched.length > 0) {
        console.log('\nMismatches:');
        mismatched
          .slice(0, 5)
          .forEach(attr => {
            console.log(`  ❌ ${attr.attributeName}: Expected "${attr.targetValue}", Got "${attr.detectedValue}"`);
            console.log(`     Similarity: ${attr.similarityScore.toFixed(2)}`);
          });
      }
    }

    // VLT Analysis
    if (validationResult.vltAnalysis) {
      console.log('\n----------------------------------------');
      console.log('RE-ANALYZED VLT ATTRIBUTES');
      console.log('----------------------------------------\n');

      const attrs = validationResult.vltAnalysis.attributes || {};
      const topAttrs = Object.entries(attrs).slice(0, 10);

      topAttrs.forEach(([key, value]) => {
        console.log(`  • ${key}: ${JSON.stringify(value)}`);
      });

      if (Object.keys(attrs).length > 10) {
        console.log(`  ... and ${Object.keys(attrs).length - 10} more attributes`);
      }
    }

    // 4. Test metrics API
    console.log('\n4. Checking validation metrics...');
    const metricsResult = await client.query(`
      SELECT * FROM validation_metrics
      WHERE metric_date = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (metricsResult.rows.length > 0) {
      console.log('\n✅ Daily metrics updated:');
      metricsResult.rows.forEach(metric => {
        const provider = metric.provider_id || 'Overall';
        console.log(`\n   ${provider}:`);
        console.log(`   - Total: ${metric.total_validations}`);
        console.log(`   - Passed: ${metric.passed_count}`);
        console.log(`   - Failed: ${metric.failed_count}`);
        console.log(`   - Outliers: ${metric.outlier_count}`);
        console.log(`   - Avg Score: ${parseFloat(metric.avg_overall_score).toFixed(2)}`);
      });
    }

    // 5. Check validation was stored in database
    console.log('\n5. Verifying database storage...');
    const dbCheck = await client.query(`
      SELECT 
        vr.*,
        COUNT(ac.id) as attribute_count
      FROM validation_results vr
      LEFT JOIN attribute_comparisons ac ON vr.id = ac.validation_result_id
      WHERE vr.generation_id = $1
      GROUP BY vr.id
    `, [generation.id]);

    if (dbCheck.rows.length > 0) {
      console.log('✅ Validation stored in database:');
      dbCheck.rows.forEach(row => {
        console.log(`   - Validation ID: ${row.id}`);
        console.log(`   - Status: ${row.status}`);
        console.log(`   - Score: ${parseFloat(row.overall_score).toFixed(2)}`);
        console.log(`   - Attributes: ${row.attribute_count}`);
      });
    }

    console.log('\n========================================');
    console.log('Test Complete! ✅');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
  }
}

/**
 * Test validation with custom test data
 */
async function testValidationWithMockData() {
  console.log('\n========================================');
  console.log('Mock Validation Test');
  console.log('========================================\n');

  // This would test with synthetic/mock data
  console.log('⚠️  Mock data test not yet implemented');
  console.log('   Use testValidationOnGeneration() instead');
}

/**
 * Test outlier detection
 */
async function testOutlierDetection() {
  console.log('\n========================================');
  console.log('Outlier Detection Test');
  console.log('========================================\n');

  const client = await db.getClient();

  try {
    // Get all validations with outlier status
    const result = await client.query(`
      SELECT 
        vr.id,
        vr.generation_id,
        vr.overall_score,
        vr.outlier_score,
        vr.is_outlier,
        ga.provider_id,
        mp.name as provider_name
      FROM validation_results vr
      JOIN generation_assets ga ON vr.asset_id = ga.id
      LEFT JOIN model_providers mp ON ga.provider_id = mp.id
      WHERE vr.status = 'completed'
      ORDER BY vr.outlier_score ASC
      LIMIT 20
    `);

    console.log(`Found ${result.rows.length} validated generations\n`);

    const outliers = result.rows.filter(r => r.is_outlier);
    const inliers = result.rows.filter(r => !r.is_outlier);

    console.log(`Outliers: ${outliers.length}`);
    console.log(`Inliers: ${inliers.length}`);

    if (outliers.length > 0) {
      console.log('\n⚠️  Detected Outliers:');
      outliers.forEach(row => {
        console.log(`   - ${row.generation_id} (${row.provider_name})`);
        console.log(`     Score: ${parseFloat(row.overall_score).toFixed(2)}, Outlier: ${row.outlier_score.toFixed(4)}`);
      });
    } else {
      console.log('\n✅ No outliers detected (good!)');
    }

  } catch (error) {
    console.error('❌ Outlier test failed:', error.message);
  } finally {
    client.release();
  }
}

/**
 * Test provider comparison
 */
async function testProviderComparison() {
  console.log('\n========================================');
  console.log('Provider Validation Comparison');
  console.log('========================================\n');

  const client = await db.getClient();

  try {
    const result = await client.query(`
      SELECT * FROM provider_validation_stats
      ORDER BY avg_overall_score DESC
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No validation data available yet');
      return;
    }

    console.log('Provider Quality Rankings:\n');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.provider_name}`);
      console.log(`   Score: ${parseFloat(row.avg_overall_score || 0).toFixed(2)}/100`);
      console.log(`   Pass Rate: ${parseFloat(row.pass_rate || 0).toFixed(1)}%`);
      console.log(`   Total: ${row.total_validations || 0} validations`);
      console.log(`   Outliers: ${row.outlier_count || 0}`);
      console.log(`   Rejected: ${row.rejected_count || 0}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Provider comparison failed:', error.message);
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  try {
    await testValidationOnGeneration();
    await testOutlierDetection();
    await testProviderComparison();
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    // Close database connection
    await db.pool.end();
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testValidationOnGeneration,
  testValidationWithMockData,
  testOutlierDetection,
  testProviderComparison
};
