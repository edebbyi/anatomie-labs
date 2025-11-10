console.log('==> Starting server.js...');
console.log('==> Node version:', process.version);
console.log('==> Environment:', process.env.NODE_ENV);
console.log('==> DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('==> About to require modules...');

const express = require('express');
console.log('✓ express loaded');
const cors = require('cors');
console.log('✓ cors loaded');
const helmet = require('helmet');
console.log('✓ helmet loaded');
const rateLimit = require('express-rate-limit');
console.log('✓ rateLimit loaded');
const path = require('path');
console.log('✓ path loaded');
const fs = require('fs');
console.log('✓ fs loaded');
const http = require('http');
console.log('✓ http loaded');
const socketIo = require('socket.io');
console.log('✓ socketIo loaded');
require('dotenv').config();
console.log('✓ dotenv loaded');

// Create logs directory if it doesn't exist
console.log('==> Creating logs directory...');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✓ logs directory created');
} else {
  console.log('✓ logs directory exists');
}

// Import middleware and routes
console.log('==> Loading authMiddleware...');
const { authMiddleware } = require('./src/middleware/auth');
console.log('✓ authMiddleware loaded');

console.log('==> Loading errorHandler...');
const { errorHandler } = require('./src/middleware/errorHandler');
console.log('✓ errorHandler loaded');

console.log('==> Loading logger...');
const logger = require('./src/utils/logger');
console.log('✓ logger loaded');

console.log('==> Loading database service...');
const db = require('./src/services/database');
console.log('✓ database service loaded');

console.log('==> Loading redis service...');
const redis = require('./src/services/redis');
console.log('✓ redis service loaded');

console.log('==> Loading r2Storage service...');
const r2Storage = require('./src/services/r2Storage');
console.log('✓ r2Storage service loaded');

console.log('==> Loading archiveCleanupService...');
const archiveCleanupService = require('./src/services/archiveCleanupService');
console.log('✓ archiveCleanupService loaded');

// Import API routes
console.log('==> Loading authRoutes...');
const authRoutes = require('./src/api/routes/auth');
console.log('✓ authRoutes loaded');

console.log('==> Loading voiceRoutes...');
const voiceRoutes = require('./src/api/routes/voice');
console.log('✓ voiceRoutes loaded');

console.log('==> Loading imageRoutes...');
const imageRoutes = require('./src/api/routes/images');
console.log('✓ imageRoutes loaded');

console.log('==> Loading feedbackRoutes...');
const feedbackRoutes = require('./src/api/routes/feedback');
console.log('✓ feedbackRoutes loaded');

console.log('==> Loading analyticsRoutes...');
const analyticsRoutes = require('./src/api/routes/analytics');
console.log('✓ analyticsRoutes loaded');

console.log('==> Loading vltRoutes...');
const vltRoutes = require('./src/api/routes/vlt');
console.log('✓ vltRoutes loaded');

console.log('==> Loading personaRoutes...');
const personaRoutes = require('./src/api/routes/persona');
console.log('✓ personaRoutes loaded');

console.log('==> Loading generationRoutes...');
const generationRoutes = require('./src/routes/generation');
console.log('✓ generationRoutes loaded');

console.log('==> Loading rlhfRoutes...');
const rlhfRoutes = require('./src/api/routes/rlhf');
console.log('✓ rlhfRoutes loaded');

console.log('==> Loading styleClusteringRoutes...');
const styleClusteringRoutes = require('./src/routes/styleClusteringRoutes');
console.log('✓ styleClusteringRoutes loaded');

console.log('==> Loading agentsRoutes...');
const agentsRoutes = require('./src/api/routes/agents');
console.log('✓ agentsRoutes loaded');

console.log('==> Loading podnaRoutes...');
const podnaRoutes = require('./src/api/routes/podna');
console.log('✓ podnaRoutes loaded');

console.log('==> Loading podsRoutes...');
const podsRoutes = require('./src/api/routes/pods');
console.log('✓ podsRoutes loaded');

console.log('==> Loading modelGenderRoutes...');
const modelGenderRoutes = require('./src/api/routes/modelGenderRoutes');
console.log('✓ modelGenderRoutes loaded');

console.log('==> All modules loaded successfully!');

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

// Serve static files (prefer the new Vite build but keep legacy assets)
const frontendBuildPath = path.join(__dirname, 'frontend', 'build');
const legacyPublicPath = path.join(__dirname, 'public');
const staticRoots = [
  frontendBuildPath,
  legacyPublicPath,
].filter((dir) => fs.existsSync(dir));

staticRoots.forEach((dir) => {
  app.use(express.static(dir));
});

const uploadsDir = path.join(legacyPublicPath, 'uploads');
if (fs.existsSync(uploadsDir)) {
  app.use('/uploads', express.static(uploadsDir));
}

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
app.use('/api/pods', authMiddleware, podsRoutes); // User pods (collections)
app.use('/api/model-gender', authMiddleware, modelGenderRoutes); // Model gender preference management

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

// Catch-all handler for React router (prefer new build index)
const candidateIndexFiles = [
  path.join(frontendBuildPath, 'index.html'),
  path.join(legacyPublicPath, 'index.html'),
];

app.get('*', (req, res) => {
  // Don't serve HTML for API routes - return 404 JSON instead
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  for (const indexPath of candidateIndexFiles) {
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }

  res.status(404).send('Frontend build not found');
});

const PORT = process.env.PORT || 3001;

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('==> Starting server initialization...');
    
    // Test database connection
    console.log('==> Testing database connection...');
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      if (process.env.NODE_ENV === 'development' || process.env.SKIP_SERVICE_CHECKS === '1') {
        logger.warn('Database connection failed, but continuing because NODE_ENV=development or SKIP_SERVICE_CHECKS=1');
      } else {
        logger.error('Failed to connect to database. Exiting...');
        process.exit(1);
      }
    }
    console.log('✓ Database connection tested');

    // Connect to Redis
    console.log('==> Connecting to Redis...');
    await redis.connect();
    const redisConnected = await redis.testConnection();
    if (!redisConnected) {
      logger.warn('Redis connection failed. Continuing without cache...');
    }
    console.log('✓ Redis connection tested');

    // Test R2 storage connection
    console.log('==> Testing R2 storage...');
    const r2Configured = r2Storage.isConfigured();
    let r2Connected = false;
    if (r2Configured) {
      r2Connected = await r2Storage.testConnection();
    } else {
      logger.warn('R2 storage not configured. Image upload will be unavailable.');
    }
    console.log('✓ R2 storage tested');

    // Start server
    logger.info(`About to start server on port ${PORT}...`);
    
    // Schedule archive cleanup job - runs daily at 2:00 AM
    const scheduleArchiveCleanup = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(2, 0, 0, 0);
      
      // If it's already past 2:00 AM today, schedule for tomorrow
      if (now > target) {
        target.setDate(target.getDate() + 1);
      }
      
      const delay = target.getTime() - now.getTime();
      
      logger.info('Archive Cleanup Scheduler initialized', {
        nextRunAt: target.toISOString(),
        delayMs: delay,
        delayHours: (delay / (1000 * 60 * 60)).toFixed(2)
      });
      
      // Run immediately on startup with small delay to allow services to stabilize
      setTimeout(async () => {
        try {
          logger.info('Archive Cleanup: Running scheduled cleanup (startup)');
          const result = await archiveCleanupService.cleanupExpiredArchives();
          logger.info('Archive Cleanup: Scheduled cleanup completed', { result });
        } catch (error) {
          logger.error('Archive Cleanup: Scheduled cleanup failed', { error: error.message });
        }
        
        // Schedule for daily execution after initial run
        setInterval(async () => {
          try {
            logger.info('Archive Cleanup: Running scheduled cleanup (daily)');
            const result = await archiveCleanupService.cleanupExpiredArchives();
            logger.info('Archive Cleanup: Daily cleanup completed', { result });
          } catch (error) {
            logger.error('Archive Cleanup: Daily cleanup failed', { error: error.message });
          }
        }, 24 * 60 * 60 * 1000); // Every 24 hours
      }, 5000); // Wait 5 seconds for services to stabilize
    };
    
    // Initialize cleanup scheduler
    scheduleArchiveCleanup();
    
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

    console.log('==> About to listen on port', PORT);
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
    console.error('FATAL ERROR in startServer:', error);
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
