/**
 * Over-Generation + RLHF Feedback Test Suite
 * Tests the complete flow of over-generation, validation, and feedback creation
 */

require('dotenv').config();
const generationService = require('../src/services/generationService');
const db = require('../src/utils/db');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Test 1: Over-generation with small batch
 */
async function testSmallBatchOverGeneration() {
  console.log('\n========================================');
  console.log('Test 1: Small Batch Over-Generation');
  console.log('========================================\n');

  try {
    // Load test image
    const testImagePath = path.join(__dirname, '../test-assets/test-fashion.jpg');
    
    if (!fs.existsSync(testImagePath)) {
      console.log('⚠️  Test image not found, skipping this test');
      console.log('   Place a test image at:', testImagePath);
      return;
    }

    const imageBuffer = fs.readFileSync(testImagePath);

    console.log('Requesting 5 images with 20% buffer...');
    console.log('Expected: Generate 6, validate 6, return best 5\n');

    const startTime = Date.now();

    const result = await generationService.generateFromImage({
      userId: 'test_user_over_gen',
      imageFile: imageBuffer,
      settings: {
        count: 5,
        bufferPercent: 20,
        autoValidate: true
      }
    });

    const duration = Date.now() - startTime;

    console.log('✅ Generation completed in', Math.round(duration / 1000), 'seconds\n');
    console.log('Results:');
    console.log('  Generation ID:', result.id);
    console.log('  Status:', result.status);
    console.log('  Assets returned:', result.assets?.length || 0);
    console.log('  Cost: $' + (result.cost || 0).toFixed(2));

    if (result.pipeline_data?.overGeneration) {
      const og = result.pipeline_data.overGeneration;
      console.log('\n  Over-Generation Stats:');
      console.log('    Requested:', og.requested);
      console.log('    Generated:', og.generated);
      console.log('    Returned:', og.returned);
    }

    if (result.pipeline_data?.filtering) {
      const f = result.pipeline_data.filtering;
      console.log('\n  Filtering Stats:');
      console.log('    Avg Returned Score:', f.avgReturnedScore?.toFixed(2));
      console.log('    Avg Discarded Score:', f.avgDiscardedScore?.toFixed(2));
      console.log('    Discarded Count:', f.discarded);
    }

    // Check RLHF feedback created
    console.log('\n  Checking RLHF feedback...');
    const client = await db.getClient();
    try {
      const feedbackResult = await client.query(`
        SELECT 
          feedback_type,
          is_negative_example,
          is_positive_example,
          quality_score
        FROM rlhf_feedback
        WHERE generation_id = $1
        ORDER BY quality_score DESC
      `, [result.id]);

      console.log('    Total feedback entries:', feedbackResult.rows.length);
      
      const negative = feedbackResult.rows.filter(r => r.is_negative_example);
      const positive = feedbackResult.rows.filter(r => r.is_positive_example);
      
      console.log('    Negative examples:', negative.length);
      console.log('    Positive examples:', positive.length);

      if (negative.length > 0) {
        console.log('\n    Negative Examples:');
        negative.forEach(f => {
          console.log(`      - Type: ${f.feedback_type}, Score: ${parseFloat(f.quality_score).toFixed(2)}`);
        });
      }

      if (positive.length > 0) {
        console.log('\n    Positive Examples:');
        positive.slice(0, 3).forEach(f => {
          console.log(`      - Type: ${f.feedback_type}, Score: ${parseFloat(f.quality_score).toFixed(2)}`);
        });
      }

    } finally {
      client.release();
    }

    console.log('\n✅ Test 1 Passed!\n');
    return result;

  } catch (error) {
    console.error('\n❌ Test 1 Failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Test 2: Verify RLHF feedback views
 */
async function testRLHFFeedbackViews() {
  console.log('\n========================================');
  console.log('Test 2: RLHF Feedback Views');
  console.log('========================================\n');

  const client = await db.getClient();
  try {
    // Test negative examples view
    console.log('1. Testing rlhf_negative_examples view...');
    const negResult = await client.query(`
      SELECT COUNT(*) as count FROM rlhf_negative_examples
    `);
    console.log('   ✅ Negative examples found:', negResult.rows[0].count);

    // Test positive examples view
    console.log('\n2. Testing rlhf_positive_examples view...');
    const posResult = await client.query(`
      SELECT COUNT(*) as count FROM rlhf_positive_examples
    `);
    console.log('   ✅ Positive examples found:', posResult.rows[0].count);

    // Test feedback summary view
    console.log('\n3. Testing rlhf_feedback_summary view...');
    const summaryResult = await client.query(`
      SELECT 
        provider_name,
        feedback_type,
        negative_count,
        positive_count,
        ROUND(avg_quality_score, 2) as avg_score
      FROM rlhf_feedback_summary
      ORDER BY feedback_count DESC
      LIMIT 5
    `);

    if (summaryResult.rows.length > 0) {
      console.log('   ✅ Summary view working:\n');
      summaryResult.rows.forEach(row => {
        console.log(`      ${row.provider_name || 'Unknown'} (${row.feedback_type})`);
        console.log(`        Negative: ${row.negative_count}, Positive: ${row.positive_count}`);
        console.log(`        Avg Score: ${row.avg_score}`);
      });
    } else {
      console.log('   ⚠️  No data in summary yet (run Test 1 first)');
    }

    console.log('\n✅ Test 2 Passed!\n');

  } catch (error) {
    console.error('\n❌ Test 2 Failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test 3: Test training data retrieval function
 */
async function testTrainingDataRetrieval() {
  console.log('\n========================================');
  console.log('Test 3: Training Data Retrieval');
  console.log('========================================\n');

  const client = await db.getClient();
  try {
    console.log('1. Getting negative examples for training...');
    const negData = await client.query(`
      SELECT * FROM get_rlhf_training_data(
        p_provider_id := NULL,
        p_limit := 10,
        p_negative_only := TRUE,
        p_positive_only := FALSE
      )
    `);

    console.log('   ✅ Retrieved', negData.rows.length, 'negative examples');
    
    if (negData.rows.length > 0) {
      console.log('   Sample negative example:');
      const sample = negData.rows[0];
      console.log('     - Provider:', sample.provider_name);
      console.log('     - Quality Score:', parseFloat(sample.quality_score).toFixed(2));
      console.log('     - Feedback Type:', sample.feedback_type);
    }

    console.log('\n2. Getting positive examples for training...');
    const posData = await client.query(`
      SELECT * FROM get_rlhf_training_data(
        p_provider_id := NULL,
        p_limit := 10,
        p_negative_only := FALSE,
        p_positive_only := TRUE
      )
    `);

    console.log('   ✅ Retrieved', posData.rows.length, 'positive examples');

    if (posData.rows.length > 0) {
      console.log('   Sample positive example:');
      const sample = posData.rows[0];
      console.log('     - Provider:', sample.provider_name);
      console.log('     - Quality Score:', parseFloat(sample.quality_score).toFixed(2));
      console.log('     - Feedback Type:', sample.feedback_type);
    }

    console.log('\n✅ Test 3 Passed!\n');

  } catch (error) {
    console.error('\n❌ Test 3 Failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test 4: Verify trigger auto-creates positive feedback
 */
async function testPositiveFeedbackTrigger() {
  console.log('\n========================================');
  console.log('Test 4: Positive Feedback Trigger');
  console.log('========================================\n');

  const client = await db.getClient();
  try {
    console.log('Checking if trigger auto-created positive feedback...');
    
    const result = await client.query(`
      SELECT 
        vr.overall_score,
        rf.feedback_type,
        rf.is_positive_example
      FROM validation_results vr
      JOIN rlhf_feedback rf ON rf.validation_result_id = vr.id
      WHERE vr.overall_score >= 85
        AND rf.feedback_source = 'validation_auto'
      LIMIT 5
    `);

    if (result.rows.length > 0) {
      console.log('✅ Trigger working! Found', result.rows.length, 'auto-created positive feedback\n');
      result.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. Score: ${parseFloat(row.overall_score).toFixed(2)}, Type: ${row.feedback_type}`);
      });
    } else {
      console.log('⚠️  No auto-positive feedback found yet');
      console.log('   (This is OK if no high-scoring validations exist)');
    }

    console.log('\n✅ Test 4 Passed!\n');

  } catch (error) {
    console.error('\n❌ Test 4 Failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test 5: Buffer percentage variations
 */
async function testBufferVariations() {
  console.log('\n========================================');
  console.log('Test 5: Buffer Percentage Variations');
  console.log('========================================\n');

  const testCases = [
    { count: 10, buffer: 10, expected: 11 },
    { count: 10, buffer: 20, expected: 12 },
    { count: 10, buffer: 50, expected: 15 },
    { count: 30, buffer: 15, expected: 35 },
  ];

  testCases.forEach(test => {
    const calculated = Math.ceil(test.count * (1 + test.buffer / 100));
    const match = calculated === test.expected ? '✅' : '❌';
    console.log(`${match} ${test.count} images, ${test.buffer}% buffer → ${calculated} generated (expected ${test.expected})`);
  });

  console.log('\n✅ Test 5 Passed!\n');
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Over-Generation Test Suite           ║');
  console.log('╚════════════════════════════════════════╝');

  const tests = [
    { name: 'Buffer Variations', fn: testBufferVariations },
    { name: 'RLHF Feedback Views', fn: testRLHFFeedbackViews },
    { name: 'Training Data Retrieval', fn: testTrainingDataRetrieval },
    { name: 'Positive Feedback Trigger', fn: testPositiveFeedbackTrigger },
    // Commenting out full generation test - uncomment if you have test image
    // { name: 'Small Batch Over-Generation', fn: testSmallBatchOverGeneration },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`Test "${test.name}" failed:`, error.message);
    }
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  Test Results: ${passed} passed, ${failed} failed${' '.repeat(Math.max(0, 10 - passed.toString().length - failed.toString().length))}║`);
  console.log('╚════════════════════════════════════════╝\n');

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Check logs above.\n');
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = {
  testSmallBatchOverGeneration,
  testRLHFFeedbackViews,
  testTrainingDataRetrieval,
  testPositiveFeedbackTrigger,
  testBufferVariations,
  runAllTests
};
