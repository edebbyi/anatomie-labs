#!/usr/bin/env node

/**
 * Run Pods Database Migration
 * This script applies the pods migration using the database connection from .env
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATION_FILE = path.join(__dirname, 'database/migrations/009_create_pods_tables.sql');

async function runMigration() {
  console.log('======================================');
  console.log('🗄️  Running Pods Database Migration');
  console.log('======================================');
  console.log('');

  // Check if migration file exists
  if (!fs.existsSync(MIGRATION_FILE)) {
    console.error(`❌ Migration file not found: ${MIGRATION_FILE}`);
    process.exit(1);
  }

  // Read migration SQL
  const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');

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
  console.log(`  Migration: ${MIGRATION_FILE}`);
  console.log('');

  // Create database connection
  const pool = new Pool(dbConfig);

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('✅ Database connection successful');
    console.log('Running migration...');

    // Run migration
    await client.query(migrationSQL);

    // Release client
    client.release();

    console.log('');
    console.log('======================================');
    console.log('✅ Migration completed successfully!');
    console.log('======================================');
    console.log('');
    console.log('Tables created:');
    console.log('  - pods');
    console.log('  - pod_images');
    console.log('  - user_preferences');
    console.log('');
    console.log('✅ Ready to use pods feature!');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('======================================');
    console.error('❌ Migration failed!');
    console.error('======================================');
    console.error(`Error: ${error.message}`);
    console.error('');
    
    await pool.end();
    process.exit(1);
  }
}

// Run migration
runMigration();
