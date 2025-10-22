require('dotenv').config();
const axios = require('axios');

async function testVLT() {
  const apiUrl = process.env.VLT_API_URL || 'https://visual-descriptor-516904417440.us-central1.run.app';
  const apiKey = process.env.VLT_API_KEY;

  console.log('🔍 Testing VLT API...');
  console.log(`   URL: ${apiUrl}`);
  console.log(`   API Key: ${apiKey ? '✅ Configured' : '❌ Missing'}`);
  
  if (!apiKey) {
    console.error('❌ VLT_API_KEY not found in .env');
    return;
  }

  // Test 1: Try healthz endpoint
  console.log('\n📡 Test 1: Health check (may not exist)');
  try {
    const response = await axios.get(`${apiUrl}/healthz`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 5000
    });
    console.log('✅ Health endpoint accessible:', response.status);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⚠️  Health endpoint returns 404 (this is normal)');
    } else {
      console.log('⚠️  Health check failed:', error.message);
    }
  }

  // Test 2: Try listing or checking API access
  console.log('\n📡 Test 2: Check API access');
  try {
    const response = await axios.get(`${apiUrl}/v1/jobs`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 5000
    });
    console.log('✅ API accessible:', response.status);
    console.log('   Response:', response.data);
  } catch (error) {
    if (error.response) {
      console.log(`⚠️  API returned ${error.response.status}:`, error.response.data);
      if (error.response.status === 401) {
        console.log('❌ API Key is invalid or unauthorized');
      } else if (error.response.status === 404) {
        console.log('ℹ️  Endpoint not found - VLT API might need a POST request with an image');
      }
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  console.log('\n✨ VLT API test complete!');
  console.log('ℹ️  To fully test VLT, you need to upload an actual image file.');
}

testVLT().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});