#!/usr/bin/env node
/**
 * Test Imagen-4 Ultra generation directly
 */

require('dotenv').config();
const Replicate = require('replicate');

async function testImagen() {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
  });

  console.log('Testing google/imagen-4-ultra on Replicate...\n');

  const testPrompt = "A minimalist linen dress in cream white, coastal aesthetic, natural lighting";

  try {
    console.log('Sending request...');
    console.log('Prompt:', testPrompt);
    console.log('');

    let output = await replicate.run(
      'google/imagen-4-ultra',
      {
        input: {
          prompt: testPrompt,
          aspect_ratio: '1:1',
          output_format: 'jpg',
          safety_filter_level: 'block_only_high'
        }
      }
    );

    console.log('✅ Raw output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    console.log('Has asyncIterator:', output && typeof output[Symbol.asyncIterator]);

    // If it's an async iterator, consume it
    if (output && typeof output[Symbol.asyncIterator] === 'function') {
      console.log('\n Consuming async iterator...');
      const results = [];
      for await (const item of output) {
        console.log('  - Item type:', typeof item);
        console.log('  - Item:', item);
        results.push(item);
      }
      output = results;
      console.log('\n✅ Iterator consumed, got', results.length, 'results');
    }

    console.log('\n📦 Final output:', output);

    // Try to extract URL
    let imageUrl;
    
    if (output && typeof output.url === 'function') {
      imageUrl = output.url();
      console.log('\n✅ Extracted URL using .url() method');
    } else if (Array.isArray(output) && output.length > 0) {
      if (typeof output[0].url === 'function') {
        imageUrl = output[0].url();
        console.log('\n✅ Extracted URL from array[0].url()');
      } else if (typeof output[0] === 'string') {
        imageUrl = output[0];
        console.log('\n✅ Extracted URL from array[0]');
      } else {
        console.log('\n❌ Array[0] is:', typeof output[0], output[0]);
      }
    } else if (typeof output === 'string') {
      imageUrl = output;
      console.log('\n✅ Output is string URL');
    }

    if (imageUrl) {
      console.log('\n🖼️  Image URL:', imageUrl);
      console.log('\n✅ SUCCESS - Image generated!');
    } else {
      console.log('\n❌ FAILED - Could not extract URL');
    }

  } catch (error) {
    console.log('\n❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.log('\nStack:', error.stack);
    }
  }
}

testImagen();
