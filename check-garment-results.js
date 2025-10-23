#!/usr/bin/env node
/**
 * Check Garment Detection Results
 * Run this after uploading a test portfolio to see the classification results
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkResults(userEmail) {
  try {
    console.log('\n🔍 Checking Garment Detection Results...\n');
    console.log(`Looking for user: ${userEmail}\n`);

    // Get user
    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found. Please check the email address.');
      await pool.end();
      return;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   User ID: ${user.id}\n`);

    // Get portfolio
    const portfolioResult = await pool.query(
      'SELECT id, image_count, processing_status FROM portfolios WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.id]
    );

    if (portfolioResult.rows.length === 0) {
      console.log('❌ No portfolio found for this user.');
      await pool.end();
      return;
    }

    const portfolio = portfolioResult.rows[0];
    console.log(`📁 Portfolio: ${portfolio.id}`);
    console.log(`   Status: ${portfolio.processing_status}`);
    console.log(`   Images: ${portfolio.image_count}\n`);

    // Get garment classifications
    const classificationResult = await pool.query(`
      SELECT 
        garment_type,
        is_two_piece,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence,
        ARRAY_AGG(DISTINCT reasoning) FILTER (WHERE reasoning IS NOT NULL) as reasoning_samples
      FROM image_descriptors
      WHERE user_id = $1
      GROUP BY garment_type, is_two_piece
      ORDER BY count DESC
    `, [user.id]);

    if (classificationResult.rows.length === 0) {
      console.log('❌ No image analysis found. The analysis may not have completed yet.');
      await pool.end();
      return;
    }

    console.log('📊 Garment Classification Summary:\n');
    console.log('━'.repeat(100));
    console.log('Garment Type'.padEnd(20), 'Two-Piece'.padEnd(12), 'Count'.padEnd(8), 'Avg Confidence'.padEnd(18), 'Sample Reasoning');
    console.log('━'.repeat(100));

    classificationResult.rows.forEach(row => {
      const garmentType = row.garment_type.padEnd(20);
      const isTwoPiece = (row.is_two_piece ? 'Yes' : 'No').padEnd(12);
      const count = row.count.toString().padEnd(8);
      const confidence = (row.avg_confidence * 100).toFixed(1) + '%';
      const confStr = confidence.padEnd(18);
      const reasoning = row.reasoning_samples && row.reasoning_samples.length > 0 
        ? row.reasoning_samples[0].substring(0, 40) + '...'
        : 'N/A';
      
      console.log(garmentType, isTwoPiece, count, confStr, reasoning);
    });

    console.log('━'.repeat(100));

    // Total stats
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM image_descriptors WHERE user_id = $1',
      [user.id]
    );

    console.log(`\n📈 Total Images Analyzed: ${totalResult.rows[0].total}`);

    // Check for potential issues
    console.log('\n🔍 Issue Detection:\n');

    // Check for duplicate dress classifications
    const dressCount = classificationResult.rows
      .filter(r => r.garment_type === 'dress')
      .reduce((sum, r) => sum + parseInt(r.count), 0);

    if (dressCount > portfolio.image_count * 0.5) {
      console.log('⚠️  WARNING: High number of dress classifications detected!');
      console.log(`   Found ${dressCount} dresses out of ${portfolio.image_count} images`);
      console.log('   This might indicate the old issue of multiple dress detections.\n');
    } else {
      console.log('✅ Dress classification count looks reasonable.\n');
    }

    // Check two-piece detection
    const twoPieceCount = classificationResult.rows
      .filter(r => r.is_two_piece === true)
      .reduce((sum, r) => sum + parseInt(r.count), 0);

    if (twoPieceCount > 0) {
      console.log(`✅ Two-piece detection is working! Found ${twoPieceCount} two-piece outfits.\n`);
    } else {
      console.log('ℹ️  No two-piece outfits detected (might not be in the test set).\n');
    }

    // Check confidence scores
    const lowConfidence = classificationResult.rows.filter(r => r.avg_confidence < 0.5);
    if (lowConfidence.length > 0) {
      console.log('⚠️  WARNING: Some classifications have low confidence:');
      lowConfidence.forEach(r => {
        console.log(`   - ${r.garment_type}: ${(r.avg_confidence * 100).toFixed(1)}% confidence`);
      });
      console.log('');
    } else {
      console.log('✅ All classifications have good confidence scores (>50%).\n');
    }

    // Sample individual records with reasoning
    console.log('📝 Sample Analysis Results:\n');
    const sampleResult = await pool.query(`
      SELECT 
        pi.filename,
        id.garment_type,
        id.is_two_piece,
        id.confidence,
        id.reasoning
      FROM image_descriptors id
      JOIN portfolio_images pi ON pi.id = id.image_id
      WHERE id.user_id = $1
      ORDER BY id.created_at DESC
      LIMIT 5
    `, [user.id]);

    sampleResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.filename}`);
      console.log(`   Type: ${row.garment_type} ${row.is_two_piece ? '(Two-Piece)' : ''}`);
      console.log(`   Confidence: ${(row.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${row.reasoning || 'N/A'}`);
      console.log('');
    });

    await pool.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Get email from command line or use default
const userEmail = process.argv[2] || 'test-garment-detection@test.com';
checkResults(userEmail);
