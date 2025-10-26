/**
 * Re-analyze Portfolio with Ultra-Detailed Ingestion
 * 
 * Run this to upgrade your portfolio from old descriptors to ultra-detailed ones
 */

const ultraDetailedAgent = require('./src/services/ultraDetailedIngestionAgent');
const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');
const styleTaggerAgent = require('./src/services/styleTaggerAgent');
const db = require('./src/services/database');

async function reanalyzePortfolio(portfolioId, userId) {
  console.log('🔄 Re-analyzing portfolio with ultra-detailed ingestion...');
  
  try {
    // Step 1: Run ultra-detailed analysis on all images
    console.log('\n📸 Step 1: Analyzing images with forensic-level detail...');
    const analysisResults = await ultraDetailedAgent.analyzePortfolio(
      portfolioId,
      (progress) => {
        console.log(`Progress: ${progress.percentage}% (${progress.current}/${progress.total})`);
        console.log(`  Current: ${progress.currentImage}`);
        console.log(`  Avg Confidence: ${progress.avgConfidence || 'N/A'}`);
        console.log(`  Avg Completeness: ${progress.avgCompleteness || 'N/A'}%`);
      }
    );
    
    console.log('\n✅ Analysis Complete:');
    console.log(`  - Analyzed: ${analysisResults.analyzed}`);
    console.log(`  - Failed: ${analysisResults.failed}`);
    console.log(`  - Avg Confidence: ${analysisResults.avgConfidence}`);
    console.log(`  - Avg Completeness: ${analysisResults.avgCompleteness}%`);
    
    // Step 2: Regenerate style profile from ultra-detailed data
    console.log('\n📊 Step 2: Generating enhanced style profile...');
    const styleProfile = await trendAnalysisAgent.generateStyleProfile(userId, portfolioId);
    
    console.log('\n✅ Style Profile Generated:');
    console.log(`  - Style Labels: ${styleProfile.style_labels?.length || 0}`);
    console.log(`  - Clusters: ${styleProfile.clusters?.length || 0}`);
    console.log(`  - Total Images: ${styleProfile.total_images}`);
    
    // Step 3: Enrich with style tags
    console.log('\n🏷️  Step 3: Generating style tags...');
    
    // Get the full style profile with distributions
    const fullProfile = {
      color_palette: Object.keys(styleProfile.color_distribution || {}),
      silhouettes: Object.keys(styleProfile.silhouette_distribution || {}),
      materials: Object.keys(styleProfile.fabric_distribution || {}),
      design_elements: styleProfile.style_labels?.map(l => l.name) || [],
      garment_types: Object.keys(styleProfile.garment_distribution || {})
    };
    
    const enrichment = styleTaggerAgent.analyzeAndEnrich(fullProfile);
    
    console.log('\n✅ Style Tags Generated:');
    console.log(`  - Tags: ${enrichment.style_tags.join(', ')}`);
    console.log(`  - Description: ${enrichment.style_description}`);
    
    // Step 4: Update style profile with enrichment
    await db.query(`
      UPDATE style_profiles
      SET 
        style_tags = $1,
        garment_types = $2,
        style_description = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $4
    `, [
      JSON.stringify(enrichment.style_tags),
      JSON.stringify(enrichment.garment_types),
      enrichment.style_description,
      userId
    ]);
    
    console.log('\n🎉 Portfolio re-analysis complete!\n');
    
    return {
      analysisResults,
      styleProfile,
      enrichment
    };
    
  } catch (error) {
    console.error('\n❌ Re-analysis failed:', error.message);
    throw error;
  }
}

// Usage example
const PORTFOLIO_ID = process.env.PORTFOLIO_ID || 'your-portfolio-id';
const USER_ID = process.env.USER_ID || 'your-user-id';

if (require.main === module) {
  reanalyzePortfolio(PORTFOLIO_ID, USER_ID)
    .then(() => {
      console.log('✅ Done! Check your style profile page for improvements.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { reanalyzePortfolio };
