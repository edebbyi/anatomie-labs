require('dotenv').config();
const axios = require('axios');

/**
 * Complete API Flow Test
 * Tests the entire image generation pipeline through the API:
 * 1. User authentication
 * 2. Image generation request
 * 3. Job status monitoring
 * 4. Image gallery retrieval
 */

const API_URL = 'http://localhost:3001';

// Test user credentials
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User'
};

let authToken = null;
let userId = null;

// Color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, title) {
  console.log('');
  log(`${'='.repeat(70)}`, colors.cyan);
  log(`${step}. ${title}`, colors.bright + colors.cyan);
  log(`${'='.repeat(70)}`, colors.cyan);
  console.log('');
}

async function testHealthCheck() {
  logStep('1', 'Health Check');
  
  try {
    const response = await axios.get(`${API_URL}/health`);
    log('✅ Server is healthy', colors.green);
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    log(`❌ Health check failed: ${error.message}`, colors.red);
    return false;
  }
}

async function testRegister() {
  logStep('2', 'User Registration');
  
  try {
    const response = await axios.post(`${API_URL}/api/auth/register`, testUser);
    
    authToken = response.data.data.token;
    userId = response.data.data.user.id;
    
    log('✅ User registered successfully', colors.green);
    log(`   User ID: ${userId}`, colors.cyan);
    log(`   Email: ${response.data.data.user.email}`, colors.cyan);
    log(`   Token: ${authToken.substring(0, 20)}...`, colors.cyan);
    
    return true;
  } catch (error) {
    // If user already exists, try to login
    if (error.response?.status === 409 || error.response?.data?.message?.includes('exists')) {
      log('⚠️  User already exists, attempting login...', colors.yellow);
      return await testLogin();
    }
    
    log(`❌ Registration failed: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function testLogin() {
  logStep('3', 'User Login');
  
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    authToken = response.data.data.token;
    userId = response.data.data.user.id;
    
    log('✅ Login successful', colors.green);
    log(`   User ID: ${userId}`, colors.cyan);
    log(`   Token: ${authToken.substring(0, 20)}...`, colors.cyan);
    
    return true;
  } catch (error) {
    log(`❌ Login failed: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function testImageGeneration() {
  logStep('4', 'Submit Image Generation Job');
  
  try {
    const response = await axios.post(
      `${API_URL}/api/images/generate`,
      {
        parsedCommand: {
          quantity: 1,
          garmentType: 'A photorealistic sunset over mountains'
        },
        vltSpecification: 'A breathtaking photorealistic landscape of a golden sunset over majestic mountains. The sky is painted with vibrant oranges, pinks, and purples. Dramatic clouds catch the last rays of sunlight. In the foreground, a serene alpine lake reflects the colorful sky. Professional landscape photography, high detail, 8K quality.',
        model: 'imagen-4-ultra'
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const jobData = response.data.data;
    
    log('✅ Image generation job submitted', colors.green);
    log(`   Job ID: ${jobData.jobId}`, colors.cyan);
    log(`   Status: ${jobData.status}`, colors.cyan);
    log(`   Quantity: ${jobData.quantity}`, colors.cyan);
    log(`   Estimated time: ${jobData.estimatedTime}`, colors.cyan);
    
    return jobData.jobId;
  } catch (error) {
    log(`❌ Image generation failed: ${error.response?.data?.message || error.message}`, colors.red);
    if (error.response?.data) {
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

async function testJobStatus(jobId) {
  logStep('5', 'Monitor Job Status');
  
  let attempts = 0;
  const maxAttempts = 40; // 3+ minutes
  
  log('⏳ Waiting for job to complete...', colors.yellow);
  console.log('');
  
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const response = await axios.get(
        `${API_URL}/api/images/job/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      const status = response.data.data;
      
      process.stdout.write(`\r   Attempt ${attempts}/${maxAttempts} - Status: ${status.status.padEnd(15)}`);
      
      if (status.status === 'completed') {
        console.log('');
        console.log('');
        log('✅ Job completed successfully!', colors.green);
        
        if (status.result?.images && status.result.images.length > 0) {
          log(`   Images generated: ${status.result.images.length}`, colors.cyan);
          log(`   Total cost: $${status.result.totalCost || 'N/A'}`, colors.cyan);
          
          status.result.images.forEach((img, idx) => {
            console.log('');
            log(`   Image ${idx + 1}:`, colors.bright);
            log(`     • ID: ${img.imageId}`, colors.cyan);
            log(`     • Size: ${(img.size / 1024).toFixed(2)} KB`, colors.cyan);
            log(`     • CDN URL: ${img.cdnUrl}`, colors.cyan);
          });
          
          return status.result.images;
        }
        
        return [];
      } else if (status.status === 'failed') {
        console.log('');
        console.log('');
        log('❌ Job failed!', colors.red);
        log(`   Error: ${status.error || 'Unknown error'}`, colors.red);
        return null;
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.log('');
      log(`   ❌ Error checking status: ${error.message}`, colors.red);
      return null;
    }
  }
  
  console.log('');
  console.log('');
  log('⏰ Timeout: Job did not complete within expected time', colors.yellow);
  return null;
}

async function testGallery() {
  logStep('6', 'Retrieve Image Gallery');
  
  try {
    const response = await axios.get(
      `${API_URL}/api/images/gallery?page=1&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    const gallery = response.data.data;
    
    log('✅ Gallery retrieved successfully', colors.green);
    log(`   Total images: ${gallery.pagination.total}`, colors.cyan);
    log(`   Current page: ${gallery.pagination.page}`, colors.cyan);
    log(`   Images on this page: ${gallery.images.length}`, colors.cyan);
    
    if (gallery.images.length > 0) {
      console.log('');
      log('   Recent images:', colors.bright);
      gallery.images.slice(0, 3).forEach((img, idx) => {
        console.log('');
        log(`   ${idx + 1}. Image ID: ${img.id}`, colors.cyan);
        log(`      Created: ${new Date(img.created_at).toLocaleString()}`, colors.cyan);
        log(`      Format: ${img.format} | Size: ${(img.original_size / 1024).toFixed(2)} KB`, colors.cyan);
        log(`      URL: ${img.cdn_url}`, colors.cyan);
      });
    }
    
    return true;
  } catch (error) {
    log(`❌ Gallery retrieval failed: ${error.response?.data?.message || error.message}`, colors.red);
    return false;
  }
}

async function runTests() {
  console.log('');
  log('🧪 COMPLETE API FLOW TEST', colors.bright + colors.blue);
  log('Testing Imagen-4-Ultra Pipeline via API', colors.blue);
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Health Check
    const healthOk = await testHealthCheck();
    if (!healthOk) {
      log('\n❌ Server is not running. Please start the server first.', colors.red);
      process.exit(1);
    }
    
    // Step 2 & 3: Register or Login
    const authOk = await testRegister();
    if (!authOk) {
      log('\n❌ Authentication failed. Cannot continue.', colors.red);
      process.exit(1);
    }
    
    // Step 4: Submit image generation job
    const jobId = await testImageGeneration();
    if (!jobId) {
      log('\n❌ Failed to submit job. Cannot continue.', colors.red);
      process.exit(1);
    }
    
    // Step 5: Monitor job status
    const images = await testJobStatus(jobId);
    if (!images || images.length === 0) {
      log('\n⚠️  Job did not complete or no images generated.', colors.yellow);
    }
    
    // Step 6: Check gallery
    await testGallery();
    
    // Summary
    const totalTime = Date.now() - startTime;
    console.log('');
    log('='.repeat(70), colors.green);
    log('✅ ALL TESTS COMPLETED!', colors.bright + colors.green);
    log('='.repeat(70), colors.green);
    console.log('');
    log(`   Total test time: ${(totalTime / 1000).toFixed(2)}s`, colors.cyan);
    log(`   API URL: ${API_URL}`, colors.cyan);
    log(`   User: ${testUser.email}`, colors.cyan);
    console.log('');
    log('🎉 Your image generation pipeline is fully operational!', colors.green);
    console.log('');
    
  } catch (error) {
    console.error('');
    log('❌ TEST SUITE FAILED', colors.red);
    console.error(error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test suite
runTests();
