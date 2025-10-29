#!/usr/bin/env node

/**
 * Test voice command bar prompt quality
 * Verifies that prompts are being interpreted and enhanced properly
 */

const http = require('http');

const testCommands = [
  {
    command: 'elegant black dress',
    expectedFeatures: ['interpretation', 'brandDNA', 'specificity']
  },
  {
    command: 'something casual',
    expectedFeatures: ['interpretation', 'brandDNA', 'low specificity', 'high creativity']
  },
  {
    command: 'navy wool blazer with gold buttons and structured shoulders',
    expectedFeatures: ['interpretation', 'high specificity', 'low creativity', 'user modifiers']
  },
  {
    command: 'make me 10 outfits',
    expectedFeatures: ['interpretation', 'exploratory']
  }
];

async function testCommand(testCase) {
  return new Promise((resolve, reject) => {
    const testData = JSON.stringify({
      userId: null, // Test without userId to see fallback behavior
      description: testCase.command,
      model: 'google-imagen',
      count: 1
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/generate/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': testData.length
      }
    };

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Testing: "${testCase.command}"`);
    console.log('='.repeat(80));

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          
          if (res.statusCode === 200) {
            console.log(`✅ SUCCESS (${res.statusCode})`);
            
            // Check metadata for prompt quality indicators
            const metadata = parsed.metadata || {};
            const generation = parsed.generation || {};
            
            console.log('\n📊 Prompt Quality Analysis:');
            console.log('─'.repeat(80));
            
            // Check if interpretation was used
            if (metadata.interpretation) {
              console.log('✅ Prompt Interpretation: USED');
              console.log(`   - Garment Type: ${metadata.interpretation.garmentType || 'N/A'}`);
              console.log(`   - Specificity: ${metadata.interpretation.specificity || 'N/A'}`);
              console.log(`   - Creativity: ${metadata.interpretation.creativity || 'N/A'}`);
              console.log(`   - Brand DNA Strength: ${metadata.interpretation.brandDNAStrength || 'N/A'}`);
            } else {
              console.log('⚠️  Prompt Interpretation: NOT USED');
            }
            
            // Check source
            if (metadata.source) {
              console.log(`\n📍 Source: ${metadata.source}`);
              if (metadata.source.includes('interpretation')) {
                console.log('   ✅ Using intelligent prompt system');
              } else if (metadata.source.includes('fallback')) {
                console.log('   ⚠️  Using fallback (interpretation failed)');
              } else {
                console.log('   ❌ Using basic prompt (no interpretation)');
              }
            }
            
            // Check enhanced suggestion
            if (metadata.enhancedSuggestion) {
              console.log(`\n💡 Enhanced Suggestion: ${metadata.enhancedSuggestion}`);
            }
            
            // Check original query
            if (metadata.originalQuery) {
              console.log(`\n📝 Original Query: "${metadata.originalQuery}"`);
            }
            
            // Check if we got assets
            if (parsed.assets && parsed.assets.length > 0) {
              console.log(`\n🖼️  Generated Assets: ${parsed.assets.length}`);
              console.log(`   - Asset ID: ${parsed.assets[0].id}`);
              console.log(`   - Provider: ${parsed.assets[0].provider_id}`);
              console.log(`   - File Size: ${(parsed.assets[0].file_size / 1024).toFixed(2)} KB`);
            }
            
            // Feature check
            console.log('\n🔍 Feature Check:');
            testCase.expectedFeatures.forEach(feature => {
              const hasFeature = checkFeature(feature, metadata, parsed);
              console.log(`   ${hasFeature ? '✅' : '❌'} ${feature}`);
            });
            
            resolve({ 
              success: true, 
              command: testCase.command, 
              metadata,
              hasInterpretation: !!metadata.interpretation,
              source: metadata.source
            });
          } else {
            console.log(`❌ FAILED (${res.statusCode})`);
            console.log(`   Error: ${parsed.error}`);
            resolve({ 
              success: false, 
              command: testCase.command, 
              error: parsed.error 
            });
          }
        } catch (error) {
          console.log(`❌ PARSE ERROR`);
          console.log(`   ${error.message}`);
          resolve({ 
            success: false, 
            command: testCase.command, 
            error: error.message 
          });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ REQUEST FAILED`);
      console.log(`   ${error.message}`);
      resolve({ 
        success: false, 
        command: testCase.command, 
        error: error.message 
      });
    });

    req.write(testData);
    req.end();
  });
}

function checkFeature(feature, metadata, response) {
  const lowerFeature = feature.toLowerCase();
  
  if (lowerFeature.includes('interpretation')) {
    return !!metadata.interpretation;
  }
  if (lowerFeature.includes('branddna')) {
    return metadata.interpretation?.brandDNAStrength !== undefined;
  }
  if (lowerFeature.includes('specificity')) {
    return !!metadata.interpretation?.specificity;
  }
  if (lowerFeature.includes('low specificity')) {
    return metadata.interpretation?.specificity === 'low';
  }
  if (lowerFeature.includes('high specificity')) {
    return metadata.interpretation?.specificity === 'high';
  }
  if (lowerFeature.includes('creativity')) {
    return metadata.interpretation?.creativity !== undefined;
  }
  if (lowerFeature.includes('high creativity')) {
    return metadata.interpretation?.creativity > 0.6;
  }
  if (lowerFeature.includes('low creativity')) {
    return metadata.interpretation?.creativity < 0.4;
  }
  if (lowerFeature.includes('user modifiers')) {
    return metadata.interpretation?.userModifiers?.length > 0;
  }
  
  return false;
}

async function runTests() {
  console.log('\n🎯 VOICE COMMAND BAR PROMPT QUALITY TEST SUITE');
  console.log('Testing that prompts are properly interpreted and enhanced\n');

  const results = [];
  
  for (const testCase of testCommands) {
    const result = await testCommand(testCase);
    results.push(result);
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const interpretationCount = results.filter(r => r.hasInterpretation).length;
  
  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
  
  console.log(`\n🧠 Prompt Intelligence:`);
  console.log(`✅ Using Interpretation: ${interpretationCount}/${results.length}`);
  console.log(`Interpretation Rate: ${((interpretationCount / results.length) * 100).toFixed(1)}%`);
  
  // Source breakdown
  const sources = {};
  results.forEach(r => {
    if (r.source) {
      sources[r.source] = (sources[r.source] || 0) + 1;
    }
  });
  
  if (Object.keys(sources).length > 0) {
    console.log(`\n📍 Source Breakdown:`);
    Object.entries(sources).forEach(([source, count]) => {
      console.log(`   - ${source}: ${count}`);
    });
  }
  
  if (failCount > 0) {
    console.log('\n❌ Failed Commands:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - "${r.command}": ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  if (successCount === results.length && interpretationCount === results.length) {
    console.log('🎉 PERFECT! All tests passed and all prompts are being interpreted!');
  } else if (successCount === results.length) {
    console.log('✅ All tests passed, but some prompts are not using interpretation.');
    console.log('⚠️  Check if promptEnhancementService is configured properly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
  
  console.log('='.repeat(80) + '\n');
}

runTests().catch(console.error);

