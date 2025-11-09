const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// CORS configuration - only one origin to avoid conflicts
const corsOptions = {
  origin: function (origin, callback) {
    // Allow specific origins
    const allowedOrigins = [
      'https://3001-8b0db23c-efc9-4c0b-ba7a-028a4af13021.proxy.daytona.works',
      'https://3001-30c8ca16-abe7-4e7f-9f4d-b2b91828049e.app.super.myninja.ai',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS once
app.use(cors(corsOptions));
app.use(express.json());

// Mock user data for testing
const mockUser = {
  id: 'demo-user-123',
  email: 'demo@anatomie.com',
  name: 'Demo User'
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

// Mock agents API
app.get('/api/agents/style-profile/:userId', (req, res) => {
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
  console.log(`🚀 Fixed demo server running on port ${PORT}`);
  console.log(`🌍 Backend API: http://localhost:${PORT}/api`);
  console.log(`🎨 Frontend: http://localhost:${PORT}/`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log('\n📝 Demo credentials:');
  console.log('   Email: demo@anatomie.com');
  console.log('   Token: Bearer demo-token (any token works)');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down fixed demo server...');
  process.exit(0);
});