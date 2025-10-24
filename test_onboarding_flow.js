/**
 * Onboarding Flow Test Script
 * 
 * Tests the complete onboarding process:
 * 1. Upload portfolio ZIP
 * 2. Analyze images
 * 3. Generate style profile
 * 4. Generate images based on profile
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_ZIP = path.join(__dirname, 'anatomie_test_5.zip');
const TEST_USER_EMAIL = 'test@anatomie.com';
const TEST_USER_PASSWORD = 'test123';

// Axios instance with base URL
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000, // 5 minutes for large operations
  validateStatus: null // Don't throw on any status
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${'='.repeat(60)}]`, 'cyan');
  log(`Step ${step}: ${message}`, 'cyan');
  log(`[${'='.repeat(60)}]`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

// Test results tracking
const results = {
  upload: null,
  analysis: null,
  profile: null,
  generation: null,
  errors: []
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Step 1: Register/Login user
 */
async function authenticateUser() {
  logStep(1, 'Authenticating user');
  
  try {
    // Try to login first
    log('Attempting login...', 'blue');
    let response = await api.post('/api/auth/login', {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    });
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Login successful');
      return response.data.data.token;
    }
    
    // If login fails, try to register
    log('Login failed, attempting registration...', 'blue');
    response = await api.post('/api/auth/register', {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      name: 'Test User'
    });
    
    if (response.status === 201 && response.data.success) {
      logSuccess('Registration successful');
      return response.data.data.token;
    }
    
    throw new Error(`Authentication failed: ${response.data.message || 'Unknown error'}`);
    
  } catch (error) {
    logError(`Authentication error: ${error.message}`);
    results.errors.push({ step: 'authentication', error: error.message });
    throw error;
  }
}

/**
 * Step 2: Upload portfolio ZIP
 */
async function uploadPortfolio(token) {
  logStep(2, 'Uploading portfolio ZIP');
  
  if (!fs.existsSync(TEST_ZIP)) {
    throw new Error(`Test ZIP file not found: ${TEST_ZIP}`);
  }
  
  const stats = fs.statSync(TEST_ZIP);
  log(`File: ${TEST_ZIP}`, 'blue');
  log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'blue');
  
  try {
    const formData = new FormData();
    formData.append('portfolio', fs.createReadStream(TEST_ZIP));
    
    const response = await api.post('/api/podna/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || 'Upload failed');
    }
    
    results.upload = response.data.data;
    logSuccess(`Portfolio uploaded successfully`);
    logSuccess(`Portfolio ID: ${results.upload.portfolioId}`);
    logSuccess(`Images uploaded: ${results.upload.imageCount}`);
    logSuccess(`Processing time: ${results.upload.processingTimeMs}ms`);
    
    return results.upload.portfolioId;
    
  } catch (error) {
    logError(`Upload error: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    results.errors.push({ step: 'upload', error: error.message });
    throw error;
  }
}

/**
 * Step 3: Analyze portfolio
 */
async function analyzePortfolio(token, portfolioId) {
  logStep(3, 'Analyzing portfolio images');
  
  try {
    // Start analysis
    log('Starting image analysis...', 'blue');
    const response = await api.post(`/api/podna/analyze/${portfolioId}`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || 'Analysis failed');
    }
    
    // Poll for progress
    log('Polling analysis progress...', 'blue');
    let progress = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await sleep(5000); // Poll every 5 seconds
      
      const progressResponse = await api.get(`/api/podna/analyze/${portfolioId}/progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (progressResponse.data.success) {
        progress = progressResponse.data.data;
        
        if (progress.status === 'complete') {
          logSuccess('Analysis complete!');
          break;
        } else if (progress.status === 'failed') {
          throw new Error(progress.error || 'Analysis failed');
        } else if (progress.status === 'analyzing') {
          log(`Progress: ${progress.percentage}% - ${progress.message}`, 'yellow');
          if (progress.avgConfidence) {
            log(`  Avg Confidence: ${progress.avgConfidence.toFixed(2)}`, 'yellow');
          }
        }
      }
      
      attempts++;
    }
    
    if (!progress || progress.status !== 'complete') {
      throw new Error('Analysis timed out or did not complete');
    }
    
    results.analysis = response.data.data;
    logSuccess(`Images analyzed: ${results.analysis.analyzed}`);
    logSuccess(`Failed: ${results.analysis.failed}`);
    if (results.analysis.avgConfidence !== undefined && results.analysis.avgConfidence !== null) {
      logSuccess(`Avg Confidence: ${typeof results.analysis.avgConfidence === 'number' ? results.analysis.avgConfidence.toFixed(2) : results.analysis.avgConfidence}`);
    }
    if (results.analysis.avgCompleteness !== undefined && results.analysis.avgCompleteness !== null) {
      logSuccess(`Avg Completeness: ${typeof results.analysis.avgCompleteness === 'number' ? results.analysis.avgCompleteness.toFixed(2) : results.analysis.avgCompleteness}`);
    }
    logSuccess(`Descriptors extracted: ${results.analysis.descriptors}`);
    
    return results.analysis;
    
  } catch (error) {
    logError(`Analysis error: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    results.errors.push({ step: 'analysis', error: error.message });
    throw error;
  }
}

/**
 * Step 4: Generate style profile
 */
async function generateStyleProfile(token, portfolioId) {
  logStep(4, 'Generating style profile');
  
  try {
    log('Creating style profile from analyzed data...', 'blue');
    const response = await api.post(`/api/podna/profile/generate/${portfolioId}`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || 'Profile generation failed');
    }
    
    results.profile = response.data.data.profile;
    logSuccess('Style profile generated successfully');
    logSuccess(`Profile ID: ${results.profile.id}`);
    logSuccess(`Style Labels: ${JSON.stringify(results.profile.styleLabels)}`);
    logSuccess(`Total Images: ${results.profile.totalImages}`);
    log(`\nDistributions:`, 'blue');
    log(`  Garments: ${JSON.stringify(results.profile.distributions.garments, null, 2)}`, 'blue');
    log(`  Colors: ${JSON.stringify(results.profile.distributions.colors, null, 2)}`, 'blue');
    
    return results.profile;
    
  } catch (error) {
    logError(`Profile generation error: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    results.errors.push({ step: 'profile', error: error.message });
    throw error;
  }
}

/**
 * Step 5: Verify profile is accessible
 */
async function verifyProfile(token) {
  logStep(5, 'Verifying profile accessibility');
  
  try {
    log('Fetching style profile...', 'blue');
    const response = await api.get('/api/podna/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || 'Profile fetch failed');
    }
    
    const profile = response.data.data.profile;
    logSuccess('Profile fetched successfully');
    logSuccess(`Portfolio Images: ${profile.portfolioImages.length}`);
    
    return profile;
    
  } catch (error) {
    logError(`Profile verification error: ${error.message}`);
    results.errors.push({ step: 'profile_verify', error: error.message });
    throw error;
  }
}

/**
 * Step 6: Generate test image
 */
async function generateTestImage(token) {
  logStep(6, 'Generating test image');
  
  try {
    log('Generating image based on style profile...', 'blue');
    const response = await api.post('/api/podna/generate', {
      mode: 'exploratory',
      provider: 'imagen-4-ultra',
      upscale: false
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error(response.data.message || 'Image generation failed');
    }
    
    results.generation = response.data.data.generation;
    logSuccess('Image generated successfully');
    logSuccess(`Generation ID: ${results.generation.id}`);
    logSuccess(`URL: ${results.generation.url}`);
    logSuccess(`Provider: ${results.generation.provider}`);
    logSuccess(`Cost: ${results.generation.costCents} cents`);
    log(`\nPrompt used:`, 'blue');
    log(results.generation.promptText, 'blue');
    
    return results.generation;
    
  } catch (error) {
    logError(`Generation error: ${error.message}`);
    if (error.response) {
      logError(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    results.errors.push({ step: 'generation', error: error.message });
    throw error;
  }
}

/**
 * Main test execution
 */
async function runTest() {
  log('\n' + '='.repeat(80), 'cyan');
  log('ONBOARDING FLOW TEST', 'cyan');
  log('='.repeat(80) + '\n', 'cyan');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Authenticate
    const token = await authenticateUser();
    
    // Step 2: Upload portfolio
    const portfolioId = await uploadPortfolio(token);
    
    // Step 3: Analyze portfolio
    await analyzePortfolio(token, portfolioId);
    
    // Step 4: Generate style profile
    await generateStyleProfile(token, portfolioId);
    
    // Step 5: Verify profile
    await verifyProfile(token);
    
    // Step 6: Generate test image
    await generateTestImage(token);
    
    // Success summary
    const totalTime = Date.now() - startTime;
    log('\n' + '='.repeat(80), 'green');
    log('TEST COMPLETED SUCCESSFULLY', 'green');
    log('='.repeat(80), 'green');
    log(`\nTotal time: ${(totalTime / 1000).toFixed(2)}s`, 'green');
    log('\nResults Summary:', 'green');
    log(`  ✓ Portfolio uploaded: ${results.upload?.imageCount} images`, 'green');
    log(`  ✓ Images analyzed: ${results.analysis?.analyzed}/${results.analysis?.analyzed + results.analysis?.failed}`, 'green');
    log(`  ✓ Style profile created with ${results.profile?.styleLabels?.length || 0} style labels`, 'green');
    log(`  ✓ Image generated: ${results.generation?.id}`, 'green');
    log('\n');
    
    process.exit(0);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    log('\n' + '='.repeat(80), 'red');
    log('TEST FAILED', 'red');
    log('='.repeat(80), 'red');
    log(`\nTotal time: ${(totalTime / 1000).toFixed(2)}s`, 'red');
    log(`\nError: ${error.message}`, 'red');
    
    if (results.errors.length > 0) {
      log('\nError details:', 'red');
      results.errors.forEach(e => {
        log(`  ${e.step}: ${e.error}`, 'red');
      });
    }
    
    log('\n');
    process.exit(1);
  }
}

// Run the test
runTest();
