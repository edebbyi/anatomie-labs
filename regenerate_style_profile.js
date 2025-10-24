const db = require('./src/services/database');
const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');

async function regenerateStyleProfile() {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database');
      process.exit(1);
    }

    console.log('Connected to database successfully');

    // Use the specific user ID that has a style profile
    const userId = '63ac9657-091b-4ffe-909b-8601cfc0e471';
    console.log('Using user ID:', userId);

    // Get the portfolio ID for this user
    const portfolioResult = await db.query(
      'SELECT id FROM portfolios WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    
    if (portfolioResult.rows.length === 0) {
      console.log('No portfolio found for user');
      process.exit(1);
    }
    
    const portfolioId = portfolioResult.rows[0].id;
    console.log('Portfolio ID:', portfolioId);

    // Regenerate the style profile
    console.log('Regenerating style profile...');
    const profile = await trendAnalysisAgent.generateStyleProfile(userId, portfolioId);
    
    console.log('Style profile regenerated successfully:');
    console.log('Profile ID:', profile.id);
    console.log('Total images:', profile.total_images);
    
    // Parse style labels if they're stored as strings
    let styleLabels = profile.style_labels;
    if (typeof styleLabels === 'string') {
      try {
        styleLabels = JSON.parse(styleLabels);
      } catch (e) {
        console.error('Failed to parse style labels:', e.message);
      }
    }
    
    console.log('Style labels:', JSON.stringify(styleLabels, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

regenerateStyleProfile();