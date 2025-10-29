#!/usr/bin/env node

/**
 * Test the voice command bar with various commands
 */

const http = require('http');

const testCommands = [
  'make me 10 outfits',
  'elegant black dress',
  'navy wool blazer with gold buttons',
  'something casual for summer'
];

async function testCommand(command) {
  return new Promise((resolve, reject) => {
    const testData = JSON.stringify({
      userId: null,
      description: command,
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

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing command: "${command}"`);
    console.log('='.repeat(60));

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
            console.log(`   Generated ${parsed.assets?.length || 0} asset(s)`);
            if (parsed.assets && parsed.assets.length > 0) {
              console.log(`   Asset ID: ${parsed.assets[0].id}`);
              console.log(`   Provider: ${parsed.assets[0].provider_id}`);
              console.log(`   File Size: ${(parsed.assets[0].file_size / 1024).toFixed(2)} KB`);
            }
            resolve({ success: true, command, response: parsed });
          } else {
            console.log(`❌ FAILED (${res.statusCode})`);
            console.log(`   Error: ${parsed.error}`);
            resolve({ success: false, command, error: parsed.error });
          }
        } catch (error) {
          console.log(`❌ PARSE ERROR`);
          console.log(`   ${error.message}`);
          resolve({ success: false, command, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ REQUEST FAILED`);
      console.log(`   ${error.message}`);
      resolve({ success: false, command, error: error.message });
    });

    req.write(testData);
    req.end();
  });
}

async function runTests() {
  console.log('\n🎯 VOICE COMMAND BAR TEST SUITE');
  console.log('Testing /api/generate/generate endpoint with various commands\n');

  const results = [];
  
  for (const command of testCommands) {
    const result = await testCommand(command);
    results.push(result);
    
    // Wait a bit between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
  
  if (failCount > 0) {
    console.log('\n❌ Failed Commands:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - "${r.command}": ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (successCount === results.length) {
    console.log('🎉 ALL TESTS PASSED! Voice command bar is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
}

runTests().catch(console.error);

