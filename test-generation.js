const Replicate = require('replicate');
require('dotenv').config();

async function testImageGeneration() {
  console.log('🧪 Testing Replicate API for image generation...');
  
  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });
    
    console.log('✅ Replicate client initialized');
    console.log('🔑 API Token:', process.env.REPLICATE_API_TOKEN ? 'Present' : 'Missing');
    
    // Test with a simple Stable Diffusion model
    const model = "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4";
    const input = {
      prompt: "a beautiful fashion design, elegant black dress, studio photography",
      num_outputs: 1,
      width: 512,
      height: 512
    };
    
    console.log('🎨 Starting image generation...');
    console.log('📝 Prompt:', input.prompt);
    
    const startTime = Date.now();
    const output = await replicate.run(model, { input });
    const endTime = Date.now();
    
    console.log('✅ Image generation completed!');
    console.log('⏱️  Duration:', (endTime - startTime) / 1000, 'seconds');
    console.log('🖼️  Output:', output);
    console.log('🔗 Generated URL:', output[0]);
    
    return { success: true, url: output[0] };
    
  } catch (error) {
    console.error('❌ Image generation failed:');
    console.error('Error:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.details);
    
    return { success: false, error: error.message };
  }
}

testImageGeneration().then(result => {
  console.log('\n🏁 Test completed');
  process.exit(result.success ? 0 : 1);
});