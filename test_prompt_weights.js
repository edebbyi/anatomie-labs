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
    
    // Test generating a default prompt
    console.log('2. Testing default prompt generation:');
    const defaultPrompt = await IntelligentPromptBuilder.generateDefaultPrompt('test-user-id', {
      garmentType: 'dress',
      creativity: 0.5
    });
    
    console.log('   Positive prompt:', defaultPrompt.positive_prompt);
    console.log('   Has weights and brackets:', /\(.+:\d+\.\d+\)/.test(defaultPrompt.positive_prompt));
    console.log('');
    
    // Show some examples of what a properly formatted prompt should look like
    console.log('3. Examples of properly formatted tokens:');
    console.log('   (professional fashion photography:1.3)');
    console.log('   (high detail:1.2)');
    console.log('   (8k:1.1)');
    console.log('   (sharp focus:1.0)');
    console.log('   (silk:1.2)');
    console.log('   (navy:1.3)');
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPromptWeights();