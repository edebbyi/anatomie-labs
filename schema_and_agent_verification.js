/**
 * Schema and Agent Verification Test
 * 
 * This test verifies that the enhanced style profile system is properly set up:
 * 1. Database schema has the required enhanced fields
 * 2. Trend analysis agent has the enhanced methods
 * 3. Onboarding configuration is correct (5 images, imagen-4-ultra provider)
 */

const db = require('./src/services/database');
const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');
const fs = require('fs');

console.log('🔍 SCHEMA AND AGENT VERIFICATION TEST');
console.log('='.repeat(50));

async function verifySystemSetup() {
  console.log('\n🧪 Verifying System Setup...\n');
  
  let allTestsPassed = true;
  
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
      allTestsPassed = false;
    } else {
      console.log('   ✅ All enhanced style profile columns present');
      schemaResult.rows.forEach(row => {
        console.log(`      - ${row.column_name} (${row.data_type})`);
      });
    }
    console.log();
    
    // Test 3: Verify trend analysis agent functionality
    console.log('3️⃣ Testing Trend Analysis Agent Methods...');
    
    const requiredMethods = [
      'extractAestheticThemes',
      'extractConstructionPatterns',
      'extractSignaturePieces',
      'generateEnhancedStyleProfile'
    ];
    
    const missingMethods = requiredMethods.filter(method => 
      typeof trendAnalysisAgent[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
      console.log(`   ❌ Missing methods: ${missingMethods.join(', ')}`);
      allTestsPassed = false;
    } else {
      console.log('   ✅ All enhanced trend analysis methods present');
      requiredMethods.forEach(method => {
        console.log(`      - ${method}`);
      });
    }
    console.log();
    
    // Test 4: Verify onboarding configuration
    console.log('4️⃣ Testing Onboarding Configuration...');
    
    const podnaRoutePath = './src/api/routes/podna.js';
    if (fs.existsSync(podnaRoutePath)) {
      const podnaContent = fs.readFileSync(podnaRoutePath, 'utf8');
      
      // Check for 5 images generation
      const hasFiveImages = podnaContent.includes('initialCount = parseInt(req.body.initialCount) || 5') ||
                           podnaContent.includes('initialCount || 5') ||
                           podnaContent.includes('count: 5');
                           
      // Check for imagen-4-ultra provider
      const hasImagen4Ultra = podnaContent.includes('imagen-4-ultra');
      
      if (hasFiveImages) {
        console.log('   ✅ Onboarding configured to generate 5 images');
      } else {
        console.log('   ❌ Onboarding not configured to generate 5 images');
        allTestsPassed = false;
      }
      
      if (hasImagen4Ultra) {
        console.log('   ✅ Onboarding uses imagen-4-ultra provider');
      } else {
        console.log('   ❌ Onboarding does not use imagen-4-ultra provider');
        allTestsPassed = false;
      }
    } else {
      console.log('   ❌ podna.js route file not found');
      allTestsPassed = false;
    }
    console.log();
    
    // Test 5: Verify Intelligent Prompt Builder enhancements
    console.log('5️⃣ Testing Intelligent Prompt Builder Enhancements...');
    
    const promptBuilderPath = './src/services/IntelligentPromptBuilder.js';
    if (fs.existsSync(promptBuilderPath)) {
      const promptBuilderContent = fs.readFileSync(promptBuilderPath, 'utf8');
      
      const hasCorrectOrder = promptBuilderContent.includes('ORDER: Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera');
      const hasPoseAnalysis = promptBuilderContent.includes('generatePoseKey') && promptBuilderContent.includes('determineFacingDirection');
      const hasFrontFacingEnforcement = promptBuilderContent.includes('front-facing') && promptBuilderContent.includes('ensureFrontAngle');
      
      if (hasCorrectOrder) {
        console.log('   ✅ Correct prompt ordering implemented');
      } else {
        console.log('   ❌ Correct prompt ordering not implemented');
        allTestsPassed = false;
      }
      
      if (hasPoseAnalysis) {
        console.log('   ✅ Pose analysis functionality present');
      } else {
        console.log('   ❌ Pose analysis functionality missing');
        allTestsPassed = false;
      }
      
      if (hasFrontFacingEnforcement) {
        console.log('   ✅ Front-facing enforcement implemented');
      } else {
        console.log('   ❌ Front-facing enforcement not implemented');
        allTestsPassed = false;
      }
    } else {
      console.log('   ❌ IntelligentPromptBuilder.js file not found');
      allTestsPassed = false;
    }
    console.log();
    
    // Test 6: Verify Voice Command Enhancement components
    console.log('6️⃣ Testing Voice Command Enhancement Components...');
    
    const specificityAnalyzerPath = './src/services/specificityAnalyzer.js';
    const suggestionEnginePath = './src/services/trendAwareSuggestionEngine.js';
    const voiceRoutePath = './src/api/routes/voice.js';
    
    const components = [
      { name: 'Specificity Analyzer', path: specificityAnalyzerPath },
      { name: 'Trend-Aware Suggestion Engine', path: suggestionEnginePath },
      { name: 'Voice Route', path: voiceRoutePath }
    ];
    
    let allVoiceComponentsPresent = true;
    components.forEach(component => {
      if (fs.existsSync(component.path)) {
        console.log(`   ✅ ${component.name} present`);
      } else {
        console.log(`   ❌ ${component.name} missing`);
        allVoiceComponentsPresent = false;
        allTestsPassed = false;
      }
    });
    
    if (allVoiceComponentsPresent) {
      // Check voice route for specificity integration
      const voiceContent = fs.readFileSync(voiceRoutePath, 'utf8');
      const hasSpecificityAnalysis = voiceContent.includes('specificityAnalyzer') && 
                                    voiceContent.includes('analyzeCommand');
      const hasTrendSuggestions = voiceContent.includes('suggestionEngine') &&
                                 voiceContent.includes('generateSuggestions');
      
      if (hasSpecificityAnalysis) {
        console.log('   ✅ Voice command specificity analysis integrated');
      } else {
        console.log('   ❌ Voice command specificity analysis not integrated');
        allTestsPassed = false;
      }
      
      if (hasTrendSuggestions) {
        console.log('   ✅ Trend-aware suggestions integrated');
      } else {
        console.log('   ❌ Trend-aware suggestions not integrated');
        allTestsPassed = false;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    if (allTestsPassed) {
      console.log('🎉 ALL VERIFICATION TESTS PASSED!');
      console.log('   ✅ Database schema has enhanced fields');
      console.log('   ✅ Trend analysis agent has enhanced methods');
      console.log('   ✅ Onboarding configured for 5 images with imagen-4-ultra provider');
      console.log('   ✅ Intelligent Prompt Builder has pose analysis enhancements');
      console.log('   ✅ Voice Command Enhancement components present and integrated');
      console.log('\n   The enhanced onboarding system is properly configured!');
    } else {
      console.log('❌ SOME VERIFICATION TESTS FAILED');
      console.log('   Please check the issues identified above and ensure all components are properly implemented.');
    }
    console.log('='.repeat(50));
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('\n❌ Verification test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the verification
if (require.main === module) {
  verifySystemSetup()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Verification execution failed:', error);
      process.exit(1);
    });
}

module.exports = { verifySystemSetup };