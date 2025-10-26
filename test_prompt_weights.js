const IntelligentPromptBuilder = require('./src/services/IntelligentPromptBuilder');

async function testPromptWeights() {
  try {
    console.log('Testing prompt weights and brackets...\n');
    
    // Test the formatToken method directly
    console.log('1. Testing formatToken method:');
    console.log('   formatToken("test", 1.3):', IntelligentPromptBuilder.formatToken('test', 1.3));
    console.log('   formatToken("example", 1.0):', IntelligentPromptBuilder.formatToken('example', 1.0));
    console.log('   formatToken("low", 0.8):', IntelligentPromptBuilder.formatToken('low', 0.8));
    console.log('   formatToken("high", 1.5):', IntelligentPromptBuilder.formatToken('high', 1.5));
    console.log('');
    
    // Compose a sample positive prompt (no DB IO)
    console.log('2. Testing sample positive prompt composition:');
    const samplePositive = [
      IntelligentPromptBuilder.formatToken('minimalist', 1.4),
      IntelligentPromptBuilder.formatToken('blazer', 1.3),
      IntelligentPromptBuilder.formatToken('silk', 1.2),
      IntelligentPromptBuilder.formatToken('black and white palette', 1.3),
      IntelligentPromptBuilder.formatToken('three-quarter length shot', 1.3)
    ].join(', ');

    console.log('   Sample positive prompt:', samplePositive);
    console.log('   Has weights and brackets:', /\[.+:\d+\.\d+\]/.test(samplePositive));
    console.log('');

    // Show some examples of what a properly formatted prompt should look like
    console.log('3. Examples of properly formatted tokens:');
    console.log('   [professional fashion photography:1.3]');
    console.log('   [high detail:1.2]');
    console.log('   [8k:1.1]');
    console.log('   [sharp focus:1.0]');
    console.log('   [silk:1.2]');
    console.log('   [navy:1.3]');
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPromptWeights();