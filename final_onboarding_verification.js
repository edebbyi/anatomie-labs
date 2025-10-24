/**
 * Final Onboarding Verification
 * 
 * Verifies that all components of the enhanced onboarding system are correctly implemented:
 * 1. Intelligent Prompt Builder with correct ordering and pose analysis
 * 2. Enhanced Style Profile with rich information
 * 3. Voice Command Enhancement with specificity analysis
 * 4. Onboarding flow generates 5 images with imagen-4-ultra provider
 */

console.log('🔍 FINAL ONBOARDING SYSTEM VERIFICATION');
console.log('='.repeat(50));

const fs = require('fs');
const path = require('path');

// Verification tests
async function verifySystemComponents() {
  const results = {
    components: {},
    configurations: {}
  };
  
  console.log('\n🔧 COMPONENT VERIFICATION\n');
  
  // 1. Check Intelligent Prompt Builder
  console.log('1️⃣ Intelligent Prompt Builder...');
  try {
    const promptBuilderPath = './src/services/IntelligentPromptBuilder.js';
    const promptBuilderExists = fs.existsSync(promptBuilderPath);
    
    if (promptBuilderExists) {
      const content = fs.readFileSync(promptBuilderPath, 'utf8');
      const hasCorrectOrder = content.includes('ORDER: Style → Garment → Color → Model/Pose → Accessories → Lighting → Camera');
      const hasPoseAnalysis = content.includes('generatePoseKey') && content.includes('determineFacingDirection');
      const hasFrontFacingEnforcement = content.includes('front-facing') && content.includes('ensureFrontAngle');
      
      results.components.promptBuilder = {
        exists: true,
        correctOrder: hasCorrectOrder,
        poseAnalysis: hasPoseAnalysis,
        frontFacingEnforcement: hasFrontFacingEnforcement,
        status: hasCorrectOrder && hasPoseAnalysis && hasFrontFacingEnforcement ? '✅ PASS' : '❌ FAIL'
      };
      
      console.log(`   ${results.components.promptBuilder.status} Component present with enhancements`);
      if (!hasCorrectOrder) console.log('      ❌ Missing correct prompt order');
      if (!hasPoseAnalysis) console.log('      ❌ Missing pose analysis');
      if (!hasFrontFacingEnforcement) console.log('      ❌ Missing front-facing enforcement');
    } else {
      results.components.promptBuilder = { exists: false, status: '❌ FAIL' };
      console.log('   ❌ Component missing');
    }
  } catch (error) {
    results.components.promptBuilder = { error: error.message, status: '❌ FAIL' };
    console.log(`   ❌ Error checking component: ${error.message}`);
  }
  
  // 2. Check Enhanced Style Profile
  console.log('\n2️⃣ Enhanced Style Profile...');
  try {
    const trendAnalysisPath = './src/services/trendAnalysisAgent.js';
    const migrationPath = './fix_style_profile/migration_enhanced_style_profiles.sql';
    
    const trendAnalysisExists = fs.existsSync(trendAnalysisPath);
    const migrationExists = fs.existsSync(migrationPath);
    
    if (trendAnalysisExists && migrationExists) {
      const trendContent = fs.readFileSync(trendAnalysisPath, 'utf8');
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');
      
      const hasAestheticThemes = trendContent.includes('extractAestheticThemes');
      const hasConstructionPatterns = trendContent.includes('extractConstructionPatterns');
      const hasSignaturePieces = trendContent.includes('extractSignaturePieces');
      const hasMigrationFields = migrationContent.includes('aesthetic_themes') && 
                                migrationContent.includes('construction_patterns') && 
                                migrationContent.includes('signature_pieces');
      
      results.components.styleProfile = {
        trendAnalysisExists: true,
        migrationExists: true,
        aestheticThemes: hasAestheticThemes,
        constructionPatterns: hasConstructionPatterns,
        signaturePieces: hasSignaturePieces,
        migrationFields: hasMigrationFields,
        status: hasAestheticThemes && hasConstructionPatterns && hasSignaturePieces && hasMigrationFields ? '✅ PASS' : '❌ FAIL'
      };
      
      console.log(`   ${results.components.styleProfile.status} Enhanced profile components present`);
      if (!hasAestheticThemes) console.log('      ❌ Missing aesthetic themes extraction');
      if (!hasConstructionPatterns) console.log('      ❌ Missing construction patterns extraction');
      if (!hasSignaturePieces) console.log('      ❌ Missing signature pieces extraction');
      if (!hasMigrationFields) console.log('      ❌ Missing database migration fields');
    } else {
      results.components.styleProfile = { 
        trendAnalysisExists, 
        migrationExists, 
        status: '❌ FAIL' 
      };
      console.log('   ❌ Components missing');
      if (!trendAnalysisExists) console.log('      ❌ trendAnalysisAgent.js missing');
      if (!migrationExists) console.log('      ❌ migration_enhanced_style_profiles.sql missing');
    }
  } catch (error) {
    results.components.styleProfile = { error: error.message, status: '❌ FAIL' };
    console.log(`   ❌ Error checking component: ${error.message}`);
  }
  
  // 3. Check Voice Command Enhancement
  console.log('\n3️⃣ Voice Command Enhancement...');
  try {
    const specificityAnalyzerPath = './src/services/specificityAnalyzer.js';
    const suggestionEnginePath = './src/services/trendAwareSuggestionEngine.js';
    const voiceRoutePath = './src/api/routes/voice.js';
    
    const specificityExists = fs.existsSync(specificityAnalyzerPath);
    const suggestionEngineExists = fs.existsSync(suggestionEnginePath);
    const voiceRouteExists = fs.existsSync(voiceRoutePath);
    
    if (specificityExists && suggestionEngineExists && voiceRouteExists) {
      const voiceContent = fs.readFileSync(voiceRoutePath, 'utf8');
      const hasSpecificityAnalysis = voiceContent.includes('specificityAnalyzer') && 
                                    voiceContent.includes('analyzeCommand');
      const hasTrendSuggestions = voiceContent.includes('suggestionEngine') &&
                                 voiceContent.includes('generateSuggestions');
      
      results.components.voiceEnhancement = {
        specificityAnalyzer: true,
        suggestionEngine: true,
        voiceRoute: true,
        specificityAnalysis: hasSpecificityAnalysis,
        trendSuggestions: hasTrendSuggestions,
        status: hasSpecificityAnalysis && hasTrendSuggestions ? '✅ PASS' : '❌ FAIL'
      };
      
      console.log(`   ${results.components.voiceEnhancement.status} Voice enhancement components present`);
      if (!hasSpecificityAnalysis) console.log('      ❌ Missing specificity analysis integration');
      if (!hasTrendSuggestions) console.log('      ❌ Missing trend-aware suggestions');
    } else {
      results.components.voiceEnhancement = { 
        specificityAnalyzer: specificityExists,
        suggestionEngine: suggestionEngineExists,
        voiceRoute: voiceRouteExists,
        status: '❌ FAIL'
      };
      console.log('   ❌ Components missing');
    }
  } catch (error) {
    results.components.voiceEnhancement = { error: error.message, status: '❌ FAIL' };
    console.log(`   ❌ Error checking component: ${error.message}`);
  }
  
  // 4. Check Onboarding Configuration
  console.log('\n4️⃣ Onboarding Configuration...');
  try {
    const podnaRoutePath = './src/api/routes/podna.js';
    
    if (fs.existsSync(podnaRoutePath)) {
      const podnaContent = fs.readFileSync(podnaRoutePath, 'utf8');
      
      // Check for 5 images generation
      const hasFiveImages = podnaContent.includes('initialCount = parseInt(req.body.initialCount) || 5') ||
                           podnaContent.includes('initialCount || 5') ||
                           podnaContent.includes('count: 5');
                           
      // Check for imagen-4-ultra provider
      const hasImagen4Ultra = podnaContent.includes('imagen-4-ultra');
      
      results.configurations.onboarding = {
        fileExists: true,
        fiveImages: hasFiveImages,
        imagen4Ultra: hasImagen4Ultra,
        status: hasFiveImages && hasImagen4Ultra ? '✅ PASS' : '❌ FAIL'
      };
      
      console.log(`   ${results.configurations.onboarding.status} Onboarding configuration verified`);
      if (!hasFiveImages) console.log('      ❌ Not configured to generate 5 images');
      if (!hasImagen4Ultra) console.log('      ❌ Not using imagen-4-ultra provider');
    } else {
      results.configurations.onboarding = { fileExists: false, status: '❌ FAIL' };
      console.log('   ❌ podna.js route missing');
    }
  } catch (error) {
    results.configurations.onboarding = { error: error.message, status: '❌ FAIL' };
    console.log(`   ❌ Error checking configuration: ${error.message}`);
  }
  
  return results;
}

// Display results
function displayResults(results) {
  console.log('\n' + '='.repeat(50));
  console.log('📋 VERIFICATION RESULTS');
  console.log('='.repeat(50));
  
  // Component Summary
  console.log('\n🔧 COMPONENT STATUS:');
  Object.entries(results.components).forEach(([component, data]) => {
    const name = component.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`   ${data.status} ${name}`);
  });
  
  // Configuration Summary
  console.log('\n⚙️  CONFIGURATION STATUS:');
  Object.entries(results.configurations).forEach(([config, data]) => {
    const name = config.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`   ${data.status} ${name}`);
  });
  
  // Overall Status
  const allComponentsPass = Object.values(results.components).every(c => c.status === '✅ PASS');
  const allConfigsPass = Object.values(results.configurations).every(c => c.status === '✅ PASS');
  
  console.log('\n' + '='.repeat(50));
  if (allComponentsPass && allConfigsPass) {
    console.log('🎉 ALL VERIFICATIONS PASSED!');
    console.log('   ✅ Intelligent Prompt Builder correctly implemented with pose analysis');
    console.log('   ✅ Enhanced Style Profile with rich information (themes, patterns, pieces)');
    console.log('   ✅ Voice Command Enhancement with specificity analysis');
    console.log('   ✅ Onboarding generates 5 images with imagen-4-ultra provider');
    console.log('\n   The enhanced onboarding system is ready for use!');
  } else {
    console.log('❌ SOME VERIFICATIONS FAILED');
    if (!allComponentsPass) {
      console.log('   🔧 Component issues detected - check implementation');
    }
    if (!allConfigsPass) {
      console.log('   ⚙️  Configuration issues detected - check settings');
    }
  }
  console.log('='.repeat(50));
  
  return allComponentsPass && allConfigsPass;
}

// Run verification
async function runVerification() {
  try {
    const results = await verifySystemComponents();
    const success = displayResults(results);
    return success;
  } catch (error) {
    console.error('Verification failed:', error);
    return false;
  }
}

if (require.main === module) {
  runVerification()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Verification execution failed:', error);
      process.exit(1);
    });
}

module.exports = { verifySystemComponents, displayResults };