#!/usr/bin/env node

/**
 * Setup Base Database Schema
 * This script runs the base schema.sql to create the users table and other base tables
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SCHEMA_FILE = path.join(__dirname, 'database/schema.sql');

async function setupBaseSchema() {
  console.log('======================================');
  console.log('🗄️  Setting up Base Database Schema');
  console.log('======================================');
  console.log('');

  // Check if schema file exists
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`❌ Schema file not found: ${SCHEMA_FILE}`);
    process.exit(1);
  }

  // Read schema SQL
  const schemaSQL = fs.readFileSync(SCHEMA_FILE, 'utf8');

  // Get database connection info from .env
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'designer_bff',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
  };

  if (!dbConfig.user) {
    console.error('❌ DB_USER not set in .env');
    process.exit(1);
  }

  console.log('Database Config:');
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  User: ${dbConfig.user}`);
  console.log('');

  // Create database connection
  const pool = new Pool(dbConfig);

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('✅ Database connection successful');
    console.log('Running base schema...');

    // Run schema (split by semicolons to handle it better)
    await client.query(schemaSQL);

    // Release client
    client.release();

    console.log('');
    console.log('======================================');
    console.log('✅ Base schema setup complete!');
    console.log('======================================');
    console.log('');
    console.log('Tables created:');
    console.log('  - users');
    console.log('  - user_profiles');
    console.log('  - voice_commands');
    console.log('  - vlt_specifications');
    console.log('  - generation_jobs');
    console.log('  - images');
    console.log('  - and more...');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('======================================');
    console.error('❌ Schema setup failed!');
    console.error('======================================');
    console.error(`Error: ${error.message}`);
    console.error('');
    
    await pool.end();
    process.exit(1);
  }
}

// Run setup
setupBaseSchema();
