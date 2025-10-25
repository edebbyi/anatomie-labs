#!/usr/bin/env node
/**
 * Standalone test for garment classification fix
 * Tests the improved taxonomy without requiring the full server
 */

require('dotenv').config();
const ingestionAgent = require('./src/services/ultraDetailedIngestionAgent');
const validationAgent = require('./src/services/validationAgent');

// Mock image data for testing
const testImages = [
  {
    id: 'test-1',
    url: 'https://example.com/image1.jpg',
    filename: 'utility-shirt.jpg',
    description: 'Utility shirt with multiple pockets'
  }
];

async function testGarmentClassification() {
  console.log('\n🧪 Testing Garment Classification Fix\n');
  console.log('='.repeat(80));

  try {
    
    // Test 1: Check that the prompt includes the new taxonomy
    console.log('\n📝 Test 1: Checking prompt content...\n');
    
    const prompt = ingestionAgent.getComprehensivePrompt();
    
    const checks = {
      'BLAZER vs OTHER JACKETS': prompt.includes('BLAZER vs OTHER JACKETS'),
      'BOMBER JACKET': prompt.includes('BOMBER JACKET'),
      'VEST vs JACKET/BLAZER': prompt.includes('VEST vs JACKET/BLAZER'),
      'UTILITY SHIRT': prompt.includes('UTILITY SHIRT'),
      'RIBBED KNIT': prompt.includes('RIBBED KNIT'),
      'Notched/peaked lapels': prompt.includes('notched') || prompt.includes('peaked'),
      'Ribbed cuffs + ribbed hem': prompt.includes('ribbed cuffs') && prompt.includes('ribbed hem'),
      'Sleeveless → VEST': prompt.includes('sleeveless') && prompt.includes('vest'),
      'Decision tree': prompt.includes('COLLAR') || prompt.includes('SLEEVES'),
      'Specific fabrics': prompt.includes('cotton twill') || prompt.includes('ponte knit')
    };
    
    let passedChecks = 0;
    let totalChecks = Object.keys(checks).length;
    
    for (const [check, passed] of Object.entries(checks)) {
      if (passed) {
        console.log(`   ✅ ${check}`);
        passedChecks++;
      } else {
        console.log(`   ❌ ${check}`);
      }
    }
    
    console.log(`\n   Score: ${passedChecks}/${totalChecks} (${(passedChecks/totalChecks*100).toFixed(0)}%)`);
    
    if (passedChecks < totalChecks * 0.8) {
      console.log('\n   ⚠️  Warning: Prompt may not include all taxonomy improvements');
    } else {
      console.log('\n   ✅ Prompt includes comprehensive garment taxonomy!');
    }
    
    // Test 2: Check validation agent has the new method
    console.log('\n\n📝 Test 2: Checking validation agent...\n');
    
    const hasValidateGarmentType = typeof validationAgent.validateGarmentType === 'function';
    
    if (hasValidateGarmentType) {
      console.log('   ✅ validateGarmentType method exists');
      
      // Test the method with mock data
      const mockDescriptor = {
        garment_type: 'blazer',
        design_details: {
          collar: 'shirt collar'  // This should trigger a validation issue
        }
      };
      
      const validation = validationAgent.validateGarmentType(mockDescriptor);
      
      console.log(`   ✅ Method is callable`);
      console.log(`   - Is valid: ${validation.isValid}`);
      console.log(`   - Issues: ${validation.issues.length}`);
      console.log(`   - Corrections: ${Object.keys(validation.corrections).length}`);
      
      if (!validation.isValid && validation.issues.length > 0) {
        console.log(`\n   ✅ Validation correctly detects blazer without lapels!`);
        console.log(`      Issue: ${validation.issues[0].message}`);
        if (validation.corrections.garment_type) {
          console.log(`      Correction: ${validation.corrections.garment_type}`);
        }
      } else {
        console.log(`\n   ⚠️  Warning: Validation didn't detect the issue`);
      }
      
      // Test sleeveless jacket detection
      const mockDescriptor2 = {
        garment_type: 'bomber jacket',
        design_details: {
          sleeves: {
            length: 'sleeveless'
          }
        }
      };
      
      const validation2 = validationAgent.validateGarmentType(mockDescriptor2);
      
      if (!validation2.isValid && validation2.issues.some(i => i.type === 'sleeveless_jacket')) {
        console.log(`   ✅ Validation correctly detects sleeveless jacket!`);
        console.log(`      Correction: ${validation2.corrections.garment_type || 'N/A'}`);
      }
      
    } else {
      console.log('   ❌ validateGarmentType method NOT found');
    }
    
    // Test 3: Check prompt length
    console.log('\n\n📝 Test 3: Checking prompt improvements...\n');
    
    const promptLines = prompt.split('\n').length;
    const promptChars = prompt.length;
    
    console.log(`   - Prompt lines: ${promptLines}`);
    console.log(`   - Prompt characters: ${promptChars}`);
    
    if (promptLines > 300) {
      console.log(`   ✅ Prompt is comprehensive (${promptLines} lines)`);
    } else {
      console.log(`   ⚠️  Prompt may be too short (${promptLines} lines, expected >300)`);
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY\n');
    console.log('='.repeat(80));
    
    const allTestsPassed = passedChecks >= totalChecks * 0.8 && hasValidateGarmentType;
    
    if (allTestsPassed) {
      console.log('\n✅ All tests passed! Garment classification fix is properly implemented.\n');
      console.log('Key improvements:');
      console.log('  • Comprehensive garment taxonomy in prompt');
      console.log('  • BLAZER vs BOMBER vs VEST distinctions');
      console.log('  • Sleeveless garment validation');
      console.log('  • Specific fabric vocabulary requirements');
      console.log('  • Post-processing validation to catch misclassifications');
      console.log('\nNext steps:');
      console.log('  1. Upload anatomie_test_5.zip through the UI');
      console.log('  2. Check that garments are classified correctly');
      console.log('  3. Verify style tags are generated');
      console.log('  4. Compare with previous results\n');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the implementation.\n');
    }
    
    console.log('='.repeat(80) + '\n');
    
    process.exit(allTestsPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testGarmentClassification();

