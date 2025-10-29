const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import middleware and routes
const { authMiddleware } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');
const db = require('./src/services/database');
const redis = require('./src/services/redis');
const r2Storage = require('./src/services/r2Storage');

// Import API routes
const authRoutes = require('./src/api/routes/auth');
const voiceRoutes = require('./src/api/routes/voice');
const imageRoutes = require('./src/api/routes/images');
const feedbackRoutes = require('./src/api/routes/feedback');
const analyticsRoutes = require('./src/api/routes/analytics');
const vltRoutes = require('./src/api/routes/vlt');
// const promptRoutes = require('./src/api/routes/prompt');
const personaRoutes = require('./src/api/routes/persona');
const generationRoutes = require('./src/routes/generation');
const rlhfRoutes = require('./src/api/routes/rlhf');
const styleClusteringRoutes = require('./src/routes/styleClusteringRoutes');
const agentsRoutes = require('./src/api/routes/agents');
const podnaRoutes = require('./src/api/routes/podna');

// CORS configuration - Allow multiple frontend ports
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "http://localhost:3001", // Alt frontend port
  "http://localhost:3002", // Alt frontend port  
  "http://localhost:3003", // Alt frontend port
];

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "wss:", "ws:", process.env.VLT_API_URL]
    }
  }
}));

// Rate limiting - more permissive for onboarding flows
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 for onboarding polling
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for progress checks and profile fetches
    return req.path.includes('/progress') || req.path.includes('/profile');
  }
});
app.use(limiter);

// CORS middleware with preflight handling
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const msg = `CORS Error: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`;
    return callback(new Error(msg), false);
  },
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Handle preflight requests for all routes
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/auth', authRoutes);
// Publicly expose suggestions so the frontend voice bar can fetch suggestions
// without requiring a token. The handler supports an optional query param
// `userId` to return personalized suggestions for debugging / demo.
if (voiceRoutes && voiceRoutes.suggestionsHandler) {
  app.get('/api/voice/suggestions', voiceRoutes.suggestionsHandler);
}

app.use('/api/voice', authMiddleware, voiceRoutes);
app.use('/api/images', authMiddleware, imageRoutes);
app.use('/api/feedback', authMiddleware, feedbackRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/vlt', vltRoutes); // No auth required for onboarding
// app.use('/api/prompt', authMiddleware, promptRoutes);
app.use('/api/persona', personaRoutes); // Persona routes (profile endpoint public, others need auth)
app.use('/api/generate', generationRoutes);
app.use('/api/rlhf', rlhfRoutes); // RLHF feedback and weight management
app.use('/api/style-clustering', styleClusteringRoutes); // Style clustering and Pinecone integration
app.use('/api/agents', agentsRoutes); // AI Agents multi-agent system
app.use('/api/podna', podnaRoutes); // Podna simplified agent system

// Health check endpoint
app.get('/health', async (req, res) => {
  // const pineconeService = require('./src/services/pineconeService');
  
  const services = {
    database: await db.testConnection(),
    redis: await redis.testConnection(),
    r2Storage: r2Storage.isConfigured() && await r2Storage.testConnection(),
    pinecone: false // Temporarily disabled
  };
  
  const allHealthy = Object.values(services).every(s => s);
  
  res.status(allHealthy ? 200 : 503).json({ 
    status: allHealthy ? 'healthy' : 'degraded', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services,
    stages: {
      completed: [1, 2, 3, 4, 5, 6],
      remaining: [7, 8, 9, 10, 11]
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);
  
  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
    logger.info(`User ${userId} joined room: user-${userId}`);
  });

  socket.on('voice-command', (data) => {
    // Handle real-time voice command processing
    socket.emit('voice-command-received', { status: 'processing', data });
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Store io instance for use in other modules
app.set('io', io);

// Error handling middleware (must be last)
app.use(errorHandler);

// Catch-all handler for React router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      // In development it's helpful to allow the server to start even if
      // the database isn't available (so frontend work and static hosting
      // can continue). To override the exit behavior set NODE_ENV=development
      // or set SKIP_SERVICE_CHECKS=1 in your environment.
      if (process.env.NODE_ENV === 'development' || process.env.SKIP_SERVICE_CHECKS === '1') {
        logger.warn('Database connection failed, but continuing because NODE_ENV=development or SKIP_SERVICE_CHECKS=1');
      } else {
        logger.error('Failed to connect to database. Exiting...');
        process.exit(1);
      }
    }

    // Connect to Redis
    await redis.connect();
    const redisConnected = await redis.testConnection();
    if (!redisConnected) {
      logger.warn('Redis connection failed. Continuing without cache...');
    }

    // Test R2 storage connection
    const r2Configured = r2Storage.isConfigured();
    let r2Connected = false;
    if (r2Configured) {
      r2Connected = await r2Storage.testConnection();
    } else {
      logger.warn('R2 storage not configured. Image upload will be unavailable.');
    }

    // Start server
    logger.info(`About to start server on port ${PORT}...`);
    
    // Handle specific server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please kill the process or use a different port.`);
        process.exit(1);
      } else {
        logger.error('Server error', { error: error.message });
        throw error;
      }
    });

    server.listen(PORT, () => {
      logger.info(`🚀 Designer BFF Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📊 Database: Connected to ${process.env.DB_NAME}`);
      logger.info(`🔴 Redis: ${redisConnected ? 'Connected' : 'Unavailable (degraded mode)'}`);
      logger.info(`☁️ R2 Storage: ${r2Connected ? 'Connected' : r2Configured ? 'Connection failed' : 'Not configured'}`);
      logger.info(`📡 VLT API: ${process.env.VLT_API_URL || 'Not configured'}`);
      logger.info(`💾 DB Pool: ${JSON.stringify(db.getPoolStats())}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  // Close server
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Close Redis connections
    await redis.disconnect();
    
    // Close database connections
    await db.closePool();
    
    logger.info('All connections closed. Process terminated.');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, io };