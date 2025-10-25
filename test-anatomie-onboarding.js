#!/usr/bin/env node
/**
 * Test Onboarding with anatomie_test_5.zip
 * 
 * This script:
 * 1. Creates a test user
 * 2. Uploads anatomie_test_5.zip
 * 3. Runs complete onboarding (analysis + profile generation)
 * 4. Displays the style profile results
 */

require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const API_URL = 'http://localhost:3001/api';
const ZIP_FILE = path.join(__dirname, 'anatomie_test_5.zip');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    logSection('🧪 ANATOMIE TEST 5 - ONBOARDING TEST');
    
    // Step 1: Create test user
    log('Step 1: Creating test user...', 'yellow');
    const timestamp = Date.now();
    const testEmail = `anatomie_test_${timestamp}@test.com`;
    const testPassword = 'TestPassword123!';
    
    let authToken;
    let userId;
    
    try {
      const signupRes = await axios.post(`${API_URL}/auth/register`, {
        email: testEmail,
        password: testPassword,
        name: 'Anatomie Test User'
      });

      authToken = signupRes.data.data.token;
      userId = signupRes.data.data.user.id;
      
      log(`✅ User created: ${testEmail}`, 'green');
      log(`   User ID: ${userId}`, 'green');
    } catch (error) {
      log(`❌ Failed to create user: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }
    
    // Step 2: Upload ZIP file
    logSection('📦 Step 2: Uploading anatomie_test_5.zip');
    
    if (!fs.existsSync(ZIP_FILE)) {
      log(`❌ File not found: ${ZIP_FILE}`, 'red');
      throw new Error('anatomie_test_5.zip not found');
    }
    
    const fileStats = fs.statSync(ZIP_FILE);
    log(`File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`, 'cyan');
    
    let portfolioId;
    
    try {
      const formData = new FormData();
      formData.append('portfolio', fs.createReadStream(ZIP_FILE));
      
      const uploadRes = await axios.post(
        `${API_URL}/podna/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${authToken}`
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );
      
      portfolioId = uploadRes.data.data.portfolioId;
      const imageCount = uploadRes.data.data.imageCount;
      
      log(`✅ Portfolio uploaded successfully`, 'green');
      log(`   Portfolio ID: ${portfolioId}`, 'green');
      log(`   Images uploaded: ${imageCount}`, 'green');
    } catch (error) {
      log(`❌ Upload failed: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }
    
    // Step 3: Analyze portfolio
    logSection('🔍 Step 3: Analyzing Portfolio');

    log('Running ultra-detailed image analysis...', 'cyan');
    log('This may take 2-3 minutes...', 'yellow');

    try {
      const analyzeRes = await axios.post(
        `${API_URL}/podna/analyze/${portfolioId}`,
        {},
        {
          headers: { 'Authorization': `Bearer ${authToken}` },
          timeout: 300000 // 5 minutes
        }
      );

      log(`✅ Analysis completed successfully`, 'green');
      log(`   Images analyzed: ${analyzeRes.data.data.analyzed}`, 'green');
      log(`   Failed: ${analyzeRes.data.data.failed}`, 'green');
      log(`   Avg Confidence: ${(analyzeRes.data.data.avgConfidence * 100).toFixed(0)}%`, 'green');
      log(`   Avg Completeness: ${analyzeRes.data.data.avgCompleteness.toFixed(0)}%`, 'green');
    } catch (error) {
      log(`❌ Analysis failed: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }

    // Step 4: Generate style profile
    logSection('📊 Step 4: Generating Style Profile');

    log('Extracting aesthetic themes and patterns...', 'cyan');

    try {
      const profileRes = await axios.post(
        `${API_URL}/podna/profile/generate/${portfolioId}`,
        {},
        {
          headers: { 'Authorization': `Bearer ${authToken}` },
          timeout: 60000 // 1 minute
        }
      );

      log(`✅ Profile generated successfully`, 'green');
      log(`   Total images: ${profileRes.data.data.profile.totalImages}`, 'green');
      log(`   Style labels: ${profileRes.data.data.profile.styleLabels?.length || 0}`, 'green');
    } catch (error) {
      log(`❌ Profile generation failed: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }
    
    // Step 5: Retrieve and display style profile
    logSection('📊 Step 5: Retrieving Style Profile');
    
    try {
      const profileRes = await axios.get(
        `${API_URL}/podna/profile`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      
      const profile = profileRes.data.data.profile;
      
      log('✅ Style Profile Retrieved', 'green');
      console.log('\n' + '-'.repeat(60));
      
      // Display style tags
      if (profile.style_tags && profile.style_tags.length > 0) {
        log('\n🏷️  STYLE TAGS:', 'magenta');
        profile.style_tags.forEach(tag => {
          log(`   • ${tag}`, 'cyan');
        });
      } else {
        log('\n⚠️  NO STYLE TAGS FOUND', 'red');
      }
      
      // Display style description
      if (profile.style_description) {
        log('\n📝 STYLE DESCRIPTION:', 'magenta');
        log(`   ${profile.style_description}`, 'cyan');
      } else {
        log('\n⚠️  NO STYLE DESCRIPTION FOUND', 'red');
      }
      
      // Display aesthetic themes
      if (profile.aesthetic_themes && profile.aesthetic_themes.length > 0) {
        log('\n🎨 AESTHETIC THEMES:', 'magenta');
        profile.aesthetic_themes.slice(0, 5).forEach(theme => {
          const strength = (theme.strength * 100).toFixed(0);
          log(`   • ${theme.name} (${strength}% - ${theme.count} items)`, 'cyan');
        });
      } else {
        log('\n⚠️  NO AESTHETIC THEMES FOUND', 'red');
      }
      
      // Display construction patterns
      if (profile.construction_patterns && profile.construction_patterns.length > 0) {
        log('\n🔨 CONSTRUCTION PATTERNS:', 'magenta');
        profile.construction_patterns.slice(0, 5).forEach(pattern => {
          const strength = (pattern.strength * 100).toFixed(0);
          log(`   • ${pattern.name} (${strength}% - ${pattern.count} items)`, 'cyan');
        });
      } else {
        log('\n⚠️  NO CONSTRUCTION PATTERNS FOUND', 'red');
      }
      
      // Display signature pieces
      if (profile.signature_pieces && profile.signature_pieces.length > 0) {
        log('\n⭐ SIGNATURE PIECES:', 'magenta');
        profile.signature_pieces.slice(0, 3).forEach((piece, i) => {
          log(`   ${i + 1}. ${piece.description || piece.garment_type}`, 'cyan');
          if (piece.confidence) {
            log(`      Confidence: ${(piece.confidence * 100).toFixed(0)}%`, 'cyan');
          }
        });
      } else {
        log('\n⚠️  NO SIGNATURE PIECES FOUND', 'red');
      }
      
      // Display garment distribution
      if (profile.garment_distribution) {
        log('\n👗 GARMENT DISTRIBUTION:', 'magenta');
        const garments = Object.entries(profile.garment_distribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        garments.forEach(([garment, pct]) => {
          log(`   • ${garment}: ${(pct * 100).toFixed(0)}%`, 'cyan');
        });
      }
      
      // Display color palette
      if (profile.color_distribution) {
        log('\n🎨 COLOR PALETTE:', 'magenta');
        const colors = Object.entries(profile.color_distribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        colors.forEach(([color, pct]) => {
          log(`   • ${color}: ${(pct * 100).toFixed(0)}%`, 'cyan');
        });
      }
      
      // Display quality metrics
      log('\n📈 QUALITY METRICS:', 'magenta');
      log(`   • Total Images: ${profile.total_images || 'N/A'}`, 'cyan');
      log(`   • Avg Confidence: ${profile.avg_confidence ? (profile.avg_confidence * 100).toFixed(0) + '%' : 'N/A'}`, 'cyan');
      log(`   • Avg Completeness: ${profile.avg_completeness ? profile.avg_completeness.toFixed(0) + '%' : 'N/A'}`, 'cyan');
      
      console.log('\n' + '-'.repeat(60));
      
    } catch (error) {
      log(`❌ Failed to retrieve profile: ${error.response?.data?.message || error.message}`, 'red');
      throw error;
    }
    
    // Step 6: Run diagnostic
    logSection('🔍 Step 6: Running Diagnostic');
    
    const diagnostic = require('./diagnostic');
    await diagnostic.runDiagnostic(portfolioId, userId);
    
    // Summary
    logSection('✅ TEST COMPLETE');
    log(`Test User: ${testEmail}`, 'green');
    log(`User ID: ${userId}`, 'green');
    log(`Portfolio ID: ${portfolioId}`, 'green');
    log('\nYou can now:', 'cyan');
    log('  1. Login to the frontend with the test credentials', 'cyan');
    log('  2. View the style profile in the UI', 'cyan');
    log('  3. Generate new images based on the profile', 'cyan');
    
  } catch (error) {
    log('\n❌ TEST FAILED', 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

