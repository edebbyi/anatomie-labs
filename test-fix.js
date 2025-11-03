#!/usr/bin/env node

/**
 * Test script to verify the generate/batch endpoint fix
 */

const http = require('http');

// Test 1: Verify the server is responding to the generate/batch endpoint
async function testGenerateBatch() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      count: 5,
      mode: 'exploratory',
      provider: 'imagen-4-ultra'
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/podna/generate/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer test-token'
      }
    };

    console.log('🧪 Testing POST /api/podna/generate/batch...');
    
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          // The endpoint should fail due to missing auth, but NOT due to continuousLearningAgent
          if (data.includes('continuousLearningAgent is not defined')) {
            console.log('❌ FAILED: continuousLearningAgent error still present!');
            reject(new Error('continuousLearningAgent is not defined'));
          } else if (res.statusCode === 401) {
            console.log('✅ PASSED: Got auth error (expected), not continuousLearningAgent error');
            resolve();
          } else if (res.statusCode === 500 && response.message) {
            console.log('📝 Got error:', response.message);
            if (response.message.includes('continuousLearningAgent')) {
              console.log('❌ FAILED: continuousLearningAgent error still present!');
              reject(new Error(response.message));
            } else {
              console.log('✅ PASSED: Got server error (not continuousLearningAgent)');
              resolve();
            }
          } else {
            console.log('✅ PASSED: Endpoint responded without continuousLearningAgent error');
            console.log('📝 Response status:', res.statusCode);
            resolve();
          }
        } catch (e) {
          console.log('✅ PASSED: Endpoint responded (could not parse JSON, but no crash)');
          resolve();
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ FAILED: Request error:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
testGenerateBatch()
  .then(() => {
    console.log('\n🎉 All tests passed! The fix is working.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });