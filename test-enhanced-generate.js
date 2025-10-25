const axios = require('axios');

// Test the enhanced /generate endpoint
async function testEnhancedGenerate() {
  try {
    console.log('🧪 Testing Enhanced /generate Endpoint');
    console.log('=====================================');
    
    // You'll need to replace this with a valid token from your system
    const TOKEN = process.env.TEST_AUTH_TOKEN || 'YOUR_AUTH_TOKEN_HERE';
    const API_URL = process.env.API_URL || 'http://localhost:3001/api';
    
    if (TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
      console.log('⚠️  Please set TEST_AUTH_TOKEN environment variable');
      console.log('Example: export TEST_AUTH_TOKEN="your-jwt-token"');
      return;
    }
    
    // Test 1: Generate with user prompt and interpretation
    console.log('\n📝 Test 1: Generate with User Prompt and Interpretation');
    console.log('--------------------------------------------------------');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${API_URL}/podna/generate`,
      {
        prompt: 'elegant black evening gown with silver accents',
        mode: 'exploratory',
        provider: 'imagen-4-ultra',
        interpret: true
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minute timeout
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (response.data.success) {
      console.log(`✅ Success! Generated in ${duration}s`);
      console.log(`🆔 Generation ID: ${response.data.data.generation.id}`);
      console.log(`🔗 URL: ${response.data.data.generation.url}`);
      console.log(`📄 Enhanced Prompt: ${response.data.data.generation.promptText.substring(0, 100)}...`);
      console.log(`💰 Cost: $${(response.data.data.generation.costCents / 100).toFixed(2)}`);
    } else {
      console.log('❌ Failed to generate image');
      console.log('Error:', response.data.message);
    }
    
    // Test 2: Generate without interpretation (existing behavior)
    console.log('\n📝 Test 2: Generate without Interpretation (Existing Behavior)');
    console.log('-----------------------------------------------------------------');
    
    const startTime2 = Date.now();
    
    const response2 = await axios.post(
      `${API_URL}/podna/generate`,
      {
        mode: 'exploratory',
        provider: 'imagen-4-ultra',
        interpret: false
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minute timeout
      }
    );
    
    const duration2 = ((Date.now() - startTime2) / 1000).toFixed(1);
    
    if (response2.data.success) {
      console.log(`✅ Success! Generated in ${duration2}s`);
      console.log(`🆔 Generation ID: ${response2.data.data.generation.id}`);
      console.log(`🔗 URL: ${response2.data.data.generation.url}`);
      console.log(`📄 Prompt: ${response2.data.data.generation.promptText.substring(0, 100)}...`);
      console.log(`💰 Cost: $${(response2.data.data.generation.costCents / 100).toFixed(2)}`);
    } else {
      console.log('❌ Failed to generate image');
      console.log('Error:', response2.data.message);
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testEnhancedGenerate();