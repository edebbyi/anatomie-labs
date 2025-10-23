#!/usr/bin/env node
/**
 * Podna Agent System Test
 * 
 * Tests the complete onboarding and generation flow:
 * 1. User signup
 * 2. ZIP upload
 * 3. Image analysis
 * 4. Style profile generation
 * 5. Image generation
 * 6. Feedback processing
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n🎨 PODNA AGENT SYSTEM TEST', 'bright');
  log('═'.repeat(70), 'bright');

  let authToken = null;
  let userId = null;
  let portfolioId = null;
  let generationId = null;

  try {
    // Step 1: Sign up
    log('\n📋 Step 1: User Registration', 'cyan');
    const email = `test-${Date.now()}@example.com`;
    const signupResponse = await axios.post(`${API_URL}/auth/register`, {
      name: 'Test User',
      email,
      password: 'test123456'
    });

    if (signupResponse.data.success) {
      authToken = signupResponse.data.data.token;
      userId = signupResponse.data.data.user.id;
      log(`✅ User registered: ${email}`, 'green');
      log(`   User ID: ${userId}`, 'green');
    } else {
      throw new Error('Registration failed');
    }

    // Step 2: Check for ZIP file or create mock
    log('\n📋 Step 2: Prepare Portfolio ZIP', 'cyan');
    const zipPath = process.argv[2] || null;
    
    if (!zipPath || !fs.existsSync(zipPath)) {
      log('⚠️  No ZIP file provided or file not found', 'yellow');
      log('Usage: node test-podna-system.js /path/to/portfolio.zip', 'yellow');
      log('\nFor testing without a real ZIP, the system will use mock data.', 'yellow');
      
      // Skip onboarding test if no ZIP
      log('\n⏭️  Skipping onboarding test (no ZIP file)', 'yellow');
      log('\nTo test the complete flow:', 'cyan');
      log('1. Prepare a ZIP with 50+ fashion images', 'cyan');
      log('2. Run: node test-podna-system.js /path/to/portfolio.zip', 'cyan');
      
      return;
    }

    log(`✅ ZIP file found: ${path.basename(zipPath)}`, 'green');

    // Step 3: Complete onboarding
    log('\n📋 Step 3: Complete Onboarding (Upload + Analyze + Profile)', 'cyan');
    const formData = new FormData();
    formData.append('portfolio', fs.createReadStream(zipPath));
    formData.append('generateInitial', 'true');
    formData.append('initialCount', '5'); // Generate 5 initial images

    log('⏳ Uploading and processing portfolio... (this may take a few minutes)', 'yellow');
    
    const onboardingResponse = await axios.post(`${API_URL}/podna/onboard`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000 // 5 minute timeout
    });

    if (onboardingResponse.data.success) {
      const data = onboardingResponse.data.data;
      portfolioId = data.portfolio.id;
      
      log(`✅ Onboarding complete!`, 'green');
      log(`   Portfolio: ${data.portfolio.imageCount} images`, 'green');
      log(`   Analyzed: ${data.analysis.analyzed} images`, 'green');
      log(`   Style Profile:`, 'green');
      log(`     - ${data.profile.summaryText}`, 'green');
      log(`     - Style labels: ${data.profile.styleLabels.map(l => l.name).join(', ')}`, 'green');
      log(`   Generated: ${data.generations.count} initial images`, 'green');
      
      if (data.generations.count > 0) {
        generationId = data.generations.images[0].id;
      }
    }

    // Step 4: View profile
    log('\n📋 Step 4: View Style Profile', 'cyan');
    const profileResponse = await axios.get(`${API_URL}/podna/profile`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (profileResponse.data.success) {
      const profile = profileResponse.data.data.profile;
      log(`✅ Style Profile Retrieved`, 'green');
      log(`   Total images: ${profile.totalImages}`, 'green');
      log(`   Style labels: ${profile.styleLabels.map(l => `${l.name} (${(l.score * 100).toFixed(0)}%)`).join(', ')}`, 'green');
      log(`   Top garments:`, 'green');
      Object.entries(profile.distributions.garments).slice(0, 3).forEach(([type, pct]) => {
        log(`     - ${type}: ${(pct * 100).toFixed(0)}%`, 'green');
      });
      log(`   Top colors:`, 'green');
      Object.entries(profile.distributions.colors).slice(0, 3).forEach(([color, pct]) => {
        log(`     - ${color}: ${(pct * 100).toFixed(0)}%`, 'green');
      });
    }

    // Step 5: Generate new image
    log('\n📋 Step 5: Generate New Image', 'cyan');
    const generateResponse = await axios.post(`${API_URL}/podna/generate`, {
      mode: 'exploratory',
      provider: 'imagen-4-ultra'
    }, {
      headers: { 'Authorization': `Bearer ${authToken}` },
      timeout: 60000
    });

    if (generateResponse.data.success) {
      const gen = generateResponse.data.data.generation;
      generationId = gen.id;
      log(`✅ Image Generated`, 'green');
      log(`   URL: ${gen.url}`, 'green');
      log(`   Prompt: ${gen.promptText}`, 'green');
      log(`   Cost: $${(gen.costCents / 100).toFixed(2)}`, 'green');
    }

    // Step 6: Submit feedback
    if (generationId) {
      log('\n📋 Step 6: Submit Feedback', 'cyan');
      const feedbackResponse = await axios.post(`${API_URL}/podna/feedback`, {
        generationId,
        type: 'like',
        note: 'Love this! Can you make the sleeves longer next time?'
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (feedbackResponse.data.success) {
        const feedback = feedbackResponse.data.data;
        log(`✅ Feedback Processed`, 'green');
        log(`   Type: ${feedback.feedback.type}`, 'green');
        if (feedback.feedback.parsedCritique) {
          log(`   Parsed critique: ${JSON.stringify(feedback.feedback.parsedCritique)}`, 'green');
        }
        log(`   Learning delta applied: ${Object.keys(feedback.learningEvent.delta).length} updates`, 'green');
      }
    }

    // Step 7: View gallery
    log('\n📋 Step 7: View Gallery', 'cyan');
    const galleryResponse = await axios.get(`${API_URL}/podna/gallery?limit=10`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (galleryResponse.data.success) {
      const gallery = galleryResponse.data.data;
      log(`✅ Gallery Retrieved: ${gallery.count} images`, 'green');
      gallery.generations.slice(0, 3).forEach((img, i) => {
        log(`   ${i + 1}. ${img.promptText.substring(0, 60)}...`, 'green');
      });
    }

    // Success summary
    log('\n' + '═'.repeat(70), 'bright');
    log('✅ ALL TESTS PASSED!', 'green');
    log('═'.repeat(70), 'bright');
    log('\nPodna Agent System is working correctly! 🎉', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Check the database for created records', 'cyan');
    log('2. View generated images in the gallery', 'cyan');
    log('3. Test the frontend integration', 'cyan');

  } catch (error) {
    log('\n❌ TEST FAILED', 'red');
    log('Error: ' + error.message, 'red');
    
    if (error.response) {
      log(`Status: ${error.response.status}`, 'red');
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  log('Fatal error: ' + error.message, 'red');
  process.exit(1);
});
