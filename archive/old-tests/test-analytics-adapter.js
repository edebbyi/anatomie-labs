#!/usr/bin/env node

/**
 * Test script for Analytics Service Adapter
 * Tests the adapter with your actual database schema
 */

require('dotenv').config();
const analyticsService = require('./src/services/analyticsServiceAdapter');
const db = require('./src/services/database');

async function testAnalyticsAdapter() {
  console.log('\n🧪 Testing Analytics Service Adapter\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Database Connection
    console.log('\n1️⃣  Testing database connection...');
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connected');

    // Test 2: Get a test user ID
    console.log('\n2️⃣  Finding a test user...');
    const userResult = await db.query(`
      SELECT DISTINCT user_id 
      FROM generations 
      WHERE user_id IS NOT NULL 
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('⚠️  No users found with generations. Creating test data would be needed.');
      console.log('Skipping user-specific tests...');
      await db.closePool();
      return;
    }

    const testUserId = userResult.rows[0].user_id;
    console.log(`✅ Found test user: ${testUserId}`);

    // Test 3: Get User Stats
    console.log('\n3️⃣  Testing getUserStats()...');
    const stats = await analyticsService.getUserStats(testUserId);
    console.log('✅ User stats retrieved:');
    console.log(JSON.stringify(stats, null, 2));

    // Test 4: Get Style Evolution
    console.log('\n4️⃣  Testing getStyleEvolution()...');
    const evolution = await analyticsService.getStyleEvolution(testUserId, 30);
    console.log('✅ Style evolution retrieved:');
    console.log(`   - Total generations: ${evolution.totalGenerations}`);
    console.log(`   - Average outlier rate: ${evolution.avgOutlierRate}%`);
    console.log(`   - Trend: ${evolution.trend.description}`);
    console.log(`   - Snapshots: ${evolution.snapshots.length} days`);

    // Test 5: Get Provider Performance
    console.log('\n5️⃣  Testing getProviderPerformance()...');
    const providerPerf = await analyticsService.getProviderPerformance(testUserId, 30);
    console.log('✅ Provider performance retrieved:');
    console.log(`   - Providers used: ${providerPerf.providers.length}`);
    if (providerPerf.bestPerforming) {
      console.log(`   - Best: ${providerPerf.bestPerforming.provider} (${providerPerf.bestPerforming.outlierRate}% outlier rate)`);
    }

    // Test 6: Get Recent Activity
    console.log('\n6️⃣  Testing getRecentActivity()...');
    const activity = await analyticsService.getRecentActivity(testUserId, 5);
    console.log('✅ Recent activity retrieved:');
    console.log(`   - Recent generations: ${activity.length}`);

    // Test 7: Get Recommendations
    console.log('\n7️⃣  Testing getBasicRecommendations()...');
    const recommendations = await analyticsService.getBasicRecommendations(testUserId);
    console.log('✅ Recommendations retrieved:');
    recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. [${rec.priority}] ${rec.message}`);
    });

    // Test 8: Get Dashboard (comprehensive)
    console.log('\n8️⃣  Testing getUserDashboard() - Comprehensive...');
    const dashboard = await analyticsService.getUserDashboard(testUserId, { days: 30 });
    console.log('✅ Dashboard retrieved successfully:');
    console.log(`   - Period: ${dashboard.period.days} days`);
    console.log(`   - Style evolution data: ✓`);
    console.log(`   - Provider performance: ✓`);
    console.log(`   - Recent activity: ✓`);
    console.log(`   - Recommendations: ${dashboard.recommendations.length}`);

    // Test 9: Capture Style Snapshot
    console.log('\n9️⃣  Testing captureStyleSnapshot()...');
    const snapshot = await analyticsService.captureStyleSnapshot(testUserId);
    if (snapshot) {
      console.log('✅ Snapshot captured:');
      console.log(`   - Total generations: ${snapshot.totalGenerations}`);
      console.log(`   - Total outliers: ${snapshot.totalOutliers}`);
      console.log(`   - Outlier rate: ${snapshot.outlierRate}%`);
    } else {
      console.log('⚠️  No recent data for snapshot');
    }

    // Success summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests passed successfully!');
    console.log('='.repeat(50));
    console.log('\n📊 Summary:');
    console.log(`   - User: ${testUserId}`);
    console.log(`   - Total generations: ${stats.totalGenerations}`);
    console.log(`   - Outlier rate: ${stats.outlierRate}%`);
    console.log(`   - Performance: ${stats.performance}`);
    console.log('\n✅ Analytics adapter is working correctly with your schema!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Clean up
    await db.closePool();
  }
}

// Run tests
testAnalyticsAdapter();
