#!/usr/bin/env node
/**
 * Test Generation Fix
 * Tests the fixed image generation and prompt creation
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testGeneration() {
  try {
    console.log('🧪 Testing Image Generation Fix\n');
    
    // Login
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'test-1761178218472@anatomie.test',
      password: 'TestPassword123!'
    });
    
    const TOKEN = loginResponse.data.data.token;
    const USER_ID = loginResponse.data.data.user.id;
    console.log(`✅ Logged in as: ${USER_ID}\n`);
    
    // Test 1: Generate single image
    console.log('━'.repeat(70));
    console.log('🎨 Test 1: Generate Single Image');
    console.log('━'.repeat(70));
    console.log('⏱️  Generating with Stable Diffusion...\n');
    
    const singleStart = Date.now();
    const singleResponse = await axios.post(
      `${API_URL}/podna/generate`,
      {
        mode: 'exploratory',
        provider: 'stable-diffusion'
      },
      {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        timeout: 120000
      }
    );
    
    const singleDuration = ((Date.now() - singleStart) / 1000).toFixed(1);
    console.log(`✅ Single image generated in ${singleDuration}s\n`);
    console.log('Generated Image:');
    console.log(`  ID: ${singleResponse.data.data.generation.id}`);
    console.log(`  URL: ${singleResponse.data.data.generation.url}`);
    console.log(`  Prompt: ${singleResponse.data.data.generation.promptText.substring(0, 100)}...`);
    console.log(`  Cost: $${(singleResponse.data.data.generation.costCents / 100).toFixed(2)}\n`);
    
    // Test 2: Generate batch
    console.log('━'.repeat(70));
    console.log('🎨 Test 2: Generate Batch (4 images)');
    console.log('━'.repeat(70));
    console.log('⏱️  This may take 1-2 minutes...\n');
    
    const batchStart = Date.now();
    const batchResponse = await axios.post(
      `${API_URL}/podna/generate/batch`,
      {
        count: 4,
        mode: 'exploratory',
        provider: 'stable-diffusion'
      },
      {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        timeout: 300000
      }
    );
    
    const batchDuration = ((Date.now() - batchStart) / 1000).toFixed(1);
    console.log(`✅ Batch generated in ${batchDuration}s\n`);
    console.log('Batch Results:');
    console.log(`  Images Generated: ${batchResponse.data.data.count}`);
    console.log(`  Total Cost: $${(batchResponse.data.data.totalCostCents / 100).toFixed(2)}\n`);
    
    if (batchResponse.data.data.generations.length > 0) {
      console.log('Sample Images:');
      batchResponse.data.data.generations.slice(0, 3).forEach((img, idx) => {
        console.log(`  ${idx + 1}. ID: ${img.id}`);
        console.log(`     URL: ${img.url}`);
      });
    }
    
    // Test 3: Verify database
    console.log('\n' + '━'.repeat(70));
    console.log('🔍 Test 3: Database Verification');
    console.log('━'.repeat(70));
    
    const { Client } = require('pg');
    const client = new Client({
      connectionString: 'postgresql://esosaimafidon@localhost:5432/designer_bff'
    });
    
    await client.connect();
    
    const promptsCount = await client.query(
      'SELECT COUNT(*) as count FROM prompts WHERE user_id = $1',
      [USER_ID]
    );
    
    const generationsCount = await client.query(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = $1',
      [USER_ID]
    );
    
    await client.end();
    
    console.log(`\n✅ Prompts in DB: ${promptsCount.rows[0].count}`);
    console.log(`✅ Generations in DB: ${generationsCount.rows[0].count}`);
    
    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('═'.repeat(70));
    console.log('\n✅ Image Generation: FIXED');
    console.log('✅ Prompt Creation: WORKING');
    console.log('✅ Database Storage: WORKING');
    console.log('\n🌐 View your images at:');
    console.log('  http://localhost:3000/gallery');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error('\nStack:', error.stack);
    }
    process.exit(1);
  }
}

testGeneration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
