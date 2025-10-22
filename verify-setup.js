require('dotenv').config();
const { Client } = require('pg');
const redis = require('redis');
const axios = require('axios');

const checks = {
  total: 0,
  passed: 0,
  failed: 0
};

async function check(name, testFn) {
  checks.total++;
  process.stdout.write(`\n${checks.total}. ${name}... `);
  try {
    await testFn();
    console.log('✅ PASS');
    checks.passed++;
    return true;
  } catch (error) {
    console.log('❌ FAIL');
    console.log(`   Error: ${error.message}`);
    checks.failed++;
    return false;
  }
}

async function verifySetup() {
  console.log('🔍 Designer BFF - Technical Setup Verification\n');
  console.log('=' .repeat(50));

  // Environment Variables
  console.log('\n📋 Environment Configuration:');
  await check('DATABASE_URL configured', async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  });

  await check('REDIS_URL configured', async () => {
    if (!process.env.REDIS_URL) throw new Error('REDIS_URL not set');
  });

  await check('JWT_SECRET configured', async () => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not set');
  });

  await check('VLT_API_KEY configured', async () => {
    if (!process.env.VLT_API_KEY) throw new Error('VLT_API_KEY not set');
  });

  await check('R2_BUCKET_NAME configured', async () => {
    if (!process.env.R2_BUCKET_NAME) throw new Error('R2_BUCKET_NAME not set');
  });

  // PostgreSQL
  console.log('\n🗄️  PostgreSQL Database:');
  let pgClient;
  const pgConnected = await check('PostgreSQL connection', async () => {
    pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
  });

  if (pgConnected) {
    await check('Users table exists', async () => {
      const result = await pgClient.query("SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'users')");
      if (!result.rows[0].exists) throw new Error('users table not found');
    });

    await check('Images table exists', async () => {
      const result = await pgClient.query("SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'images')");
      if (!result.rows[0].exists) throw new Error('images table not found');
    });

    await check('Voice commands table exists', async () => {
      const result = await pgClient.query("SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'voice_commands')");
      if (!result.rows[0].exists) throw new Error('voice_commands table not found');
    });

    await check('Generation jobs table exists', async () => {
      const result = await pgClient.query("SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'generation_jobs')");
      if (!result.rows[0].exists) throw new Error('generation_jobs table not found');
    });

    // Count tables
    const tableResult = await pgClient.query("SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public'");
    console.log(`   ℹ️  Total tables: ${tableResult.rows[0].count}`);

    await pgClient.end();
  }

  // Redis
  console.log('\n📦 Redis Cache:');
  let redisClient;
  const redisConnected = await check('Redis connection', async () => {
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
  });

  if (redisConnected) {
    await check('Redis SET/GET', async () => {
      await redisClient.set('test:setup', 'verified');
      const value = await redisClient.get('test:setup');
      if (value !== 'verified') throw new Error('SET/GET mismatch');
      await redisClient.del('test:setup');
    });

    await redisClient.quit();
  }

  // VLT API
  console.log('\n🎨 VLT API:');
  await check('VLT API endpoint reachable', async () => {
    const response = await axios.get(
      `${process.env.VLT_API_URL}/healthz`,
      {
        headers: { 'Authorization': `Bearer ${process.env.VLT_API_KEY}` },
        timeout: 5000,
        validateStatus: () => true // Accept any status
      }
    );
    // 404 is ok - endpoint might not exist, but service is reachable
    if (response.status !== 404 && response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  });

  // Node Modules
  console.log('\n📦 Dependencies:');
  await check('Express installed', async () => {
    require('express');
  });

  await check('Socket.IO installed', async () => {
    require('socket.io');
  });

  await check('Multer installed', async () => {
    require('multer');
  });

  await check('AWS SDK installed', async () => {
    require('aws-sdk');
  });

  await check('Winston logger installed', async () => {
    require('winston');
  });

  // File Structure
  console.log('\n📁 File Structure:');
  const fs = require('fs');
  
  await check('server.js exists', async () => {
    if (!fs.existsSync('./server.js')) throw new Error('server.js not found');
  });

  await check('VLT service exists', async () => {
    if (!fs.existsSync('./src/services/vltService.js')) throw new Error('vltService.js not found');
  });

  await check('R2 storage service exists', async () => {
    if (!fs.existsSync('./src/services/r2Storage.js')) throw new Error('r2Storage.js not found');
  });

  await check('Auth middleware exists', async () => {
    if (!fs.existsSync('./src/middleware/auth.js')) throw new Error('auth.js not found');
  });

  await check('Database schema exists', async () => {
    if (!fs.existsSync('./database/schema.sql')) throw new Error('schema.sql not found');
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 VERIFICATION SUMMARY:');
  console.log(`   Total Checks: ${checks.total}`);
  console.log(`   ✅ Passed: ${checks.passed}`);
  console.log(`   ❌ Failed: ${checks.failed}`);
  
  const percentage = ((checks.passed / checks.total) * 100).toFixed(1);
  console.log(`   📈 Success Rate: ${percentage}%`);

  if (checks.failed === 0) {
    console.log('\n🎉 All checks passed! Technical setup is complete!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Add your R2 Account ID and Access Key ID to .env');
    console.log('   2. Start the server: npm run dev');
    console.log('   3. Test API: curl http://localhost:3000/health');
    console.log('   4. Build React frontend components');
    return true;
  } else {
    console.log('\n⚠️  Some checks failed. Please review errors above.');
    return false;
  }
}

verifySetup()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  });