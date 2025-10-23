/**
 * Test Onboarding Flow End-to-End
 * 
 * This script tests the complete onboarding flow:
 * 1. Upload ZIP file with images
 * 2. Analyze with VLT
 * 3. Save portfolio to database
 * 4. Generate initial 40 images
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const TEST_USER_ID = 'ec058a8c-b2d7-4888-9e66-b7b02e393152'; // John Doe from database

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function step1_uploadAndAnalyze(zipFilePath) {
  log('\n📦 STEP 1: Upload ZIP and Run VLT Analysis', 'cyan');
  log('='.repeat(60), 'cyan');
  
  if (!fs.existsSync(zipFilePath)) {
    throw new Error(`ZIP file not found: ${zipFilePath}`);
  }
  
  log(`📁 ZIP file: ${zipFilePath}`, 'yellow');
  log(`📊 File size: ${(fs.statSync(zipFilePath).size / 1024 / 1024).toFixed(2)} MB`, 'yellow');
  
  const formData = new FormData();
  formData.append('zipFile', fs.createReadStream(zipFilePath));
  formData.append('model', 'gemini');
  formData.append('passes', 'A,B,C');
  
  log('⏳ Uploading to VLT API...', 'yellow');
  
  try {
    const response = await axios.post(`${API_URL}/vlt/analyze/batch`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxBodyLength: 100 * 1024 * 1024,
      maxContentLength: 100 * 1024 * 1024,
      timeout: 300000, // 5 minutes
    });
    
    const result = response.data.data;
    
    log('✅ VLT Analysis Complete!', 'green');
    log(`   • Total images analyzed: ${result.records.length}`, 'green');
    log(`   • Model used: ${result.model}`, 'green');
    log(`   • Backend: ${result.backend}`, 'green');
    log(`   • Average confidence: ${result.summary.averageConfidence}`, 'green');
    log(`   • Garment types: ${Object.keys(result.summary.garmentTypes).length}`, 'green');
    
    return result;
    
  } catch (error) {
    log(`❌ VLT Analysis Failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    throw error;
  }
}

async function step2_savePortfolio(userId, vltResult) {
  log('\n💾 STEP 2: Save Portfolio to Database', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    const response = await axios.post(`${API_URL}/persona/profile`, {
      userId,
      vltAnalysis: vltResult,
      summary: vltResult.summary,
      timestamp: new Date().toISOString(),
    });
    
    log('✅ Portfolio Saved Successfully!', 'green');
    log(`   • User ID: ${userId}`, 'green');
    log(`   • Records saved: ${vltResult.records.length}`, 'green');
    
    return response.data;
    
  } catch (error) {
    log(`❌ Portfolio Save Failed: ${error.message}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    throw error;
  }
}

async function step3_generateImages(userId, targetCount = 40) {
  log('\n🎨 STEP 3: Generate Initial Images', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`   Target: ${targetCount} images`, 'yellow');
  
  return new Promise((resolve, reject) => {
    const fetch = require('node-fetch');
    
    fetch(`${API_URL}/generate/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        targetCount,
        bufferPercent: 20,
        provider: 'google-imagen',
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let totalGenerated = 0;
        let lastProgress = 0;
        
        // Read the stream
        for await (const chunk of response.body) {
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                // Show progress updates
                if (data.progress !== undefined && data.progress > lastProgress) {
                  lastProgress = data.progress;
                  log(`   ⏳ Progress: ${data.progress}% - ${data.message}`, 'yellow');
                }
                
                // Track completion
                if (data.totalGenerated !== undefined) {
                  totalGenerated = data.totalGenerated;
                }
                
                // Check for completion
                if (data.progress === 100 && data.totalGenerated) {
                  log(`\n✅ Image Generation Complete!`, 'green');
                  log(`   • Total generated: ${data.totalGenerated}`, 'green');
                  log(`   • Selected for gallery: ${data.selectedCount || targetCount}`, 'green');
                  resolve({
                    totalGenerated: data.totalGenerated,
                    selected: data.selectedCount || targetCount,
                  });
                  return;
                }
                
                // Check for errors
                if (data.error) {
                  throw new Error(data.error);
                }
                
              } catch (parseError) {
                // Ignore JSON parse errors for incomplete chunks
                if (!line.trim()) continue;
                console.error('Parse error:', parseError.message);
              }
            }
          }
        }
        
        // If we get here without resolving, something went wrong
        if (totalGenerated > 0) {
          log(`\n✅ Generated ${totalGenerated} images (stream ended)`, 'green');
          resolve({ totalGenerated, selected: targetCount });
        } else {
          reject(new Error('Generation stream ended without producing images'));
        }
        
      })
      .catch((error) => {
        log(`❌ Image Generation Failed: ${error.message}`, 'red');
        reject(error);
      });
  });
}

async function verifyDatabase(userId) {
  log('\n🔍 STEP 4: Verify Database Records', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const { Pool } = require('pg');
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'designer_bff',
    user: process.env.DB_USER || 'esosaimafidon',
    password: process.env.DB_PASSWORD || '',
  });
  
  try {
    // Check VLT specifications
    const vltResult = await pool.query(
      'SELECT COUNT(*) FROM vlt_specifications WHERE user_id = $1',
      [userId]
    );
    
    // Check generation jobs
    const jobsResult = await pool.query(
      'SELECT COUNT(*) FROM generation_jobs WHERE user_id = $1',
      [userId]
    );
    
    // Check images
    const imagesResult = await pool.query(
      'SELECT COUNT(*) FROM images WHERE user_id = $1',
      [userId]
    );
    
    log('✅ Database Verification:', 'green');
    log(`   • VLT Specifications: ${vltResult.rows[0].count}`, 'green');
    log(`   • Generation Jobs: ${jobsResult.rows[0].count}`, 'green');
    log(`   • Images: ${imagesResult.rows[0].count}`, 'green');
    
    await pool.end();
    
    return {
      vltSpecs: parseInt(vltResult.rows[0].count),
      jobs: parseInt(jobsResult.rows[0].count),
      images: parseInt(imagesResult.rows[0].count),
    };
    
  } catch (error) {
    log(`❌ Database Verification Failed: ${error.message}`, 'red');
    await pool.end();
    throw error;
  }
}

async function main() {
  try {
    log('\n🚀 ANATOMIE LAB - ONBOARDING FLOW TEST', 'bright');
    log('='.repeat(60), 'bright');
    
    // Get ZIP file path from command line or use default
    const zipFilePath = process.argv[2] || '/Users/esosaimafidon/Documents/GitHub/anatomie-lab/public/uploads/portfolio.zip';
    
    // Check if backend is running
    try {
      await axios.get(`${API_URL.replace('/api', '')}/health`);
      log('✅ Backend server is running', 'green');
    } catch (error) {
      log('❌ Backend server is not running. Please start it first.', 'red');
      log('   Run: npm start', 'yellow');
      process.exit(1);
    }
    
    // Run the onboarding flow
    const vltResult = await step1_uploadAndAnalyze(zipFilePath);
    await step2_savePortfolio(TEST_USER_ID, vltResult);
    await step3_generateImages(TEST_USER_ID, 40);
    await verifyDatabase(TEST_USER_ID);
    
    log('\n🎉 ONBOARDING FLOW COMPLETE!', 'green');
    log('='.repeat(60), 'green');
    log('✅ All steps completed successfully', 'green');
    log('💡 You can now view the images at: http://localhost:3000/home', 'cyan');
    
  } catch (error) {
    log('\n💥 ONBOARDING FLOW FAILED', 'red');
    log('='.repeat(60), 'red');
    log(`Error: ${error.message}`, 'red');
    
    if (error.stack) {
      log('\nStack trace:', 'yellow');
      log(error.stack, 'yellow');
    }
    
    process.exit(1);
  }
}

// Run the test
main();
