#!/usr/bin/env node

/**
 * Image Generation Worker
 * Processes image generation jobs from Redis queue
 * Run this as a separate process: node src/workers/imageGenerationWorker.js
 */

require('dotenv').config();
const logger = require('../utils/logger');
const db = require('../services/database');
const redis = require('../services/redis');
const imageGeneration = require('../services/imageGeneration');

// Handle graceful shutdown
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received. Shutting down worker gracefully...`);
  
  try {
    // Close Redis connections
    await redis.disconnect();
    
    // Close database connections
    await db.closePool();
    
    logger.info('Worker shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during worker shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Main worker function
const main = async () => {
  try {
    logger.info('🤖 Image Generation Worker starting...');

    // Connect to database
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }
    logger.info('✅ Database connected');

    // Connect to Redis
    await redis.connect();
    const redisConnected = await redis.testConnection();
    if (!redisConnected) {
      logger.error('Failed to connect to Redis');
      process.exit(1);
    }
    logger.info('✅ Redis connected');

    // Test Replicate connection
    const replicateConnected = await imageGeneration.testConnection();
    if (!replicateConnected) {
      logger.error('Failed to connect to Replicate. Check REPLICATE_API_TOKEN');
      process.exit(1);
    }
    logger.info('✅ Replicate connected');

    logger.info('🚀 Worker ready! Waiting for jobs...');

    // Start processing jobs (this will run indefinitely)
    await imageGeneration.startWorker();

  } catch (error) {
    logger.error('Worker startup failed', { error: error.message });
    process.exit(1);
  }
};

// Start the worker
main().catch((error) => {
  logger.error('Fatal worker error', { error: error.message });
  process.exit(1);
});
