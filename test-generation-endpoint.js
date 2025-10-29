#!/usr/bin/env node

/**
 * Test the /api/generate/generate endpoint to diagnose the 500 error
 */

const http = require('http');

const testData = JSON.stringify({
  userId: null, // Test without userId first
  description: 'elegant black dress',
  model: 'google-imagen',
  count: 1
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/generate/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length
  }
};

console.log('🧪 Testing /api/generate/generate endpoint...\n');
console.log('Request:', JSON.parse(testData));
console.log('\n' + '='.repeat(60) + '\n');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Status Message: ${res.statusMessage}`);
  console.log('\nHeaders:', res.headers);
  console.log('\n' + '='.repeat(60) + '\n');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Response:', JSON.stringify(parsed, null, 2));
      
      if (res.statusCode === 500) {
        console.log('\n❌ ERROR FOUND:');
        console.log('Error Message:', parsed.error);
        console.log('\nThis is the error causing the 500 response.');
      } else if (res.statusCode === 200) {
        console.log('\n✅ SUCCESS! Endpoint is working.');
      }
    } catch (error) {
      console.log('Raw Response:', data);
      console.log('\nParse Error:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log('\nMake sure the server is running on port 3001');
});

req.write(testData);
req.end();

