const Replicate = require('replicate');
require('dotenv').config();

// Mock the database and storage for testing
const mockDb = {
  query: async (sql, params) => {
    console.log('🗄️  Mock DB Query:', sql);
    console.log('📝 Params:', params);
    
    if (sql.includes('INSERT INTO generations')) {
      return {
        rows: [{
          id: 'gen-' + Date.now(),
          url: 'https://mock-url.com/generated.png',
          created_at: new Date().toISOString()
        }]
      };
    }
    
    if (sql.includes('SELECT')) {
      return {
        rows: [{
          id: 'prompt-' + Date.now(),
          positive_prompt: params[0] || 'a beautiful fashion design',
          json_spec: { test: true }
        }]
      };
    }
    
    return { rows: [] };
  }
};

const mockR2Storage = {
  uploadImage: async (buffer, options) => {
    console.log('☁️  Mock R2 Upload:', {
      sizeKB: (buffer.length / 1024).toFixed(2),
      options
    });
    return {
      url: 'https://pub-729882d04124e4fac23a81ccc54f11fa.r2.dev/generated-' + Date.now() + '.png'
    };
  }
};

// Mock logger
const mockLogger = {
  info: (msg, data) => console.log('ℹ️ ', msg, data || ''),
  error: (msg, data) => console.log('❌', msg, data || ''),
  warn: (msg, data) => console.log('⚠️ ', msg, data || ''),
  debug: (msg, data) => console.log('🐛', msg, data || '')
};

// Test the complete generation flow
async function testCompleteGeneration() {
  console.log('🧪 Testing complete image generation flow...');
  
  try {
    // Replace imports with mocks
    const originalDb = require('./src/services/database');
    const originalR2 = require('./src/services/r2Storage');
    const originalLogger = require('./src/utils/logger');
    
    // Temporarily replace with mocks
    require('./src/services/database').query = mockDb.query;
    require('./src/services/r2Storage').uploadImage = mockR2Storage.uploadImage;
    require('./src/utils/logger').info = mockLogger.info;
    require('./src/utils/logger').error = mockLogger.error;
    require('./src/utils/logger').warn = mockLogger.warn;
    require('./src/utils/logger').debug = mockLogger.debug;
    
    // Import and test the agent
    const imageGenerationAgent = require('./src/services/imageGenerationAgent');
    
    console.log('✅ Image Generation Agent loaded');
    
    // Test generation
    const userId = 'test-user-123';
    const promptId = 'test-prompt-456';
    
    console.log('🎨 Starting image generation test...');
    
    const result = await imageGenerationAgent.generateImage(userId, promptId, {
      provider: 'imagen-4-ultra',
      upscale: false
    });
    
    console.log('🎉 Generation completed successfully!');
    console.log('📊 Result:', {
      id: result.id,
      url: result.url,
      provider: result.provider,
      cost: result.cost_cents
    });
    
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ Complete generation test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return { success: false, error: error.message };
  }
}

testCompleteGeneration().then(result => {
  console.log('\n🏁 Test completed:', result);
  process.exit(result.success ? 0 : 1);
});