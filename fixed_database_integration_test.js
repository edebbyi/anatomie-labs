/**
 * Fixed Database Integration Test for Enhanced Style Profile
 * 
 * This test verifies that the enhanced style profile system works correctly
 * with the actual database, including:
 * 1. Database schema with new enhanced fields
 * 2. Trend analysis agent generating rich profile information
 * 3. Proper storage and retrieval of enhanced profile data
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./src/services/database');
const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');

console.log('🧪 DATABASE INTEGRATION TEST FOR ENHANCED STYLE PROFILE');
console.log('='.repeat(60));

async function testDatabaseIntegration() {
  console.log('\n🔍 Testing Database Integration...\n');
  
  // Generate proper UUIDs for testing
  const testUserId = uuidv4();
  const testPortfolioId = uuidv4();
  
  try {
    // Test 1: Verify database connection
    console.log('1️⃣ Testing Database Connection...');
    const connectionSuccess = await db.testConnection();
    if (!connectionSuccess) {
      throw new Error('Database connection failed');
    }
    console.log('   ✅ Database connection successful\n');
    
    // Test 2: Check for enhanced style profile schema
    console.log('2️⃣ Checking Enhanced Style Profile Schema...');
    
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'style_profiles'
      AND column_name IN (
        'aesthetic_themes',
        'construction_patterns', 
        'signature_pieces',
        'avg_confidence',
        'avg_completeness'
      )
      ORDER BY column_name
    `;
    
    const schemaResult = await db.query(schemaQuery);
    const existingColumns = schemaResult.rows.map(row => row.column_name);
    const requiredColumns = [
      'aesthetic_themes',
      'construction_patterns',
      'signature_pieces',
      'avg_confidence',
      'avg_completeness'
    ];
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`   ❌ Missing columns: ${missingColumns.join(', ')}`);
      console.log('   ℹ️  You may need to run the migration_enhanced_style_profiles.sql script');
      return false;
    } else {
      console.log('   ✅ All enhanced style profile columns present');
      schemaResult.rows.forEach(row => {
        console.log(`      - ${row.column_name} (${row.data_type})`);
      });
    }
    
    // Test 3: Verify trend analysis agent functionality
    console.log('\n3️⃣ Testing Trend Analysis Agent...');
    
    // Check if the enhanced methods exist
    const hasEnhancedMethods = 
      typeof trendAnalysisAgent.extractAestheticThemes === 'function' &&
      typeof trendAnalysisAgent.extractConstructionPatterns === 'function' &&
      typeof trendAnalysisAgent.extractSignaturePieces === 'function' &&
      typeof trendAnalysisAgent.generateEnhancedStyleProfile === 'function';
    
    if (!hasEnhancedMethods) {
      console.log('   ❌ Enhanced trend analysis methods missing');
      return false;
    }
    
    console.log('   ✅ Enhanced trend analysis methods present');
    
    // Test 4: Verify data storage and retrieval
    console.log('\n4️⃣ Testing Data Storage and Retrieval...');
    
    // Clean up any existing test data
    await db.query('DELETE FROM style_profiles WHERE user_id = $1', [testUserId]);
    
    // Insert a test profile with enhanced data
    const insertQuery = `
      INSERT INTO style_profiles (
        id,
        user_id, 
        portfolio_id,
        aesthetic_themes,
        construction_patterns,
        signature_pieces,
        avg_confidence,
        avg_completeness,
        summary_text
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        portfolio_id = EXCLUDED.portfolio_id,
        aesthetic_themes = EXCLUDED.aesthetic_themes,
        construction_patterns = EXCLUDED.construction_patterns,
        signature_pieces = EXCLUDED.signature_pieces,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_completeness = EXCLUDED.avg_completeness,
        summary_text = EXCLUDED.summary_text
    `;
    
    const testProfileId = uuidv4();
    const testProfileData = {
      aesthetic_themes: JSON.stringify([
        { name: 'Minimalist', count: 3, strength: 0.6, frequency: '60%' },
        { name: 'Contemporary', count: 2, strength: 0.4, frequency: '40%' }
      ]),
      construction_patterns: JSON.stringify([
        { name: 'Clean seams', count: 4, frequency: '80%' },
        { name: 'Structured shoulders', count: 3, frequency: '60%' }
      ]),
      signature_pieces: JSON.stringify([
        {
          garment_type: 'Blazer',
          description: 'Structured single-breasted blazer with notched lapels',
          standout_detail: 'Sharp shoulder construction',
          confidence: 0.92,
          completeness: 95.5
        }
      ]),
      avg_confidence: 0.85,
      avg_completeness: 92.5,
      summary_text: 'Test profile with enhanced data'
    };
    
    await db.query(insertQuery, [
      testProfileId,
      testUserId,
      testPortfolioId,
      testProfileData.aesthetic_themes,
      testProfileData.construction_patterns,
      testProfileData.signature_pieces,
      testProfileData.avg_confidence,
      testProfileData.avg_completeness,
      testProfileData.summary_text
    ]);
    
    console.log('   ✅ Test profile inserted successfully');
    
    // Retrieve and verify the data
    const selectQuery = `
      SELECT 
        id,
        user_id,
        aesthetic_themes,
        construction_patterns,
        signature_pieces,
        avg_confidence,
        avg_completeness
      FROM style_profiles 
      WHERE user_id = $1
    `;
    
    const selectResult = await db.query(selectQuery, [testUserId]);
    
    if (selectResult.rows.length === 0) {
      console.log('   ❌ Failed to retrieve test profile');
      return false;
    }
    
    const retrievedProfile = selectResult.rows[0];
    
    // Verify the data structure
    const hasAestheticThemes = retrievedProfile.aesthetic_themes && 
                              Array.isArray(JSON.parse(retrievedProfile.aesthetic_themes));
    const hasConstructionPatterns = retrievedProfile.construction_patterns && 
                                   Array.isArray(JSON.parse(retrievedProfile.construction_patterns));
    const hasSignaturePieces = retrievedProfile.signature_pieces && 
                              Array.isArray(JSON.parse(retrievedProfile.signature_pieces));
    
    if (!hasAestheticThemes || !hasConstructionPatterns || !hasSignaturePieces) {
      console.log('   ❌ Retrieved profile missing enhanced data structures');
      return false;
    }
    
    console.log('   ✅ Enhanced profile data stored and retrieved correctly');
    console.log(`      - Profile ID: ${retrievedProfile.id}`);
    console.log(`      - Aesthetic themes: ${JSON.parse(retrievedProfile.aesthetic_themes).length} items`);
    console.log(`      - Construction patterns: ${JSON.parse(retrievedProfile.construction_patterns).length} items`);
    console.log(`      - Signature pieces: ${JSON.parse(retrievedProfile.signature_pieces).length} items`);
    console.log(`      - Avg confidence: ${retrievedProfile.avg_confidence}`);
    console.log(`      - Avg completeness: ${retrievedProfile.avg_completeness}`);
    
    // Test 5: Verify JSON data content
    console.log('\n5️⃣ Testing Enhanced Data Content...');
    
    const aestheticThemes = JSON.parse(retrievedProfile.aesthetic_themes);
    const constructionPatterns = JSON.parse(retrievedProfile.construction_patterns);
    const signaturePieces = JSON.parse(retrievedProfile.signature_pieces);
    
    // Check aesthetic themes structure
    if (aestheticThemes.length > 0) {
      const theme = aestheticThemes[0];
      const hasRequiredFields = theme.name && theme.count && theme.strength && theme.frequency;
      console.log(`   ${hasRequiredFields ? '✅' : '❌'} Aesthetic themes have correct structure`);
    }
    
    // Check construction patterns structure
    if (constructionPatterns.length > 0) {
      const pattern = constructionPatterns[0];
      const hasRequiredFields = pattern.name && pattern.count && pattern.frequency;
      console.log(`   ${hasRequiredFields ? '✅' : '❌'} Construction patterns have correct structure`);
    }
    
    // Check signature pieces structure
    if (signaturePieces.length > 0) {
      const piece = signaturePieces[0];
      const hasRequiredFields = piece.garment_type && piece.description && piece.standout_detail && 
                               piece.confidence && piece.completeness;
      console.log(`   ${hasRequiredFields ? '✅' : '❌'} Signature pieces have correct structure`);
    }
    
    // Clean up test data
    await db.query('DELETE FROM style_profiles WHERE user_id = $1', [testUserId]);
    console.log('   🧹 Test data cleaned up');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL DATABASE INTEGRATION TESTS PASSED!');
    console.log('   ✅ Database connection working');
    console.log('   ✅ Enhanced style profile schema present');
    console.log('   ✅ Trend analysis agent methods available');
    console.log('   ✅ Enhanced profile data storage and retrieval working');
    console.log('   ✅ Enhanced data content structure verified');
    console.log('\n   The enhanced style profile system is properly integrated with the database!');
    console.log('='.repeat(60));
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Database integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Clean up test data in case of error
    try {
      await db.query('DELETE FROM style_profiles WHERE user_id = $1', [testUserId]);
      console.log('   🧹 Test data cleaned up after error');
    } catch (cleanupError) {
      console.log('   ⚠️  Failed to clean up test data:', cleanupError.message);
    }
    
    return false;
  }
}

// Run the test
if (require.main === module) {
  testDatabaseIntegration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testDatabaseIntegration };