/**
 * Test script to verify prompt variation
 * Generates 5 images and checks if prompts are different
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const TEST_USER_EMAIL = 'test@anatomie.com';
const TEST_USER_PASSWORD = 'test123';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  validateStatus: null
});

async function login() {
  const response = await api.post('/api/auth/login', {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD
  });
  
  if (response.status === 200 && response.data.success) {
    return response.data.data.token;
  }
  
  throw new Error('Login failed');
}

async function generateImage(token, index) {
  console.log(`\nGenerating image ${index + 1}...`);
  
  const response = await api.post('/api/podna/generate', {
    mode: 'exploratory',
    provider: 'imagen-4-ultra',
    upscale: false
  }, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.status === 200 && response.data.success) {
    const generation = response.data.data.generation;
    console.log(`✓ Image ${index + 1} generated`);
    console.log(`  Prompt: ${generation.promptText}`);
    return generation.promptText;
  } else {
    console.log(`✗ Image ${index + 1} failed: ${response.data.message}`);
    return null;
  }
}

async function testVariation() {
  console.log('='.repeat(80));
  console.log('PROMPT VARIATION TEST');
  console.log('='.repeat(80));
  
  try {
    // Login
    console.log('\n1. Authenticating...');
    const token = await login();
    console.log('✓ Authenticated');
    
    // Generate 5 images
    console.log('\n2. Generating 5 images...');
    const prompts = [];
    
    for (let i = 0; i < 5; i++) {
      const prompt = await generateImage(token, i);
      if (prompt) {
        prompts.push(prompt);
      }
      // Wait a bit between generations
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Analyze variation
    console.log('\n' + '='.repeat(80));
    console.log('VARIATION ANALYSIS');
    console.log('='.repeat(80));
    
    const uniquePrompts = new Set(prompts);
    console.log(`\nTotal prompts: ${prompts.length}`);
    console.log(`Unique prompts: ${uniquePrompts.size}`);
    console.log(`Variation rate: ${((uniquePrompts.size / prompts.length) * 100).toFixed(1)}%`);
    
    if (uniquePrompts.size === prompts.length) {
      console.log('\n✅ SUCCESS: All prompts are unique!');
    } else if (uniquePrompts.size > prompts.length * 0.6) {
      console.log('\n⚠️ PARTIAL: Most prompts are unique');
    } else {
      console.log('\n❌ FAILED: Too many duplicate prompts');
    }
    
    // Show prompt details
    console.log('\n' + '='.repeat(80));
    console.log('PROMPT DETAILS');
    console.log('='.repeat(80));
    
    prompts.forEach((prompt, index) => {
      console.log(`\n${index + 1}. ${prompt}`);
    });
    
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testVariation();
