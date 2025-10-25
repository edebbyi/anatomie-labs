const { Client } = require('pg');
require('dotenv').config();

async function debugStyleProfilesTable() {
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

    // Check if style_profiles table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'style_profiles'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ style_profiles table does not exist');
      return;
    }
    
    console.log('✅ style_profiles table exists');
    
    // Get column information
    const columns = await client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'style_profiles'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Columns in style_profiles table:');
    columns.rows.forEach(col => {
      let typeInfo = col.data_type;
      if (col.data_type === 'numeric') {
        typeInfo = `DECIMAL(${col.numeric_precision},${col.numeric_scale})`;
      }
      console.log(`  - ${col.column_name}: ${typeInfo} (${col.is_nullable})`);
    });
    
    // Check for avg_confidence and avg_completeness columns specifically
    const numericColumns = await client.query(`
      SELECT column_name, data_type, numeric_precision, numeric_scale
      FROM information_schema.columns 
      WHERE table_name = 'style_profiles' 
      AND column_name IN ('avg_confidence', 'avg_completeness')
    `);
    
    console.log('\n🔢 Numeric column details:');
    if (numericColumns.rows.length === 0) {
      console.log('  ❌ Neither avg_confidence nor avg_completeness columns exist');
    } else {
      numericColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: DECIMAL(${col.numeric_precision},${col.numeric_scale})`);
      });
    }
    
    // Check if there are any records in the table
    const countResult = await client.query('SELECT COUNT(*) as count FROM style_profiles');
    console.log(`\n📊 Total records in style_profiles: ${countResult.rows[0].count}`);
    
    if (parseInt(countResult.rows[0].count) > 0) {
      // Check for any records with high confidence values
      try {
        const highConfidence = await client.query(`
          SELECT COUNT(*) as count 
          FROM style_profiles 
          WHERE avg_confidence >= 1.0
        `);
        console.log(`📊 Records with confidence >= 1.0: ${highConfidence.rows[0].count}`);
      } catch (error) {
        console.log('⚠️  Could not check confidence values:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure PostgreSQL is running on your system');
    } else if (error.code === '28P01') {
      console.log('💡 Check your database credentials in .env file');
    }
  } finally {
    await client.end();
  }
}

debugStyleProfilesTable();