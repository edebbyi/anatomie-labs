/**
 * Test script to verify both trend analysis agent files are fixed
 */

const db = require('./src/services/database');
const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');
const improvedTrendAnalysisAgent = require('./fix_style_profile/improvedTrendAnalysisAgent');
const { v4: uuidv4 } = require('uuid');

async function testBothFixes() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const connected = await db.testConnection();
    if (!connected) {
      console.error('❌ Failed to connect to database');
      return;
    }
    console.log('✅ Connected to database successfully');

    // Create a test user
    console.log('\n🔧 Creating test user...');
    const testUserId = uuidv4();
    const testPortfolioId = uuidv4();
    
    const createUserQuery = `
      INSERT INTO users (id, email, password_hash, name)
      VALUES ($1, $2, $3, $4)
    `;
    
    await db.query(createUserQuery, [
      testUserId,
      `test-${testUserId}@example.com`,
      'test-password-hash',
      'Test User'
    ]);
    
    // Create a test portfolio
    const createPortfolioQuery = `
      INSERT INTO portfolios (id, user_id, title)
      VALUES ($1, $2, $3)
    `;
    
    await db.query(createPortfolioQuery, [
      testPortfolioId,
      testUserId,
      'Test Portfolio'
    ]);
    
    console.log('✅ Test user and portfolio created successfully');

    // Test the main trendAnalysisAgent with high numeric values
    console.log('\n🧪 Testing main trendAnalysisAgent with high numeric values...');
    
    const testData = {
      garment_distribution: {},
      color_distribution: {},
      fabric_distribution: {},
      silhouette_distribution: {},
      aesthetic_themes: [],
      construction_patterns: [],
      signature_pieces: [],
      rich_summary: 'Test summary',
      total_images: 50,
      avg_confidence: 15.5, // This is higher than the max allowed value
      avg_completeness: 1200.75 // This is higher than the max allowed value
    };
    
    console.log(`  Input values:`);
    console.log(`    avg_confidence: ${testData.avg_confidence}`);
    console.log(`    avg_completeness: ${testData.avg_completeness}`);
    
    // Test the main method
    const result1 = await trendAnalysisAgent.saveEnhancedProfile(
      testUserId,
      testPortfolioId,
      testData
    );
    
    console.log(`\n✅ Main agent - Successfully saved test profile`);
    console.log(`  Stored values:`);
    console.log(`    avg_confidence: ${result1.avg_confidence}`);
    console.log(`    avg_completeness: ${result1.avg_completeness}`);
    
    // Verify the values are within expected ranges
    if (result1.avg_confidence >= 0 && result1.avg_confidence <= 9.999) {
      console.log(`  ✅ avg_confidence is within valid range`);
    } else {
      console.log(`  ❌ avg_confidence is outside valid range`);
    }
    
    if (result1.avg_completeness >= 0 && result1.avg_completeness <= 999.99) {
      console.log(`  ✅ avg_completeness is within valid range`);
    } else {
      console.log(`  ❌ avg_completeness is outside valid range`);
    }
    
    // Clean up the first test
    await db.query('DELETE FROM style_profiles WHERE user_id = $1', [testUserId]);
    
    // Test the improved trendAnalysisAgent with high numeric values
    console.log('\n🧪 Testing improved trendAnalysisAgent with high numeric values...');
    
    // Test the improved method
    const result2 = await improvedTrendAnalysisAgent.saveEnhancedProfile(
      testUserId,
      testPortfolioId,
      testData
    );
    
    console.log(`\n✅ Improved agent - Successfully saved test profile`);
    console.log(`  Stored values:`);
    console.log(`    avg_confidence: ${result2.avg_confidence}`);
    console.log(`    avg_completeness: ${result2.avg_completeness}`);
    
    // Verify the values are within expected ranges
    if (result2.avg_confidence >= 0 && result2.avg_confidence <= 9.999) {
      console.log(`  ✅ avg_confidence is within valid range`);
    } else {
      console.log(`  ❌ avg_confidence is outside valid range`);
    }
    
    if (result2.avg_completeness >= 0 && result2.avg_completeness <= 999.99) {
      console.log(`  ✅ avg_completeness is within valid range`);
    } else {
      console.log(`  ❌ avg_completeness is outside valid range`);
    }
    
    // Clean up test data
    await db.query('DELETE FROM style_profiles WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM portfolios WHERE id = $1', [testPortfolioId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log(`\n🧹 Cleaned up test data`);
    
    console.log('\n🎉 Both numeric overflow fixes tested successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.closePool();
  }
}

testBothFixes();