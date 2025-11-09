const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware - Fix CORS configuration
app.use(cors({
  origin: [
    'https://3001-8b0db23c-efc9-4c0b-ba7a-028a4af13021.proxy.daytona.works',
    'https://3001-30c8ca16-abe7-4e7f-9f4d-b2b91828049e.app.super.myninja.ai',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Mock user data for testing
const mockUser = {
  id: 'demo-user-123',
  email: 'demo@anatomie.com',
  name: 'Demo User'
};

// Mock authentication
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Always allow for demo - set mock user
  req.user = mockUser;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret');
      console.log('✅ Authenticated user:', decoded.email);
    } catch (error) {
      console.log('⚠️ Invalid token, but allowing for demo');
    }
  } else {
    console.log('⚠️ No token provided, allowing for demo');
  }
  
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mock auth routes
app.post('/api/auth/login', (req, res) => {
  const token = jwt.sign(mockUser, process.env.JWT_SECRET || 'demo-secret');
  res.json({
    success: true,
    data: { user: mockUser, token }
  });
});

// Import the fixed image generation agent
const imageGenerationAgent = require('./src/services/imageGenerationAgent');

// Mock database queries
const mockDb = {
  query: async (sql, params) => {
    console.log('🗄️ Mock DB Query:', sql);
    
    if (sql.includes('INSERT INTO generations')) {
      return {
        rows: [{
          id: 'gen-' + Date.now(),
          url: 'https://pub-729882d04124e4fac23a81ccc54f11fa.r2.dev/generated-' + Date.now() + '.png',
          created_at: new Date().toISOString()
        }]
      };
    }
    
    if (sql.includes('SELECT.*prompts')) {
      return {
        rows: [{
          id: 'prompt-' + Date.now(),
          positive_prompt: 'elegant fashion design',
          json_spec: { test: true }
        }]
      };
    }
    
    if (sql.includes('SELECT.*profiles') || sql.includes('style')) {
      return {
        rows: [{
          id: 'profile-' + Date.now(),
          summary_text: 'Mock style profile for testing',
          style_labels: ['elegant', 'modern'],
          clusters: [],
          aesthetic_themes: [{ name: 'contemporary', score: 0.8 }]
        }]
      };
    }
    
    return { rows: [] };
  }
};

// Override database temporarily
require('./src/services/database').query = mockDb.query;
require('./src/services/r2Storage').uploadImage = async (buffer, options) => {
  console.log('☁️ Mock R2 Upload:', {
    sizeKB: (buffer.length / 1024).toFixed(2),
    options
  });
  return {
    url: 'https://pub-729882d04124e4fac23a81ccc54f11fa.r2.dev/demo-generated-' + Date.now() + '.png'
  };
};

// Fix authentication for podna routes by ensuring req.user is properly set
app.use('/api/podna', authMiddleware, (req, res, next) => {
  // Ensure req.user exists for the podna routes
  if (!req.user) {
    req.user = mockUser;
  }
  next();
});

// Podna routes with authentication
// Simple test endpoint for image generation
app.post('/api/test/generate', async (req, res) => {
  console.log('🎨 Test generation endpoint called');
  
  try {
    const { prompt, count = 1 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }
    
    console.log('🎨 Starting image generation with prompt:', prompt);
    
    // Create a mock prompt
    const mockPrompt = {
      id: 'prompt-' + Date.now(),
      positive_prompt: prompt,
      json_spec: { test: true }
    };
    
    // Override database query for this test
    require('./src/services/database').query = async (sql, params) => {
      if (sql.includes('prompts') && sql.includes('WHERE')) {
        return {
          rows: [mockPrompt]
        };
      }
      
      if (sql.includes('INSERT INTO generations')) {
        return {
          rows: [{
            id: 'gen-' + Date.now(),
            url: 'https://pub-729882d04124e4fac23a81ccc54f11fa.r2.dev/test-generated-' + Date.now() + '.png',
            created_at: new Date().toISOString()
          }]
        };
      }
      
      return { rows: [] };
    };
    
    // Generate image
    const result = await imageGenerationAgent.generateImage('demo-user-123', mockPrompt.id, {
      provider: 'imagen-4-ultra',
      upscale: false
    });
    
    console.log('✅ Image generation completed:', result.url);
    
    res.json({
      success: true,
      message: 'Image generated successfully',
      data: {
        generations: [{
          id: result.id,
          url: result.url,
          prompt: prompt,
          createdAt: result.created_at
        }]
      }
    });
    
  } catch (error) {
    console.error('❌ Test generation failed:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      code: 'GENERATION_ERROR'
    });
  }
});

const podnaRoutes = require('./src/api/routes/podna');
app.use('/api/podna', podnaRoutes);

// Mock agents API
app.get('/api/agents/style-profile/:userId', authMiddleware, (req, res) => {
  res.json({
    success: true,
    profile_data: {
      brandDNA: {
        primaryAesthetic: 'contemporary',
        signatureColors: [{ name: 'black', hex: '#000000' }],
        signatureFabrics: [{ name: 'silk' }],
        signatureConstruction: [{ detail: 'structured shoulders' }]
      },
      aesthetic_themes: [{ name: 'elegant minimalism', score: 0.9 }]
    }
  });
});

// Serve static files from frontend build
app.use(express.static('frontend/build'));
app.use(express.static('frontend/public'));

// Catch-all handler for React app
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'frontend/build' });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Demo server running on port ${PORT}`);
  console.log(`🌍 Backend API: http://localhost:${PORT}/api`);
  console.log(`🎨 Frontend: http://localhost:${PORT}/`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log('\n📝 Demo credentials:');
  console.log('   Email: demo@anatomie.com');
  console.log('   Token: Bearer demo-token (any token works)');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down demo server...');
  process.exit(0);
});