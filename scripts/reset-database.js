/**
 * Database Reset Script
 * 
 * Safely deletes all users and their associated data while preserving database structure.
 * This allows you to start fresh with onboarding using the same account names.
 * 
 * Usage: node scripts/reset-database.js
 */

const { Client } = require('pg');
require('dotenv').config();

const logger = {
  info: (message, meta) => console.log(`ℹ️  ${message}`, meta ? JSON.stringify(meta, null, 2) : ''),
  warn: (message, meta) => console.log(`⚠️  ${message}`, meta ? JSON.stringify(meta, null, 2) : ''),
  error: (message, meta) => console.log(`❌ ${message}`, meta ? JSON.stringify(meta, null, 2) : ''),
  success: (message, meta) => console.log(`✅ ${message}`, meta ? JSON.stringify(meta, null, 2) : '')
};

async function resetDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'anatomie_lab',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    await client.connect();
    logger.info('Connected to database');

    // Start transaction
    await client.query('BEGIN');
    logger.info('Started database transaction');

    // Get counts before deletion for reporting
    const countQueries = [
      'users',
      'vlt_specifications', 
      'images',
      'generations',
      'generation_assets',
      'user_style_profiles',
      'generation_feedback'
    ];

    const beforeCounts = {};
    for (const tableName of countQueries) {
      try {
        // Check if table exists first
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);

        if (tableCheck.rows[0].exists) {
          const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          beforeCounts[tableName] = parseInt(result.rows[0].count);
        } else {
          beforeCounts[tableName] = 'N/A (table does not exist)';
        }
      } catch (error) {
        beforeCounts[tableName] = 'Error checking table';
      }
    }

    logger.info('Current database state:', beforeCounts);

    // Delete in correct order to respect foreign key constraints
    const deletionOrder = [
      // Start with dependent tables first
      { table: 'generation_feedback', description: 'user feedback on images' },
      { table: 'generation_assets', description: 'generated image assets' },
      { table: 'generations', description: 'image generation requests' },
      { table: 'user_style_profiles', description: 'style clustering profiles' },
      { table: 'vlt_specifications', description: 'VLT analysis results' },
      { table: 'images', description: 'user uploaded and generated images' },
      
      // Clear user-related tables
      { table: 'user_sessions', description: 'user login sessions', optional: true },
      { table: 'user_preferences', description: 'user preferences', optional: true },
      
      // Finally delete users (this will cascade to related data)
      { table: 'users', description: 'user accounts' }
    ];

    let totalDeleted = 0;

    for (const { table, description, optional } of deletionOrder) {
      try {
        logger.info(`Clearing ${table} (${description})...`);
        
        // Check if table exists first
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [table]);

        if (!tableCheck.rows[0].exists) {
          if (!optional) {
            logger.warn(`Table ${table} does not exist, skipping`);
          }
          continue;
        }

        const result = await client.query(`DELETE FROM ${table}`);
        const deletedCount = result.rowCount;
        totalDeleted += deletedCount;
        
        logger.success(`Deleted ${deletedCount} records from ${table}`);
        
      } catch (error) {
        if (optional) {
          logger.warn(`Failed to clear optional table ${table}:`, error.message);
        } else {
          throw error;
        }
      }
    }

    // Reset sequences to start from 1 again
    const sequenceResets = [
      'ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1',
      'ALTER SEQUENCE IF EXISTS images_id_seq RESTART WITH 1', 
      'ALTER SEQUENCE IF EXISTS generation_assets_id_seq RESTART WITH 1',
      'ALTER SEQUENCE IF EXISTS generation_feedback_id_seq RESTART WITH 1',
      'ALTER SEQUENCE IF EXISTS vlt_specifications_id_seq RESTART WITH 1'
    ];

    logger.info('Resetting ID sequences...');
    for (const resetQuery of sequenceResets) {
      try {
        await client.query(resetQuery);
      } catch (error) {
        logger.warn(`Sequence reset failed (may not exist):`, error.message);
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    logger.success('Database transaction committed successfully');

    // Verify cleanup
    logger.info('Verifying cleanup...');
    const afterCounts = {};
    for (const tableName of countQueries) {
      try {
        // Check if table exists first
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `, [tableName]);

        if (tableCheck.rows[0].exists) {
          const result = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          afterCounts[tableName] = parseInt(result.rows[0].count);
        } else {
          afterCounts[tableName] = 'N/A (table does not exist)';
        }
      } catch (error) {
        afterCounts[tableName] = 'Error checking table';
      }
    }

    logger.info('Database state after cleanup:', afterCounts);

    // Summary
    console.log('\n🎉 DATABASE RESET COMPLETE');
    console.log('============================');
    console.log(`📊 Total records deleted: ${totalDeleted}`);
    console.log('📋 Cleared data:');
    Object.entries(beforeCounts).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   • ${table}: ${count} records`);
      }
    });
    
    console.log('\n✨ Your database is now clean and ready for fresh onboarding!');
    console.log('🔄 You can now use the same account names without conflicts.');
    console.log('\n📝 Next steps:');
    console.log('1. Start your application servers');
    console.log('2. Go through onboarding with your portfolio');
    console.log('3. Test the new Stage 1-2 integration features');

  } catch (error) {
    // Rollback transaction on error
    try {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back due to error');
    } catch (rollbackError) {
      logger.error('Failed to rollback transaction:', rollbackError.message);
    }
    
    logger.error('Database reset failed:', {
      message: error.message,
      stack: error.stack
    });
    throw error;
    
  } finally {
    await client.end();
    logger.info('Database connection closed');
  }
}

// Also clear Pinecone vectors if configured
async function clearPineconeData() {
  try {
    const pineconeService = require('../src/services/pineconeService');
    
    logger.info('Clearing Pinecone vector data...');
    
    // Initialize Pinecone service
    await pineconeService.initialize();
    
    // Clear onboarding namespace (where Stage 1 uploads vectors)
    await pineconeService.deleteNamespace('onboarding');
    logger.success('Cleared Pinecone onboarding namespace');
    
    // Clear styles namespace
    await pineconeService.deleteNamespace('styles');
    logger.success('Cleared Pinecone styles namespace');
    
    // Clear personas namespace
    await pineconeService.deleteNamespace('personas');
    logger.success('Cleared Pinecone personas namespace');
    
  } catch (error) {
    logger.warn('Failed to clear Pinecone data (may not be configured):', error.message);
    logger.info('This is okay - Pinecone clearing is optional');
  }
}

// Run the reset
async function main() {
  console.log('🧹 Starting Database Reset Process');
  console.log('==================================');
  console.log('This will delete all users and their data while preserving database structure.\n');
  
  try {
    // Reset PostgreSQL database
    await resetDatabase();
    
    // Clear Pinecone vectors (optional)
    await clearPineconeData();
    
    console.log('\n🏁 Reset process completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Reset process failed:', error.message);
    process.exit(1);
  }
}

// Confirmation check
if (require.main === module) {
  // Only run if called directly, not when imported
  main();
}

module.exports = { resetDatabase, clearPineconeData };