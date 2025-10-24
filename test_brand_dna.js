/**
 * Simple test script to verify Brand DNA functionality
 */

const http = require('http');

// Test the /generate-with-dna endpoint
const testGenerateWithDNA = () => {
  const postData = JSON.stringify({
    prompt: 'black blazer',
    enforceBrandDNA: true,
    brandDNAStrength: 0.8,
    creativity: 0.3,
    count: 2
  });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/podna/generate-with-dna',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
      // Note: In a real test, you would need to include an Authorization header
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    res.on('data', (chunk) => {
      console.log(`Body: ${chunk}`);
    });
    
    res.on('end', () => {
      console.log('Test completed');
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(postData);
  req.end();
};

// Test the /profile endpoint
const testGetProfile = () => {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/podna/profile',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
      // Note: In a real test, you would need to include an Authorization header
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Profile Status: ${res.statusCode}`);
    
    res.on('data', (chunk) => {
      console.log(`Profile Body: ${chunk}`);
    });
    
    res.on('end', () => {
      console.log('Profile test completed');
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with profile request: ${e.message}`);
  });

  req.end();
};

// Run tests
console.log('Testing Brand DNA functionality...');
testGetProfile();
// testGenerateWithDNA(); // This would require authentication

console.log('Test script completed. Note: Full testing requires authentication tokens.');