#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Get the most recent user
    const userResult = await pool.query(
      'SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 1'
    );
    
    if (userResult.rows.length === 0) {
      console.log('No users found in database');
      await pool.end();
      return;
    }
    
    console.log('\n📊 Latest Test User:');
    console.log('Email:', userResult.rows[0].email);
    console.log('User ID:', userResult.rows[0].id);
    console.log('Created:', userResult.rows[0].created_at);
    
    const userId = userResult.rows[0].id;
    
    // Get portfolio info
    const portfolioResult = await pool.query(
      'SELECT id, processing_status, image_count FROM portfolios WHERE user_id = $1',
      [userId]
    );
    
    if (portfolioResult.rows.length === 0) {
      console.log('\n❌ No portfolio found');
      await pool.end();
      return;
    }
    
    console.log('\n📁 Portfolio:');
    console.log('Processing Status:', portfolioResult.rows[0].processing_status);
    console.log('Image Count:', portfolioResult.rows[0].image_count);
    console.log('Portfolio ID:', portfolioResult.rows[0].id);
    
    const portfolioId = portfolioResult.rows[0].id;
    
    // Get style profile
    const profileResult = await pool.query(
      'SELECT id, style_labels FROM style_profiles WHERE portfolio_id = $1',
      [portfolioId]
    );
    
    if (profileResult.rows.length > 0) {
      console.log('\n🎨 Style Profile:');
      console.log('Labels:', profileResult.rows[0].style_labels);
    } else {
      console.log('\n❌ No style profile found');
    }
    
    // Get prompts
    const promptResult = await pool.query(
      'SELECT COUNT(*) as count FROM prompts WHERE user_id = $1',
      [userId]
    );
    console.log('\n✏️ Prompts Created:', promptResult.rows[0].count);
    
    // Get generations
    const genResult = await pool.query(
      'SELECT id, status, error_message FROM generations WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    console.log('\n🖼️ Image Generations:', genResult.rows.length);
    
    if (genResult.rows.length > 0) {
      genResult.rows.forEach((gen, i) => {
        console.log(`\n  Generation ${i+1}:`);
        console.log(`    ID: ${gen.id}`);
        console.log(`    Status: ${gen.status}`);
        if (gen.error_message) console.log(`    Error: ${gen.error_message}`);
      });
    } else {
      console.log('  ❌ No generations found');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
