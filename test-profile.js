#!/usr/bin/env node

/**
 * Quick test script to verify profile endpoint
 * Run with: node test-profile.js <auth-token>
 */

const http = require('http');

const authToken = process.argv[2];

if (!authToken) {
  console.error('Usage: node test-profile.js <auth-token>');
  console.error('Get your auth token from the browser developer tools (Application > Local Storage)');
  process.exit(1);
}

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/podna/profile',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  }
};

console.log('🔍 Testing profile endpoint...');
console.log(`   GET http://localhost:3001/api/podna/profile`);
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('');
    
    if (res.statusCode === 200) {
      console.log('✅ Success!');
      console.log('');
      try {
        const json = JSON.parse(data);
        console.log('Profile Data:');
        console.log(JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('Response:', data);
      }
    } else {
      console.log('❌ Error!');
      console.log('');
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.end();
