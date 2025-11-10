#!/usr/bin/env node

/**
 * JWT Configuration Verification Script
 *
 * This script verifies that the JWT_SECRET environment variable is properly configured
 * and provides helpful diagnostic information.
 */

try {
  require('dotenv').config();
} catch (e) {
  console.log('Note: dotenv not installed, reading from process.env only');
}

const crypto = require('crypto');

console.log('\n=== JWT Configuration Verification ===\n');

// Check if JWT_SECRET is defined
const jwtSecret = process.env.JWT_SECRET;
const jwtExpireTime = process.env.JWT_EXPIRE_TIME;

if (!jwtSecret) {
  console.error('❌ ERROR: JWT_SECRET is not defined!');
  console.log('\nTo fix this:');
  console.log('1. For local development: Copy .env.example to .env and set JWT_SECRET');
  console.log('2. For production (Render): Ensure JWT_SECRET is set in Environment Variables');
  console.log('\nYou can generate a secure JWT secret with:');
  console.log('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  process.exit(1);
}

// Verify JWT_SECRET has sufficient entropy
if (jwtSecret.length < 32) {
  console.warn('⚠️  WARNING: JWT_SECRET is too short (< 32 characters)');
  console.warn('   For security, use at least a 32-character random string\n');
} else {
  console.log('✅ JWT_SECRET is defined and has sufficient length');
}

// Check JWT_EXPIRE_TIME
if (!jwtExpireTime) {
  console.warn('⚠️  WARNING: JWT_EXPIRE_TIME is not defined (will default to 7d)');
} else {
  console.log(`✅ JWT_EXPIRE_TIME is set to: ${jwtExpireTime}`);
}

// Display masked JWT_SECRET for verification
const maskedSecret = jwtSecret.length > 8
  ? `${jwtSecret.substring(0, 8)}...${jwtSecret.substring(jwtSecret.length - 8)}`
  : '***REDACTED***';
console.log(`   JWT_SECRET: ${maskedSecret}`);

// Test JWT signing (requires jsonwebtoken)
try {
  const jwt = require('jsonwebtoken');
  const testPayload = { test: true, timestamp: Date.now() };
  const token = jwt.sign(testPayload, jwtSecret, { expiresIn: '1m' });
  const decoded = jwt.verify(token, jwtSecret);

  console.log('\n✅ JWT signing and verification test: PASSED');
  console.log('   Token generation and validation working correctly\n');
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('\n⚠️  jsonwebtoken not available for testing (install with: npm install)');
  } else {
    console.error('\n❌ JWT signing/verification test FAILED:', error.message);
    process.exit(1);
  }
}

// Environment check
console.log('=== Environment Information ===');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set (defaults to development)'}`);
console.log(`PORT: ${process.env.PORT || 'not set (defaults to 3001)'}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`);

console.log('\n✅ JWT configuration is valid!\n');
