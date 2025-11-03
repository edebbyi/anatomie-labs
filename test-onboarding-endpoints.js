#!/usr/bin/env node

/**
 * Test script to diagnose onboarding pipeline failures
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001';

// Test data
let testData = {
  token: null,
  userId: null,
  portfolioId: null,
};

const log = {
  info: (msg, data) => console.log(`\n✅ ${msg}`, data || ''),
  error: (msg, data) => console.log(`\n❌ ${msg}`, data || ''),
  warn: (msg, data) => console.log(`\n⚠️ ${msg}`, data || ''),
  header: (msg) => console.log(`\n${'='.repeat(60)}\n📋 ${msg}\n${'='.repeat(60)}`),
};

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function testOnboarding() {
  try {
    log.header('ONBOARDING PIPELINE DIAGNOSTIC');

    // Step 1: Create test user
    log.info('Step 1: Registering test user');
    const email = `test-${Date.now()}@test.com`;
    const registerRes = await makeRequest('POST', '/api/auth/register', {
      email,
      password: 'TestPassword123!',
      name: 'Test User'
    });

    if (registerRes.status !== 201 && registerRes.status !== 200) {
      log.error(`Registration failed with status ${registerRes.status}`, registerRes.data);
      return;
    }

    testData.userId = registerRes.data.data?.id || registerRes.data.user?.id;
    testData.token = registerRes.data.data?.token || registerRes.data.token;

    log.info('User registered', { userId: testData.userId, email });

    // Step 2: Test analyze endpoint directly (without actually uploading)
    log.header('TESTING ENDPOINTS');

    log.info('Step 2: Testing /api/podna/analyze/:portfolioId endpoint');
    const analyzeRes = await makeRequest('POST', '/api/podna/analyze/test-portfolio-id', {}, testData.token);
    
    if (analyzeRes.status === 404) {
      log.warn('Portfolio not found (expected for test)', analyzeRes.data);
    } else if (analyzeRes.status === 500) {
      log.error('Analyze endpoint returned 500 error', analyzeRes.data);
    } else {
      log.info('Analyze endpoint response', { status: analyzeRes.status, ...analyzeRes.data });
    }

    // Step 3: Test profile/generate endpoint
    log.info('Step 3: Testing /api/podna/profile/generate/:portfolioId endpoint');
    const profileRes = await makeRequest('POST', '/api/podna/profile/generate/test-portfolio-id', {}, testData.token);
    
    if (profileRes.status === 404) {
      log.warn('Portfolio not found (expected for test)', profileRes.data);
    } else if (profileRes.status === 500) {
      log.error('Profile generation endpoint returned 500 error', profileRes.data);
    } else {
      log.info('Profile generation endpoint response', { status: profileRes.status, ...profileRes.data });
    }

    // Step 4: Test batch generation endpoint
    log.info('Step 4: Testing /api/podna/generate/batch endpoint');
    const generateRes = await makeRequest('POST', '/api/podna/generate/batch', {
      count: 2,
      mode: 'exploratory',
      provider: 'imagen-4-ultra'
    }, testData.token);

    if (generateRes.status === 500) {
      log.error('Batch generation endpoint returned 500 error', generateRes.data);
      
      // Parse error message to understand what failed
      const errorMsg = generateRes.data?.message || '';
      if (errorMsg.includes('relation') && errorMsg.includes('does not exist')) {
        log.error('Database table missing! This is a schema issue.', errorMsg);
      } else if (errorMsg.includes('not defined')) {
        log.error('Missing module or function', errorMsg);
      } else if (errorMsg.includes('no style profile')) {
        log.warn('No style profile found (expected for new user)', errorMsg);
      }
    } else {
      log.info('Batch generation endpoint response', { status: generateRes.status, ...generateRes.data });
    }

    // Step 5: Check database tables
    log.header('DATABASE SCHEMA CHECK');
    const db = require('./src/services/database');
    
    try {
      const tableCheck = await db.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema='public' 
        AND table_name IN ('style_tag_metadata', 'thompson_sampling_params', 'interaction_events', 'validation_results')
        ORDER BY table_name
      `);

      if (tableCheck.rows.length === 4) {
        log.info('All required tables exist ✅', tableCheck.rows.map(r => r.table_name));
      } else {
        const existing = tableCheck.rows.map(r => r.table_name);
        const missing = ['style_tag_metadata', 'thompson_sampling_params', 'interaction_events', 'validation_results']
          .filter(t => !existing.includes(t));
        log.error('Missing tables:', missing);
      }

      await db.end();
    } catch (err) {
      log.error('Database check failed', err.message);
    }

    log.header('DIAGNOSTIC COMPLETE');

  } catch (error) {
    log.error('Test failed', error);
  }
}

testOnboarding().catch(console.error);