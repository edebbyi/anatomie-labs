const db = require('./src/services/database');
const trendAnalysisAgent = require('./src/services/trendAnalysisAgent');

async function testStyleLabels() {
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

    // Get user's style profile
    const profile = await trendAnalysisAgent.getStyleProfile(userId);
    if (!profile) {
      console.log('No style profile found for user');
      process.exit(1);
    }

    console.log('Style profile found:');
    console.log('Portfolio ID:', profile.portfolio_id);
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

    // Get portfolio descriptors to test the aggregation
    const descriptors = await trendAnalysisAgent.getPortfolioDescriptors(profile.portfolio_id);
    console.log('Number of descriptors:', descriptors.length);
    
    if (descriptors.length > 0) {
      console.log('First descriptor raw_analysis:', JSON.stringify(descriptors[0].raw_analysis, null, 2));
      
      // Test style label aggregation
      const aggregatedLabels = trendAnalysisAgent.aggregateStyleLabels(descriptors);
      console.log('Aggregated style labels:', JSON.stringify(aggregatedLabels, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testStyleLabels();