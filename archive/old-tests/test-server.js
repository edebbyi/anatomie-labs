const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import only basic services
const logger = require('./src/utils/logger');
const db = require('./src/services/database');
const redis = require('./src/services/redis');

// Import agents service
const agentService = require('./src/services/agentService');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());

// Test routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Designer BFF - Minimal Test Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  const services = {
    database: await db.testConnection().catch(() => false),
    redis: await redis.testConnection().catch(() => false),
    agents: await agentService.healthCheck().then(r => r.status === 'healthy').catch(() => false)
  };
  
  res.json({
    status: 'healthy',
    services,
    timestamp: new Date().toISOString()
  });
});

// Agents health check route
app.get('/api/agents/health', async (req, res) => {
  try {
    const agentHealth = await agentService.healthCheck();
    res.json({
      success: true,
      data: agentHealth
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
const startServer = async () => {
  try {
    logger.info('Starting minimal test server...');
    
    // Test basic connections
    const dbConnected = await db.testConnection();
    logger.info(`Database: ${dbConnected ? 'Connected' : 'Failed'}`);
    
    await redis.connect();
    const redisConnected = await redis.testConnection();
    logger.info(`Redis: ${redisConnected ? 'Connected' : 'Failed'}`);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Test Server running on port ${PORT}`);
      logger.info(`🧪 Test endpoints:`);
      logger.info(`   - GET http://localhost:${PORT}/`);
      logger.info(`   - GET http://localhost:${PORT}/health`);
      logger.info(`   - GET http://localhost:${PORT}/api/agents/health`);
    });
  } catch (error) {
    logger.error('Failed to start test server', { error: error.message });
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});