/**
 * Backfill style_tags for existing style profiles
 * 
 * This script extracts the top 5 aesthetic themes from existing profiles
 * and populates the style_tags column
 */

const db = require('../services/database');
const logger = require('../utils/logger');

async function backfillStyleTags() {
  try {
    logger.info('Starting style_tags backfill...');

    // Get all profiles with empty or null style_tags
    const query = `
      SELECT id, user_id, aesthetic_themes, style_tags
      FROM style_profiles
      WHERE style_tags IS NULL OR style_tags = '{}'
    `;
    
    const result = await db.query(query);
    const profiles = result.rows;

    logger.info(`Found ${profiles.length} profiles to backfill`);

    let updated = 0;
    let skipped = 0;

    for (const profile of profiles) {
      try {
        // Parse aesthetic_themes
        let aestheticThemes = profile.aesthetic_themes;
        if (typeof aestheticThemes === 'string') {
          aestheticThemes = JSON.parse(aestheticThemes);
        }

        if (!Array.isArray(aestheticThemes) || aestheticThemes.length === 0) {
          logger.warn(`Profile ${profile.id} has no aesthetic themes, skipping`);
          skipped++;
          continue;
        }

        // Extract top 5 theme names
        const styleTags = aestheticThemes
          .slice(0, 5)
          .map(theme => theme.name)
          .filter(Boolean);

        if (styleTags.length === 0) {
          logger.warn(`Profile ${profile.id} has no valid theme names, skipping`);
          skipped++;
          continue;
        }

        // Update the profile
        const updateQuery = `
          UPDATE style_profiles
          SET style_tags = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `;
        
        await db.query(updateQuery, [styleTags, profile.id]);
        
        logger.info(`Updated profile ${profile.id} with style tags:`, styleTags);
        updated++;

      } catch (err) {
        logger.error(`Error processing profile ${profile.id}:`, err);
        skipped++;
      }
    }

    logger.info('Backfill complete', {
      total: profiles.length,
      updated,
      skipped
    });

    process.exit(0);

  } catch (error) {
    logger.error('Backfill failed:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillStyleTags();

