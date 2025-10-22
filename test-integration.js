#!/usr/bin/env node
/**
 * Integration Test Script for AI Agents System
 * Tests communication between Node.js backend and Python agents service
 */

const axios = require('axios');

async function testIntegration() {
  console.log('🧪 Testing AI Agents Integration...\n');
  
  // Test 1: Python agents service health
  console.log('1️⃣ Testing Python Agents Service (Port 8000)...');
  try {
    const agentsHealth = await axios.get('http://localhost:8000/health', { timeout: 5000 });
    console.log('✅ Python Agents Service: HEALTHY');
    console.log(`   - Status: ${agentsHealth.data.status}`);
    console.log(`   - Agents: ${agentsHealth.data.agents.length} available`);
  } catch (error) {
    console.log('❌ Python Agents Service: FAILED');
    console.log(`   Error: ${error.message}`);
    return;
  }
  
  console.log('');
  
  // Test 2: Node.js agents routes health
  console.log('2️⃣ Testing Node.js ↔ Python Communication...');
  try {
    const nodeAgentsHealth = await axios.get('http://localhost:3001/api/agents/health', { timeout: 10000 });
    console.log('✅ Node.js → Python Communication: WORKING');
    console.log(`   - Response: ${nodeAgentsHealth.data.success ? 'Success' : 'Failed'}`);
  } catch (error) {
    console.log('❌ Node.js → Python Communication: FAILED');
    console.log(`   Error: ${error.message}`);
    
    // Check if it's a timeout vs connection issue
    if (error.code === 'ECONNREFUSED') {
      console.log('   💡 Node.js server might not be running on port 3001');
    } else if (error.code === 'TIMEOUT') {
      console.log('   💡 Node.js server is running but agents route is slow/hanging');
    }
    return;
  }
  
  console.log('');
  
  // Test 3: Portfolio analysis endpoint (without auth for testing)
  console.log('3️⃣ Testing Portfolio Analysis Endpoint...');
  try {
    // This will fail due to auth, but we can see if the route exists
    const portfolioTest = await axios.post('http://localhost:3001/api/agents/portfolio/analyze', {
      imageUrls: ['https://example.com/test.jpg']
    }, { timeout: 5000 });
    console.log('✅ Portfolio Analysis Endpoint: ACCESSIBLE');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Portfolio Analysis Endpoint: ACCESSIBLE (needs auth)');
    } else if (error.response && error.response.status === 400) {
      console.log('✅ Portfolio Analysis Endpoint: ACCESSIBLE (validation working)');
    } else {
      console.log('❌ Portfolio Analysis Endpoint: FAILED');
      console.log(`   Error: ${error.message}`);
    }
  }
  
  console.log('');
  console.log('🎉 Integration Test Complete!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Both services are running ✓');
  console.log('   2. Communication is working ✓'); 
  console.log('   3. Ready for frontend integration');
  console.log('');
  console.log('🔗 Available Endpoints:');
  console.log('   - Python Agents: http://localhost:8000/docs');
  console.log('   - Node.js Agents: http://localhost:3001/api/agents/*');
}

// Run the test
testIntegration().catch(console.error);