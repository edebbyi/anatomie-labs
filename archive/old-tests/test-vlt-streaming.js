#!/usr/bin/env node
/**
 * Test VLT Streaming Endpoint
 * 
 * This script tests the new /api/vlt/analyze/stream endpoint
 * by uploading a small test ZIP file and monitoring progress updates.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const logger = require('./src/utils/logger');

const API_URL = 'http://localhost:3001/api';

async function testVLTStreaming() {
  console.log('🧪 Testing VLT Streaming Endpoint\n');
  console.log('=' .repeat(60));

  // Check if test ZIP exists
  const testZipPath = path.join(__dirname, 'test-images.zip');
  
  if (!fs.existsSync(testZipPath)) {
    console.log('❌ Test ZIP file not found at:', testZipPath);
    console.log('\n📝 To run this test:');
    console.log('1. Create a folder with 3-5 fashion images');
    console.log('2. Compress it into test-images.zip');
    console.log('3. Place test-images.zip in the project root');
    process.exit(1);
  }

  const zipStats = fs.statSync(testZipPath);
  console.log(`✅ Found test ZIP: ${(zipStats.size / 1024).toFixed(2)} KB`);
  console.log('');

  // Create form data
  const form = new FormData();
  form.append('zipFile', fs.createReadStream(testZipPath));
  form.append('model', 'gemini');
  form.append('passes', 'A,B,C');

  console.log('📤 Uploading ZIP to /api/vlt/analyze/stream...\n');

  try {
    const response = await fetch(`${API_URL}/vlt/analyze/stream`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Connection established, streaming progress...\n');
    console.log('-'.repeat(60));

    let progressCount = 0;
    let lastProgress = 0;
    let result = null;

    // Process the stream
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            progressCount++;

            // Display progress
            if (data.progress !== undefined && data.progress !== lastProgress) {
              const bar = '█'.repeat(Math.floor(data.progress / 2)) + 
                         '░'.repeat(50 - Math.floor(data.progress / 2));
              
              console.log(`[${bar}] ${data.progress}%`);
              
              if (data.currentImage && data.totalImages) {
                console.log(`   📸 Image ${data.currentImage}/${data.totalImages}: ${data.message}`);
              } else {
                console.log(`   ${data.message || 'Processing...'}`);
              }
              console.log('');
              
              lastProgress = data.progress;
            }

            // Check for completion
            if (data.done && data.result) {
              result = data.result;
              console.log('-'.repeat(60));
              console.log('✅ Analysis complete!\n');
              break;
            }

            // Check for errors
            if (data.error) {
              throw new Error(data.error);
            }

          } catch (parseError) {
            console.error('❌ Error parsing SSE data:', parseError.message);
          }
        }
      }
    }

    if (result) {
      console.log('📊 Results Summary:');
      console.log(`   Job ID: ${result.jobId}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Model: ${result.model}`);
      console.log(`   Backend: ${result.backend}`);
      console.log(`   Images analyzed: ${result.records.length}`);
      console.log(`   Average confidence: ${(result.summary.averageConfidence * 100).toFixed(1)}%`);
      console.log('');
      
      if (result.summary.garmentTypes) {
        console.log('   Garment types found:');
        Object.entries(result.summary.garmentTypes).forEach(([type, count]) => {
          console.log(`     - ${type}: ${count}`);
        });
      }

      console.log('');
      console.log('=' .repeat(60));
      console.log('✅ Test PASSED - Streaming endpoint working correctly!');
      console.log('=' .repeat(60));

    } else {
      throw new Error('No result received from stream');
    }

  } catch (error) {
    console.error('\n❌ Test FAILED');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testVLTStreaming()
  .then(() => {
    console.log('\n✅ All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
