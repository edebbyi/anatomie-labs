const { Client } = require('pg');
require('dotenv').config();

async function checkExtremeValues() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'designer_bff',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || ''
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Check the range of values in avg_confidence and avg_completeness
    console.log('\n🔍 Checking avg_confidence values:');
    const confidenceStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        MIN(avg_confidence) as min_conf,
        MAX(avg_confidence) as max_conf,
        AVG(avg_confidence) as avg_conf
      FROM style_profiles 
      WHERE avg_confidence IS NOT NULL
    `);
    
    if (confidenceStats.rows[0].total > 0) {
      console.log(`  Total records with confidence: ${confidenceStats.rows[0].total}`);
      console.log(`  Min confidence: ${confidenceStats.rows[0].min_conf}`);
      console.log(`  Max confidence: ${confidenceStats.rows[0].max_conf}`);
      console.log(`  Avg confidence: ${confidenceStats.rows[0].avg_conf}`);
      
      // Check if any values are at the limit
      if (confidenceStats.rows[0].max_conf >= 9.999) {
        console.log('  ⚠️  WARNING: Some confidence values are at or near the maximum limit (9.999)');
      }
    } else {
      console.log('  No records with confidence values found');
    }
    
    console.log('\n🔍 Checking avg_completeness values:');
    const completenessStats = await client.query(`
      SELECT 
        COUNT(*) as total,
        MIN(avg_completeness) as min_comp,
        MAX(avg_completeness) as max_comp,
        AVG(avg_completeness) as avg_comp
      FROM style_profiles 
      WHERE avg_completeness IS NOT NULL
    `);
    
    if (completenessStats.rows[0].total > 0) {
      console.log(`  Total records with completeness: ${completenessStats.rows[0].total}`);
      console.log(`  Min completeness: ${completenessStats.rows[0].min_comp}`);
      console.log(`  Max completeness: ${completenessStats.rows[0].max_comp}`);
      console.log(`  Avg completeness: ${completenessStats.rows[0].avg_comp}`);
      
      // Check if any values are at the limit
      if (completenessStats.rows[0].max_comp >= 999.99) {
        console.log('  ⚠️  WARNING: Some completeness values are at or near the maximum limit (999.99)');
      }
    } else {
      console.log('  No records with completeness values found');
    }
    
    // Check for any potential issues with data insertion
    console.log('\n🔍 Looking for recent error logs:');
    try {
      const errorLogs = await client.query(`
        SELECT created_at, error_message 
        FROM portfolios 
        WHERE error_message IS NOT NULL 
        AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 5
      `);
      
      if (errorLogs.rows.length > 0) {
        console.log('  Recent portfolio errors:');
        errorLogs.rows.forEach(row => {
          console.log(`    ${row.created_at}: ${row.error_message}`);
        });
      } else {
        console.log('  No recent portfolio errors found');
      }
    } catch (error) {
      console.log('  Could not check error logs:', error.message);
    }

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    await client.end();
  }
}

checkExtremeValues();