#!/usr/bin/env node
/**
 * Reset Onboarding State
 * 
 * This script helps reset the onboarding state for testing.
 * It generates JavaScript code that you can paste into your browser console
 * to clear localStorage and reset the onboarding state.
 * 
 * Usage:
 *   node scripts/reset-onboarding.js
 * 
 * Then copy the output and paste it into your browser console.
 */

const resetCode = `
// Reset Onboarding State
console.log('🧹 Clearing onboarding state...');

// Clear all onboarding-related localStorage items
const keysToRemove = [
  'userProfile',
  'vltAnalysis',
  'portfolioData',
  'onboardingComplete',
  'authToken',
  'currentUser',
  'userId'
];

keysToRemove.forEach(key => {
  if (localStorage.getItem(key)) {
    console.log(\`  ✓ Removed: \${key}\`);
    localStorage.removeItem(key);
  }
});

// Clear all sessionStorage too
sessionStorage.clear();
console.log('  ✓ Cleared sessionStorage');

// Clear any cookies (if used)
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});
console.log('  ✓ Cleared cookies');

console.log('');
console.log('✅ Onboarding state reset complete!');
console.log('💡 Reload the page to start fresh.');
console.log('');

// Optional: Automatically reload
setTimeout(() => {
  console.log('🔄 Reloading in 2 seconds...');
  setTimeout(() => window.location.href = '/', 2000);
}, 1000);
`;

console.log('='.repeat(80));
console.log('RESET ONBOARDING STATE');
console.log('='.repeat(80));
console.log('');
console.log('Instructions:');
console.log('1. Open your browser and navigate to: http://localhost:3000');
console.log('2. Open the Developer Console (F12 or Cmd+Option+I on Mac)');
console.log('3. Copy and paste the code below into the console');
console.log('4. Press Enter to execute');
console.log('');
console.log('='.repeat(80));
console.log('');
console.log(resetCode);
console.log('');
console.log('='.repeat(80));
console.log('');
console.log('Alternative: Visit this URL to manually clear:');
console.log('http://localhost:3000 (then open DevTools > Application > Local Storage)');
console.log('');
