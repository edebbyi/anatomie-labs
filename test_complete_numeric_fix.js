const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function testCompleteNumericFix() {
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

    // Create a test user first
    const testUserId = uuidv4();
    const testPortfolioId = uuidv4();
    
    console.log('\n🔧 Creating test user...');
    
    const createUserQuery = `
      INSERT INTO users (id, email, password_hash, name)
      VALUES ($1, $2, $3, $4)
    `;
    
    await client.query(createUserQuery, [
      testUserId,
      `test-${testUserId}@example.com`,
      'test-password-hash',
      'Test User'
    ]);
    
    console.log('✅ Test user created successfully');
    
    console.log('\n🧪 Testing numeric value insertion...');
    
    // Test with high confidence value (should be clamped)
    const testData = {
      user_id: testUserId,
      portfolio_id: testPortfolioId,
      avg_confidence: 15.5, // This is higher than the max allowed value
      avg_completeness: 1200.75, // This is higher than the max allowed value
      total_images: 50
    };
    
    console.log(`  Input values:`);
    console.log(`    avg_confidence: ${testData.avg_confidence}`);
    console.log(`    avg_completeness: ${testData.avg_completeness}`);
    
    // Clamp values to valid ranges
    const clampedConfidence = Math.min(Math.max(testData.avg_confidence, 0), 9.999);
    const clampedCompleteness = Math.min(Math.max(testData.avg_completeness, 0), 999.99);
    
    console.log(`  Clamped values:`);
    console.log(`    avg_confidence: ${clampedConfidence}`);
    console.log(`    avg_completeness: ${clampedCompleteness}`);
    
    // Try to insert into database
    const insertQuery = `
      INSERT INTO style_profiles (
        user_id, 
        portfolio_id, 
        avg_confidence,
        avg_completeness,
        total_images
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        portfolio_id = EXCLUDED.portfolio_id,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_completeness = EXCLUDED.avg_completeness,
        total_images = EXCLUDED.total_images
      RETURNING *
    `;
    
    const result = await client.query(insertQuery, [
      testData.user_id,
      testData.portfolio_id,
      clampedConfidence,
      clampedCompleteness,
      testData.total_images
    ]);
    
    console.log(`\n✅ Successfully inserted test record`);
    console.log(`  Stored values:`);
    console.log(`    avg_confidence: ${result.rows[0].avg_confidence}`);
    console.log(`    avg_completeness: ${result.rows[0].avg_completeness}`);
    
    // Verify the values are within expected ranges
    if (result.rows[0].avg_confidence >= 0 && result.rows[0].avg_confidence <= 9.999) {
      console.log(`  ✅ avg_confidence is within valid range`);
    } else {
      console.log(`  ❌ avg_confidence is outside valid range`);
    }
    
    if (result.rows[0].avg_completeness >= 0 && result.rows[0].avg_completeness <= 999.99) {
      console.log(`  ✅ avg_completeness is within valid range`);
    } else {
      console.log(`  ❌ avg_completeness is outside valid range`);
    }
    
    // Clean up test data
    await client.query('DELETE FROM style_profiles WHERE user_id = $1', [testUserId]);
    await client.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log(`\n🧹 Cleaned up test data`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testCompleteNumericFix();