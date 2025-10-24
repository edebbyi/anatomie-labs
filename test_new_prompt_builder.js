// Test the new IntelligentPromptBuilder implementation
const IntelligentPromptBuilder = require('./src/services/IntelligentPromptBuilder');

console.log('Testing new IntelligentPromptBuilder implementation:\n');

// Test the formatToken method
console.log('1. Testing formatToken method:');
console.log('   formatToken("test", 1.3):', IntelligentPromptBuilder.formatToken('test', 1.3));
console.log('   formatToken("example", 1.0):', IntelligentPromptBuilder.formatToken('example', 1.0));
console.log('   formatToken("low", 0.8):', IntelligentPromptBuilder.formatToken('low', 0.8));
console.log('   formatToken("high", 1.5):', IntelligentPromptBuilder.formatToken('high', 1.5));
console.log('');

// Test the new methods
console.log('2. Testing new methods:');

// Test generatePoseKey
const photography = {
  shot_composition: { type: 'three-quarter length' },
  pose: { gaze: 'camera', head: 'straight', body_position: 'front' }
};

const poseKey = IntelligentPromptBuilder.generatePoseKey(photography);
console.log('   generatePoseKey():', poseKey);

// Test determineFacingDirection
const facingDirection = IntelligentPromptBuilder.determineFacingDirection(photography.pose);
console.log('   determineFacingDirection():', facingDirection);

// Test describePoseStyle
const poseStyle = IntelligentPromptBuilder.describePoseStyle(photography.pose);
console.log('   describePoseStyle():', poseStyle);

// Test ensureFrontAngle
const frontAngle = IntelligentPromptBuilder.ensureFrontAngle('side angle');
console.log('   ensureFrontAngle("side angle"):', frontAngle);
const frontAngle2 = IntelligentPromptBuilder.ensureFrontAngle('3/4 front angle');
console.log('   ensureFrontAngle("3/4 front angle"):', frontAngle2);

console.log('\n3. Testing DEFAULT_NEGATIVE_PROMPT:');
console.log('   Contains "back view":', IntelligentPromptBuilder.DEFAULT_NEGATIVE_PROMPT.includes('back view'));
console.log('   Contains "rear view":', IntelligentPromptBuilder.DEFAULT_NEGATIVE_PROMPT.includes('rear view'));
console.log('   Contains "turned away":', IntelligentPromptBuilder.DEFAULT_NEGATIVE_PROMPT.includes('turned away'));

console.log('\n✅ All tests completed successfully!');