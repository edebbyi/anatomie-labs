#!/usr/bin/env node

/**
 * Test script to verify garment classification improvements
 * Tests with anatomie_test_5.zip portfolio
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const ingestionAgent = require('./src/services/ultraDetailedIngestionAgent');
const validationAgent = require('./src/services/validationAgent');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testGarmentClassificationWithRealData() {
  console.log('\n🧪 Testing Garment Classification Fix with anatomie_test_5.zip\n');
  console.log('='.repeat(80));
  
  try {
    // Step 1: Find the anatomie_test_5 portfolio
    console.log('\n📂 Step 1: Finding anatomie_test_5 portfolio...\n');
    
    const portfolioQuery = `
      SELECT id, user_id, title, zip_filename, created_at
      FROM portfolios
      WHERE zip_filename LIKE '%anatomie%' OR zip_filename LIKE '%test_5%'
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const portfolioResult = await pool.query(portfolioQuery);

    if (portfolioResult.rows.length === 0) {
      console.log('❌ No anatomie portfolios found in database');
      console.log('   Please upload anatomie_test_5.zip through the UI first');
      return;
    }

    console.log(`Found ${portfolioResult.rows.length} portfolio(s):`);
    portfolioResult.rows.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.title} (${p.zip_filename}) - ID: ${p.id}, Created: ${p.created_at}`);
    });

    const portfolio = portfolioResult.rows[0];
    console.log(`\n✅ Using portfolio: ${portfolio.title} (${portfolio.zip_filename}) - ID: ${portfolio.id}`);
    
    // Step 2: Get images from this portfolio
    console.log('\n📸 Step 2: Fetching images...\n');

    const imagesQuery = `
      SELECT id, filename, url_original
      FROM portfolio_images
      WHERE portfolio_id = $1
      ORDER BY created_at
    `;

    const imagesResult = await pool.query(imagesQuery, [portfolio.id]);
    console.log(`Found ${imagesResult.rows.length} images`);

    if (imagesResult.rows.length === 0) {
      console.log('❌ No images found for this portfolio');
      return;
    }
    
    // Step 3: Get existing descriptors
    console.log('\n📋 Step 3: Analyzing existing descriptors...\n');
    
    const descriptorsQuery = `
      SELECT
        d.id,
        d.image_id,
        d.garments,
        d.primary_garment,
        d.fabric_type,
        d.overall_confidence,
        i.filename
      FROM ultra_detailed_descriptors d
      JOIN portfolio_images i ON d.image_id = i.id
      WHERE i.portfolio_id = $1
      ORDER BY i.created_at
    `;

    const descriptorsResult = await pool.query(descriptorsQuery, [portfolio.id]);

    console.log(`Found ${descriptorsResult.rows.length} descriptors\n`);

    // Analyze garment type distribution
    const garmentTypes = {};
    const fabricTypes = {};
    let genericFabricCount = 0;
    let totalFabrics = 0;
    let blazerWithoutLapelsCount = 0;
    let sleevelessJacketCount = 0;

    console.log('📊 Current Classification Analysis:\n');
    console.log('   Garment Types:');

    descriptorsResult.rows.forEach((desc, i) => {
      // Extract garment info from JSONB
      const garments = desc.garments || [];
      const primaryGarment = garments[0] || {};
      const garmentType = primaryGarment.type || desc.primary_garment || 'unknown';

      garmentTypes[garmentType] = (garmentTypes[garmentType] || 0) + 1;

      // Check fabric specificity
      let fabric = primaryGarment.fabric || desc.fabric_type || '';
      if (typeof fabric === 'object') {
        fabric = fabric.type || fabric.name || JSON.stringify(fabric);
      }
      fabric = String(fabric);

      if (fabric) {
        totalFabrics++;
        if (fabric.toLowerCase().includes('fabric') ||
            fabric.toLowerCase().includes('blend') ||
            fabric.toLowerCase() === 'wool' ||
            fabric.toLowerCase() === 'cotton') {
          genericFabricCount++;
        }
        fabricTypes[fabric] = (fabricTypes[fabric] || 0) + 1;
      }

      // Check for blazer without lapels
      if (garmentType.toLowerCase().includes('blazer')) {
        const collar = (primaryGarment.collar || '').toLowerCase();
        if (!collar.includes('notched') && !collar.includes('peaked') && !collar.includes('lapel')) {
          blazerWithoutLapelsCount++;
          console.log(`   ⚠️  Image ${i + 1} (${desc.filename}): Blazer without lapels (collar: "${primaryGarment.collar}")`);
        }
      }

      // Check for sleeveless jacket
      const sleeveLength = (primaryGarment.sleeve_length || '').toLowerCase();
      if ((garmentType.toLowerCase().includes('jacket') || garmentType.toLowerCase().includes('blazer')) &&
          sleeveLength === 'sleeveless') {
        sleevelessJacketCount++;
        console.log(`   ⚠️  Image ${i + 1} (${desc.filename}): Sleeveless ${garmentType} (should be vest)`);
      }
    });
    
    Object.entries(garmentTypes).forEach(([type, count]) => {
      const percentage = ((count / descriptorsResult.rows.length) * 100).toFixed(1);
      console.log(`      • ${type}: ${count} (${percentage}%)`);
    });
    
    console.log('\n   Fabric Specificity:');
    const specificFabricPercentage = totalFabrics > 0 
      ? (((totalFabrics - genericFabricCount) / totalFabrics) * 100).toFixed(1)
      : 0;
    console.log(`      • Specific fabrics: ${totalFabrics - genericFabricCount}/${totalFabrics} (${specificFabricPercentage}%)`);
    console.log(`      • Generic fabrics: ${genericFabricCount}/${totalFabrics}`);
    
    console.log('\n   Validation Issues:');
    console.log(`      • Blazers without lapels: ${blazerWithoutLapelsCount}`);
    console.log(`      • Sleeveless jackets: ${sleevelessJacketCount}`);
    
    // Step 4: Calculate diversity score
    const uniqueGarmentTypes = Object.keys(garmentTypes).length;
    const diversityScore = (uniqueGarmentTypes / descriptorsResult.rows.length) * 100;
    
    console.log('\n   Diversity Score:');
    console.log(`      • Unique garment types: ${uniqueGarmentTypes}`);
    console.log(`      • Diversity: ${diversityScore.toFixed(1)}%`);
    
    // Step 5: Check validation results
    console.log('\n📋 Step 4: Checking validation results...\n');

    const validationQuery = `
      SELECT
        vr.id,
        vr.image_id,
        vr.validation_score,
        vr.issues,
        vr.corrected_descriptor,
        i.filename
      FROM validation_results vr
      JOIN portfolio_images i ON vr.image_id = i.id
      WHERE i.portfolio_id = $1
      ORDER BY vr.created_at DESC
    `;

    const validationResult = await pool.query(validationQuery, [portfolio.id]);

    if (validationResult.rows.length > 0) {
      console.log(`Found ${validationResult.rows.length} validation results\n`);

      let issuesFound = 0;
      let correctionsApplied = 0;

      validationResult.rows.forEach((vr, i) => {
        const issues = vr.issues || [];
        const corrections = vr.corrected_descriptor || {};

        if (issues.length > 0) {
          issuesFound += issues.length;
          console.log(`   Image ${i + 1} (${vr.filename}):`);
          console.log(`      Validation Score: ${(vr.validation_score * 100).toFixed(1)}%`);
          console.log(`      Issues: ${issues.length}`);
          issues.forEach(issue => {
            console.log(`         • ${issue.type}: ${issue.message}`);
          });
          if (Object.keys(corrections).length > 0) {
            correctionsApplied += Object.keys(corrections).length;
            console.log(`      Corrections: ${JSON.stringify(corrections).substring(0, 100)}...`);
          }
        }
      });

      console.log(`\n   Summary:`);
      console.log(`      • Total issues found: ${issuesFound}`);
      console.log(`      • Corrections applied: ${correctionsApplied}`);
    } else {
      console.log('   No validation results found (validation may not have run yet)');
    }
    
    // Step 6: Summary and recommendations
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY\n');
    console.log('='.repeat(80));
    
    console.log('\n✅ Current Status:');
    console.log(`   • Portfolio: ${portfolio.title} (${portfolio.zip_filename})`);
    console.log(`   • Images: ${imagesResult.rows.length}`);
    console.log(`   • Descriptors: ${descriptorsResult.rows.length}`);
    console.log(`   • Unique garment types: ${uniqueGarmentTypes}`);
    console.log(`   • Diversity score: ${diversityScore.toFixed(1)}%`);
    console.log(`   • Specific fabrics: ${specificFabricPercentage}%`);
    
    console.log('\n⚠️  Issues Detected:');
    console.log(`   • Blazers without lapels: ${blazerWithoutLapelsCount}`);
    console.log(`   • Sleeveless jackets: ${sleevelessJacketCount}`);
    console.log(`   • Generic fabric names: ${genericFabricCount}/${totalFabrics}`);
    
    console.log('\n💡 Expected Improvements After Fix:');
    console.log('   • Diversity score: >50% (currently ' + diversityScore.toFixed(1) + '%)');
    console.log('   • Specific fabrics: >90% (currently ' + specificFabricPercentage + '%)');
    console.log('   • Blazers without lapels: 0 (currently ' + blazerWithoutLapelsCount + ')');
    console.log('   • Sleeveless jackets: 0 (currently ' + sleevelessJacketCount + ')');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Re-upload anatomie_test_5.zip to test the fix');
    console.log('   2. Or run: node reanalyze-portfolio.js ' + portfolio.id);
    console.log('   3. Compare results with this baseline');
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testGarmentClassificationWithRealData();

