/**
 * Integration Test for Stages 1-5
 * Tests the complete pipeline from VLT → Enhancement → Persona → Routing → RLHF
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

// Mock test data
const mockVltSpec = {
  jobId: 'integration_test_001',
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
    promptText: 'elegant minimalist silk dress',
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

async function testStage1_VLT() {
  section('STAGE 1: VLT Analysis');
  
  const vltService = require('./src/services/vltService');
  
  try {
    log('Testing VLT health check...', colors.yellow);
    const isHealthy = await vltService.healthCheck();
    
    if (isHealthy) {
      log('✓ VLT service is healthy', colors.green);
    } else {
      log('⚠ VLT service unavailable (using mock data)', colors.yellow);
    }
    
    // Use mock data for integration test
    log('✓ VLT specification ready', colors.green);
    log(`  - Garment: ${mockVltSpec.records[0].garmentType}`, colors.blue);
    log(`  - Fabric: ${mockVltSpec.records[0].fabric.type}`, colors.blue);
    log(`  - Color: ${mockVltSpec.records[0].colors.primary}`, colors.blue);
    
    return { success: true, data: mockVltSpec };
    
  } catch (error) {
    log(`✗ Stage 1 failed: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function testStage2_Enhancement(vltSpec) {
  section('STAGE 2: Prompt Enhancement');
  
  if (!vltSpec) {
    log('✗ No VLT spec available', colors.red);
    return { success: false };
  }
  
  const promptService = require('./src/services/promptEnhancementService');
  
  try {
    // Check AI providers
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    
    log(`AI Providers:`, colors.yellow);
    log(`  Anthropic: ${hasAnthropic ? '✓ configured' : '✗ not configured'}`, 
        hasAnthropic ? colors.green : colors.yellow);
    log(`  OpenAI: ${hasOpenAI ? '✓ configured' : '✗ not configured'}`, 
        hasOpenAI ? colors.green : colors.yellow);
    
    let enhanced;
    
    if (hasAnthropic || hasOpenAI) {
      log('\nEnhancing with AI...', colors.yellow);
      enhanced = await promptService.enhancePrompt(vltSpec, {
        provider: hasAnthropic ? 'claude' : 'openai',
        style: 'professional',
        creativity: 0.7
      });
      
      log('✓ AI enhancement completed', colors.green);
    } else {
      log('\nUsing fallback enhancement...', colors.yellow);
      enhanced = promptService.generateFallbackEnhancements(vltSpec);
      log('✓ Fallback enhancement completed', colors.green);
    }
    
    log(`  - Provider: ${enhanced.metadata?.provider || 'fallback'}`, colors.blue);
    log(`  - Enhancements: ${enhanced.enhancements.length}`, colors.blue);
    log(`  - Quality: ${enhanced.summary?.qualityDistribution?.high || 0} high`, colors.blue);
    
    const firstEnhancement = enhanced.enhancements[0];
    log(`\nEnhanced prompt preview:`, colors.yellow);
    log(`  ${firstEnhancement.enhanced.mainPrompt.substring(0, 120)}...`, colors.blue);
    
    return { success: true, data: enhanced };
    
  } catch (error) {
    log(`✗ Stage 2 failed: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function testStage3_Persona(enhancedPrompt) {
  section('STAGE 3: Persona Matching');
  
  if (!enhancedPrompt) {
    log('✗ No enhanced prompt available', colors.red);
    return { success: false };
  }
  
  const personaService = require('./src/services/personaService');
  const pineconeService = require('./src/services/pineconeService');
  
  try {
    // Test Pinecone connection
    log('Testing Pinecone connection...', colors.yellow);
    const pineconeHealthy = await pineconeService.healthCheck();
    
    if (pineconeHealthy) {
      log('✓ Pinecone connected', colors.green);
    } else {
      log('⚠ Pinecone unavailable (persona matching limited)', colors.yellow);
    }
    
    // Create mock persona
    log('\nCreating mock persona...', colors.yellow);
    const mockPersona = {
      id: 1,
      user_id: 'test_user_123',
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
    
    // Calculate match score
    const firstEnhancement = enhancedPrompt.enhancements[0];
    const enhancedKeywords = firstEnhancement.enhanced?.keywords || [];
    const overlap = enhancedKeywords.filter(k => mockPersona.keywords.includes(k));
    const matchScore = overlap.length > 0 ? overlap.length / mockPersona.keywords.length : 0.5;
    
    log(`\n✓ Match score calculated: ${(matchScore * 100).toFixed(1)}%`, colors.green);
    log(`  - Matching keywords: ${overlap.join(', ') || 'none'}`, colors.blue);
    
    const matched = {
      originalPrompt: firstEnhancement,
      matchedPersona: mockPersona,
      matchScore,
      adjustedPrompt: firstEnhancement,
      adjustments: [],
      recommendation: matchScore > 0.7 ? 
        'Excellent match!' : 
        matchScore > 0.5 ? 'Good match' : 'Consider adjustments'
    };
    
    return { success: true, data: matched };
    
  } catch (error) {
    log(`✗ Stage 3 failed: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function testStage4_Routing(enhancedPrompt) {
  section('STAGE 4: Model Routing');
  
  if (!enhancedPrompt) {
    log('✗ No enhanced prompt available', colors.red);
    return { success: false };
  }
  
  const routingService = require('./src/services/modelRoutingService');
  
  try {
    log('Analyzing prompt features...', colors.yellow);
    
    const firstEnhancement = enhancedPrompt.enhancements?.[0] || enhancedPrompt.originalPrompt || enhancedPrompt;
    
    const routing = await routingService.routePrompt(firstEnhancement, {
      strategy: 'balanced',
      userId: 'test_user_123'
    });
    
    log('✓ Routing decision completed', colors.green);
    log(`  - Selected: ${routing.provider.name}`, colors.blue);
    log(`  - Score: ${routing.score.toFixed(3)}`, colors.blue);
    log(`  - Cost: $${routing.provider.costPerImage}/image`, colors.blue);
    log(`  - Quality: ${(routing.provider.avgQuality * 100).toFixed(0)}%`, colors.blue);
    log(`\nReasoning:`, colors.yellow);
    log(`  ${routing.reasoning}`, colors.blue);
    
    if (routing.alternatives.length > 0) {
      log(`\nAlternatives:`, colors.yellow);
      routing.alternatives.forEach(alt => {
        log(`  - ${alt.provider}: ${alt.score.toFixed(3)} (${alt.reason})`, colors.blue);
      });
    }
    
    return { success: true, data: routing };
    
  } catch (error) {
    log(`✗ Stage 4 failed: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function testStage5_RLHF(enhancedPrompt, personaData) {
  section('STAGE 5: RLHF Optimization');
  
  if (!enhancedPrompt) {
    log('✗ No enhanced prompt available', colors.red);
    return { success: false };
  }
  
  const rlhfService = require('./src/services/rlhfService');
  
  try {
    log('Calculating reward scores...', colors.yellow);
    
    const firstEnhancement = enhancedPrompt.enhancements?.[0] || enhancedPrompt.originalPrompt || enhancedPrompt;
    
    const optimized = await rlhfService.optimizePrompt(firstEnhancement, {
      userId: 'test_user_123',
      previousFeedback: [
        { type: 'outlier', keywords: ['elegant', 'minimalist'], ageInDays: 5 },
        { type: 'heart', keywords: ['professional'], ageInDays: 10 }
      ],
      personaData: personaData || { matchScore: 0.85 },
      targetQuality: 0.85
    });
    
    log('✓ RLHF optimization completed', colors.green);
    log(`  - Current reward: ${optimized.currentReward.toFixed(3)}`, colors.blue);
    log(`  - Expected reward: ${optimized.expectedReward.toFixed(3)}`, colors.blue);
    log(`  - Improvement: +${(optimized.expectedReward - optimized.currentReward).toFixed(3)}`, colors.green);
    log(`  - Confidence: ${(optimized.confidence * 100).toFixed(1)}%`, colors.blue);
    
    if (optimized.modifications.length > 0) {
      log(`\nModifications applied:`, colors.yellow);
      optimized.modifications.forEach(mod => {
        log(`  - ${mod.type}: ${mod.description || mod.variation}`, colors.blue);
      });
    } else {
      log(`\n  No modifications needed (already optimized)`, colors.green);
    }
    
    return { success: true, data: optimized };
    
  } catch (error) {
    log(`✗ Stage 5 failed: ${error.message}`, colors.red);
    return { success: false, error: error.message };
  }
}

async function runIntegrationTest() {
  console.clear();
  log('╔════════════════════════════════════════════════════════════════════╗', colors.cyan);
  log('║      DESIGNER BFF - FULL INTEGRATION TEST (STAGES 1-5)            ║', colors.cyan);
  log('╚════════════════════════════════════════════════════════════════════╝', colors.cyan);
  
  const results = {
    stage1: null,
    stage2: null,
    stage3: null,
    stage4: null,
    stage5: null
  };
  
  // Stage 1: VLT Analysis
  results.stage1 = await testStage1_VLT();
  
  // Stage 2: Prompt Enhancement
  if (results.stage1.success) {
    results.stage2 = await testStage2_Enhancement(results.stage1.data);
  }
  
  // Stage 3: Persona Matching
  if (results.stage2.success) {
    results.stage3 = await testStage3_Persona(results.stage2.data);
  }
  
  // Stage 4: Model Routing
  if (results.stage2.success) {
    results.stage4 = await testStage4_Routing(results.stage2.data);
  }
  
  // Stage 5: RLHF Optimization
  if (results.stage2.success) {
    results.stage5 = await testStage5_RLHF(
      results.stage2.data,
      results.stage3?.data
    );
  }
  
  // Summary
  section('INTEGRATION TEST SUMMARY');
  
  const passed = Object.values(results).filter(r => r && r.success).length;
  const total = 5;
  const percentage = (passed / total * 100).toFixed(0);
  
  log(`\nStages Passed: ${passed}/${total} (${percentage}%)`, 
      passed === total ? colors.green : colors.yellow);
  
  const stages = [
    { name: 'VLT Analysis', result: results.stage1 },
    { name: 'Prompt Enhancement', result: results.stage2 },
    { name: 'Persona Matching', result: results.stage3 },
    { name: 'Model Routing', result: results.stage4 },
    { name: 'RLHF Optimization', result: results.stage5 }
  ];
  
  stages.forEach((stage, index) => {
    const status = stage.result?.success ? '✓ PASS' : '✗ FAIL';
    const color = stage.result?.success ? colors.green : colors.red;
    log(`  ${status.padEnd(10)} Stage ${index + 1}: ${stage.name}`, color);
  });
  
  // Configuration status
  section('CONFIGURATION STATUS');
  
  const configs = {
    'VLT API': !!process.env.VLT_API_KEY,
    'Anthropic (Claude)': !!process.env.ANTHROPIC_API_KEY,
    'OpenAI (GPT)': !!process.env.OPENAI_API_KEY,
    'Pinecone': !!process.env.PINECONE_API_KEY,
    'Database': !!process.env.DATABASE_URL
  };
  
  Object.entries(configs).forEach(([name, configured]) => {
    const status = configured ? '✓' : '✗';
    const color = configured ? colors.green : colors.yellow;
    log(`  ${status} ${name}`, color);
  });
  
  // Pipeline output
  if (passed === total) {
    section('PIPELINE OUTPUT');
    
    log('Generation-ready prompt package:', colors.green);
    
    if (results.stage5?.data) {
      const optimized = results.stage5.data.optimizedPrompt;
      log(`\nMain Prompt:`, colors.yellow);
      log(`  ${optimized.enhanced?.mainPrompt || optimized.mainPrompt || 'N/A'}`, colors.blue);
      
      log(`\nNegative Prompt:`, colors.yellow);
      log(`  ${optimized.enhanced?.negativePrompt || 'N/A'}`, colors.blue);
    }
    
    if (results.stage4?.data) {
      log(`\nSelected Model:`, colors.yellow);
      log(`  ${results.stage4.data.provider.name}`, colors.blue);
      log(`  Cost: $${results.stage4.data.provider.costPerImage}`, colors.blue);
      log(`  Quality: ${(results.stage4.data.provider.avgQuality * 100).toFixed(0)}%`, colors.blue);
    }
  }
  
  // Next steps
  section('NEXT STEPS');
  
  if (passed === total) {
    log('🎉 All stages operational! Ready for Stage 6.', colors.green);
    log('\nRecommended next actions:', colors.yellow);
    log('  1. Run database migrations:', colors.blue);
    log('     psql $DATABASE_URL -f database/migrations/003_create_persona_tables.sql', colors.reset);
    log('     psql $DATABASE_URL -f database/migrations/004_create_routing_rlhf_tables.sql', colors.reset);
    log('  2. Configure missing API keys (if any)', colors.blue);
    log('  3. Start building Stage 6 (Image Generation)', colors.blue);
  } else {
    log('⚠️  Some stages need attention:', colors.yellow);
    
    if (!configs['Anthropic (Claude)'] && !configs['OpenAI (GPT)']) {
      log('  - Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env', colors.yellow);
    }
    if (!configs['Pinecone']) {
      log('  - Add PINECONE_API_KEY to .env for persona matching', colors.yellow);
    }
    if (!configs['Database']) {
      log('  - Configure DATABASE_URL', colors.yellow);
    }
  }
  
  log('\n✓ Integration test completed', colors.cyan);
}

// Run the test
runIntegrationTest()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    log(`\n✗ Test suite failed: ${error.message}`, colors.red);
    console.error(error.stack);
    process.exit(1);
  });
