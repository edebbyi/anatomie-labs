#!/usr/bin/env node
/**
 * Test image generation only
 */

require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const API_URL = 'http://localhost:3001/api';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get the most recent test user
    const userResult = await pool.query(
      'SELECT id, email FROM users ORDER BY created_at DESC LIMIT 1'
    );

    const user = userResult.rows[0];
    console.log('✅ User:', user.email);

    // Login
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: user.email,
      password: 'TestPassword123!'
    });

    const token = loginResponse.data.data.token;
    console.log('✅ Logged in');

    // Generate 2 images to test
    console.log('\n🖼️  Generating 2 test images with Imagen-4 Ultra...\n');
    
    const generateStart = Date.now();
    const generateResponse = await axios.post(
      `${API_URL}/podna/generate/batch`,
      {
        count: 2,
        mode: 'exploratory',
        provider: 'imagen-4-ultra'
      },
      {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 300000
      }
    );

    const generateDuration = ((Date.now() - generateStart) / 1000).toFixed(1);

    console.log(`✅ Complete in ${generateDuration}s\n`);
    console.log('Response:', JSON.stringify(generateResponse.data, null, 2));

    await pool.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    await pool.end();
    process.exit(1);
  }
}

main();
