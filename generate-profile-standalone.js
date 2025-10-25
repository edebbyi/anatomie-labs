/**
 * Standalone script to generate style profile
 * Bypasses server loading issues
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'designer_bff',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
});

const userId = '587d450d-6181-44db-b590-54047964e0e9';
const portfolioId = '37ebf39e-95ea-46a3-97ff-733f64eb80b6';

async function generateProfile() {
  try {
    console.log('Fetching ultra-detailed descriptors...');
    
    // Get descriptors
    const descriptorsResult = await pool.query(
      `SELECT * FROM ultra_detailed_descriptors WHERE user_id = $1`,
      [userId]
    );
    
    const descriptors = descriptorsResult.rows;
    console.log(`Found ${descriptors.length} descriptors`);
    
    if (descriptors.length === 0) {
      console.error('No descriptors found!');
      process.exit(1);
    }
    
    // Calculate metrics
    const avgConfidence = descriptors.reduce((sum, d) => sum + parseFloat(d.overall_confidence || 0), 0) / descriptors.length;
    const avgCompleteness = descriptors.reduce((sum, d) => sum + parseFloat(d.completeness_percentage || 0), 0) / descriptors.length;
    
    // Clamp values to valid ranges
    const clampedConfidence = Math.min(Math.max(avgConfidence, 0), 9.999);
    const clampedCompleteness = Math.min(Math.max(avgCompleteness, 0), 999.99);
    
    console.log(`Avg Confidence: ${avgConfidence} -> Clamped: ${clampedConfidence}`);
    console.log(`Avg Completeness: ${avgCompleteness} -> Clamped: ${clampedCompleteness}`);
    
    // Extract aesthetic themes
    const aestheticThemes = new Set();
    const constructionPatterns = new Set();
    const signaturePieces = [];
    const styleTags = new Set();
    const garmentTypes = new Set();
    
    descriptors.forEach(d => {
      // Extract from executive summary
      if (d.executive_summary) {
        const summary = d.executive_summary;
        if (summary.dominant_aesthetic) {
          aestheticThemes.add(summary.dominant_aesthetic.toLowerCase());
          styleTags.add(summary.dominant_aesthetic.toLowerCase());
        }
        if (summary.key_garments && Array.isArray(summary.key_garments)) {
          summary.key_garments.forEach(g => styleTags.add(g.toLowerCase()));
        }
      }

      // Extract from garments
      if (d.garments && Array.isArray(d.garments)) {
        d.garments.forEach(garment => {
          if (garment.type) {
            garmentTypes.add(garment.type.toLowerCase());
          }
          if (garment.fabric && garment.fabric.primary_material) {
            constructionPatterns.add(garment.fabric.primary_material.toLowerCase());
          }
          if (garment.construction && garment.construction.stitching_type) {
            constructionPatterns.add(garment.construction.stitching_type.toLowerCase());
          }
          if (garment.silhouette && garment.silhouette.overall_shape) {
            constructionPatterns.add(garment.silhouette.overall_shape.toLowerCase());
          }

          // All items from ultra-detailed are high confidence
          signaturePieces.push({
            type: garment.type,
            fabric: garment.fabric?.primary_material,
            silhouette: garment.silhouette?.overall_shape,
            confidence: parseFloat(d.overall_confidence || 0.9)
          });
        });
      }

      // Extract from styling context
      if (d.styling_context) {
        if (d.styling_context.overall_aesthetic) {
          aestheticThemes.add(d.styling_context.overall_aesthetic.toLowerCase());
        }
        if (d.styling_context.styling_approach) {
          styleTags.add(d.styling_context.styling_approach.toLowerCase());
        }
      }

      // Extract from photography
      if (d.photography) {
        if (d.photography.setting) {
          styleTags.add(d.photography.setting.toLowerCase());
        }
      }
    });
    
    // Generate style description
    const topAesthetics = Array.from(aestheticThemes).slice(0, 3);
    const topGarments = Array.from(garmentTypes).slice(0, 5);
    const topConstructions = Array.from(constructionPatterns).slice(0, 3);
    
    const styleDescription = `Your style is characterized by ${topAesthetics.join(', ')} aesthetics. ` +
      `You frequently feature ${topGarments.join(', ')} with ${topConstructions.join(', ')} construction details. ` +
      `Your portfolio shows ${descriptors.length} images with ${clampedConfidence.toFixed(3)} average confidence.`;
    
    console.log('\n=== STYLE PROFILE ===');
    console.log('Aesthetic Themes:', Array.from(aestheticThemes));
    console.log('Construction Patterns:', Array.from(constructionPatterns));
    console.log('Signature Pieces:', signaturePieces.slice(0, 5));
    console.log('Style Tags:', Array.from(styleTags));
    console.log('Garment Types:', Array.from(garmentTypes));
    console.log('Style Description:', styleDescription);
    console.log('Avg Confidence:', clampedConfidence.toFixed(3));
    console.log('Avg Completeness:', clampedCompleteness.toFixed(2));
    
    // Update or insert style profile
    console.log('\nUpdating style profile in database...');
    
    const updateResult = await pool.query(
      `INSERT INTO style_profiles (
        user_id, portfolio_id, style_tags, garment_types, style_description,
        aesthetic_themes, construction_patterns, signature_pieces,
        avg_confidence, avg_completeness, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        portfolio_id = EXCLUDED.portfolio_id,
        style_tags = EXCLUDED.style_tags,
        garment_types = EXCLUDED.garment_types,
        style_description = EXCLUDED.style_description,
        aesthetic_themes = EXCLUDED.aesthetic_themes,
        construction_patterns = EXCLUDED.construction_patterns,
        signature_pieces = EXCLUDED.signature_pieces,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_completeness = EXCLUDED.avg_completeness,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userId,
        portfolioId,
        Array.from(styleTags),
        Array.from(garmentTypes),
        styleDescription,
        JSON.stringify(Array.from(aestheticThemes)),
        JSON.stringify(Array.from(constructionPatterns)),
        JSON.stringify(signaturePieces.slice(0, 10)),
        clampedConfidence.toFixed(3),
        clampedCompleteness.toFixed(2)
      ]
    );
    
    console.log('\n✅ Style profile saved successfully!');
    console.log('Profile ID:', updateResult.rows[0].id);
    
    // Verify the profile
    const verifyResult = await pool.query(
      `SELECT * FROM style_profiles WHERE user_id = $1`,
      [userId]
    );
    
    console.log('\n=== VERIFIED PROFILE FROM DATABASE ===');
    console.log(JSON.stringify(verifyResult.rows[0], null, 2));
    
  } catch (error) {
    console.error('Error generating profile:', error);
    console.error('Error details:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

generateProfile();

