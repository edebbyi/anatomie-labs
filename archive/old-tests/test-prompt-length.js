#!/usr/bin/env node

/**
 * Test script to verify prompt length limits
 */

const promptTemplateService = require('./src/services/promptTemplateService');

async function testPromptLength() {
  console.log('\n=== Testing Prompt Length Limits ===\n');

  // Test 1: Basic VLT spec without style profile (uses generic templates)
  console.log('Test 1: Generic template (no style profile)');
  const vltSpec1 = {
    garmentType: 'dress',
    attributes: {
      silhouette: 'fitted',
      neckline: 'round',
      sleeveLength: 'sleeveless',
      length: 'midi'
    },
    colors: {
      primary: 'black',
      finish: 'matte'
    }
  };

  const result1 = await promptTemplateService.generatePrompt(vltSpec1, null, {
    userId: 'test-user',
    maxWords: 50
  });

  console.log('Main Prompt:', result1.mainPrompt);
  console.log('Word Count:', result1.metadata.tokenCount || 'N/A');
  console.log('Max Words:', result1.metadata.maxWords || 'N/A');
  console.log('Truncated:', result1.metadata.truncated || false);
  console.log('Template:', result1.metadata.templateName);
  
  // Count actual words
  const actualWords = result1.mainPrompt.split(/[\s,]+/).filter(w => w.length > 0).length;
  console.log('Actual Word Count:', actualWords);
  console.log('✓ Test 1:', actualWords <= 50 ? 'PASSED' : 'FAILED');
  console.log('');

  // Test 2: With style profile (user clusters)
  console.log('Test 2: User style profile with clusters');
  const styleProfile = {
    n_clusters: 3,
    clusters: [
      {
        id: 1,
        size: 5,
        percentage: 62.5,
        dominant_attributes: {
          color: ['black', 4],
          style_aesthetic: ['elegant', 4],
          style_overall: ['contemporary', 5],
          style_mood: ['sophisticated', 5],
          silhouette: ['fitted', 3]
        },
        style_summary: 'contemporary, black tones'
      },
      {
        id: 2,
        percentage: 25.0,
        dominant_attributes: {
          color: ['beige', 1],
          style_aesthetic: ['casual', 2]
        },
        style_summary: 'contemporary, beige tones'
      },
      {
        id: 0,
        percentage: 12.5,
        dominant_attributes: {
          style_aesthetic: ['romantic', 1]
        },
        style_summary: 'contemporary, black tones'
      }
    ]
  };

  const result2 = await promptTemplateService.generatePrompt(vltSpec1, styleProfile, {
    userId: 'test-user-123',
    maxWords: 50,
    userModifiers: ['elegant details', 'luxury finish']
  });

  console.log('Main Prompt:', result2.mainPrompt);
  console.log('Word Count:', result2.metadata.tokenCount || 'N/A');
  console.log('Max Words:', result2.metadata.maxWords || 'N/A');
  console.log('Truncated:', result2.metadata.truncated || false);
  console.log('Template:', result2.metadata.templateName);
  
  const actualWords2 = result2.mainPrompt.split(/[\s,]+/).filter(w => w.length > 0).length;
  console.log('Actual Word Count:', actualWords2);
  console.log('✓ Test 2:', actualWords2 <= 50 ? 'PASSED' : 'FAILED');
  console.log('');

  // Test 3: Custom max words limit
  console.log('Test 3: Custom limit (30 words)');
  const result3 = await promptTemplateService.generatePrompt(vltSpec1, styleProfile, {
    userId: 'test-user-123',
    maxWords: 30
  });

  console.log('Main Prompt:', result3.mainPrompt);
  const actualWords3 = result3.mainPrompt.split(/[\s,]+/).filter(w => w.length > 0).length;
  console.log('Actual Word Count:', actualWords3);
  console.log('✓ Test 3:', actualWords3 <= 30 ? 'PASSED' : 'FAILED');
  console.log('');

  // Test 4: Explore mode
  console.log('Test 4: Explore mode (adds exploratory tokens)');
  const result4 = await promptTemplateService.generatePrompt(vltSpec1, styleProfile, {
    userId: 'test-user-123',
    maxWords: 50,
    exploreMode: true
  });

  console.log('Main Prompt:', result4.mainPrompt);
  const actualWords4 = result4.mainPrompt.split(/[\s,]+/).filter(w => w.length > 0).length;
  console.log('Actual Word Count:', actualWords4);
  console.log('Exploratory Tokens:', result4.metadata.components.exploratory.tokens);
  console.log('✓ Test 4:', actualWords4 <= 50 ? 'PASSED' : 'FAILED');
  console.log('');

  // Summary
  console.log('=== Summary ===');
  const allPassed = actualWords <= 50 && actualWords2 <= 50 && actualWords3 <= 30 && actualWords4 <= 50;
  if (allPassed) {
    console.log('✅ All tests PASSED! Prompt length limits are working correctly.');
  } else {
    console.log('❌ Some tests FAILED. Review the output above.');
  }
  console.log('');

  // Comparison
  console.log('=== Before vs After Comparison ===');
  console.log('Before fix: ~90-150 words (too long)');
  console.log('After fix:', actualWords2, 'words (optimal for image generation)');
  console.log('');
}

// Run the test
testPromptLength().catch(error => {
  console.error('Test failed with error:', error.message);
  process.exit(1);
});
