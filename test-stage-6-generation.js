/**
 * Stage 6 - End-to-End Image Generation Test
 * Tests full pipeline with actual Imagen 4 Ultra generation
 */

require('dotenv').config();

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(`${colors.bold}${title}${colors.reset}`, colors.cyan);
  console.log('='.repeat(70));
}

// Mock VLT spec for testing
const mockVltSpec = {
  jobId: 'stage_6_test_001',
  status: 'completed',
  backend: 'gemini',
  timestamp: new Date().toISOString(),
  records: [{
    imageId: 'test_image_stage6',
    garmentType: 'evening gown',
    silhouette: 'mermaid',
    fabric: {
      type: 'silk satin',
      texture: 'smooth',
      weight: 'medium',
      finish: 'glossy'
    },
    colors: {
      primary: 'deep burgundy',
      secondary: null,
      pattern: { type: 'solid' }
    },
    construction: {
      seams: 'hidden',
      closure: 'back zipper',
      details: 'ruched bodice'
    },
    style: {
      aesthetic: 'elegant',
      formality: 'formal',
      season: 'all-season'
    },
    promptText: 'elegant burgundy evening gown',
    confidence: 0.94
  }]
};

async function testEndToEndGeneration() {
  console.clear();
  log('╔════════════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║          STAGE 6: END-TO-END IMAGE GENERATION TEST                ║', colors.cyan);
  log('╚════════════════════════════════════════════════════════════════════╝', colors.cyan);
  
  const generationService = require('./src/services/generationService');
  
  section('CONFIGURATION CHECK');
  
  const configs = {
    'Replicate API': !!process.env.REPLICATE_API_TOKEN,
    'OpenAI API': !!process.env.OPENAI_API_KEY,
    'Database': !!process.env.DATABASE_URL,
    'R2 Storage': !!process.env.R2_ACCESS_KEY_ID,
    'Pinecone': !!process.env.PINECONE_API_KEY
  };
  
  Object.entries(configs).forEach(([name, configured]) => {
    const status = configured ? '✓' : '✗';
    const color = configured ? colors.green : colors.red;
    log(`  ${status} ${name}`, color);
  });
  
  if (!configs['Replicate API']) {
    log('\n✗ REPLICATE_API_TOKEN not configured. Cannot proceed with Imagen 4 Ultra.', colors.red);
    process.exit(1);
  }
  
  if (!configs['OpenAI API']) {
    log('\n⚠ OPENAI_API_KEY not configured. Prompt enhancement may fail.', colors.yellow);
  }
  
  section('STARTING FULL PIPELINE GENERATION');
  
  const startTime = Date.now();
  
  try {
    log('\n🚀 Generating image from VLT specification...', colors.yellow);
    log(`   Garment: ${mockVltSpec.records[0].garmentType}`, colors.blue);
    log(`   Fabric: ${mockVltSpec.records[0].fabric.type}`, colors.blue);
    log(`   Color: ${mockVltSpec.records[0].colors.primary}`, colors.blue);
    
    const result = await generationService.generateFromImage({
      userId: null, // Test without user
      vltSpec: mockVltSpec,
      settings: {
        provider: 'google-imagen', // Force Imagen 4 Ultra
        quality: 'hd',
        size: 'square',
        strategy: 'quality-first'
      }
    });
    
    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(1);
    
    section('GENERATION COMPLETE! ✨');
    
    log(`\n✓ Generation ID: ${result.id}`, colors.green);
    log(`✓ Status: ${result.status}`, colors.green);
    log(`✓ Total Time: ${totalTime}s`, colors.green);
    log(`✓ Cost: $${result.cost}`, colors.green);
    
    if (result.assets && result.assets.length > 0) {
      log(`\n📸 Generated Images:`, colors.yellow);
      result.assets.forEach((asset, i) => {
        log(`   ${i + 1}. ${asset.cdn_url}`, colors.blue);
        log(`      Size: ${(asset.file_size / 1024).toFixed(2)} KB`, colors.blue);
      });
    }
    
    // Show pipeline stages
    if (result.pipeline_data) {
      section('PIPELINE STAGES');
      
      const stages = [];
      if (result.pipeline_data.vlt_complete) stages.push('✓ VLT Analysis');
      if (result.pipeline_data.enhancement_complete) stages.push('✓ Prompt Enhancement');
      if (result.pipeline_data.persona_complete) stages.push('✓ Persona Matching');
      if (result.pipeline_data.routing_complete) {
        const routing = result.pipeline_data.routing_complete.routing;
        stages.push(`✓ Model Routing (${routing.provider.name})`);
      }
      if (result.pipeline_data.rlhf_complete) stages.push('✓ RLHF Optimization');
      if (result.pipeline_data.generation_complete) stages.push('✓ Image Generation');
      
      stages.forEach(stage => log(`  ${stage}`, colors.green));
      
      // Show optimized prompt
      if (result.pipeline_data.rlhf_complete) {
        const optimized = result.pipeline_data.rlhf_complete.optimized;
        section('FINAL OPTIMIZED PROMPT');
        
        const mainPrompt = optimized.optimizedPrompt.enhanced?.mainPrompt || 
                          optimized.optimizedPrompt.mainPrompt || 'N/A';
        
        log(`\nMain Prompt:`, colors.yellow);
        log(`${mainPrompt.substring(0, 300)}${mainPrompt.length > 300 ? '...' : ''}`, colors.blue);
        
        const negativePrompt = optimized.optimizedPrompt.enhanced?.negativePrompt;
        if (negativePrompt) {
          log(`\nNegative Prompt:`, colors.yellow);
          log(`${negativePrompt.substring(0, 200)}...`, colors.blue);
        }
        
        log(`\nReward Score: ${optimized.currentReward.toFixed(3)}`, colors.green);
        log(`Confidence: ${(optimized.confidence * 100).toFixed(1)}%`, colors.green);
      }
    }
    
    section('SUCCESS! 🎉');
    
    log('\nThe full Designer BFF pipeline is now operational!', colors.green);
    log('\nStages Complete: 1-6 (VLT → Enhancement → Persona → Routing → RLHF → Generation)', colors.green);
    log('\nYou can now:', colors.yellow);
    log('  1. View the generated image at the CDN URL above', colors.blue);
    log('  2. Check the database for generation records', colors.blue);
    log('  3. Submit feedback to improve future generations', colors.blue);
    log('  4. Build stages 7-11 for advanced features', colors.blue);
    
    log(`\n✓ Test completed in ${totalTime}s`, colors.cyan);
    
    process.exit(0);
    
  } catch (error) {
    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(1);
    
    section('GENERATION FAILED ✗');
    
    log(`\nError: ${error.message}`, colors.red);
    log(`Time elapsed: ${totalTime}s`, colors.yellow);
    
    if (error.stack) {
      log(`\nStack trace:`, colors.yellow);
      console.error(error.stack);
    }
    
    log('\nTroubleshooting:', colors.yellow);
    log('  1. Check REPLICATE_API_TOKEN is valid', colors.blue);
    log('  2. Ensure database migrations have been run', colors.blue);
    log('  3. Verify R2 storage is configured', colors.blue);
    log('  4. Check logs for detailed error information', colors.blue);
    
    process.exit(1);
  }
}

// Run the test
testEndToEndGeneration()
  .catch(error => {
    log(`\n✗ Test suite crashed: ${error.message}`, colors.red);
    console.error(error.stack);
    process.exit(1);
  });
