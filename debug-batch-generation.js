const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:3001';
let authToken = null;
let userId = null;

// Test user for onboarding
const TEST_USER = {
  email: `test-batch-${Date.now()}@example.com`,
  password: 'Test123456!'
};

async function register() {
  console.log('\n📝 Registering test user...');
  try {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
      name: 'Test User'
    });
    authToken = response.data.token;
    userId = response.data.user.id;
    console.log('✅ Registered:', TEST_USER.email);
    return true;
  } catch (error) {
    console.error('❌ Registration failed:', error.response?.data || error.message);
    return false;
  }
}

async function uploadPortfolio() {
  console.log('\n📦 Uploading test portfolio...');
  
  // Create a simple test zip
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  
  // Add some test images (just small placeholder PNGs)
  const testImagePath = '/Users/esosaimafidon/Documents/GitHub/anatomie-lab/test-image.png';
  if (fs.existsSync(testImagePath)) {
    for (let i = 0; i < 5; i++) {
      const imageBuffer = fs.readFileSync(testImagePath);
      zip.addFile(`image${i}.png`, imageBuffer);
    }
  }
  
  const zipBuffer = zip.toBuffer();
  
  try {
    const response = await axios.post(
      `${API_URL}/api/podna/upload`,
      zipBuffer,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/zip'
        }
      }
    );
    
    console.log('✅ Portfolio uploaded:', response.data.data.portfolioId);
    return response.data.data.portfolioId;
  } catch (error) {
    console.error('❌ Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

async function analyzePortfolio(portfolioId) {
  console.log('\n🔍 Analyzing portfolio...');
  
  try {
    // Start analysis
    const startResponse = await axios.post(
      `${API_URL}/api/podna/analyze/${portfolioId}`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    console.log('📊 Analysis started, tracking progress...');
    
    // Poll for progress
    let complete = false;
    let progressData = null;
    
    while (!complete) {
      const response = await axios.get(
        `${API_URL}/api/podna/analyze/${portfolioId}/progress`,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      
      progressData = response.data.data;
      console.log(`   Progress: ${progressData.percentage}% (${progressData.completed}/${progressData.total})`);
      
      if (progressData.percentage === 100) {
        complete = true;
      } else {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    console.log('✅ Analysis complete');
    return true;
  } catch (error) {
    console.error('❌ Analysis failed:', error.response?.data || error.message);
    throw error;
  }
}

async function generateProfile(portfolioId) {
  console.log('\n🎨 Generating style profile...');
  
  try {
    const response = await axios.post(
      `${API_URL}/api/podna/profile/generate/${portfolioId}`,
      {},
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    console.log('✅ Style profile generated');
    console.log('   Profile data:', JSON.stringify(response.data.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Profile generation failed:', error.response?.data || error.message);
    console.error('   Full error:', error.response?.data?.error);
    throw error;
  }
}

async function generateBatch() {
  console.log('\n🖼️ Generating batch (5 images)...');
  
  try {
    const response = await axios.post(
      `${API_URL}/api/podna/generate/batch`,
      {
        count: 5,
        mode: 'exploratory',
        provider: 'imagen-4-ultra'
      },
      { headers: { 'Authorization': `Bearer ${authToken}` } }
    );
    
    console.log('✅ Batch generation succeeded');
    console.log('   Generated:', response.data.data.count, 'images');
    console.log('   Full response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Batch generation failed:', error.response?.status, error.response?.statusText);
    console.error('   Error data:', JSON.stringify(error.response?.data, null, 2));
    console.error('   Full error:', error.message);
    
    // Try to get more details
    if (error.response?.data?.message) {
      console.error('   Message:', error.response.data.message);
    }
    
    return false;
  }
}

async function checkDatabase() {
  console.log('\n🗄️ Checking database state...');
  
  const db = require('/Users/esosaimafidon/Documents/GitHub/anatomie-lab/src/config/database');
  
  try {
    const profileResult = await db.query(
      'SELECT * FROM style_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (profileResult.rows.length > 0) {
      console.log('✅ Style profile exists in DB:');
      console.log(JSON.stringify(profileResult.rows[0], null, 2));
    } else {
      console.log('❌ NO style profile in database');
    }
    
    const promptResult = await db.query(
      'SELECT COUNT(*) as count FROM prompts WHERE user_id = $1',
      [userId]
    );
    
    console.log('   Prompts in DB:', promptResult.rows[0].count);
    
    const genResult = await db.query(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = $1',
      [userId]
    );
    
    console.log('   Generations in DB:', genResult.rows[0].count);
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting batch generation debug...');
  
  try {
    // Register user
    if (!await register()) return;
    
    // Upload portfolio
    const portfolioId = await uploadPortfolio();
    
    // Analyze
    await analyzePortfolio(portfolioId);
    
    // Generate profile
    try {
      await generateProfile(portfolioId);
    } catch (e) {
      console.log('   Profile generation failed, but continuing to batch...');
    }
    
    // Check DB state
    await checkDatabase();
    
    // Try batch generation
    const batchSuccess = await generateBatch();
    
    if (!batchSuccess) {
      console.log('\n📋 DEBUGGING: Checking server logs...');
      // Try to read server logs if available
      const logPath = '/Users/esosaimafidon/Documents/GitHub/anatomie-lab/backend.log';
      if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf-8');
        const recentLogs = logs.split('\n').slice(-50).join('\n');
        console.log('Recent server logs:');
        console.log(recentLogs);
      }
    }
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
  }
  
  process.exit(0);
}

main();