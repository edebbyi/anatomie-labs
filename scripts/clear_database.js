#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearDatabase() {
  const client = await pool.connect();
  
  try {
    console.log(`${colors.yellow}🗑️  Database Clear Script${colors.reset}`);
    console.log(`${colors.yellow}================================${colors.reset}\n`);

    // Get table counts before clearing
    console.log(`${colors.blue}📊 Current table row counts:${colors.reset}`);
    
    const tables = [
      'users', 'user_profiles', 'voice_commands', 'vlt_specifications',
      'generation_jobs', 'images', 'image_feedback', 'collections',
      'collection_images', 'prompt_optimizations', 'global_learning',
      'cost_tracking', 'nightly_batches', 'analytics_snapshots'
    ];

    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`   ${table}: ${result.rows[0].count} rows`);
      } catch (err) {
        console.log(`   ${table}: table not found or error`);
      }
    }

    console.log(`\n${colors.red}⚠️  WARNING: This will permanently delete ALL data from the database!${colors.reset}`);
    console.log(`${colors.red}   This includes:${colors.reset}`);
    console.log(`${colors.red}   - All user accounts and profiles${colors.reset}`);
    console.log(`${colors.red}   - All generated images metadata${colors.reset}`);
    console.log(`${colors.red}   - All voice commands history${colors.reset}`);
    console.log(`${colors.red}   - All analytics data${colors.reset}`);
    console.log(`${colors.red}   - All feedback and collections${colors.reset}\n`);

    // Check for command line argument to skip confirmation
    const skipConfirmation = process.argv.includes('--yes') || process.argv.includes('-y');
    
    if (!skipConfirmation) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('Are you sure you want to continue? (type "yes" to confirm): ', resolve);
      });
      
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log(`${colors.yellow}Cancelled. No changes made.${colors.reset}`);
        return;
      }
    }

    console.log(`\n${colors.yellow}🧹 Clearing database...${colors.reset}`);

    // Begin transaction
    await client.query('BEGIN');

    // Disable foreign key constraints temporarily
    await client.query('SET session_replication_role = replica');

    // Clear all tables
    const truncateQuery = `
      TRUNCATE TABLE 
        analytics_snapshots,
        collection_images,
        collections,
        image_feedback,
        cost_tracking,
        nightly_batches,
        global_learning,
        prompt_optimizations,
        images,
        generation_jobs,
        vlt_specifications,
        voice_commands,
        user_profiles,
        users
      RESTART IDENTITY CASCADE
    `;

    await client.query(truncateQuery);

    // Re-enable foreign key constraints
    await client.query('SET session_replication_role = DEFAULT');

    // Commit transaction
    await client.query('COMMIT');

    console.log(`${colors.green}✅ Database cleared successfully!${colors.reset}`);
    console.log(`${colors.green}   All tables are now empty and ready for fresh data.${colors.reset}\n`);

    // Verify tables are empty
    console.log(`${colors.blue}📊 Verifying tables are empty:${colors.reset}`);
    let totalRows = 0;
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        totalRows += count;
        console.log(`   ${table}: ${count} rows`);
      } catch (err) {
        console.log(`   ${table}: error checking count`);
      }
    }

    if (totalRows === 0) {
      console.log(`${colors.green}\n🎉 Perfect! All tables are completely empty.${colors.reset}`);
    } else {
      console.log(`${colors.red}\n❌ Warning: Some tables still have data (${totalRows} total rows)${colors.reset}`);
    }

    console.log(`\n${colors.yellow}📝 Next steps:${colors.reset}`);
    console.log(`${colors.yellow}   1. Clear browser localStorage to reset any cached user data${colors.reset}`);
    console.log(`${colors.yellow}   2. Restart your application${colors.reset}`);
    console.log(`${colors.yellow}   3. Go through the onboarding process again${colors.reset}\n`);

    console.log(`${colors.yellow}🌐 To clear browser storage:${colors.reset}`);
    console.log(`${colors.yellow}   1. Open browser dev tools (F12)${colors.reset}`);
    console.log(`${colors.yellow}   2. Go to Application/Storage tab${colors.reset}`);
    console.log(`${colors.yellow}   3. Click 'Clear storage' or manually delete localStorage items${colors.reset}`);
    console.log(`${colors.yellow}   4. Refresh the page${colors.reset}`);

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error(`${colors.red}❌ Error clearing database:${colors.reset}`, error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Run the script
if (require.main === module) {
  clearDatabase()
    .then(() => {
      console.log(`\n${colors.green}✨ Script completed successfully!${colors.reset}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`${colors.red}❌ Script failed:${colors.reset}`, error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { clearDatabase };