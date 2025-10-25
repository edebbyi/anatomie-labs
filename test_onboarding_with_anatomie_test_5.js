#!/usr/bin/env node
/**
 * End-to-End Onboarding Test with anatomie_test_5.zip
 * Tests the complete Podna onboarding flow programmatically using the anatomie_test_5.zip file
 */

const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
const ZIP_FILE = './anatomie_test_5.zip';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, title) {
  console.log('');
  log('━'.repeat(60), 'blue');
  log(`${step} ${title}`, 'yellow');
  log('━'.repeat(60), 'blue');
}

async function authenticate() {
  // Check if TOKEN environment variable is set
  if (process.env.TOKEN) {
    log('Using TOKEN from environment variable', 'cyan');
    return process.env.TOKEN;
  }

  try {
    // Try to register a new test user
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    log(`Registering new test user: ${testEmail}`, 'cyan');
    
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'E2E Test User'
    });
    
    return response.data.data.token;
  } catch (error) {
    if (error.response) {
      console.error('Registration failed:', error.response.data);
    }
    throw new Error('Authentication failed. Set TOKEN environment variable with a valid auth token.');
  }
}

async function runTest() {
  const startTime = Date.now();
  
  log('╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║   🧪 Podna Onboarding Test with anatomie_test_5.zip      ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');
  console.log('');

  // Check ZIP file
  if (!fs.existsSync(ZIP_FILE)) {
    log(`❌ ERROR: ${ZIP_FILE} not found`, 'red');
    log('Please run "node create_test_5_zip.js" first to create the ZIP file', 'yellow');
    process.exit(1);
  }

  const stats = fs.statSync(ZIP_FILE);
  log(`✅ Found ZIP file: ${ZIP_FILE}`, 'green');
  log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'cyan');

  let token, portfolioId, imageCount, analyzed, failed;

  try {
    // Step 0: Authentication
    logStep('🔐', 'Step 0: Authentication');
    token = await authenticate();
    log('✅ Authenticated successfully', 'green');
    if (token && token.length > 20) {
      log(`   Token: ${token.substring(0, 20)}...`, 'cyan');
    }

    // Step 1: Upload Portfolio
    logStep('📤', 'Step 1: Upload Portfolio');
    const uploadStart = Date.now();
    
    const formData = new FormData();
    formData.append('portfolio', fs.createReadStream(ZIP_FILE));

    const uploadResponse = await axios.post(`${API_URL}/podna/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const uploadDuration = ((Date.now() - uploadStart) / 1000).toFixed(1);
    log(`✅ Upload completed in ${uploadDuration}s`, 'green');
    console.log('');
    console.log('Response:', JSON.stringify(uploadResponse.data, null, 2));
    console.log('');

    portfolioId = uploadResponse.data.data.portfolioId;
    imageCount = uploadResponse.data.data.imageCount;

    log(`📦 Portfolio ID: ${portfolioId}`, 'green');
    log(`🖼️  Images Uploaded: ${imageCount}`, 'green');

    // Step 2: Analyze Portfolio
    logStep('🔬', 'Step 2: Analyze Portfolio (Gemini Vision)');
    log(`Analyzing ${imageCount} images with AI (may take 30-60s)...`, 'cyan');
    console.log('');

    const analyzeStart = Date.now();

    const analyzeResponse = await axios.post(
      `${API_URL}/podna/analyze/${portfolioId}`,
      {},
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 120000 // 2 minute timeout
      }
    );

    const analyzeDuration = ((Date.now() - analyzeStart) / 1000).toFixed(1);
    log(`✅ Analysis completed in ${analyzeDuration}s`, 'green');
    console.log('');
    console.log('Response:', JSON.stringify(analyzeResponse.data, null, 2));
    console.log('');

    analyzed = analyzeResponse.data.data.analyzed;
    failed = analyzeResponse.data.data.failed;

    log(`✅ Images Analyzed: ${analyzed}`, 'green');
    log(`⚠️  Images Failed: ${failed}`, 'yellow');

    // Step 3: Generate Style Profile
    logStep('👤', 'Step 3: Generate Style Profile');
    const profileStart = Date.now();

    const profileResponse = await axios.post(
      `${API_URL}/podna/profile/generate/${portfolioId}`,
      {},
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const profileDuration = ((Date.now() - profileStart) / 1000).toFixed(1);
    log(`✅ Profile generated in ${profileDuration}s`, 'green');
    console.log('');
    console.log('Response:', JSON.stringify(profileResponse.data, null, 2));
    console.log('');

    const styleLabels = profileResponse.data.data.profile.styleLabels;
    const totalImages = profileResponse.data.data.profile.totalImages;

    log(`🎨 Style Labels: ${JSON.stringify(styleLabels)}`, 'green');
    log(`📊 Total Images: ${totalImages}`, 'green');

    // Step 4: Generate Batch Images
    logStep('🎨', 'Step 4: Generate Initial Images (5 images)');
    log('Generating 5 images with Imagen-4 Ultra (may take 2-3 minutes)...', 'cyan');
    console.log('');

    const generateStart = Date.now();

    const generateResponse = await axios.post(
      `${API_URL}/podna/generate/batch`,
      {
        count: 5,
        mode: 'exploratory',
        provider: 'imagen-4-ultra'  // Using Imagen-4 Ultra as specified in the requirements
      },
      {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minute timeout
      }
    );

    const generateDuration = ((Date.now() - generateStart) / 1000).toFixed(1);
    log(`✅ Generation completed in ${generateDuration}s`, 'green');
    console.log('');
    console.log('Response:', JSON.stringify(generateResponse.data, null, 2));
    console.log('');

    const generatedCount = generateResponse.data.data.count;
    const totalCost = generateResponse.data.data.totalCostCents;

    log(`🖼️  Images Generated: ${generatedCount}`, 'green');
    log(`💰 Total Cost: $${(totalCost / 100).toFixed(2)} USD`, 'green');

    // Final Summary
    const totalTime = Date.now() - startTime;
    const totalMinutes = Math.floor(totalTime / 60000);
    const totalSeconds = Math.floor((totalTime % 60000) / 1000);

    console.log('');
    log('╔═══════════════════════════════════════════════════════════╗', 'blue');
    log('║   📊 End-to-End Test Summary                             ║', 'blue');
    log('╚═══════════════════════════════════════════════════════════╝', 'blue');
    console.log('');

    log('🎉 ONBOARDING COMPLETED SUCCESSFULLY!', 'green');
    console.log('');
    console.log('Timeline:');
    console.log(`  1. Upload:      ${uploadDuration}s → ${imageCount} images`);
    console.log(`  2. Analysis:    ${analyzeDuration}s → ${analyzed} analyzed, ${failed} failed`);
    console.log(`  3. Profile:     ${profileDuration}s → Style profile generated`);
    console.log(`  4. Generation:  ${generateDuration}s → ${generatedCount} images created`);
    console.log('');
    console.log(`  Total Time:     ${totalMinutes}m ${totalSeconds}s`);
    console.log('');
    log(`💰 Total API Cost: $${(totalCost / 100).toFixed(2)} USD`, 'green');
    console.log('');

  } catch (error) {
    log('', 'reset');
    log('❌ TEST FAILED', 'red');
    console.log('');
    
    if (error.response) {
      log(`HTTP ${error.response.status}: ${error.response.statusText}`, 'red');
      console.log('');
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      log('No response received from server', 'red');
    } else {
      log(`Error: ${error.message}`, 'red');
    }
    
    console.log('');
    console.log('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});