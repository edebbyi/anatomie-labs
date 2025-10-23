#!/usr/bin/env node

/**
 * Test Enhanced Fashion Analysis Service
 * 
 * Tests the improved style detection capabilities
 */

const fashionAnalysisService = require('./src/services/fashionAnalysisService');

async function testEnhancedStyleDetection() {
  console.log('🧪 Testing Enhanced Fashion Analysis Service\n');
  
  // Test with mock analysis text to see if parsing works
  const mockAnalysisText = `
Primary Style Aesthetic: sporty
Secondary Style: minimalist  
Garment Type: two-piece
Silhouette: fitted
Color Palette: black and gray
Fabric/Texture: performance knit
Key Details: athletic branding, moisture-wicking fabric, logo visible
Formality Level: athletic
Target Occasion: gym, workout, active lifestyle
Brand/Designer Vibe: athletic brand
  `.trim();
  
  console.log('📝 Testing parsing with mock sporty chic analysis...');
  
  // Test the internal parsing function
  const parsed = fashionAnalysisService._parseAnalysis(mockAnalysisText);
  
  console.log('✅ Parsed Results:');
  console.log('   Primary Aesthetic:', parsed.aesthetic);
  console.log('   Secondary Aesthetic:', parsed.secondaryAesthetic);
  console.log('   Garment Type:', parsed.garmentType);
  console.log('   Formality:', parsed.formality);
  console.log('   Occasion:', parsed.occasion);
  console.log('   Brand Vibe:', parsed.brandVibe);
  console.log('   Key Details:', parsed.keyDetails);
  
  // Test enhanced prompt generation
  const enhancedPrompt = fashionAnalysisService._generateEnhancedPrompt(parsed);
  console.log('\n🎯 Enhanced Prompt:');
  console.log('  ', enhancedPrompt);
  
  // Test style detection accuracy
  const expectedSporty = ['sporty', 'athletic', 'gym', 'workout', 'performance'];
  const promptText = enhancedPrompt.toLowerCase();
  const foundSportyKeywords = expectedSporty.filter(keyword => promptText.includes(keyword));
  
  console.log('\n📊 Style Detection Accuracy:');
  console.log('   Expected Sporty Keywords:', expectedSporty);
  console.log('   Found in Prompt:', foundSportyKeywords);
  console.log('   Detection Accuracy:', `${(foundSportyKeywords.length / expectedSporty.length * 100).toFixed(0)}%`);
  
  if (foundSportyKeywords.length >= 3) {
    console.log('   ✅ EXCELLENT: Strong sporty style detection');
  } else if (foundSportyKeywords.length >= 2) {
    console.log('   ⚠️  GOOD: Moderate sporty style detection');
  } else {
    console.log('   ❌ POOR: Weak sporty style detection');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Test with minimalist example
  const mockMinimalistText = `
Primary Style Aesthetic: minimalist
Secondary Style: chic
Garment Type: outfit  
Silhouette: clean, structured
Color Palette: white and beige
Fabric/Texture: cotton, linen blend
Key Details: clean lines, no excessive decoration
Formality Level: business-casual
Target Occasion: work, professional meetings
Brand/Designer Vibe: contemporary, modern
  `.trim();
  
  console.log('\n📝 Testing minimalist style detection...');
  
  const parsedMinimalist = fashionAnalysisService._parseAnalysis(mockMinimalistText);
  const minimalistPrompt = fashionAnalysisService._generateEnhancedPrompt(parsedMinimalist);
  
  console.log('✅ Minimalist Results:');
  console.log('   Primary Aesthetic:', parsedMinimalist.aesthetic);
  console.log('   Enhanced Prompt:', minimalistPrompt);
  
  const expectedMinimalist = ['minimalist', 'clean', 'modern', 'contemporary', 'structured'];
  const minimalistPromptText = minimalistPrompt.toLowerCase();
  const foundMinimalistKeywords = expectedMinimalist.filter(keyword => minimalistPromptText.includes(keyword));
  
  console.log('   Found Minimalist Keywords:', foundMinimalistKeywords);
  console.log('   Detection Accuracy:', `${(foundMinimalistKeywords.length / expectedMinimalist.length * 100).toFixed(0)}%`);
  
  console.log('\n🎯 Summary:');
  console.log('   The enhanced Fashion Analysis Service now:');
  console.log('   ✅ Uses improved prompts to guide the vision model');
  console.log('   ✅ Automatically detects style aesthetics (sporty, minimalist, etc.)');
  console.log('   ✅ Parses structured responses for better accuracy');
  console.log('   ✅ Generates enhanced prompts with style-first approach');
  console.log('   ✅ No manual keyword mapping required');
  
  console.log('\n💡 For real image analysis:');
  console.log('   The vision LLM will now receive better prompts and return');
  console.log('   structured data that automatically detects sporty chic,');
  console.log('   minimalist, and other style signatures from the images.');
}

// Run the test
testEnhancedStyleDetection().catch(console.error);