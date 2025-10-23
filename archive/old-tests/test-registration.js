/**
 * Test Registration Endpoint
 * Run: node test-registration.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testRegistration() {
  console.log('🧪 Testing Registration Endpoint...\n');

  try {
    // Test 1: Basic registration
    console.log('📝 Testing basic registration...');
    const testUser = {
      name: 'Test User ' + Date.now(),
      email: `test.${Date.now()}@example.com`,
      password: 'password123'
    };

    console.log('Sending request to:', `${API_URL}/auth/register`);
    console.log('With data:', { ...testUser, password: '***' });

    const response = await axios.post(`${API_URL}/auth/register`, testUser, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('✅ Registration successful!');
    console.log('Response status:', response.status);
    console.log('Response data:', {
      success: response.data.success,
      message: response.data.message,
      userCreated: !!response.data.data?.user?.id,
      tokenProvided: !!response.data.data?.token
    });

  } catch (error) {
    console.error('❌ Registration failed!');
    
    if (error.response) {
      // Server responded with error status
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.error('No response received. Is the server running?');
      console.error('Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
    } else {
      // Something else happened
      console.error('Error message:', error.message);
    }
  }

  // Test 2: Duplicate email
  console.log('\n📝 Testing duplicate email handling...');
  try {
    const duplicateUser = {
      name: 'Duplicate User',
      email: 'test@example.com', // This was created earlier
      password: 'password123'
    };

    await axios.post(`${API_URL}/auth/register`, duplicateUser);
    console.log('⚠️  Should have failed with duplicate email');
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message === 'User already exists') {
      console.log('✅ Duplicate email properly rejected');
    } else {
      console.error('❌ Unexpected error for duplicate email:', error.response?.data || error.message);
    }
  }

  // Test 3: Invalid data
  console.log('\n📝 Testing validation...');
  try {
    const invalidUser = {
      name: '',
      email: 'invalid-email',
      password: '123' // Too short
    };

    await axios.post(`${API_URL}/auth/register`, invalidUser);
    console.log('⚠️  Should have failed validation');
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message === 'Validation failed') {
      console.log('✅ Validation properly rejected invalid data');
    } else {
      console.error('❌ Unexpected error for invalid data:', error.response?.data || error.message);
    }
  }

  // Test 4: Frontend-like request
  console.log('\n📝 Testing frontend-style request...');
  try {
    const frontendUser = {
      name: 'Frontend Test ' + Date.now(),
      email: `frontend.${Date.now()}@example.com`,
      password: 'password123'
    };

    // Simulate what the frontend authAPI does
    const response = await axios.post(`${API_URL}/auth/register`, frontendUser, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Frontend Test)',
      },
      withCredentials: false, // Frontend doesn't use credentials for register
      timeout: 30000
    });

    if (response.data.success && response.data.data.token) {
      console.log('✅ Frontend-style request successful!');
      console.log('Token received:', response.data.data.token.substring(0, 20) + '...');
    } else {
      console.error('❌ Frontend-style request missing expected data');
    }

  } catch (error) {
    console.error('❌ Frontend-style request failed:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.message || error.message);
  }

  console.log('\n🏁 Registration endpoint test completed!');
}

// Run the test
testRegistration().catch(console.error);