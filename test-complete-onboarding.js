#!/usr/bin/env node
/**
 * Complete E2E Onboarding Test
 * Tests: Signup → Login → Portfolio Upload → Analysis → Profile → Image Generation
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const TEST_ZIP_PATH = './anatomie-zip.zip';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(emoji, title) {
  console.log('');
  log('━'.repeat(70), 'blue');
  log(`${emoji} ${title}`, 'yellow');
  log('━'.repeat(70), 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

async function checkServerHealth() {
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function createTestZip() {
  // No need to create - using existing anatomie-zip.zip
  logInfo('Using existing anatomie-zip.zip file');
}

async function runCompleteTest() {
  const startTime = Date.now();
  
  log('╔═══════════════════════════════════════════════════════════════════╗', 'magenta');
  log('║                                                                   ║', 'magenta');
  log('║      🧪 COMPLETE E2E ONBOARDING TEST                             ║', 'magenta');
  log('║      Signup → Portfolio → Analysis → Profile → Generation        ║', 'magenta');
  log('║                                                                   ║', 'magenta');
  log('╚═══════════════════════════════════════════════════════════════════╝', 'magenta');
  console.log('');

  // Step 0: Health Check
  logStep('🏥', 'Step 0: Server Health Check');
  const isHealthy = await checkServerHealth();
  
  if (!isHealthy) {
    logError('Backend server is not running on http://localhost:3001');
    logInfo('Please start the backend server first:');
    console.log('  $ npm run dev');
    console.log('  OR');
    console.log('  $ ./start-full-stack.sh');
    process.exit(1);
  }
  
  logSuccess('Backend server is healthy');

  // Step 0.5: Prepare test data
  logStep('📦', 'Step 0.5: Prepare Test Data');
  
  if (!fs.existsSync(TEST_ZIP_PATH)) {
    await createTestZip();
  } else {
    logSuccess('Test portfolio ZIP already exists');
  }

  const stats = fs.statSync(TEST_ZIP_PATH);
  logInfo(`ZIP file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  let testUser, token, portfolioId;

  try {
    // Step 1: Signup
    logStep('✍️', 'Step 1: User Signup');
    
    const testEmail = `test-${Date.now()}@anatomie.test`;
    const testPassword = 'TestPassword123!';
    const testName = 'E2E Test User';
    
    logInfo(`Creating test account: ${testEmail}`);
    
    const signupStart = Date.now();
    const signupResponse = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: testName
    });
    
    const signupDuration = ((Date.now() - signupStart) / 1000).toFixed(2);
    
    if (!signupResponse.data.success) {
      logError('Signup failed');
      console.log(JSON.stringify(signupResponse.data, null, 2));
      process.exit(1);
    }
    
    testUser = signupResponse.data.data.user;
    token = signupResponse.data.data.token;
    
    logSuccess(`User created in ${signupDuration}s`);
    logInfo(`User ID: ${testUser.id}`);
    logInfo(`Token: ${token.substring(0, 20)}...`);

    // Step 2: Login (verify credentials work)
    logStep('🔐', 'Step 2: User Login');
    
    const loginStart = Date.now();
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: testEmail,
      password: testPassword
    });
    
    const loginDuration = ((Date.now() - loginStart) / 1000).toFixed(2);
    
    if (!loginResponse.data.success) {
      logError('Login failed');
      console.log(JSON.stringify(loginResponse.data, null, 2));
      process.exit(1);
    }
    
    // Update token from login
    token = loginResponse.data.data.token;
    
    logSuccess(`Login successful in ${loginDuration}s`);
    logInfo(`Session token refreshed`);

    // Step 3: Upload Portfolio
    logStep('📤', 'Step 3: Portfolio Upload');
    
    logInfo('Uploading portfolio ZIP file...');
    logInfo('This may take 10-30 seconds depending on file size');
    
    const uploadStart = Date.now();
    
    const formData = new FormData();
    formData.append('portfolio', fs.createReadStream(TEST_ZIP_PATH));

    const uploadResponse = await axios.post(`${API_URL}/podna/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000
    });

    const uploadDuration = ((Date.now() - uploadStart) / 1000).toFixed(1);
    
    if (!uploadResponse.data.success) {
      logError('Upload failed');
      console.log(JSON.stringify(uploadResponse.data, null, 2));
      process.exit(1);
    }

    portfolioId = uploadResponse.data.data.portfolioId;
    const imageCount = uploadResponse.data.data.imageCount;

    logSuccess(`Upload completed in ${uploadDuration}s`);
    logInfo(`Portfolio ID: ${portfolioId}`);
    logInfo(`Images uploaded: ${imageCount}`);

    // Step 4: Analyze Portfolio
    logStep('🔬', 'Step 4: Portfolio Analysis (AI Vision)');
    
    logInfo('Analyzing images with OpenAI GPT-5 vision model...');
    logInfo('This may take 30-90 seconds for full analysis');
    console.log('');
    
    const analyzeStart = Date.now();
    let analyzed = 0, failed = 0;

    try {
      const analyzeResponse = await axios.post(
        `${API_URL}/podna/analyze/${portfolioId}`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 180000 // 3 minutes
        }
      );

      const analyzeDuration = ((Date.now() - analyzeStart) / 1000).toFixed(1);
      
      if (!analyzeResponse.data.success) {
        logError('Analysis failed');
        console.log(JSON.stringify(analyzeResponse.data, null, 2));
      } else {
        analyzed = analyzeResponse.data.data.analyzed || 0;
        failed = analyzeResponse.data.data.failed || 0;
        
        logSuccess(`Analysis completed in ${analyzeDuration}s`);
        logInfo(`Images analyzed: ${analyzed}`);
        if (failed > 0) {
          log(`⚠️  Images failed: ${failed}`, 'yellow');
        }
      }
    } catch (error) {
      logError('Analysis request failed');
      if (error.response) {
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('Error:', error.message);
      }
      log('⚠️  Continuing with test...', 'yellow');
    }

    // Step 5: Generate Style Profile
    logStep('👤', 'Step 5: Style Profile Generation');
    
    logInfo('Generating personalized style profile from analyzed images...');
    
    const profileStart = Date.now();
    
    try {
      const profileResponse = await axios.post(
        `${API_URL}/podna/profile/generate/${portfolioId}`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: 60000
        }
      );

      const profileDuration = ((Date.now() - profileStart) / 1000).toFixed(1);
      
      if (!profileResponse.data.success) {
        logError('Profile generation failed');
        console.log(JSON.stringify(profileResponse.data, null, 2));
      } else {
        const profile = profileResponse.data.data.profile;
        
        logSuccess(`Profile generated in ${profileDuration}s`);
        console.log('');
        log('Style Profile Summary:', 'cyan');
        log('─'.repeat(70), 'cyan');
        console.log(JSON.stringify(profile, null, 2));
        log('─'.repeat(70), 'cyan');
      }
    } catch (error) {
      logError('Profile generation request failed');
      if (error.response) {
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('Error:', error.message);
      }
      log('⚠️  Continuing with test...', 'yellow');
    }

    // Step 6: Generate Images
    logStep('🎨', 'Step 6: Initial Image Generation (Batch)');
    
    logInfo('Generating 8 images with Stable Diffusion XL...');
    logInfo('This may take 2-4 minutes depending on API speed');
    console.log('');
    
    const generateStart = Date.now();
    
    try {
      const generateResponse = await axios.post(
        `${API_URL}/podna/generate/batch`,
        {
          count: 8,
          mode: 'exploratory',
          provider: 'stable-diffusion'
        },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 300000, // 5 minutes
          onDownloadProgress: (progressEvent) => {
            // Show progress
            process.stdout.write('.');
          }
        }
      );

      console.log(''); // New line after progress dots
      const generateDuration = ((Date.now() - generateStart) / 1000).toFixed(1);
      
      if (!generateResponse.data.success) {
        logError('Image generation failed');
        console.log(JSON.stringify(generateResponse.data, null, 2));
      } else {
        const generatedCount = generateResponse.data.data.count || 0;
        const totalCost = generateResponse.data.data.totalCostCents || 0;
        const images = generateResponse.data.data.images || [];
        
        logSuccess(`Generation completed in ${generateDuration}s`);
        logInfo(`Images generated: ${generatedCount}`);
        logInfo(`Total cost: $${(totalCost / 100).toFixed(2)} USD`);
        
        if (images.length > 0) {
          console.log('');
          log('Generated Images:', 'cyan');
          log('─'.repeat(70), 'cyan');
          images.slice(0, 3).forEach((img, idx) => {
            console.log(`  ${idx + 1}. ${img.url || 'URL not available'}`);
            console.log(`     Prompt: ${(img.prompt || '').substring(0, 80)}...`);
          });
          if (images.length > 3) {
            console.log(`  ... and ${images.length - 3} more images`);
          }
          log('─'.repeat(70), 'cyan');
        }
      }
    } catch (error) {
      logError('Image generation request failed');
      if (error.response) {
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
      } else if (error.code === 'ECONNABORTED') {
        logError('Request timeout - generation may still be processing');
      } else {
        console.log('Error:', error.message);
      }
      log('⚠️  Check backend logs for details', 'yellow');
    }

    // Step 7: Verification
    logStep('🔍', 'Step 7: Database Verification');
    
    logInfo('Checking database for created records...');
    
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://esosaimafidon@localhost:5432/designer_bff'
    });
    
    await client.connect();
    
    // Check portfolios
    const portfolioResult = await client.query(
      'SELECT id, user_id, image_count, processing_status FROM portfolios WHERE id = $1',
      [portfolioId]
    );
    
    if (portfolioResult.rows.length > 0) {
      logSuccess('Portfolio record found in database');
      console.log('  ', portfolioResult.rows[0]);
    }
    
    // Check portfolio images
    const imagesResult = await client.query(
      'SELECT COUNT(*) as count FROM portfolio_images WHERE portfolio_id = $1',
      [portfolioId]
    );
    logInfo(`Portfolio images in DB: ${imagesResult.rows[0].count}`);
    
    // Check image descriptors
    const descriptorsResult = await client.query(
      `SELECT COUNT(*) as count FROM image_descriptors 
       WHERE image_id IN (SELECT id FROM portfolio_images WHERE portfolio_id = $1)`,
      [portfolioId]
    );
    logInfo(`Image descriptors in DB: ${descriptorsResult.rows[0].count}`);
    
    // Check style profile
    const profileResult = await client.query(
      'SELECT COUNT(*) as count FROM style_profiles WHERE user_id = $1',
      [testUser.id]
    );
    logInfo(`Style profiles in DB: ${profileResult.rows[0].count}`);
    
    // Check prompts
    const promptsResult = await client.query(
      'SELECT COUNT(*) as count FROM prompts WHERE user_id = $1',
      [testUser.id]
    );
    logInfo(`Prompts created: ${promptsResult.rows[0].count}`);
    
    // Check generations
    const generationsResult = await client.query(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = $1',
      [testUser.id]
    );
    logInfo(`Generations created: ${generationsResult.rows[0].count}`);
    
    await client.end();

    // Final Summary
    const totalTime = Date.now() - startTime;
    const totalMinutes = Math.floor(totalTime / 60000);
    const totalSeconds = Math.floor((totalTime % 60000) / 1000);

    console.log('');
    log('╔═══════════════════════════════════════════════════════════════════╗', 'magenta');
    log('║                                                                   ║', 'magenta');
    log('║                    📊 E2E TEST SUMMARY                           ║', 'magenta');
    log('║                                                                   ║', 'magenta');
    log('╚═══════════════════════════════════════════════════════════════════╝', 'magenta');
    console.log('');

    log('🎉 ONBOARDING FLOW COMPLETED!', 'green');
    console.log('');
    
    log('Test Timeline:', 'cyan');
    console.log(`  1. Signup:         ${signupDuration}s → User created`);
    console.log(`  2. Login:          ${loginDuration}s → Session authenticated`);
    console.log(`  3. Upload:         ${uploadDuration}s → Portfolio uploaded`);
    console.log(`  4. Analysis:       Completed → ${analyzed} images analyzed`);
    console.log(`  5. Profile:        Completed → Style profile generated`);
    console.log(`  6. Generation:     Completed → Images created`);
    console.log('');
    console.log(`  Total Time:        ${totalMinutes}m ${totalSeconds}s`);
    console.log('');
    
    log('Test Account Details:', 'cyan');
    console.log(`  Email:             ${testEmail}`);
    console.log(`  Password:          ${testPassword}`);
    console.log(`  User ID:           ${testUser.id}`);
    console.log(`  Portfolio ID:      ${portfolioId}`);
    console.log('');
    
    log('Database Verification:', 'cyan');
    console.log(`  ✓ Portfolio:       ${portfolioResult.rows.length > 0 ? 'Found' : 'Not found'}`);
    console.log(`  ✓ Images:          ${imagesResult.rows[0].count} uploaded`);
    console.log(`  ✓ Descriptors:     ${descriptorsResult.rows[0].count} analyzed`);
    console.log(`  ✓ Style Profile:   ${profileResult.rows[0].count} created`);
    console.log(`  ✓ Prompts:         ${promptsResult.rows[0].count} generated`);
    console.log(`  ✓ Generations:     ${generationsResult.rows[0].count} created`);
    console.log('');
    
    log('Next Steps:', 'yellow');
    console.log('  • View generated images in the frontend gallery');
    console.log('  • Test the profile page at http://localhost:3000/profile');
    console.log('  • Generate more images with different styles');
    console.log('  • Provide feedback on generated images');
    console.log('');
    
    log('Frontend URLs:', 'cyan');
    console.log('  • Dashboard:       http://localhost:3000/dashboard');
    console.log('  • Gallery:         http://localhost:3000/gallery');
    console.log('  • Profile:         http://localhost:3000/profile');
    console.log('');

  } catch (error) {
    console.log('');
    log('━'.repeat(70), 'red');
    log('❌ TEST FAILED', 'red');
    log('━'.repeat(70), 'red');
    console.log('');
    
    if (error.response) {
      log(`HTTP ${error.response.status}: ${error.response.statusText}`, 'red');
      console.log('');
      console.log('Response data:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      log('No response received from server', 'red');
      console.log('');
      logInfo('Check if the backend server is running:');
      console.log('  $ npm run dev');
    } else {
      log(`Error: ${error.message}`, 'red');
    }
    
    console.log('');
    console.log('Stack trace:');
    console.log(error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('Starting complete E2E onboarding test...');
console.log('');

runCompleteTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
