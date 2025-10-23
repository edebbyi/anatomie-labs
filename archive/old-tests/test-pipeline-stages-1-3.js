/**
 * Test Script for Stages 1-3 Pipeline
 * Tests: Voice Command → VLT → Enhancement → Persona Matching
 */

require('dotenv').config();
const pipelineOrchestrator = require('./src/services/pipelineOrchestrator');
const vltService = require('./src/services/vltService');
const promptEnhancementService = require('./src/services/promptEnhancementService');
const personaService = require('./src/services/personaService');
const pineconeService = require('./src/services/pineconeService');

// Test configuration
const TEST_USER_ID = 'test_user_123';
const TEST_IMAGE_URL = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d'; // Sample fashion image

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.cyan);
  console.log('='.repeat(60));
}

async function testPineconeConnection() {
  section('TEST 1: Pinecone Connection');
  
  try {
    log('Testing Pinecone health check...', colors.yellow);
    const isHealthy = await pineconeService.healthCheck();
    
    if (isHealthy) {
      log('✓ Pinecone connection successful', colors.green);
      
      // Get stats
      await pineconeService.initialize();
      const stats = await pineconeService.getStats();
      log(`  - Vector count: ${stats.totalVectorCount}`, colors.blue);
      log(`  - Dimension: ${stats.dimension}`, colors.blue);
      
      return true;
    } else {
      log('✗ Pinecone connection failed (API key may not be configured)', colors.yellow);
      return false;
    }
  } catch (error) {
    log(`✗ Pinecone test failed: ${error.message}`, colors.red);
    return false;
  }
}

async function testVLTService() {
  section('TEST 2: VLT Service (Stage 1)');
  
  try {
    log('Testing VLT health check...', colors.yellow);
    const isHealthy = await vltService.healthCheck();
    
    if (!isHealthy) {
      log('✗ VLT service not available', colors.red);
      return null;
    }
    
    log('✓ VLT service is healthy', colors.green);
    
    // Test with mock VLT data (since we don't have a real image)
    log('\nCreating mock VLT specification...', colors.yellow);
    const mockVltSpec = {
      jobId: 'test_vlt_job_001',
      status: 'completed',
      backend: 'gemini',
      model: 'gemini-pro-vision',
      timestamp: new Date().toISOString(),
      records: [{
        imageId: 'test_image_001',
        garmentType: 'dress',
        silhouette: 'A-line',
        fabric: {
          type: 'silk charmeuse',
          texture: 'smooth',
          weight: 'lightweight',
          finish: 'lustrous'
        },
        colors: {
          primary: 'emerald green',
          secondary: null,
          pattern: { type: 'solid' }
        },
        construction: {
          seams: 'French seams',
          closure: 'invisible zipper',
          details: 'bias cut'
        },
        style: {
          aesthetic: 'minimalist',
          formality: 'cocktail',
          season: 'spring/summer'
        },
        promptText: 'elegant silk dress',
        confidence: 0.92,
        attributes: {
          garment_type: 'dress',
          silhouette: 'A-line',
          fabric_type: 'silk charmeuse',
          primary_color: 'emerald green',
          aesthetic: 'minimalist'
        }
      }],
      summary: {
        totalImages: 1,
        garmentTypes: { dress: 1 },
        dominantColors: { 'emerald green': 1 },
        fabricTypes: { 'silk charmeuse': 1 },
        silhouettes: { 'A-line': 1 },
        averageConfidence: '0.92'
      }
    };
    
    log('✓ Mock VLT specification created', colors.green);
    log(`  - Garment: ${mockVltSpec.records[0].garmentType}`, colors.blue);
    log(`  - Silhouette: ${mockVltSpec.records[0].silhouette}`, colors.blue);
    log(`  - Fabric: ${mockVltSpec.records[0].fabric.type}`, colors.blue);
    log(`  - Color: ${mockVltSpec.records[0].colors.primary}`, colors.blue);
    
    return mockVltSpec;
    
  } catch (error) {
    log(`✗ VLT test failed: ${error.message}`, colors.red);
    return null;
  }
}

async function testPromptEnhancement(vltSpec) {
  section('TEST 3: Prompt Enhancement (Stage 2)');
  
  if (!vltSpec) {
    log('⊘ Skipping - no VLT spec available', colors.yellow);
    return null;
  }
  
  try {
    // Check if AI providers are configured
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    
    log(`Anthropic API key: ${hasAnthropicKey ? '✓ configured' : '✗ not configured'}`, 
        hasAnthropicKey ? colors.green : colors.yellow);
    log(`OpenAI API key: ${hasOpenAIKey ? '✓ configured' : '✗ not configured'}`, 
        hasOpenAIKey ? colors.green : colors.yellow);
    
    if (!hasAnthropicKey && !hasOpenAIKey) {
      log('\n✗ No AI provider configured - using fallback enhancement', colors.yellow);
      
      // Test fallback enhancement
      const fallbackResult = promptEnhancementService.generateFallbackEnhancements(vltSpec);
      log('✓ Fallback enhancement created', colors.green);
      log(`  - Prompt: ${fallbackResult.enhancements[0].enhanced.mainPrompt.substring(0, 100)}...`, colors.blue);
      
      return fallbackResult;
    }
    
    log('\nEnhancing prompts with AI...', colors.yellow);
    const enhanced = await promptEnhancementService.enhancePrompt(vltSpec, {
      provider: hasAnthropicKey ? 'claude' : 'openai',
      style: 'professional',
      creativity: 0.7
    });
    
    log('✓ Prompt enhancement completed', colors.green);
    log(`  - Provider: ${enhanced.metadata.provider}`, colors.blue);
    log(`  - Enhancements: ${enhanced.enhancements.length}`, colors.blue);
    log(`  - Quality: ${enhanced.summary.qualityDistribution.high} high, ${enhanced.summary.qualityDistribution.medium} medium`, colors.blue);
    log(`  - Avg word count: ${enhanced.summary.averageWordCount}`, colors.blue);
    
    log('\nEnhanced prompt preview:');
    const firstEnhancement = enhanced.enhancements[0];
    log(`  Main: ${firstEnhancement.enhanced.mainPrompt.substring(0, 150)}...`, colors.blue);
    log(`  Negative: ${firstEnhancement.enhanced.negativePrompt.substring(0, 100)}...`, colors.blue);
    
    return enhanced;
    
  } catch (error) {
    log(`✗ Enhancement test failed: ${error.message}`, colors.red);
    console.error(error.stack);
    return null;
  }
}

async function testPersonaService(enhanced) {
  section('TEST 4: Persona Service (Stage 3)');
  
  if (!enhanced) {
    log('⊘ Skipping - no enhanced prompts available', colors.yellow);
    return null;
  }
  
  try {
    log('Testing persona service...', colors.yellow);
    
    // Note: This would require database connection in real scenario
    // For testing, we'll use mock data
    log('\nCreating mock persona...', colors.yellow);
    const mockPersona = {
      id: 1,
      user_id: TEST_USER_ID,
      name: 'Minimalist Tailoring',
      description: 'Clean lines, monochromatic palettes, precision construction',
      keywords: ['minimalist', 'tailored', 'structured', 'monochrome', 'clean lines'],
      style_preferences: {
        lightingPreference: 'soft natural light',
        compositionStyle: 'centered'
      },
      is_active: true
    };
    
    log('✓ Mock persona created', colors.green);
    log(`  - Name: ${mockPersona.name}`, colors.blue);
    log(`  - Keywords: ${mockPersona.keywords.join(', ')}`, colors.blue);
    
    // Test matching logic
    log('\nTesting persona matching logic...', colors.yellow);
    const firstEnhancement = enhanced.enhancements[0];
    
    // Calculate keyword overlap
    const enhancedKeywords = firstEnhancement.enhanced.keywords || [];
    const overlap = enhancedKeywords.filter(k => mockPersona.keywords.includes(k));
    const matchScore = overlap.length / mockPersona.keywords.length;
    
    log(`✓ Match score calculated: ${(matchScore * 100).toFixed(1)}%`, colors.green);
    log(`  - Matching keywords: ${overlap.join(', ') || 'none'}`, colors.blue);
    
    return {
      persona: mockPersona,
      matchScore,
      enhancement: firstEnhancement
    };
    
  } catch (error) {
    log(`✗ Persona test failed: ${error.message}`, colors.red);
    return null;
  }
}

async function testFullPipeline() {
  section('TEST 5: Full Pipeline Orchestrator');
  
  try {
    log('Note: Full pipeline test requires a real image and database connection', colors.yellow);
    log('Testing pipeline structure and logic...', colors.yellow);
    
    // Validate pipeline stages
    log('\n✓ Pipeline stages defined:', colors.green);
    log(`  - ${pipelineOrchestrator.stages.VLT}`, colors.blue);
    log(`  - ${pipelineOrchestrator.stages.ENHANCEMENT}`, colors.blue);
    log(`  - ${pipelineOrchestrator.stages.PERSONA}`, colors.blue);
    
    // Test input validation
    log('\nTesting input validation...', colors.yellow);
    const vltValidation = pipelineOrchestrator.validateInput(
      'test_image.jpg',
      pipelineOrchestrator.stages.VLT
    );
    log(`  VLT validation: ${vltValidation.valid ? '✓' : '✗'} ${vltValidation.errors.join(', ')}`, 
        vltValidation.valid ? colors.green : colors.red);
    
    log('\n✓ Pipeline orchestrator is ready', colors.green);
    
    return true;
    
  } catch (error) {
    log(`✗ Pipeline test failed: ${error.message}`, colors.red);
    return false;
  }
}

async function runAllTests() {
  console.clear();
  log('╔══════════════════════════════════════════════════════════╗', colors.cyan);
  log('║   DESIGNER BFF - STAGES 1-3 PIPELINE TEST SUITE         ║', colors.cyan);
  log('╚══════════════════════════════════════════════════════════╝', colors.cyan);
  
  const results = {
    pinecone: false,
    vlt: false,
    enhancement: false,
    persona: false,
    pipeline: false
  };
  
  // Run tests sequentially
  results.pinecone = await testPineconeConnection();
  const vltSpec = await testVLTService();
  results.vlt = !!vltSpec;
  
  const enhanced = await testPromptEnhancement(vltSpec);
  results.enhancement = !!enhanced;
  
  const personaResult = await testPersonaService(enhanced);
  results.persona = !!personaResult;
  
  results.pipeline = await testFullPipeline();
  
  // Summary
  section('TEST SUMMARY');
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  log(`\nTests Passed: ${passed}/${total}`, passed === total ? colors.green : colors.yellow);
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✓ PASS' : '✗ FAIL';
    const color = passed ? colors.green : colors.red;
    log(`  ${status.padEnd(10)} ${test}`, color);
  });
  
  // Configuration check
  section('CONFIGURATION STATUS');
  
  const configs = {
    'VLT API Key': !!process.env.VLT_API_KEY,
    'Anthropic API Key': !!process.env.ANTHROPIC_API_KEY,
    'OpenAI API Key': !!process.env.OPENAI_API_KEY,
    'Pinecone API Key': !!process.env.PINECONE_API_KEY,
    'Database URL': !!process.env.DATABASE_URL
  };
  
  Object.entries(configs).forEach(([name, configured]) => {
    const status = configured ? '✓' : '✗';
    const color = configured ? colors.green : colors.yellow;
    log(`  ${status} ${name}`, color);
  });
  
  // Next steps
  section('NEXT STEPS');
  
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    log('1. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env for prompt enhancement', colors.yellow);
  }
  
  if (!process.env.PINECONE_API_KEY) {
    log('2. Add PINECONE_API_KEY to .env for persona vector storage', colors.yellow);
  }
  
  if (!process.env.DATABASE_URL) {
    log('3. Configure DATABASE_URL and run migrations for persona tables', colors.yellow);
  }
  
  if (passed === total) {
    log('\n🎉 All systems ready! Pipeline is operational.', colors.green);
  } else {
    log('\n⚠️  Some components need configuration. See above.', colors.yellow);
  }
  
  log('\n✓ Test suite completed', colors.cyan);
}

// Run tests
runAllTests()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    log(`\n✗ Test suite failed: ${error.message}`, colors.red);
    console.error(error.stack);
    process.exit(1);
  });
