#!/usr/bin/env node

/**
 * Apply database schema
 * This script reads and applies the main schema.sql file to the database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create database pool
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'designer_bff',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD || '',
      }
);

async function applySchema() {
  console.log('======================================');
  console.log('🗄️  Applying Database Schema');
  console.log('======================================');
  console.log('');

  try {
    // Try multiple possible paths for the schema file
    const possiblePaths = [
      path.join(__dirname, '../database/schema.sql'),
      path.join(process.cwd(), 'database/schema.sql'),
      path.join(process.cwd(), '../database/schema.sql'),
      '/opt/render/project/src/database/schema.sql',
    ];

    let schemaPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        schemaPath = testPath;
        break;
      }
    }

    if (!schemaPath) {
      console.error('❌ Schema file not found. Tried:');
      possiblePaths.forEach(p => console.error(`   - ${p}`));
      console.error('\nCurrent directory:', process.cwd());
      console.error('Script directory:', __dirname);
      process.exit(1);
    }

    console.log(`Reading schema from: ${schemaPath}`);

    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded');
    console.log('');

    // Connect to database
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Apply schema
    console.log('Applying schema...');
    await client.query(schema);
    console.log('✅ Schema applied successfully');
    console.log('');

    // Verify tables exist
    console.log('Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN (
          'portfolios',
          'portfolio_images',
          'style_profiles',
          'ultra_detailed_descriptors',
          'image_descriptors',
          'image_embeddings'
        )
      ORDER BY table_name
    `);

    console.log('Tables found:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log('');

    // Release client
    client.release();

    console.log('======================================');
    console.log('✅ Schema application complete!');
    console.log('======================================');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('======================================');
    console.error('❌ Error applying schema:');
    console.error('======================================');
    console.error(error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applySchema();
