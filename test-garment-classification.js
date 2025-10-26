/**
 * Test garment classification improvements
 * Tests the anatomie_test_5.zip portfolio with the new garment taxonomy
 */

const db = require('./src/services/database');
const UltraDetailedIngestionAgent = require('./src/services/ultraDetailedIngestionAgent');
const fs = require('fs');
const path = require('path');

async function testGarmentClassification() {
  console.log('🧪 Testing Garment Classification Fix\n');
  console.log('=' .repeat(80));
  
  try {
    // Find the most recent portfolio (should be anatomie_test_5)
    const portfolio = await db.query(
      `SELECT * FROM portfolios ORDER BY created_at DESC LIMIT 1`
    );
    
    if (portfolio.rows.length === 0) {
      console.log('❌ No portfolio found. Please upload anatomie_test_5.zip first.');
      process.exit(1);
    }
    
    const portfolioId = portfolio.rows[0].id;
    const userId = portfolio.rows[0].user_id;
    
    console.log(`\n📁 Portfolio ID: ${portfolioId}`);
    console.log(`👤 User ID: ${userId}`);
    
    // Get images in portfolio
    const images = await db.query(
      `SELECT * FROM images WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );
    
    console.log(`\n📸 Found ${images.rows.length} images\n`);
    
    // Delete old descriptors to force fresh analysis
    console.log('🗑️  Deleting old descriptors...');
    await db.query(
      `DELETE FROM ultra_detailed_descriptors WHERE image_id IN (
        SELECT id FROM images WHERE user_id = $1
      )`,
      [userId]
    );
    
    await db.query(
      `DELETE FROM validation_results WHERE image_id IN (
        SELECT id FROM images WHERE user_id = $1
      )`,
      [userId]
    );
    
    console.log('✅ Old data cleared\n');
    
    // Re-analyze with new taxonomy
    console.log('🔍 Re-analyzing images with improved garment taxonomy...\n');
    
    const agent = new UltraDetailedIngestionAgent();
    const results = {
      analyzed: 0,
      failed: 0,
      garmentTypes: {},
      fabrics: {},
      confidences: [],
      validationIssues: []
    };
    
    for (const image of images.rows) {
      try {
        console.log(`\n📷 Analyzing: ${image.filename}`);
        
        const descriptor = await agent.analyzeImage(image);
        
        // Extract garment type
        const garmentType = descriptor.garments?.[0]?.type || 'unknown';
        const fabric = descriptor.garments?.[0]?.fabric?.primary_material || 'unknown';
        const confidence = descriptor.metadata?.overall_confidence || 0;
        
        results.analyzed++;
        results.garmentTypes[garmentType] = (results.garmentTypes[garmentType] || 0) + 1;
        results.fabrics[fabric] = (results.fabrics[fabric] || 0) + 1;
        results.confidences.push(confidence);
        
        console.log(`   ✅ Garment: ${garmentType}`);
        console.log(`   📦 Fabric: ${fabric}`);
        console.log(`   📊 Confidence: ${(confidence * 100).toFixed(1)}%`);
        
        // Check for validation issues
        const validation = await db.query(
          `SELECT * FROM validation_results WHERE image_id = $1`,
          [image.id]
        );
        
        if (validation.rows.length > 0 && !validation.rows[0].is_valid) {
          const issues = validation.rows[0].issues || [];
          results.validationIssues.push({
            image: image.filename,
            issues: issues
          });
          console.log(`   ⚠️  Validation issues: ${issues.length}`);
        }
        
      } catch (error) {
        results.failed++;
        console.log(`   ❌ Failed: ${error.message}`);
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RESULTS SUMMARY\n');
    console.log('='.repeat(80));
    
    console.log(`\n✅ Successfully analyzed: ${results.analyzed}/${images.rows.length}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    const avgConfidence = results.confidences.reduce((a, b) => a + b, 0) / results.confidences.length;
    console.log(`\n📈 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    
    console.log(`\n👕 GARMENT TYPES:`);
    Object.entries(results.garmentTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} (${(count / results.analyzed * 100).toFixed(0)}%)`);
      });
    
    console.log(`\n🧵 FABRICS:`);
    Object.entries(results.fabrics)
      .sort((a, b) => b[1] - a[1])
      .forEach(([fabric, count]) => {
        console.log(`   - ${fabric}: ${count}`);
      });
    
    if (results.validationIssues.length > 0) {
      console.log(`\n⚠️  VALIDATION ISSUES (${results.validationIssues.length}):`);
      results.validationIssues.forEach(({image, issues}) => {
        console.log(`\n   ${image}:`);
        issues.forEach(issue => {
          console.log(`      - ${issue.type}: ${issue.message}`);
        });
      });
    } else {
      console.log(`\n✅ No validation issues detected!`);
    }
    
    // Check for specific improvements
    console.log(`\n\n🎯 IMPROVEMENT CHECKS:\n`);
    
    const blazerCount = Object.keys(results.garmentTypes).filter(t => t.includes('blazer')).length;
    const specificFabrics = Object.keys(results.fabrics).filter(f => 
      !f.includes('blend') && !f.includes('unknown') && f.length > 5
    ).length;
    
    console.log(`✓ Blazer classifications: ${blazerCount} (should be minimal unless actual blazers)`);
    console.log(`✓ Specific fabric names: ${specificFabrics}/${Object.keys(results.fabrics).length}`);
    console.log(`✓ Average confidence: ${(avgConfidence * 100).toFixed(1)}% (target: >85%)`);
    console.log(`✓ Validation issues: ${results.validationIssues.length} (target: 0)`);
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Test complete!\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testGarmentClassification();

