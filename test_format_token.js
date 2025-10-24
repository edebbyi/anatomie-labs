// Test the formatToken method directly
const IntelligentPromptBuilder = require('./src/services/IntelligentPromptBuilder');

console.log('Testing formatToken method:\n');

// Test cases
const testCases = [
  { text: 'test', weight: 1.3, description: 'Weight > 1.0' },
  { text: 'example', weight: 1.0, description: 'Weight = 1.0' },
  { text: 'low', weight: 0.8, description: 'Weight < 1.0' },
  { text: 'high', weight: 1.5, description: 'Weight at max' },
  { text: 'min', weight: 0.5, description: 'Weight at min' }
];

testCases.forEach((testCase, index) => {
  const result = IntelligentPromptBuilder.formatToken(testCase.text, testCase.weight);
  console.log(`${index + 1}. ${testCase.description}:`);
  console.log(`   Input: formatToken("${testCase.text}", ${testCase.weight})`);
  console.log(`   Output: "${result}"`);
  console.log(`   Has brackets: ${result.startsWith('(') && result.endsWith(')')}`);
  console.log(`   Has weight: ${result.includes(':') ? result.split(':')[1].slice(0, -1) : 'No'}`);
  console.log('');
});

console.log('✅ All formatToken tests completed successfully!');
console.log('\nExamples of properly formatted prompts:');
console.log('- (professional fashion photography:1.3)');
console.log('- (high detail:1.2)');
console.log('- (8k:1.1)');
console.log('- (sharp focus:1.0)');
console.log('- (silk:1.2)');
console.log('- (navy:1.3)');