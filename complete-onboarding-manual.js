#!/usr/bin/env node
/**
 * Complete the onboarding for the most recent test user
 * Continues from: Portfolio uploaded → Analyze → Profile → Generate
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
    log(`✅ Portfolio: ${portfolio.id} (${portfolio.image_count} images)`, 'green');
    log(`   Status: ${portfolio.processing_status}`, 'cyan');

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

    // Step 1: Analyze Portfolio
    log('\n🔬 Step 1: Analyzing portfolio with AI...', 'yellow');
    log('   This may take 30-90 seconds...', 'cyan');
    
    const analyzeStart = Date.now();
    const analyzeResponse = await axios.post(
      `${API_URL}/podna/analyze/${portfolio.id}`,
      {},
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 300000 // 5 minutes for 44 images
      }
    );

    const analyzeDuration = ((Date.now() - analyzeStart) / 1000).toFixed(1);

    if (!analyzeResponse.data.success) {
      log(`❌ Analysis failed: ${analyzeResponse.data.error}`, 'red');
      await pool.end();
      return;
    }

    log(`✅ Analysis complete in ${analyzeDuration}s`, 'green');
    log(`   Analyzed: ${analyzeResponse.data.data.analyzedCount}/${analyzeResponse.data.data.totalImages} images`, 'cyan');

    // Step 2: Generate Style Profile
    log('\n🎨 Step 2: Generating style profile...', 'yellow');
    
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
      await pool.end();
      return;
    }

    const profile = profileResponse.data.data;
    log(`✅ Profile generated in ${profileDuration}s`, 'green');
    log(`   Style: ${profile.styleLabels ? profile.styleLabels.join(', ') : 'N/A'}`, 'cyan');

    // Step 3: Generate Images
    log('\n🖼️  Step 3: Generating images with Imagen-4 Ultra...', 'yellow');
    log('   Requesting 8 images...', 'cyan');
    
    const generateStart = Date.now();
    const generateResponse = await axios.post(
      `${API_URL}/podna/generate/batch`,
      {
        count: 8,
        mode: 'exploratory',
        provider: 'imagen-4-ultra' // Use Imagen-4 Ultra explicitly
      },
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 300000 // 5 minutes for image generation
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
    log(`   Requested: ${genData.requested}`, 'cyan');
    log(`   Generated: ${genData.generated}`, 'cyan');
    log(`   Failed: ${genData.failed}`, 'cyan');

    if (genData.prompts && genData.prompts.length > 0) {
      log(`\n📝 Generated Prompts:`, 'yellow');
      genData.prompts.forEach((p, i) => {
        log(`   ${i + 1}. ${p.text.substring(0, 60)}...`, 'cyan');
      });
    }

    if (genData.results && genData.results.length > 0) {
      log(`\n🖼️  Generated Images:`, 'yellow');
      genData.results.forEach((r, i) => {
        log(`   ${i + 1}. ${r.url ? r.url.substring(0, 60) + '...' : 'No URL'}`, 'cyan');
        if (r.error) log(`      Error: ${r.error}`, 'red');
      });
    }

    log('\n✅ Complete onboarding flow successful!', 'green');
    log('━'.repeat(60), 'cyan');

    await pool.end();

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    await pool.end();
    process.exit(1);
  }
}

main();
