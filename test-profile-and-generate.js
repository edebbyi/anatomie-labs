#!/usr/bin/env node
/**
 * Test profile generation and image generation for analyzed portfolio
 */

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const API_URL = 'http://localhost:3001/api';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get the most recent test user
    log('\n🔍 Finding most recent test user...', 'cyan');
    const userResult = await pool.query(
      'SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1'
    );

    if (userResult.rows.length === 0) {
      log('❌ No users found', 'red');
      await pool.end();
      return;
    }

    const user = userResult.rows[0];
    log(`✅ Found user: ${user.email}`, 'green');

    // Get portfolio
    const portfolioResult = await pool.query(
      'SELECT id, processing_status, image_count FROM portfolios WHERE user_id = $1',
      [user.id]
    );

    if (portfolioResult.rows.length === 0) {
      log('❌ No portfolio found', 'red');
      await pool.end();
      return;
    }

    const portfolio = portfolioResult.rows[0];
    log(`✅ Portfolio: ${portfolio.id}`, 'green');
    log(`   Images: ${portfolio.image_count}`, 'cyan');

    // Check if descriptors exist
    const descriptorResult = await pool.query(
      'SELECT COUNT(*) as count FROM image_descriptors WHERE image_id IN (SELECT id FROM portfolio_images WHERE portfolio_id = $1)',
      [portfolio.id]
    );
    
    log(`✅ Descriptors: ${descriptorResult.rows[0].count}`, 'green');

    // Login to get token
    log('\n🔐 Logging in...', 'cyan');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: user.email,
      password: 'TestPassword123!' // Standard test password
    });

    if (!loginResponse.data.success) {
      log('❌ Login failed', 'red');
      await pool.end();
      return;
    }

    const token = loginResponse.data.data.token;
    log('✅ Login successful', 'green');

    // Step 1: Generate Style Profile
    log('\n🎨 Step 1: Generating style profile...', 'yellow');
    
    const profileStart = Date.now();
    const profileResponse = await axios.post(
      `${API_URL}/podna/profile/generate/${portfolio.id}`,
      {},
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 60000
      }
    );

    const profileDuration = ((Date.now() - profileStart) / 1000).toFixed(1);

    if (!profileResponse.data.success) {
      log(`❌ Profile generation failed: ${profileResponse.data.error}`, 'red');
      console.log('Response:', JSON.stringify(profileResponse.data, null, 2));
      await pool.end();
      return;
    }

    const profile = profileResponse.data.data.profile;
    log(`✅ Profile generated in ${profileDuration}s`, 'green');
    log(`   Style Labels: ${profile.styleLabels ? profile.styleLabels.join(', ') : 'N/A'}`, 'cyan');
    log(`   Summary: ${profile.summaryText ? profile.summaryText.substring(0, 80) + '...' : 'N/A'}`, 'cyan');

    // Step 2: Generate Images with Imagen-4 Ultra
    log('\n🖼️  Step 2: Generating images with Imagen-4 Ultra...', 'yellow');
    log('   Requesting 4 images to test...', 'cyan');
    
    const generateStart = Date.now();
    const generateResponse = await axios.post(
      `${API_URL}/podna/generate/batch`,
      {
        count: 4,
        mode: 'exploratory',
        provider: 'imagen-4-ultra'
      },
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 300000 // 5 minutes
      }
    );

    const generateDuration = ((Date.now() - generateStart) / 1000).toFixed(1);

    if (!generateResponse.data.success) {
      log(`❌ Image generation failed: ${generateResponse.data.error}`, 'red');
      console.log('Response:', JSON.stringify(generateResponse.data, null, 2));
      await pool.end();
      return;
    }

    const genData = generateResponse.data.data;
    log(`✅ Image generation complete in ${generateDuration}s`, 'green');
    log(`   Generated: ${genData.count} images`, 'cyan');
    log(`   Total Cost: ${genData.totalCostCents} cents`, 'cyan');

    if (genData.generations && genData.generations.length > 0) {
      log(`\n🖼️  Generated Images:`, 'yellow');
      genData.generations.forEach((g, i) => {
        log(`   ${i + 1}. ID: ${g.id}`, 'cyan');
        log(`      URL: ${g.url ? g.url.substring(0, 70) + '...' : 'No URL'}`, 'cyan');
      });
    }

    log('\n✅ Complete flow successful!', 'green');
    log('━'.repeat(70), 'cyan');

    await pool.end();

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    if (error.stack) {
      log(`\nStack: ${error.stack}`, 'red');
    }
    await pool.end();
    process.exit(1);
  }
}

main();
