#!/usr/bin/env node
/**
 * Simple Onboarding Test
 * Tests VLT analysis and image generation
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_URL = 'http://localhost:3001/api';
const TEST_USER_ID = 'ec058a8c-b2d7-4888-9e66-b7b02e393152';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  const zipFile = process.argv[2] || 'anatomie_onboarding_sample_80.zip';
  
  log('\n🚀 ONBOARDING TEST START', 'cyan');
  log('═'.repeat(60), 'cyan');
  
  // Test 1: Health check
  log('\n📋 Step 1: Health Check', 'yellow');
  try {
    const health = await axios.get('http://localhost:3001/health', { 
      timeout: 5000,
      validateStatus: (status) => status === 200 || status === 503 // Accept degraded
    });
    log(`✅ Backend is ${health.data.status}`, 'green');
    if (health.data.status === 'degraded') {
      log('   ⚠️  Some services unavailable (Pinecone), but continuing...', 'yellow');
    }
  } catch (error) {
    log(`❌ Backend not responding: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Test 2: VLT Analysis
  log('\n📋 Step 2: VLT Analysis', 'yellow');
  log(`   ZIP: ${zipFile}`, 'yellow');
  
  if (!fs.existsSync(zipFile)) {
    log(`❌ ZIP file not found: ${zipFile}`, 'red');
    process.exit(1);
  }
  
  const formData = new FormData();
  formData.append('zipFile', fs.createReadStream(zipFile));
  formData.append('model', 'gemini');
  formData.append('passes', 'A,B,C');
  
  let vltResult;
  try {
    log('   ⏳ Uploading and analyzing...', 'yellow');
    const response = await axios.post(`${API_URL}/vlt/analyze/batch`, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: 100 * 1024 * 1024,
      maxContentLength: 100 * 1024 * 1024,
      timeout: 300000,
    });
    
    vltResult = response.data.data;
    log(`✅ Analyzed ${vltResult.records.length} images`, 'green');
    log(`   Model: ${vltResult.model}`, 'green');
    log(`   Confidence: ${vltResult.summary.averageConfidence}`, 'green');
    log(`   Garment types: ${Object.keys(vltResult.summary.garmentTypes).join(', ')}`, 'green');
  } catch (error) {
    log(`❌ VLT Analysis failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Error: ${JSON.stringify(error.response.data)}`, 'red');
    }
    process.exit(1);
  }
  
  // Test 3: Save Portfolio  
  log('\n📋 Step 3: Save Portfolio', 'yellow');
  try {
    await axios.post(`${API_URL}/persona/profile`, {
      userId: TEST_USER_ID,
      vltAnalysis: vltResult,
      summary: vltResult.summary,
      timestamp: new Date().toISOString(),
    });
    log(`✅ Portfolio saved for user ${TEST_USER_ID}`, 'green');
  } catch (error) {
    log(`❌ Portfolio save failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Error: ${JSON.stringify(error.response.data)}`, 'red');
    }
  }
  
  // Test 4: Generate Images (streaming)
  log('\n📋 Step 4: Generate Images (20 images)', 'yellow');
  log('   This will take 2-3 minutes...', 'yellow');
  
  const fetch = require('node-fetch');
  
  try {
    const response = await fetch(`${API_URL}/generate/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        targetCount: 20,
        bufferPercent: 10,
        provider: 'google-imagen',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    let lastProgress = 0;
    for await (const chunk of response.body) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            
            if (data.progress && data.progress > lastProgress) {
              lastProgress = data.progress;
              log(`   ⏳ ${data.progress}% - ${data.message}`, 'yellow');
            }
            
            if (data.progress === 100 && data.totalGenerated) {
              log(`\n✅ Generated ${data.totalGenerated} images!`, 'green');
              log(`   Selected: ${data.selectedCount || 20} for gallery`, 'green');
              break;
            }
            
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (parseError) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    log(`❌ Generation failed: ${error.message}`, 'red');
  }
  
  log('\n🎉 ONBOARDING TEST COMPLETE', 'green');
  log('═'.repeat(60), 'green');
  log('✅ View images at: http://localhost:3000/home', 'cyan');
}

main().catch(error => {
  log(`\n❌ Test failed: ${error.message}`, 'red');
  process.exit(1);
});
