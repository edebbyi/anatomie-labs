/**
 * Test Gemini 2.5 Flash Image Analysis Agent
 * 
 * This script tests the image analysis capabilities of Gemini 2.5 Flash
 * using images from the anatomie_test_10 dataset.
 */

require('dotenv').config();
const Replicate = require('replicate');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./src/utils/logger');

class GeminiImageAnalyzer {
  constructor() {
    this.replicate = null;
    this.model = 'google/gemini-2.5-flash';
  }

  async initialize() {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }

    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    logger.info('Gemini Image Analyzer initialized');
  }

  /**
   * Analyze fashion image with detailed prompts
   */
  async analyzeFashionImage(imageBuffer, analysisType = 'detailed') {
    const base64Image = imageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    const prompts = {
      detailed: `Analyze this fashion image in detail. Provide:
1. Garment type(s) and category
2. Detailed color analysis (specific colors, palette, mood)
3. Fabric types and textures (be specific: cotton, silk, denim, etc.)
4. Style aesthetic (e.g., minimalist, streetwear, formal, bohemian)
5. Notable design details (cuts, patterns, embellishments, silhouettes)
6. Overall quality and craftsmanship indicators
7. Target occasion or use case

Be specific, technical, and comprehensive.`,

      quick: `Describe this fashion image concisely:
- Garment type(s)
- Colors and color palette
- Fabrics and textures
- Style and aesthetic
- Notable design details

Be specific but concise.`,

      technical: `Provide a technical fashion analysis:
1. Garment construction and silhouette
2. Material composition (estimate based on visual)
3. Color theory application (complementary, analogous, monochromatic)
4. Design elements: proportion, balance, emphasis
5. Manufacturing quality indicators
6. Fashion category and target market
7. Styling suggestions and versatility

Use professional fashion industry terminology.`,

      creative: `As a fashion designer, describe this piece:
1. What story does this garment tell?
2. What emotions or mood does it evoke?
3. Who is the ideal wearer?
4. What occasions suit this piece?
5. How would you style it?
6. What makes it unique or special?
7. Design inspiration (if evident)

Be creative yet insightful.`
    };

    const prompt = prompts[analysisType] || prompts.detailed;

    try {
      const startTime = Date.now();

      logger.info('Starting Gemini analysis', { analysisType });

      const output = await this.replicate.run(this.model, {
        input: {
          prompt: prompt,
          image: dataUri,
          max_output_tokens: 1024,
          temperature: 0.3
        }
      });

      const latency = Date.now() - startTime;
      const analysis = Array.isArray(output) ? output.join('') : output;

      logger.info('Analysis completed', { 
        latency: `${latency}ms`,
        length: analysis.length 
      });

      return {
        success: true,
        analysis,
        analysisType,
        metadata: {
          model: this.model,
          latency,
          tokenCount: analysis.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Analysis failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        analysisType
      };
    }
  }

  /**
   * Batch analyze multiple images
   */
  async batchAnalyze(imageBuffers, analysisType = 'quick') {
    const results = [];

    for (let i = 0; i < imageBuffers.length; i++) {
      logger.info(`Analyzing image ${i + 1}/${imageBuffers.length}`);
      
      const result = await this.analyzeFashionImage(imageBuffers[i], analysisType);
      results.push(result);

      // Rate limiting - wait 500ms between requests
      if (i < imageBuffers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Compare different analysis types on the same image
   */
  async compareAnalysisTypes(imageBuffer) {
    const types = ['detailed', 'quick', 'technical', 'creative'];
    const results = {};

    for (const type of types) {
      logger.info(`Running ${type} analysis`);
      results[type] = await this.analyzeFashionImage(imageBuffer, type);
      
      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

// Main test function
async function runTest() {
  try {
    console.log('=== Gemini 2.5 Flash Image Analysis Test ===\n');

    const analyzer = new GeminiImageAnalyzer();
    await analyzer.initialize();

    // Get images from anatomie_test_10
    const testDir = path.join(__dirname, 'anatomie_test_10');
    const files = await fs.readdir(testDir);
    const imageFiles = files.filter(f => 
      f.match(/\.(jpg|jpeg|png|webp)$/i) && !f.startsWith('.')
    );

    if (imageFiles.length === 0) {
      console.error('No images found in anatomie_test_10 directory');
      process.exit(1);
    }

    console.log(`Found ${imageFiles.length} images in anatomie_test_10\n`);

    // Test 1: Detailed analysis of first image
    console.log('=== TEST 1: Detailed Analysis ===');
    const testImagePath = path.join(testDir, imageFiles[0]);
    console.log(`Analyzing: ${imageFiles[0]}\n`);
    
    const imageBuffer = await fs.readFile(testImagePath);
    const detailedResult = await analyzer.analyzeFashionImage(imageBuffer, 'detailed');

    if (detailedResult.success) {
      console.log('✅ Analysis successful\n');
      console.log('ANALYSIS RESULT:');
      console.log('─'.repeat(80));
      console.log(detailedResult.analysis);
      console.log('─'.repeat(80));
      console.log(`\nLatency: ${detailedResult.metadata.latency}ms`);
      console.log(`Length: ${detailedResult.metadata.tokenCount} characters\n`);
    } else {
      console.log('❌ Analysis failed:', detailedResult.error);
    }

    // Test 2: Compare different analysis types
    console.log('\n=== TEST 2: Compare Analysis Types ===');
    console.log('Running all analysis types on the same image...\n');
    
    const comparisonResults = await analyzer.compareAnalysisTypes(imageBuffer);

    for (const [type, result] of Object.entries(comparisonResults)) {
      console.log(`\n--- ${type.toUpperCase()} ANALYSIS ---`);
      if (result.success) {
        console.log(`Latency: ${result.metadata.latency}ms`);
        console.log(`Length: ${result.metadata.tokenCount} chars`);
        console.log('\nOutput:');
        console.log(result.analysis.substring(0, 200) + '...');
      } else {
        console.log('❌ Failed:', result.error);
      }
    }

    // Test 3: Quick batch analysis of 3 images
    console.log('\n\n=== TEST 3: Batch Analysis (3 images) ===');
    const batchCount = Math.min(3, imageFiles.length);
    const batchBuffers = [];
    
    for (let i = 0; i < batchCount; i++) {
      const filePath = path.join(testDir, imageFiles[i]);
      const buffer = await fs.readFile(filePath);
      batchBuffers.push(buffer);
    }

    console.log(`Analyzing ${batchCount} images with 'quick' analysis type...\n`);
    const batchResults = await analyzer.batchAnalyze(batchBuffers, 'quick');

    batchResults.forEach((result, index) => {
      console.log(`\n📷 Image ${index + 1}/${batchCount}: ${imageFiles[index]}`);
      if (result.success) {
        console.log(`✅ Success (${result.metadata.latency}ms)`);
        console.log(result.analysis.substring(0, 150) + '...');
      } else {
        console.log('❌ Failed:', result.error);
      }
    });

    // Summary statistics
    console.log('\n\n=== SUMMARY & RECOMMENDATIONS ===');
    const successfulAnalyses = batchResults.filter(r => r.success).length;
    const avgLatency = batchResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.metadata.latency, 0) / successfulAnalyses;

    console.log(`Success rate: ${successfulAnalyses}/${batchResults.length} (${(successfulAnalyses/batchResults.length*100).toFixed(1)}%)`);
    console.log(`Average latency: ${avgLatency.toFixed(0)}ms`);
    
    console.log('\n💡 RECOMMENDATIONS FOR SMARTER IMAGE ANALYSIS:');
    console.log('1. Use "quick" analysis for initial ingestion (faster, cheaper)');
    console.log('2. Use "detailed" analysis for style profiling');
    console.log('3. Use "technical" analysis for advanced features');
    console.log('4. Implement caching to avoid re-analyzing same images');
    console.log('5. Batch process images with rate limiting');
    console.log('6. Store analysis results in database for quick retrieval');
    console.log('7. Consider using embeddings + semantic search for similarity');
    console.log('8. Implement retry logic with exponential backoff');
    
    console.log('\n✅ Test completed!\n');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest();
