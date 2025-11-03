#!/usr/bin/env node

/**
 * Verification script for the continuousLearningAgent and image generation fix
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying fix for "continuousLearningAgent is not defined" error\n');

const checks = [];

// 1. Check if continuousLearningAgent module exists
console.log('1️⃣  Checking continuousLearningAgent module...');
const agentPath = path.join(__dirname, 'src/services/continuousLearningAgent.js');
if (fs.existsSync(agentPath)) {
  const content = fs.readFileSync(agentPath, 'utf8');
  if (content.includes('trackInteraction')) {
    console.log('   ✅ Module exists with trackInteraction method');
    checks.push(true);
  } else {
    console.log('   ❌ Module exists but missing trackInteraction method');
    checks.push(false);
  }
} else {
  console.log('   ❌ Module file does not exist');
  checks.push(false);
}

// 2. Check if podna.js safely loads the agent
console.log('\n2️⃣  Checking podna.js agent loading logic...');
const podnaPath = path.join(__dirname, 'src/api/routes/podna.js');
const podnaContent = fs.readFileSync(podnaPath, 'utf8');
if (podnaContent.includes('let continuousLearningAgent = null') && 
    podnaContent.includes('typeof cla.trackInteraction === \'function\'')) {
  console.log('   ✅ Safe try-catch loading pattern present');
  checks.push(true);
} else {
  console.log('   ⚠️  Try-catch pattern may not be complete');
  checks.push(false);
}

// 3. Check if Onboarding.tsx saves to correct key
console.log('\n3️⃣  Checking Onboarding.tsx localStorage key...');
const onboardingPath = path.join(__dirname, 'frontend/src/pages/Onboarding.tsx');
const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');
if (onboardingContent.includes('`generatedImages_${userId}`')) {
  console.log('   ✅ User-specific localStorage key pattern found');
  checks.push(true);
} else {
  console.log('   ❌ User-specific key pattern missing');
  checks.push(false);
}

// 4. Check if useGalleryData reads from correct key
console.log('\n4️⃣  Checking useGalleryData.ts localStorage key...');
const hookPath = path.join(__dirname, 'frontend/src/hooks/useGalleryData.ts');
const hookContent = fs.readFileSync(hookPath, 'utf8');
if (hookContent.includes('`generatedImages_${currentUser.id}`')) {
  console.log('   ✅ useGalleryData correctly looks for user-specific key');
  checks.push(true);
} else {
  console.log('   ❌ useGalleryData key pattern incorrect');
  checks.push(false);
}

// Summary
console.log('\n' + '='.repeat(60));
const passCount = checks.filter(Boolean).length;
const totalCount = checks.length;
console.log(`\n📊 Results: ${passCount}/${totalCount} checks passed\n`);

if (passCount === totalCount) {
  console.log('✅ All fixes are in place!');
  console.log('\n📝 Next steps:');
  console.log('   1. Test with a fresh onboarding flow');
  console.log('   2. Check browser DevTools for generated image URLs');
  console.log('   3. Verify localStorage has images under user-specific key');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Review the issues above.');
  process.exit(1);
}