/**
 * Test script for prompt enhancement fix
 * Tests the interpretUserPrompt functionality
 */

const promptEnhancementService = require('./src/services/promptEnhancementService');
const logger = require('./src/utils/logger');

// Mock brand DNA for testing
const mockBrandDNA = {
  primaryAesthetic: 'minimalist',
  secondaryAesthetics: ['contemporary', 'structured'],
  signatureColors: [
    { name: 'navy', frequency: 0.35 },
    { name: 'black', frequency: 0.25 },
    { name: 'white', frequency: 0.20 }
  ],
  signatureFabrics: [
    { name: 'wool', frequency: 0.40 },
    { name: 'silk', frequency: 0.30 }
  ],
  primaryGarments: [
    { type: 'blazer', count: 15 },
    { type: 'dress', count: 12 }
  ],
  signatureConstruction: [
    { detail: 'structured shoulders', frequency: 0.45 },
    { detail: 'clean lines', frequency: 0.40 }
  ]
};

async function runTests() {
  console.log('\n=== PROMPT ENHANCEMENT FIX - TEST SUITE ===\n');

  // Test 1: Vague prompt (low specificity)
  console.log('TEST 1: Vague prompt (low specificity)');
  console.log('Input: "something elegant for evening"');
  try {
    const result1 = await promptEnhancementService.interpretUserPrompt(
      'something elegant for evening',
      mockBrandDNA
    );
    console.log('✅ SUCCESS');
    console.log('Specificity:', result1.specificity);
    console.log('Garment Type:', result1.garmentType);
    console.log('Style Adjectives:', result1.styleAdjectives);
    console.log('Recommended Creativity:', result1.recommendedCreativity);
    console.log('Enhanced Suggestion:', result1.enhancedSuggestion?.substring(0, 100) + '...');
    console.log('');
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    console.log('');
  }

  // Test 2: Specific prompt (high specificity)
  console.log('TEST 2: Specific prompt (high specificity)');
  console.log('Input: "navy wool double-breasted blazer with peak lapels"');
  try {
    const result2 = await promptEnhancementService.interpretUserPrompt(
      'navy wool double-breasted blazer with peak lapels',
      mockBrandDNA
    );
    console.log('✅ SUCCESS');
    console.log('Specificity:', result2.specificity);
    console.log('Garment Type:', result2.garmentType);
    console.log('Colors:', result2.colors);
    console.log('Fabrics:', result2.fabrics);
    console.log('Style Adjectives:', result2.styleAdjectives);
    console.log('Recommended Creativity:', result2.recommendedCreativity);
    console.log('Enhanced Suggestion:', result2.enhancedSuggestion?.substring(0, 100) + '...');
    console.log('');
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    console.log('');
  }

  // Test 3: Medium specificity
  console.log('TEST 3: Medium specificity');
  console.log('Input: "elegant black evening gown"');
  try {
    const result3 = await promptEnhancementService.interpretUserPrompt(
      'elegant black evening gown',
      mockBrandDNA
    );
    console.log('✅ SUCCESS');
    console.log('Specificity:', result3.specificity);
    console.log('Garment Type:', result3.garmentType);
    console.log('Colors:', result3.colors);
    console.log('Style Adjectives:', result3.styleAdjectives);
    console.log('Recommended Creativity:', result3.recommendedCreativity);
    console.log('Enhanced Suggestion:', result3.enhancedSuggestion?.substring(0, 100) + '...');
    console.log('');
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    console.log('');
  }

  // Test 4: No brand DNA (new user)
  console.log('TEST 4: No brand DNA (new user)');
  console.log('Input: "casual summer dress"');
  try {
    const result4 = await promptEnhancementService.interpretUserPrompt(
      'casual summer dress',
      null // No brand DNA
    );
    console.log('✅ SUCCESS');
    console.log('Specificity:', result4.specificity);
    console.log('Garment Type:', result4.garmentType);
    console.log('Style Adjectives:', result4.styleAdjectives);
    console.log('Recommended Creativity:', result4.recommendedCreativity);
    console.log('Brand DNA Available:', result4.brandDNAAvailable);
    console.log('Enhanced Suggestion:', result4.enhancedSuggestion?.substring(0, 100) + '...');
    console.log('');
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    console.log('');
  }

  // Test 5: Fallback interpretation (no LLM)
  console.log('TEST 5: Fallback interpretation (simulated LLM failure)');
  console.log('Input: "red silk blouse"');
  try {
    // This will use fallback if LLM is not configured
    const result5 = await promptEnhancementService.interpretUserPrompt(
      'red silk blouse',
      mockBrandDNA,
      { provider: 'invalid' } // Force fallback
    );
    console.log('✅ SUCCESS (using fallback)');
    console.log('Specificity:', result5.specificity);
    console.log('Garment Type:', result5.garmentType);
    console.log('Colors:', result5.colors);
    console.log('Fabrics:', result5.fabrics);
    console.log('User Modifiers:', result5.userModifiers);
    console.log('');
  } catch (error) {
    console.log('❌ FAILED:', error.message);
    console.log('');
  }

  console.log('=== TEST SUITE COMPLETE ===\n');
  
  // Summary
  console.log('SUMMARY:');
  console.log('- All tests should show SUCCESS or use fallback gracefully');
  console.log('- Specificity should vary: low/medium/high based on prompt detail');
  console.log('- Enhanced suggestions should blend user intent with brand DNA');
  console.log('- System should work without brand DNA (new users)');
  console.log('- Fallback should work when LLM is unavailable');
  console.log('');
}

// Run tests
runTests()
  .then(() => {
    console.log('✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });

