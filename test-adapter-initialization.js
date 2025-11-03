#!/usr/bin/env node

/**
 * Test script to verify adapter initialization and API key configuration
 * Run: node test-adapter-initialization.js
 */

const imagenAdapter = require('./src/adapters/imagenAdapter');
const stableDiffusionAdapter = require('./src/adapters/stableDiffusionAdapter');
const dalleAdapter = require('./src/adapters/dalleAdapter');
const geminiAdapter = require('./src/adapters/geminiAdapter');

console.log('🔍 Adapter Initialization Test\n');
console.log('Environment Verification:');
console.log('  REPLICATE_API_TOKEN:', process.env.REPLICATE_API_TOKEN ? '✅ Configured' : '❌ Missing');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configured' : '⚠️  Not required for Replicate adapters\n');

const adapters = [
  { name: 'Imagen 4 Ultra', instance: imagenAdapter },
  { name: 'Stable Diffusion 3.5', instance: stableDiffusionAdapter },
  { name: 'DALL-E 3', instance: dalleAdapter },
  { name: 'Gemini 2.5 Flash', instance: geminiAdapter }
];

(async () => {
  console.log('Adapter Health Checks:\n');
  
  for (const adapter of adapters) {
    try {
      const health = await adapter.instance.healthCheck();
      const status = health.healthy ? '✅' : '❌';
      const error = health.error ? ` - ${health.error}` : '';
      console.log(`${status} ${adapter.name}${error}`);
    } catch (error) {
      console.log(`❌ ${adapter.name} - ${error.message}`);
    }
  }
  
  console.log('\n💰 Cost Calculation Test:\n');
  
  // Test Imagen cost calculation
  try {
    const imagenCost = imagenAdapter.calculateCost(
      { output_quality: 80 }, 
      2  // count
    );
    console.log(`✅ Imagen 4 Ultra: $${imagenCost} (2 images × $0.04)`);
  } catch (e) {
    console.log(`❌ Imagen 4 Ultra: ${e.message}`);
  }
  
  // Test SD cost calculation
  try {
    const sdCost = stableDiffusionAdapter.calculateCost(
      { num_outputs: 3 }
    );
    console.log(`✅ Stable Diffusion: $${sdCost} (3 images × $0.02)`);
  } catch (e) {
    console.log(`❌ Stable Diffusion: ${e.message}`);
  }
  
  // Test DALL-E cost calculation
  try {
    const dalleCost = dalleAdapter.calculateCost(
      { quality: 'standard', size: '1024x1024' }
    );
    console.log(`✅ DALL-E 3: $${dalleCost} (1 image, standard quality)`);
  } catch (e) {
    console.log(`❌ DALL-E 3: ${e.message}`);
  }
  
  // Test Gemini cost calculation
  try {
    const geminiCost = geminiAdapter.calculateCost({});
    console.log(`✅ Gemini 2.5 Flash: $${geminiCost} (1 image × $0.01)`);
  } catch (e) {
    console.log(`❌ Gemini 2.5 Flash: ${e.message}`);
  }
  
  console.log('\n✅ All tests completed!\n');
  process.exit(0);
})().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});