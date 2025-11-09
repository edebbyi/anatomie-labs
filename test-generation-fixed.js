const Replicate = require('replicate');
require('dotenv').config();

async function testImageGenerationFixed() {
  console.log('🧪 Testing Replicate API with proper stream handling...');
  
  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });
    
    console.log('✅ Replicate client initialized');
    
    // Test with a Stable Diffusion model that returns URLs
    const model = "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4";
    const input = {
      prompt: "a beautiful fashion design, elegant black dress, studio photography, high fashion",
      num_outputs: 1,
      width: 512,
      height: 512,
      num_inference_steps: 20
    };
    
    console.log('🎨 Starting image generation...');
    console.log('📝 Model:', model);
    console.log('📝 Prompt:', input.prompt);
    
    const startTime = Date.now();
    let output = await replicate.run(model, { input });
    const endTime = Date.now();
    
    console.log('✅ Raw generation completed!');
    console.log('⏱️  Duration:', (endTime - startTime) / 1000, 'seconds');
    console.log('🔍 Raw output type:', typeof output);
    console.log('🔍 Is array:', Array.isArray(output));
    console.log('🔍 Output:', output);
    
    // Handle async iterator/ReadableStream
    if (output && typeof output[Symbol.asyncIterator] === 'function') {
      console.log('🔄 Consuming async iterator from Replicate...');
      const results = [];
      for await (const item of output) {
        results.push(item);
        console.log('📦 Got item:', typeof item, item);
      }
      output = results;
      console.log('✅ Async iterator consumed, result count:', results.length);
    }
    
    // Check final output
    if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      console.log('🏁 Final output type:', typeof firstItem);
      
      if (typeof firstItem === 'string') {
        console.log('🔗 Generated Image URL:', firstItem);
        return { success: true, url: firstItem };
      } else {
        console.log('❌ Unexpected output item type:', typeof firstItem);
        console.log('📦 Item:', firstItem);
        return { success: false, error: 'Unexpected output type: ' + typeof firstItem };
      }
    } else {
      console.log('❌ No output received');
      return { success: false, error: 'No output received' };
    }
    
  } catch (error) {
    console.error('❌ Image generation failed:');
    console.error('Error:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.details);
    
    return { success: false, error: error.message };
  }
}

testImageGenerationFixed().then(result => {
  console.log('\n🏁 Test completed with result:', result);
  process.exit(result.success ? 0 : 1);
});