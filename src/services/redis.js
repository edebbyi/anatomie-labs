const redis = require('redis');
const logger = require('../utils/logger');

// Create Redis client
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis max reconnection attempts reached');
        return new Error('Max reconnection attempts reached');
      }
      // Exponential backoff: 50ms * 2^retries
      return Math.min(retries * 50, 3000);
    }
  }
});

// Create separate client for pub/sub
const subscriber = client.duplicate();
const publisher = client.duplicate();

// Error handlers
client.on('error', (err) => {
  logger.error('Redis client error', { error: err.message });
});

client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('ready', () => {
  logger.info('Redis client ready');
});

client.on('reconnecting', () => {
  logger.warn('Redis client reconnecting...');
});

subscriber.on('error', (err) => {
  logger.error('Redis subscriber error', { error: err.message });
});

publisher.on('error', (err) => {
  logger.error('Redis publisher error', { error: err.message });
});

/**
 * Connect to Redis
 * @returns {Promise<void>}
 */
const connect = async () => {
  try {
    await client.connect();
    await subscriber.connect();
    await publisher.connect();
    logger.info('All Redis clients connected successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis', { error: error.message });
    throw error;
  }
};

/**
 * Disconnect from Redis
 * @returns {Promise<void>}
 */
const disconnect = async () => {
  try {
    await client.quit();
    await subscriber.quit();
    await publisher.quit();
    logger.info('All Redis clients disconnected');
  } catch (error) {
    logger.error('Error disconnecting from Redis', { error: error.message });
  }
};

/**
 * Test Redis connection
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    const result = await client.ping();
    logger.info('Redis connection test successful', { response: result });
    return true;
  } catch (error) {
    logger.error('Redis connection test failed', { error: error.message });
    return false;
  }
};

// ==================== CACHE OPERATIONS ====================

/**
 * Set cache value
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 * @returns {Promise<void>}
 */
const setCache = async (key, value, ttl = 3600) => {
  try {
    const serialized = JSON.stringify(value);
    await client.setEx(key, ttl, serialized);
    logger.debug('Cache set', { key, ttl });
  } catch (error) {
    logger.error('Failed to set cache', { key, error: error.message });
    throw error;
  }
};

/**
 * Get cache value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>}
 */
const getCache = async (key) => {
  try {
    const value = await client.get(key);
    if (!value) {
      logger.debug('Cache miss', { key });
      return null;
    }
    logger.debug('Cache hit', { key });
    return JSON.parse(value);
  } catch (error) {
    logger.error('Failed to get cache', { key, error: error.message });
    return null;
  }
};

/**
 * Delete cache value
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
const deleteCache = async (key) => {
  try {
    await client.del(key);
    logger.debug('Cache deleted', { key });
  } catch (error) {
    logger.error('Failed to delete cache', { key, error: error.message });
  }
};

/**
 * Delete cache by pattern
 * @param {string} pattern - Key pattern (e.g., 'user:*')
 * @returns {Promise<number>} Number of keys deleted
 */
const deleteCachePattern = async (pattern) => {
  try {
    const keys = await client.keys(pattern);
    if (keys.length === 0) return 0;
    
    await client.del(keys);
    logger.debug('Cache pattern deleted', { pattern, count: keys.length });
    return keys.length;
  } catch (error) {
    logger.error('Failed to delete cache pattern', { pattern, error: error.message });
    return 0;
  }
};

// ==================== SESSION MANAGEMENT ====================

/**
 * Set user session
 * @param {string} userId - User ID
 * @param {Object} sessionData - Session data
 * @param {number} ttl - Time to live in seconds (default: 7 days)
 * @returns {Promise<void>}
 */
const setSession = async (userId, sessionData, ttl = 7 * 24 * 60 * 60) => {
  const key = `session:${userId}`;
  await setCache(key, sessionData, ttl);
};

/**
 * Get user session
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>}
 */
const getSession = async (userId) => {
  const key = `session:${userId}`;
  return await getCache(key);
};

/**
 * Delete user session
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deleteSession = async (userId) => {
  const key = `session:${userId}`;
  await deleteCache(key);
};

// ==================== JOB QUEUE ====================

/**
 * Add job to queue
 * @param {string} queueName - Queue name
 * @param {Object} jobData - Job data
 * @returns {Promise<void>}
 */
const addToQueue = async (queueName, jobData) => {
  try {
    const key = `queue:${queueName}`;
    const serialized = JSON.stringify({
      ...jobData,
      addedAt: new Date().toISOString()
    });
    await client.rPush(key, serialized);
    logger.info('Job added to queue', { queueName, jobId: jobData.id });
  } catch (error) {
    logger.error('Failed to add job to queue', { queueName, error: error.message });
    throw error;
  }
};

/**
 * Get next job from queue
 * @param {string} queueName - Queue name
 * @param {number} timeout - Block timeout in seconds (0 = non-blocking)
 * @returns {Promise<Object|null>}
 */
const getFromQueue = async (queueName, timeout = 0) => {
  try {
    const key = `queue:${queueName}`;
    let result;
    
    if (timeout > 0) {
      // Blocking pop
      result = await client.blPop(key, timeout);
      if (!result) return null;
      return JSON.parse(result.element);
    } else {
      // Non-blocking pop
      result = await client.lPop(key);
      if (!result) return null;
      return JSON.parse(result);
    }
  } catch (error) {
    logger.error('Failed to get job from queue', { queueName, error: error.message });
    return null;
  }
};

/**
 * Get queue length
 * @param {string} queueName - Queue name
 * @returns {Promise<number>}
 */
const getQueueLength = async (queueName) => {
  try {
    const key = `queue:${queueName}`;
    return await client.lLen(key);
  } catch (error) {
    logger.error('Failed to get queue length', { queueName, error: error.message });
    return 0;
  }
};

/**
 * Peek at queue without removing
 * @param {string} queueName - Queue name
 * @param {number} count - Number of items to peek
 * @returns {Promise<Array>}
 */
const peekQueue = async (queueName, count = 10) => {
  try {
    const key = `queue:${queueName}`;
    const items = await client.lRange(key, 0, count - 1);
    return items.map(item => JSON.parse(item));
  } catch (error) {
    logger.error('Failed to peek queue', { queueName, error: error.message });
    return [];
  }
};

// ==================== JOB STATUS TRACKING ====================

/**
 * Set job status
 * @param {string} jobId - Job ID
 * @param {Object} status - Job status data
 * @param {number} ttl - Time to live in seconds (default: 24 hours)
 * @returns {Promise<void>}
 */
const setJobStatus = async (jobId, status, ttl = 24 * 60 * 60) => {
  const key = `job:${jobId}`;
  await setCache(key, status, ttl);
};

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>}
 */
const getJobStatus = async (jobId) => {
  const key = `job:${jobId}`;
  return await getCache(key);
};

// ==================== PUB/SUB ====================

/**
 * Publish message to channel
 * @param {string} channel - Channel name
 * @param {Object} message - Message data
 * @returns {Promise<void>}
 */
const publish = async (channel, message) => {
  try {
    const serialized = JSON.stringify(message);
    await publisher.publish(channel, serialized);
    logger.debug('Message published', { channel });
  } catch (error) {
    logger.error('Failed to publish message', { channel, error: error.message });
  }
};

/**
 * Subscribe to channel
 * @param {string} channel - Channel name
 * @param {Function} callback - Message handler
 * @returns {Promise<void>}
 */
const subscribe = async (channel, callback) => {
  try {
    await subscriber.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message);
        callback(parsed);
      } catch (error) {
        logger.error('Failed to parse subscribed message', { channel, error: error.message });
      }
    });
    logger.info('Subscribed to channel', { channel });
  } catch (error) {
    logger.error('Failed to subscribe to channel', { channel, error: error.message });
  }
};

/**
 * Unsubscribe from channel
 * @param {string} channel - Channel name
 * @returns {Promise<void>}
 */
const unsubscribe = async (channel) => {
  try {
    await subscriber.unsubscribe(channel);
    logger.info('Unsubscribed from channel', { channel });
  } catch (error) {
    logger.error('Failed to unsubscribe from channel', { channel, error: error.message });
  }
};

// ==================== RATE LIMITING ====================

/**
 * Check rate limit
 * @param {string} key - Rate limit key (e.g., 'ratelimit:user:123')
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<Object>} { allowed: boolean, remaining: number, resetAt: number }
 */
const checkRateLimit = async (key, maxRequests, windowSeconds) => {
  try {
    const current = await client.incr(key);
    
    if (current === 1) {
      await client.expire(key, windowSeconds);
    }
    
    const ttl = await client.ttl(key);
    const resetAt = Date.now() + (ttl * 1000);
    
    return {
      allowed: current <= maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetAt
    };
  } catch (error) {
    logger.error('Rate limit check failed', { key, error: error.message });
    // Fail open - allow request if Redis is down
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowSeconds * 1000 };
  }
};

// ==================== STATISTICS ====================

/**
 * Increment counter
 * @param {string} key - Counter key
 * @param {number} amount - Amount to increment (default: 1)
 * @returns {Promise<number>} New value
 */
const incrementCounter = async (key, amount = 1) => {
  try {
    return await client.incrBy(key, amount);
  } catch (error) {
    logger.error('Failed to increment counter', { key, error: error.message });
    return 0;
  }
};

/**
 * Get counter value
 * @param {string} key - Counter key
 * @returns {Promise<number>}
 */
const getCounter = async (key) => {
  try {
    const value = await client.get(key);
    return value ? parseInt(value) : 0;
  } catch (error) {
    logger.error('Failed to get counter', { key, error: error.message });
    return 0;
  }
};

module.exports = {
  client,
  subscriber,
  publisher,
  connect,
  disconnect,
  testConnection,
  // Cache
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  // Sessions
  setSession,
  getSession,
  deleteSession,
  // Queue
  addToQueue,
  getFromQueue,
  getQueueLength,
  peekQueue,
  // Job status
  setJobStatus,
  getJobStatus,
  // Pub/Sub
  publish,
  subscribe,
  unsubscribe,
  // Rate limiting
  checkRateLimit,
  // Statistics
  incrementCounter,
  getCounter
};
