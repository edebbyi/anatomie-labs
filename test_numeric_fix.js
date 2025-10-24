/**
 * Test script to verify numeric calculations are within bounds
 */

const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');

async function test() {
  const portfolioId = '4c9028c1-79e4-4009-babb-fee8f6fcc531';
  
  console.log('Fetching descriptors...');
  const descriptors = await trendAnalysisAgent.getUltraDetailedDescriptors(portfolioId);
  
  console.log(`Found ${descriptors.length} descriptors`);
  
  console.log('\nCalculating averages...');
  const avgConfidence = trendAnalysisAgent.calculateAvgConfidence(descriptors);
  const avgCompleteness = trendAnalysisAgent.calculateAvgCompleteness(descriptors);
  
  console.log('\n✅ Results:');
  console.log(`  avg_confidence: ${avgConfidence} (type: ${typeof avgConfidence})`);
  console.log(`  avg_completeness: ${avgCompleteness} (type: ${typeof avgCompleteness})`);
  
  // Check if values fit in their column types
  console.log('\n📊 Column type checks:');
  console.log(`  avg_confidence fits in numeric(4,3)? ${avgConfidence >= 0 && avgConfidence <= 9.999 ? '✅ YES' : '❌ NO'}`);
  console.log(`  avg_completeness fits in numeric(5,2)? ${avgCompleteness >= 0 && avgCompleteness <= 999.99 ? '✅ YES' : '❌ NO'}`);
  
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
