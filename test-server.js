const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Test the image generation agent directly
async function testImageGenerationAPI() {
  console.log('🧪 Testing image generation API directly...');
  
  try {
    const Replicate = require('replicate');
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });
    
    console.log('✅ Replicate client initialized');
    
    // Test with Stable Diffusion (returns URLs directly)
    const output = await replicate.run(
      "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
      {
        input: {
          prompt: "elegant fashion design, black dress, studio photography",
          num_outputs: 1,
          width: 512,
          height: 512,
          num_inference_steps: 20
        }
      }
    );
    
    console.log('🎉 Image generated successfully!');
    console.log('🔗 URL:', output[0]);
    
    return { success: true, url: output[0] };
    
  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Basic middleware
app.use(express.json());

// Test endpoint
app.get('/test', async (req, res) => {
  console.log('🧪 Testing endpoint called');
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Image generation test endpoint
app.post('/test-generate', async (req, res) => {
  console.log('🎨 Generation test endpoint called');
  
  try {
    const result = await testImageGenerationAPI();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Image generation working!',
        url: result.url
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Image generation failed',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`🌍 Visit http://localhost:${PORT}/test to check`);
  console.log(`🎨 POST to http://localhost:${PORT}/test-generate to test image generation`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test server...');
  process.exit(0);
});