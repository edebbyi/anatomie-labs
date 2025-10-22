/**
 * Test Script: Generate First 40 Images on Account Creation
 * 
 * This script tests the complete onboarding flow:
 * 1. Create test user
 * 2. Upload & analyze portfolio (VLT)
 * 3. Generate style profile
 * 4. Generate 40 images using RLHF-enhanced prompts
 * 
 * Usage:
 *   node test-first-40-images.js --portfolio=./test-data/anatomie-portfolio.zip
 * 
 * Requirements:
 *   - PostgreSQL running
 *   - VLT service accessible
 *   - Imagen API key configured
 *   - (Optional) R2 storage configured
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const logger = require('./src/utils/logger');

// Services
const User = require('./src/models/User');
const vltService = require('./src/services/vltService');
const portfolioService = require('./src/services/portfolioService');
const generationService = require('./src/services/generationService');
const promptTemplateService = require('./src/services/promptTemplateService');
const dppSelectionService = require('./src/services/dppSelectionService');
const r2Service = require('./src/services/r2Storage');

// Configuration
const CONFIG = {
  targetImageCount: 40,
  bufferPercent: 20, // Generate 48 images (20% buffer)
  vltModel: 'gemini',
  vltPasses: 'A,B,C',
  generationProvider: 'google-imagen', // All via Replicate (Imagen 4 Ultra)
  // Alternative: 'stable-diffusion-xl' (faster, cheaper - $0.02 vs $0.04)
  testUser: {
    email: 'test-onboarding@anatomie.com',
    password: 'TestPassword123!',
    name: 'Test User - Onboarding'
  }
};

class OnboardingTestRunner {
  constructor() {
    this.userId = null;
    this.vltResults = null;
    this.styleProfile = null;
    this.generatedImages = [];
    this.selectedImages = [];
    this.startTime = Date.now();
  }

  /**
   * Main test runner
   */
  async run(portfolioPath) {
    try {
      logger.info('🚀 Starting onboarding test', {
        portfolioPath,
        targetCount: CONFIG.targetImageCount,
        buffer: CONFIG.bufferPercent
      });

      // Step 1: Create test user
      await this.step1_createUser();

      // Step 2: Analyze portfolio with VLT
      await this.step2_analyzePortfolio(portfolioPath);

      // Step 3: Generate style profile (simplified for testing)
      await this.step3_generateStyleProfile();

      // Step 4: Generate prompts
      const prompts = await this.step4_generatePrompts();

      // Step 5: Generate images
      await this.step5_generateImages(prompts);

      // Step 6: Validate & select best 40
      await this.step6_validateAndSelect();

      // Step 7: Store images (if R2 configured)
      await this.step7_storeImages();

      // Summary
      this.printSummary();

      logger.info('✅ Onboarding test completed successfully!');
      process.exit(0);

    } catch (error) {
      logger.error('❌ Onboarding test failed', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Step 1: Create test user account
   */
  async step1_createUser() {
    logger.info('\n📝 Step 1: Creating test user...');

    try {
      // Check if user already exists
      const existing = await User.findByEmail(CONFIG.testUser.email);
      if (existing) {
        logger.info('User already exists, using existing account', {
          userId: existing.id
        });
        this.userId = existing.id;
        return;
      }

      // Create new user
      const user = await User.create(CONFIG.testUser);
      this.userId = user.id;

      logger.info('✅ Test user created', {
        userId: this.userId,
        email: user.email
      });

    } catch (error) {
      logger.error('Failed to create user', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 2: Analyze portfolio with VLT
   */
  async step2_analyzePortfolio(portfolioPath) {
    logger.info('\n🔍 Step 2: Analyzing portfolio with VLT (Gemini Vision)...');

    if (!portfolioPath || !fs.existsSync(portfolioPath)) {
      throw new Error(`Portfolio file not found: ${portfolioPath}`);
    }

    const startTime = Date.now();

    try {
      // Call VLT service
      logger.info('Uploading portfolio for analysis', {
        path: portfolioPath,
        model: CONFIG.vltModel,
        passes: CONFIG.vltPasses
      });

      const zipBuffer = fs.readFileSync(portfolioPath);
      
      // Analyze portfolio
      this.vltResults = await vltService.analyzeFromZip(zipBuffer, {
        userId: this.userId,
        model: CONFIG.vltModel,
        passes: CONFIG.vltPasses
      });

      const duration = Date.now() - startTime;

      // Save to database
      await portfolioService.saveBatchAnalysis(
        this.userId,
        this.vltResults
      );

      logger.info('✅ VLT analysis complete', {
        totalImages: this.vltResults.records.length,
        avgConfidence: this.vltResults.summary?.averageConfidence || 'N/A',
        duration: `${(duration / 1000).toFixed(1)}s`,
        garmentTypes: Object.keys(this.vltResults.summary?.garmentTypes || {})
      });

      // Show sample analysis
      if (this.vltResults.records.length > 0) {
        const sample = this.vltResults.records[0];
        logger.info('Sample VLT analysis:', {
          garmentType: sample.garmentType,
          silhouette: sample.attributes?.silhouette,
          colors: sample.colors?.primary,
          fabric: sample.fabric?.type,
          style: sample.style?.aesthetic
        });
      }

    } catch (error) {
      logger.error('VLT analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 3: Generate style profile
   * Note: In production, this calls the Python ML service for GMM clustering
   * For testing, we create a simplified profile
   */
  async step3_generateStyleProfile() {
    logger.info('\n🎨 Step 3: Generating style profile...');

    try {
      // In production: Call Python ML service
      // const mlService = require('./src/services/mlService');
      // this.styleProfile = await mlService.generateStyleProfile(this.userId);

      // For testing: Create simplified profile from VLT analysis
      const summary = this.vltResults.summary;
      
      this.styleProfile = {
        userId: this.userId,
        clusters: this._createSimplifiedClusters(summary),
        dominantColors: summary.dominantColors || {},
        dominantFabrics: summary.fabricTypes || {},
        dominantSilhouettes: {},
        updated_at: new Date().toISOString()
      };

      logger.info('✅ Style profile generated', {
        numClusters: Object.keys(this.styleProfile.clusters).length,
        dominantColors: Object.keys(this.styleProfile.dominantColors).slice(0, 3),
        dominantFabrics: Object.keys(this.styleProfile.dominantFabrics).slice(0, 3)
      });

    } catch (error) {
      logger.error('Style profile generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 4: Generate prompts using template system + RLHF
   */
  async step4_generatePrompts() {
    logger.info('\n📝 Step 4: Generating prompts with RLHF templates...');

    const calculateCount = CONFIG.targetImageCount * (1 + CONFIG.bufferPercent / 100);
    const generateCount = Math.ceil(calculateCount);

    logger.info(`Generating ${generateCount} prompts (target: ${CONFIG.targetImageCount} + ${CONFIG.bufferPercent}% buffer)`);

    const prompts = [];

    try {
      // Get portfolio items for prompt generation
      const portfolio = await portfolioService.getUserPortfolio(this.userId, {
        limit: generateCount
      });

      // Generate prompt for each portfolio item
      for (let i = 0; i < Math.min(generateCount, portfolio.length); i++) {
        const vltSpec = portfolio[i];
        
        // Use template service to generate prompt
        const result = promptTemplateService.generatePrompt(
          vltSpec,
          this.styleProfile,
          {
            userId: this.userId,
            exploreMode: i % 5 === 0, // 20% exploration
            userModifiers: []
          }
        );

        prompts.push({
          id: `prompt-${i + 1}`,
          vltSpecId: vltSpec.id,
          mainPrompt: result.mainPrompt,
          negativePrompt: result.negativePrompt,
          metadata: result.metadata
        });
      }

      logger.info('✅ Prompts generated', {
        count: prompts.length,
        withExploration: prompts.filter(p => p.metadata.exploreMode).length,
        templateIds: [...new Set(prompts.map(p => p.metadata.templateId))]
      });

      // Show sample prompt
      if (prompts.length > 0) {
        const sample = prompts[0];
        logger.info('Sample prompt:', {
          template: sample.metadata.templateName,
          promptLength: sample.mainPrompt.length,
          negativeLength: sample.negativePrompt.length,
          preview: sample.mainPrompt.substring(0, 150) + '...'
        });
      }

      return prompts;

    } catch (error) {
      logger.error('Prompt generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 5: Generate images using Imagen (or test provider)
   */
  async step5_generateImages(prompts) {
    logger.info(`\n🖼️ Step 5: Generating ${prompts.length} images with ${CONFIG.generationProvider}...`);
    logger.info(`⏱️  Estimated time: ${(prompts.length * 12 / 60).toFixed(1)} minutes`);

    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;

    try {
      // Generate images in batches (to avoid rate limits)
      const batchSize = 5;
      
      for (let i = 0; i < prompts.length; i += batchSize) {
        const batch = prompts.slice(i, i + batchSize);
        logger.info(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prompts.length / batchSize)}`);

        const batchPromises = batch.map(async (prompt, idx) => {
          const imageNum = i + idx + 1;
          
          try {
            logger.info(`  [${imageNum}/${prompts.length}] Generating image...`);

            // Call generation service
            const result = await generationService.generateFromImage({
              userId: this.userId,
              vltSpec: { id: prompt.vltSpecId },
              settings: {
                count: 1,
                provider: CONFIG.generationProvider,
                prompt: prompt.mainPrompt,
                negativePrompt: prompt.negativePrompt,
                bufferPercent: 0 // Already accounted for
              }
            });

            successCount++;
            
            this.generatedImages.push({
              id: result.id,
              promptId: prompt.id,
              url: result.url,
              quality: result.quality,
              metadata: result.metadata
            });

            logger.info(`  ✅ [${imageNum}/${prompts.length}] Generated successfully`);

          } catch (error) {
            failureCount++;
            logger.warn(`  ❌ [${imageNum}/${prompts.length}] Failed: ${error.message}`);
          }
        });

        await Promise.all(batchPromises);

        // Rate limiting pause between batches
        if (i + batchSize < prompts.length) {
          logger.info('  Waiting 5s before next batch...');
          await this._sleep(5000);
        }
      }

      const duration = Date.now() - startTime;

      logger.info('\n✅ Image generation complete', {
        success: successCount,
        failures: failureCount,
        successRate: `${((successCount / prompts.length) * 100).toFixed(1)}%`,
        duration: `${(duration / 1000 / 60).toFixed(1)} minutes`,
        avgPerImage: `${(duration / successCount / 1000).toFixed(1)}s`
      });

    } catch (error) {
      logger.error('Image generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 6: Validate and select best 40 images using DPP
   */
  async step6_validateAndSelect() {
    logger.info(`\n✨ Step 6: Selecting best ${CONFIG.targetImageCount} images (DPP algorithm)...`);

    try {
      // Use DPP selection service for diversity
      this.selectedImages = await dppSelectionService.selectDiverseImages(
        this.generatedImages,
        CONFIG.targetImageCount,
        {
          userId: this.userId,
          qualityThreshold: 0.7,
          diversityWeight: 0.6
        }
      );

      logger.info('✅ Image selection complete', {
        selected: this.selectedImages.length,
        target: CONFIG.targetImageCount,
        avgQuality: (
          this.selectedImages.reduce((sum, img) => sum + (img.quality || 0), 0) / 
          this.selectedImages.length
        ).toFixed(2)
      });

    } catch (error) {
      logger.error('Image selection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Step 7: Store images to R2 (if configured)
   */
  async step7_storeImages() {
    logger.info('\n💾 Step 7: Storing images to R2...');

    if (!process.env.R2_ACCOUNT_ID) {
      logger.warn('⚠️  R2 not configured, skipping storage (images stored in temp)');
      return;
    }

    try {
      let storedCount = 0;

      for (const image of this.selectedImages) {
        try {
          // Upload to R2
          const r2Result = await r2Service.uploadImage(
            image.url,
            this.userId,
            {
              imageId: image.id,
              metadata: image.metadata
            }
          );

          image.r2Url = r2Result.cdnUrl;
          storedCount++;

        } catch (error) {
          logger.warn(`Failed to store image ${image.id}`, { error: error.message });
        }
      }

      logger.info('✅ Images stored to R2', {
        stored: storedCount,
        total: this.selectedImages.length
      });

    } catch (error) {
      logger.error('Image storage failed', { error: error.message });
      // Don't fail the test if storage fails
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    const totalDuration = Date.now() - this.startTime;

    console.log('\n');
    console.log('═'.repeat(80));
    console.log('                    🎉 ONBOARDING TEST COMPLETE 🎉');
    console.log('═'.repeat(80));
    console.log();
    console.log('📊 Summary:');
    console.log('─'.repeat(80));
    console.log(`  User Created:           ${this.userId}`);
    console.log(`  Portfolio Analyzed:     ${this.vltResults?.records.length || 0} images`);
    console.log(`  VLT Confidence:         ${this.vltResults?.summary?.averageConfidence || 'N/A'}`);
    console.log(`  Style Clusters:         ${Object.keys(this.styleProfile?.clusters || {}).length}`);
    console.log(`  Images Generated:       ${this.generatedImages.length}`);
    console.log(`  Images Selected:        ${this.selectedImages.length} (target: ${CONFIG.targetImageCount})`);
    console.log(`  Success Rate:           ${((this.selectedImages.length / this.generatedImages.length) * 100).toFixed(1)}%`);
    console.log(`  Total Duration:         ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
    console.log();
    console.log('💰 Cost Estimate:');
    console.log('─'.repeat(80));
    console.log(`  VLT Analysis:           ~$0.50`);
    console.log(`  Image Generation:       ${this.generatedImages.length} × $0.04 = $${(this.generatedImages.length * 0.04).toFixed(2)}`);
    console.log(`  Total Cost:             ~$${(0.50 + this.generatedImages.length * 0.04).toFixed(2)}`);
    console.log();
    console.log('✅ Status:                SUCCESS');
    console.log('═'.repeat(80));
    console.log();
  }

  /**
   * Helper: Create simplified style clusters from VLT summary
   */
  _createSimplifiedClusters(summary) {
    const clusters = {};
    const garmentTypes = summary.garmentTypes || {};
    
    let clusterId = 1;
    for (const [garmentType, count] of Object.entries(garmentTypes)) {
      clusters[`cluster-${clusterId}`] = {
        clusterId: `cluster-${clusterId}`,
        technicalName: `${garmentType}_cluster`,
        displayName: `${garmentType.charAt(0).toUpperCase() + garmentType.slice(1)} Collection`,
        dominant_attributes: {
          garmentType: garmentType,
          count: count
        },
        structure: 'simplified',
        modifiers: []
      };
      clusterId++;
    }

    return clusters;
  }

  /**
   * Helper: Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const portfolioArg = args.find(arg => arg.startsWith('--portfolio='));
  
  if (!portfolioArg) {
    console.error('❌ Error: Portfolio path required');
    console.log('Usage: node test-first-40-images.js --portfolio=<path-to-zip>');
    console.log('Example: node test-first-40-images.js --portfolio=./test-data/anatomie-portfolio.zip');
    process.exit(1);
  }

  const portfolioPath = portfolioArg.split('=')[1];

  // Check environment
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not configured in .env');
    process.exit(1);
  }

  if (!process.env.VLT_API_URL) {
    console.error('⚠️  Warning: VLT_API_URL not configured, VLT analysis may fail');
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ Error: REPLICATE_API_TOKEN not configured');
    console.error('   All image generation (Imagen, SDXL) uses Replicate API');
    console.error('   Please set REPLICATE_API_TOKEN in .env');
    console.log();
    process.exit(1);
  }

  console.log('✅ Replicate API configured');
  console.log(`   Provider: ${CONFIG.generationProvider}`);
  console.log();
  console.log('💡 Tip: Use "stable-diffusion-xl" for faster/cheaper testing');
  console.log('   Imagen 4 Ultra: $0.04/image (highest quality)');
  console.log('   Stable Diffusion XL: $0.02/image (cost-effective)');
  console.log();

  // Run test
  const runner = new OnboardingTestRunner();
  await runner.run(portfolioPath);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Fatal error', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = OnboardingTestRunner;
