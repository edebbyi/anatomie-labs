#!/usr/bin/env node
/**
 * Test Replicate API Connection
 * Verifies that the REPLICATE_API_TOKEN is valid and working
 */

require('dotenv').config();
const Replicate = require('replicate');

console.log('🔍 Testing Replicate API Connection\n');
console.log('='.repeat(60));

// Check if token is set
const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error('❌ REPLICATE_API_TOKEN not found in environment');
  console.log('\n💡 Make sure .env file contains:');
  console.log('   REPLICATE_API_TOKEN=r8_your_token_here');
  process.exit(1);
}

console.log(`✅ Token found: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);
console.log('');

async function testConnection() {
  try {
    console.log('📡 Initializing Replicate client...');
    const replicate = new Replicate({ auth: token });
    
    console.log('✅ Client initialized');
    console.log('');
    
    console.log('🧪 Testing with a simple text generation...');
    console.log('   (This tests basic API connectivity)');
    console.log('');
    
    // Use a fast, simple model to test connectivity
    const model = 'meta/meta-llama-3-8b-instruct';
    const input = {
      prompt: 'Say "API connection successful" in exactly 3 words:',
      max_tokens: 10,
    };
    
    console.log(`   Model: ${model}`);
    console.log(`   Running prediction...`);
    
    const startTime = Date.now();
    const output = await replicate.run(model, { input });
    const duration = Date.now() - startTime;
    
    console.log('');
    console.log('✅ API call successful!');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Response: ${Array.isArray(output) ? output.join('') : output}`);
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Replicate API is working correctly!');
    console.log('='.repeat(60));
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. The VLT streaming endpoint should work now');
    console.log('   2. Test onboarding with a small ZIP file (3-5 images)');
    console.log('   3. Monitor backend logs: tail -f logs/combined.log');
    
  } catch (error) {
    console.error('\n❌ API test failed!');
    console.error('');
    console.error('Error:', error.message);
    
    if (error.message.includes('Unauthorized') || error.message.includes('401')) {
      console.error('');
      console.error('🔑 Authentication failed!');
      console.error('   The REPLICATE_API_TOKEN appears to be invalid.');
      console.error('');
      console.error('   Get a valid token from: https://replicate.com/account/api-tokens');
      console.error('   Then update .env file with: REPLICATE_API_TOKEN=r8_...');
    } else if (error.message.includes('rate limit')) {
      console.error('');
      console.error('⏱️  Rate limit reached!');
      console.error('   Wait a moment and try again.');
    } else {
      console.error('');
      console.error('Stack:', error.stack);
    }
    
    process.exit(1);
  }
}

testConnection();
