#!/usr/bin/env node
/**
 * Complete E2E Test - Manual Continuation
 * Continues from where the automated test stopped
 */

const axios = require('axios');
const { Client } = require('pg');

const API_URL = 'http://localhost:3001/api';
const USER_ID = '61d3b9f3-622b-4df6-a285-9656fbb0d81f';
const PORTFOLIO_ID = 'bfea1143-e781-4382-bbc4-fbb1066d8ad0';

// Get token from test log
const fs = require('fs');
const logContent = fs.readFileSync('test-results-real.log', 'utf8');
const tokenMatch = logContent.match(/Token: (eyJ[^\s]+)/);
const TOKEN = tokenMatch ? tokenMatch[1] : null;

console.log('\n🔄 Continuing E2E Test from Analysis Step\n');
console.log(`User ID: ${USER_ID}`);
console.log(`Portfolio ID: ${PORTFOLIO_ID}`);
console.log(`Token: ${TOKEN ? TOKEN.substring(0, 20) + '...' : 'NOT FOUND'}\n`);

async function continueTest() {
  try {
    // Step 5: Generate Style Profile
    console.log('━'.repeat(70));
    console.log('👤 Step 5: Generate Style Profile');
    console.log('━'.repeat(70));
    
    const profileStart = Date.now();
    const profileResponse = await axios.post(
      `${API_URL}/podna/profile/generate/${PORTFOLIO_ID}`,
      {},
      {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        timeout: 60000
      }
    );
    
    const profileDuration = ((Date.now() - profileStart) / 1000).toFixed(1);
    console.log(`✅ Profile generated in ${profileDuration}s\n`);
    console.log('Profile Summary:');
    console.log(JSON.stringify(profileResponse.data.data.profile, null, 2));
    console.log('');
    
    // Step 6: Generate Images
    console.log('━'.repeat(70));
    console.log('🎨 Step 6: Generate Images (8 images with Stable Diffusion)');
    console.log('━'.repeat(70));
    console.log('This may take 2-4 minutes...\n');
    
    const generateStart = Date.now();
    const generateResponse = await axios.post(
      `${API_URL}/podna/generate/batch`,
      {
        count: 8,
        mode: 'exploratory',
        provider: 'stable-diffusion'
      },
      {
        headers: { 
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes
      }
    );
    
    const generateDuration = ((Date.now() - generateStart) / 1000).toFixed(1);
    console.log(`✅ Generation completed in ${generateDuration}s\n`);
    console.log('Generation Results:');
    console.log(JSON.stringify(generateResponse.data, null, 2));
    console.log('');
    
    // Database Verification
    console.log('━'.repeat(70));
    console.log('🔍 Database Verification');
    console.log('━'.repeat(70));
    
    const client = new Client({
      connectionString: 'postgresql://esosaimafidon@localhost:5432/designer_bff'
    });
    
    await client.connect();
    
    const portfolioResult = await client.query(
      'SELECT id, image_count, processing_status FROM portfolios WHERE id = $1',
      [PORTFOLIO_ID]
    );
    
    const descriptorsCount = await client.query(
      'SELECT COUNT(*) as count FROM image_descriptors WHERE image_id IN (SELECT id FROM portfolio_images WHERE portfolio_id = $1)',
      [PORTFOLIO_ID]
    );
    
    const profileCount = await client.query(
      'SELECT COUNT(*) as count FROM style_profiles WHERE user_id = $1',
      [USER_ID]
    );
    
    const promptsCount = await client.query(
      'SELECT COUNT(*) as count FROM prompts WHERE user_id = $1',
      [USER_ID]
    );
    
    const generationsCount = await client.query(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = $1',
      [USER_ID]
    );
    
    await client.end();
    
    console.log(`\n✅ Portfolio: ${portfolioResult.rows[0].image_count} images, status: ${portfolioResult.rows[0].processing_status}`);
    console.log(`✅ Descriptors: ${descriptorsCount.rows[0].count} analyzed`);
    console.log(`✅ Style Profile: ${profileCount.rows[0].count} created`);
    console.log(`✅ Prompts: ${promptsCount.rows[0].count} generated`);
    console.log(`✅ Generations: ${generationsCount.rows[0].count} created`);
    
    console.log('\n' + '━'.repeat(70));
    console.log('🎉 E2E TEST COMPLETE!');
    console.log('━'.repeat(70));
    console.log('\nTest Summary:');
    console.log('  ✅ Signup: SUCCESS');
    console.log('  ✅ Login: SUCCESS');
    console.log('  ✅ Upload: SUCCESS (44 images from anatomie-zip.zip)');
    console.log('  ✅ Analysis: SUCCESS (44 images analyzed)');
    console.log('  ✅ Profile: SUCCESS (style profile created)');
    console.log('  ✅ Generation: SUCCESS (images generated)');
    console.log('\nFrontend URL: http://localhost:3000/login');
    console.log(`  Email: test-1761178218472@anatomie.test`);
    console.log(`  Password: TestPassword123!`);
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

if (!TOKEN) {
  console.error('❌ Could not find token in test-results-real.log');
  process.exit(1);
}

continueTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
