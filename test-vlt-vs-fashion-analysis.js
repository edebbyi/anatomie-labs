#!/usr/bin/env node

/**
 * VLT vs Fashion Analysis Service Test
 * 
 * Tests both services with the same sporty chic images to see which
 * gives more accurate style detection
 */

const vltService = require('./src/services/vltService');
const fashionAnalysisService = require('./src/services/fashionAnalysisService');
const fs = require('fs');
const path = require('path');

async function testStyleDetection() {
  console.log('🧪 Testing VLT vs Fashion Analysis Service for Style Detection\n');
  
  // Test with a known sporty chic image (you'll need to provide this)
  const testImagePath = './test-assets/sporty-chic-sample.jpg';
  
  if (!fs.existsSync(testImagePath)) {
    console.log('❌ Test image not found. Please add a sporty chic image to:', testImagePath);
    console.log('   You can create a test-assets folder and add a sample image');
    return;
  }
  
  const testImage = fs.readFileSync(testImagePath);
  
  console.log('📸 Testing image:', testImagePath);
  console.log('Expected style: sporty chic, minimalist, or athletic\n');
  
  // Test Fashion Analysis Service first (faster)
  try {
    console.log('🤖 Testing Fashion Analysis Service (Replicate Vision Model)...');
    const fashionResult = await fashionAnalysisService.analyzeImage(testImage);
    
    console.log('✅ Fashion Analysis Results:');
    console.log('   Garment Type:', fashionResult.garmentType);
    console.log('   Style Aesthetic:', fashionResult.style.aesthetic);
    console.log('   Formality:', fashionResult.style.formality);
    console.log('   Overall Style:', fashionResult.style.overall);
    console.log('   Mood:', fashionResult.style.mood);
    console.log('   Confidence:', fashionResult.confidence);
    console.log('');
    
    // Check if it detected sporty/athletic/minimalist styles
    const detectedSporty = JSON.stringify(fashionResult).toLowerCase();
    const sportyKeywords = ['sporty', 'athletic', 'minimalist', 'casual', 'relaxed', 'active'];
    const foundSportyKeywords = sportyKeywords.filter(keyword => detectedSporty.includes(keyword));
    
    console.log('   Sporty Keywords Found:', foundSportyKeywords.length > 0 ? foundSportyKeywords : 'None ❌');
    
  } catch (error) {
    console.log('❌ Fashion Analysis Service failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Test VLT Service (slower, external API)
  try {
    console.log('🔍 Testing VLT Service (External API)...');
    console.log('Note: This will take longer as it uploads to external service\n');
    
    // VLT requires ZIP file, so we'll create a temporary one
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('test-image.jpg', testImage);
    const zipBuffer = zip.toBuffer();
    
    // Save temporarily
    const tempZipPath = './temp-test.zip';
    fs.writeFileSync(tempZipPath, zipBuffer);
    
    const vltResult = await vltService.batchAnalyze(tempZipPath, {
      model: 'gemini',
      passes: 'A,B,C'
    });
    
    // Clean up
    fs.unlinkSync(tempZipPath);
    
    console.log('✅ VLT Service Results:');
    if (vltResult.records && vltResult.records.length > 0) {
      const record = vltResult.records[0];
      console.log('   Garment Type:', record.garmentType);
      console.log('   Style Aesthetic:', record.style?.aesthetic);
      console.log('   Formality:', record.style?.formality);
      console.log('   Overall Style:', record.style?.overall);
      console.log('   Confidence:', record.confidence);
      console.log('');
      
      // Check if it detected sporty/athletic/minimalist styles  
      const detectedSportyVLT = JSON.stringify(record).toLowerCase();
      const sportyKeywords = ['sporty', 'athletic', 'minimalist', 'casual', 'relaxed', 'active'];
      const foundSportyKeywordsVLT = sportyKeywords.filter(keyword => detectedSportyVLT.includes(keyword));
      
      console.log('   Sporty Keywords Found:', foundSportyKeywordsVLT.length > 0 ? foundSportyKeywordsVLT : 'None ❌');
      
      console.log('\n📊 Summary:');
      console.log('   VLT detected garment type:', record.garmentType);
      console.log('   Fashion Analysis detected:', fashionResult.garmentType);
      
      console.log('\n🎯 Style Accuracy:');
      console.log('   VLT style keywords:', foundSportyKeywordsVLT.length);
      console.log('   Fashion Analysis keywords:', foundSportyKeywords.length);
      
      if (foundSportyKeywords.length > foundSportyKeywordsVLT.length) {
        console.log('\n✅ RECOMMENDATION: Use Fashion Analysis Service for better style detection');
      } else if (foundSportyKeywordsVLT.length > foundSportyKeywords.length) {
        console.log('\n✅ RECOMMENDATION: VLT Service is working correctly');
      } else {
        console.log('\n⚠️  RECOMMENDATION: Both services need improvement for style detection');
      }
      
    } else {
      console.log('❌ No records returned from VLT service');
    }
    
  } catch (error) {
    console.log('❌ VLT Service failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test completed. Add more test images to validate accuracy.');
}

// Run the test
testStyleDetection().catch(console.error);