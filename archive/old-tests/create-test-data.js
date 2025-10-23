#!/usr/bin/env node

/**
 * Create test data for analytics testing
 */

require('dotenv').config();
const db = require('./src/services/database');

async function createTestData() {
  console.log('\n📝 Creating test data for analytics...\n');

  try {
    // Ensure database connection
    const connected = await db.testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Get or create a test user
    console.log('1️⃣  Creating/finding test user...');
    let userResult = await db.query(`
      SELECT id FROM users LIMIT 1
    `);

    let testUserId;
    if (userResult.rows.length === 0) {
      // Create a test user
      const newUser = await db.query(`
        INSERT INTO users (email, name, created_at)
        VALUES ($1, $2, NOW())
        RETURNING id
      `, ['test@analytics.com', 'Analytics Test User']);
      testUserId = newUser.rows[0].id;
      console.log(`✅ Created test user: ${testUserId}`);
    } else {
      testUserId = userResult.rows[0].id;
      console.log(`✅ Using existing user: ${testUserId}`);
    }

    // Create test generations
    console.log('\n2️⃣  Creating test generations...');
    const providers = ['Google Imagen 3', 'DALL-E 3', 'Stable Diffusion XL'];
    const generationIds = [];

    for (let i = 0; i < 15; i++) {
      const provider = providers[i % 3];
      const daysAgo = Math.floor(i / 3) * 3; // Spread over different days
      
      const result = await db.query(`
        INSERT INTO generations (
          id,
          user_id,
          status,
          cost,
          pipeline_data,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '${daysAgo} days')
        RETURNING id
      `, [
        `test_gen_${Date.now()}_${i}`,
        testUserId,
        'completed',
        0.04,
        JSON.stringify({
          routing: {
            provider: {
              name: provider,
              id: provider.toLowerCase().replace(/ /g, '-')
            }
          },
          enhanced: {
            enhancements: [{
              originalVLT: {
                silhouette: i % 2 === 0 ? 'mermaid' : 'a-line',
                garmentType: 'evening gown',
                confidence: 0.9
              }
            }]
          }
        })
      ]);

      generationIds.push(result.rows[0].id);
    }
    console.log(`✅ Created ${generationIds.length} test generations`);

    // Create some outliers (high quality generations)
    console.log('\n3️⃣  Creating test outliers...');
    let outlierCount = 0;
    for (let i = 0; i < generationIds.length; i++) {
      // Mark 60% as outliers
      if (i % 5 !== 0) {
        await db.query(`
          INSERT INTO outliers (
            generation_id,
            user_id,
            outlier_score,
            clip_score,
            is_outlier
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          generationIds[i],
          testUserId,
          0.75 + Math.random() * 0.2,
          0.70 + Math.random() * 0.25,
          true
        ]);
        outlierCount++;
      }
    }
    console.log(`✅ Created ${outlierCount} outliers`);

    // Create some feedback
    console.log('\n4️⃣  Creating test feedback...');
    let feedbackCount = 0;
    for (let i = 0; i < generationIds.length; i++) {
      // Add feedback to 50% of generations
      if (i % 2 === 0) {
        await db.query(`
          INSERT INTO generation_feedback (
            generation_id,
            user_id,
            feedback_type,
            rating
          ) VALUES ($1, $2, $3, $4)
        `, [
          generationIds[i],
          testUserId,
          'quality',
          3 + Math.floor(Math.random() * 3) // Random rating 3-5
        ]);
        feedbackCount++;
      }
    }
    console.log(`✅ Created ${feedbackCount} feedback entries`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Test data created successfully!');
    console.log('='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   - Test User ID: ${testUserId}`);
    console.log(`   - Generations: ${generationIds.length}`);
    console.log(`   - Outliers: ${outlierCount} (${(outlierCount/generationIds.length*100).toFixed(1)}%)`);
    console.log(`   - Feedback: ${feedbackCount}`);
    console.log(`   - Providers: ${providers.join(', ')}`);
    console.log(`\n✅ You can now run: node test-analytics-adapter.js\n`);

  } catch (error) {
    console.error('\n❌ Failed to create test data:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await db.closePool();
  }
}

createTestData();
