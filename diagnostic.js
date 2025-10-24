/**
 * Style Profile System Diagnostic
 * 
 * Run this to see exactly what's wrong with your current setup
 */

const db = require('./src/services/database');

async function runDiagnostic(portfolioId, userId) {
  console.log('🔍 STYLE PROFILE SYSTEM DIAGNOSTIC\n');
  console.log('═'.repeat(60));
  
  const issues = [];
  const warnings = [];
  const successes = [];
  
  try {
    // Check 1: Which descriptors table has data?
    console.log('\n📊 Check 1: Image Descriptors\n');
    
    const oldDescriptors = await db.query(`
      SELECT COUNT(*) as count, AVG(confidence) as avg_confidence
      FROM image_descriptors id
      JOIN portfolio_images pi ON id.image_id = pi.id
      WHERE pi.portfolio_id = $1
    `, [portfolioId]);
    
    const ultraDescriptors = await db.query(`
      SELECT COUNT(*) as count, 
             AVG(overall_confidence) as avg_confidence,
             AVG(completeness_percentage) as avg_completeness
      FROM ultra_detailed_descriptors udd
      JOIN portfolio_images pi ON udd.image_id = pi.id
      WHERE pi.portfolio_id = $1
    `, [portfolioId]);
    
    const oldCount = parseInt(oldDescriptors.rows[0].count);
    const ultraCount = parseInt(ultraDescriptors.rows[0].count);
    
    console.log(`Old descriptors (image_descriptors): ${oldCount} images`);
    console.log(`Ultra-detailed descriptors: ${ultraCount} images`);
    
    if (ultraCount === 0 && oldCount > 0) {
      issues.push({
        severity: 'CRITICAL',
        issue: 'Using OLD descriptor system',
        detail: `Your portfolio has ${oldCount} images analyzed with the OLD enhancedStyleDescriptorAgent that captures minimal detail. Zero images with ultra-detailed analysis.`,
        fix: 'Run reanalyze-portfolio.js to upgrade to forensic-level analysis'
      });
    } else if (ultraCount > 0) {
      successes.push(`✅ Ultra-detailed descriptors found: ${ultraCount} images`);
      
      const avgConf = parseFloat(ultraDescriptors.rows[0].avg_confidence);
      const avgComp = parseFloat(ultraDescriptors.rows[0].avg_completeness);
      
      console.log(`  Avg Confidence: ${avgConf?.toFixed(2) || 'N/A'}`);
      console.log(`  Avg Completeness: ${avgComp?.toFixed(1) || 'N/A'}%`);
      
      if (avgConf < 0.70) {
        warnings.push({
          severity: 'WARNING',
          issue: 'Low confidence scores',
          detail: `Average confidence is ${avgConf.toFixed(2)}, below recommended 0.70`,
          fix: 'Re-run analysis or check image quality (resolution, lighting, clarity)'
        });
      }
      
      if (avgComp < 70) {
        warnings.push({
          severity: 'WARNING',
          issue: 'Low completeness scores',
          detail: `Average completeness is ${avgComp.toFixed(1)}%, below recommended 70%`,
          fix: 'May indicate partial analysis or missing data fields'
        });
      }
    }
    
    // Check 2: Style Profile Structure
    console.log('\n📊 Check 2: Style Profile Data Structure\n');
    
    const styleProfile = await db.query(`
      SELECT 
        aesthetic_themes,
        construction_patterns,
        signature_pieces,
        style_tags,
        garment_types,
        style_description,
        avg_confidence,
        avg_completeness
      FROM style_profiles
      WHERE user_id = $1
    `, [userId]);
    
    if (styleProfile.rows.length === 0) {
      issues.push({
        severity: 'ERROR',
        issue: 'No style profile found',
        detail: 'Style profile does not exist for this user',
        fix: 'Run trend analysis to generate profile'
      });
    } else {
      const profile = styleProfile.rows[0];
      
      // Check for new fields
      const hasAestheticThemes = profile.aesthetic_themes && profile.aesthetic_themes.length > 0;
      const hasConstructionPatterns = profile.construction_patterns && profile.construction_patterns.length > 0;
      const hasSignaturePieces = profile.signature_pieces && profile.signature_pieces.length > 0;
      const hasStyleTags = profile.style_tags && profile.style_tags.length > 0;
      
      console.log(`Aesthetic themes: ${hasAestheticThemes ? '✅ Present' : '❌ Missing'}`);
      console.log(`Construction patterns: ${hasConstructionPatterns ? '✅ Present' : '❌ Missing'}`);
      console.log(`Signature pieces: ${hasSignaturePieces ? '✅ Present' : '❌ Missing'}`);
      console.log(`Style tags: ${hasStyleTags ? '✅ Present' : '❌ Missing'}`);
      console.log(`Style description: ${profile.style_description ? '✅ Present' : '❌ Missing'}`);
      
      if (!hasAestheticThemes || !hasConstructionPatterns || !hasSignaturePieces) {
        issues.push({
          severity: 'CRITICAL',
          issue: 'Profile lacks rich detail fields',
          detail: 'Style profile is using OLD structure without aesthetic themes, construction patterns, or signature pieces',
          fix: 'Run improvedTrendAnalysisAgent.generateEnhancedStyleProfile()'
        });
      } else {
        successes.push('✅ Enhanced style profile structure present');
        
        // Show sample data
        if (hasAestheticThemes) {
          const themes = profile.aesthetic_themes.slice(0, 3).map(t => t.name).join(', ');
          console.log(`\nTop aesthetic themes: ${themes}`);
        }
        
        if (hasConstructionPatterns) {
          const patterns = profile.construction_patterns.slice(0, 3).map(p => p.name).join(', ');
          console.log(`Top construction patterns: ${patterns}`);
        }
      }
    }
    
    // Check 3: Database Schema
    console.log('\n📊 Check 3: Database Schema\n');
    
    const schemaCheck = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'style_profiles'
      AND column_name IN (
        'aesthetic_themes', 
        'construction_patterns', 
        'signature_pieces',
        'avg_confidence',
        'avg_completeness',
        'style_tags',
        'garment_types',
        'style_description'
      )
    `);
    
    const requiredColumns = [
      'aesthetic_themes',
      'construction_patterns', 
      'signature_pieces',
      'avg_confidence',
      'avg_completeness'
    ];
    
    const existingColumns = schemaCheck.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      issues.push({
        severity: 'ERROR',
        issue: 'Database schema outdated',
        detail: `Missing columns: ${missingColumns.join(', ')}`,
        fix: 'Run migration_enhanced_style_profiles.sql'
      });
    } else {
      successes.push('✅ Database schema has enhanced fields');
    }
    
    // Check 4: Sample Data Quality
    console.log('\n📊 Check 4: Sample Data Quality\n');
    
    if (ultraCount > 0) {
      const sampleDesc = await db.query(`
        SELECT 
          udd.image_id,
          udd.executive_summary->>'one_sentence_description' as description,
          udd.overall_confidence,
          udd.completeness_percentage,
          jsonb_array_length(udd.garments) as garment_count,
          (udd.garments->0->>'type') as primary_garment,
          (udd.garments->0->'fabric'->>'primary_material') as fabric,
          jsonb_array_length(udd.garments->0->'color_palette') as color_count
        FROM ultra_detailed_descriptors udd
        JOIN portfolio_images pi ON udd.image_id = pi.id
        WHERE pi.portfolio_id = $1
        ORDER BY udd.overall_confidence DESC
        LIMIT 1
      `, [portfolioId]);
      
      if (sampleDesc.rows.length > 0) {
        const sample = sampleDesc.rows[0];
        
        console.log('Sample analysis (highest confidence):');
        console.log(`  Description: "${sample.description || 'N/A'}"`);
        console.log(`  Primary garment: ${sample.primary_garment || 'N/A'}`);
        console.log(`  Fabric: ${sample.fabric || 'N/A'}`);
        console.log(`  Color count: ${sample.color_count || 0}`);
        console.log(`  Confidence: ${(sample.overall_confidence * 100).toFixed(0)}%`);
        console.log(`  Completeness: ${sample.completeness_percentage?.toFixed(1) || 'N/A'}%`);
        
        if (!sample.description || sample.description === 'N/A') {
          warnings.push({
            severity: 'WARNING',
            issue: 'Missing executive summary',
            detail: 'Ultra-detailed descriptors lack executive summaries',
            fix: 'Re-run ultra-detailed ingestion with latest prompt'
          });
        }
        
        if (!sample.fabric) {
          warnings.push({
            severity: 'WARNING', 
            issue: 'Missing fabric details',
            detail: 'Fabric information not captured',
            fix: 'Verify ultra-detailed agent prompt includes fabric analysis'
          });
        }
      }
    }
    
    // Print Summary
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('═'.repeat(60));
    console.log('\n');
    
    if (successes.length > 0) {
      console.log('✅ SUCCESSES:\n');
      successes.forEach(s => console.log(`   ${s}`));
      console.log('\n');
    }
    
    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:\n');
      warnings.forEach(w => {
        console.log(`   ${w.severity}: ${w.issue}`);
        console.log(`   → ${w.detail}`);
        console.log(`   → FIX: ${w.fix}\n`);
      });
    }
    
    if (issues.length > 0) {
      console.log('❌ CRITICAL ISSUES:\n');
      issues.forEach(i => {
        console.log(`   ${i.severity}: ${i.issue}`);
        console.log(`   → ${i.detail}`);
        console.log(`   → FIX: ${i.fix}\n`);
      });
    }
    
    // Overall Status
    console.log('═'.repeat(60));
    if (issues.length === 0 && warnings.length === 0) {
      console.log('🎉 STATUS: EXCELLENT - System is properly configured!');
    } else if (issues.length === 0) {
      console.log('👍 STATUS: GOOD - Minor warnings, system mostly functional');
    } else if (issues.filter(i => i.severity === 'CRITICAL').length > 0) {
      console.log('🚨 STATUS: CRITICAL - Major issues need immediate attention');
    } else {
      console.log('⚠️  STATUS: NEEDS ATTENTION - Some fixes required');
    }
    console.log('═'.repeat(60));
    console.log('\n');
    
    // Action Plan
    if (issues.length > 0 || warnings.length > 0) {
      console.log('📝 RECOMMENDED ACTION PLAN:\n');
      
      let step = 1;
      
      // Step 1: Schema migration if needed
      if (issues.some(i => i.issue.includes('schema'))) {
        console.log(`${step}. Run database migration:`);
        console.log('   psql your_database < migration_enhanced_style_profiles.sql\n');
        step++;
      }
      
      // Step 2: Re-analyze with ultra-detailed if needed
      if (issues.some(i => i.issue.includes('OLD descriptor'))) {
        console.log(`${step}. Re-analyze portfolio with ultra-detailed ingestion:`);
        console.log(`   export PORTFOLIO_ID="${portfolioId}"`);
        console.log(`   export USER_ID="${userId}"`);
        console.log('   node reanalyze-portfolio.js\n');
        step++;
      }
      
      // Step 3: Update UI if needed
      if (issues.some(i => i.issue.includes('rich detail'))) {
        console.log(`${step}. Update UI to enhanced style profile component:`);
        console.log('   cp EnhancedStyleProfile.jsx src/components/\n');
        step++;
      }
      
      console.log(`${step}. Verify improvements by checking your style profile page\n`);
    }
    
    return {
      status: issues.length === 0 ? 'OK' : 'ISSUES_FOUND',
      issues,
      warnings,
      successes
    };
    
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    console.error(error.stack);
    return {
      status: 'ERROR',
      error: error.message
    };
  }
}

// Usage
const PORTFOLIO_ID = process.env.PORTFOLIO_ID || 'your-portfolio-id';
const USER_ID = process.env.USER_ID || 'your-user-id';

if (require.main === module) {
  runDiagnostic(PORTFOLIO_ID, USER_ID)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { runDiagnostic };
