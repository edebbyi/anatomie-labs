#!/usr/bin/env node

/**
 * Comprehensive Onboarding Test Script
 * Tests the full onboarding flow with the anatomie_test_5.zip file
 */

const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const path = require('path');

const API_BASE = 'http://localhost:3001/api';
const TEST_ZIP = '/Users/esosaimafidon/Documents/GitHub/anatomie-lab/anatomie_test_5.zip';

let authToken = null;
let userId = null;
let portfolioId = null;

// Color logging
const log = {
  info: (msg, data = '') => console.log(`📘 ${msg}`, data),
  success: (msg, data = '') => console.log(`✅ ${msg}`, data),
  error: (msg, data = '') => console.log(`❌ ${msg}`, data),
  warn: (msg, data = '') => console.log(`⚠️  ${msg}`, data),
  step: (num, msg) => console.log(`\n${'═'.repeat(60)}\nSTEP ${num}: ${msg}\n${'═'.repeat(60)}`),
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Step 1: Register/Login Test User
async function testUserAuth() {
  log.step(1, 'Testing User Authentication');
  
  const testEmail = `test-${Date.now()}@anatomie.dev`;
  const testPassword = 'TestPassword123!';

  try {
    log.info('Registering test user:', testEmail);
    
    const registerRes = await axios.post(`${API_BASE}/auth/register`, {
      email: testEmail,
      password: testPassword,
      name: 'Test User'
    });

    if (registerRes.data.success) {
      authToken = registerRes.data.data.token;
      userId = registerRes.data.data.user.id;
      log.success('User registered and authenticated', `ID: ${userId}`);
      return true;
    }
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('exists')) {
      log.warn('User already exists, trying login');
      
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: testEmail,
        password: testPassword
      });
      
      authToken = loginRes.data.data.token;
      userId = loginRes.data.data.user.id;
      log.success('User logged in', `ID: ${userId}`);
      return true;
    }
    
    log.error('Authentication failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Step 2: Complete Onboarding (upload + analyze + profile generation)
async function testCompleteOnboarding() {
  log.step(2, 'Testing Complete Onboarding');
  
  try {
    if (!fs.existsSync(TEST_ZIP)) {
      log.error('Test zip file not found:', TEST_ZIP);
      return false;
    }

    log.info('Creating form data with zip file');
    const form = new FormData();
    form.append('portfolio', fs.createReadStream(TEST_ZIP), 'anatomie_test_5.zip');
    form.append('generateInitial', 'false'); // Skip image generation for now
    form.append('initialCount', '0');

    const config = {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 600000 // 10 minutes for full onboarding
    };

    log.info('Submitting complete onboarding to /api/podna/onboard');
    const onboardRes = await axios.post(`${API_BASE}/podna/onboard`, form, config);

    if (onboardRes.data.success) {
      portfolioId = onboardRes.data.data.portfolio.id;
      log.success('Onboarding complete!', `Portfolio ID: ${portfolioId}`);
      
      // Log the onboarding results
      if (onboardRes.data.data) {
        log.info('Onboarding Results:');
        if (onboardRes.data.data.portfolio) {
          log.info('  Portfolio - Images uploaded:', onboardRes.data.data.portfolio.imageCount);
        }
        if (onboardRes.data.data.analysis) {
          log.info('  Analysis - Analyzed:', onboardRes.data.data.analysis.analyzed);
          log.info('  Analysis - Failed:', onboardRes.data.data.analysis.failed);
          log.info('  Analysis - Avg Confidence:', onboardRes.data.data.analysis.avgConfidence?.toFixed(2));
          log.info('  Analysis - Avg Completeness:', onboardRes.data.data.analysis.avgCompleteness?.toFixed(2));
        }
        if (onboardRes.data.data.profile) {
          log.info('  Profile - ID:', onboardRes.data.data.profile.id);
          log.info('  Profile - Style Labels:', onboardRes.data.data.profile.styleLabels?.slice(0, 5).join(', '));
        }
      }
      
      return true;
    }
  } catch (error) {
    log.error('Onboarding failed:', error.response?.data?.message || error.message);
    if (error.response?.data?.details) {
      log.error('Details:', error.response.data.details);
    }
    if (error.response?.data?.error) {
      log.error('Error:', error.response.data.error);
    }
    return false;
  }
}

// Step 3: Fetch Final Profile
async function testFetchProfile() {
  log.step(3, 'Testing Fetch User Profile');

  try {
    log.info('Fetching user profile');
    
    const profileRes = await axios.get(
      `${API_BASE}/podna/profile`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    if (profileRes.data.success) {
      log.success('Profile fetched successfully');
      
      if (profileRes.data.data?.profile) {
        const profile = profileRes.data.data.profile;
        log.info('Profile ID:', profile.id);
        log.info('Total Images:', profile.total_images);
        log.info('Created At:', profile.created_at);
      }
      return true;
    }
  } catch (error) {
    log.error('Fetch profile failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Main Test Runner
async function runTests() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       ANATOMIE LAB - ONBOARDING SYSTEM TEST SUITE          ║
║                 Testing with: anatomie_test_5.zip          ║
╚════════════════════════════════════════════════════════════╝
  `);

  const results = {};

  // Test 1: Auth
  results.auth = await testUserAuth();
  if (!results.auth) {
    log.error('Authentication failed - stopping tests');
    process.exit(1);
  }

  // Test 2: Complete Onboarding (upload + analyze + profile generation)
  results.onboarding = await testCompleteOnboarding();
  if (!results.onboarding) {
    log.error('Onboarding failed - stopping tests');
    process.exit(1);
  }

  // Test 3: Fetch Profile
  results.fetch = await testFetchProfile();

  // Final Summary
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log(`✅ Authentication:        ${results.auth ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Complete Onboarding:   ${results.onboarding ? 'PASS' : 'FAIL'}`);
  console.log(`✅ Profile Fetch:         ${results.fetch ? 'PASS' : 'FAIL'}`);

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  console.log(`
Total: ${passed}/${total} tests passed
${passed === total ? '🎉 ALL TESTS PASSED!' : '⚠️  Some tests failed'}
  `);

  process.exit(passed === total ? 0 : 1);
}

// Run with error handling
runTests().catch(err => {
  log.error('Unexpected error:', err.message);
  process.exit(1);
});