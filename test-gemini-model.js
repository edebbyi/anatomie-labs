#!/usr/bin/env node
/**
 * Test if Gemini 2.5 Flash is available on Replicate
 */

require('dotenv').config();
const Replicate = require('replicate');

async function testModel() {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN
  });

  console.log('Testing google/gemini-2.5-flash on Replicate...\n');

  try {
    const output = await replicate.run(
      'google/gemini-2.5-flash',
      {
        input: {
          prompt: 'Say hello',
          max_output_tokens: 100,
          temperature: 0.5
        }
      }
    );

    console.log('✅ Model is available!');
    console.log('Response:', output);
  } catch (error) {
    console.log('❌ Model not available');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testModel();
