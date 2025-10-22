const redis = require('./redis');
const db = require('./database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Queue names
const QUEUES = {
  IMAGE_GENERATION: 'image-generation',
  IMAGE_ENHANCEMENT: 'image-enhancement',
  VLT_ANALYSIS: 'vlt-analysis',
  NIGHTLY_BATCH: 'nightly-batch'
};

/**
 * Add image generation job to queue
 * @param {Object} jobData - Job data
 * @returns {Promise<string>} Job ID
 */
const addImageGenerationJob = async (jobData) => {
  const jobId = uuidv4();
  
  const job = {
    id: jobId,
    type: 'image-generation',
    userId: jobData.userId,
    vltSpecId: jobData.vltSpecId,
    prompt: jobData.prompt,
    quantity: jobData.quantity,
    model: jobData.model || 'imagen',
    priority: jobData.priority || 'normal',
    status: 'queued',
    createdAt: new Date().toISOString()
  };
  
  // Save job to database
  const query = `
    INSERT INTO generation_jobs (id, user_id, vlt_spec_id, status, quantity, model_provider, generation_params)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;
  
  await db.query(query, [
    jobId,
    job.userId,
    job.vltSpecId || null,
    'queued',
    job.quantity,
    job.model,
    JSON.stringify({ prompt: job.prompt, priority: job.priority })
  ]);
  
  // Add to Redis queue
  await redis.addToQueue(QUEUES.IMAGE_GENERATION, job);
  
  // Set initial job status in Redis for quick access
  await redis.setJobStatus(jobId, {
    status: 'queued',
    progress: 0,
    total: job.quantity,
    createdAt: job.createdAt
  });
  
  logger.info('Image generation job added', {
    jobId,
    userId: job.userId,
    quantity: job.quantity,
    model: job.model
  });
  
  return jobId;
};

/**
 * Get next image generation job from queue
 * @param {number} timeout - Timeout in seconds
 * @returns {Promise<Object|null>}
 */
const getNextImageGenerationJob = async (timeout = 30) => {
  return await redis.getFromQueue(QUEUES.IMAGE_GENERATION, timeout);
};

/**
 * Update job status
 * @param {string} jobId - Job ID
 * @param {string} status - New status
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
const updateJobStatus = async (jobId, status, metadata = {}) => {
  // Update in database  
  const updateQuery = `
    UPDATE generation_jobs
    SET status = $1::text,
        started_at = CASE WHEN $1::text = 'processing' THEN CURRENT_TIMESTAMP ELSE started_at END,
        completed_at = CASE WHEN $1::text IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
        error_message = $2::text
    WHERE id = $3::uuid
  `;
  
  await db.query(updateQuery, [
    status,
    metadata.error || null,
    jobId
  ]);
  
  // Update in Redis
  const currentStatus = await redis.getJobStatus(jobId) || {};
  await redis.setJobStatus(jobId, {
    ...currentStatus,
    ...metadata,
    status,
    updatedAt: new Date().toISOString()
  });
  
  logger.info('Job status updated', { jobId, status });
};

/**
 * Update job progress
 * @param {string} jobId - Job ID
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @returns {Promise<void>}
 */
const updateJobProgress = async (jobId, current, total) => {
  const currentStatus = await redis.getJobStatus(jobId) || {};
  await redis.setJobStatus(jobId, {
    ...currentStatus,
    progress: current,
    total,
    percentage: Math.round((current / total) * 100)
  });
};

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>}
 */
const getJobStatus = async (jobId) => {
  // Try Redis first (fast)
  let status = await redis.getJobStatus(jobId);
  
  if (status) {
    return status;
  }
  
  // Fallback to database
  const query = `
    SELECT id, status, quantity, model_provider, started_at, completed_at, error_message
    FROM generation_jobs
    WHERE id = $1
  `;
  
  const result = await db.query(query, [jobId]);
  if (result.rows.length === 0) {
    return null;
  }
  
  const job = result.rows[0];
  return {
    jobId: job.id,
    status: job.status,
    total: job.quantity,
    model: job.model_provider,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    error: job.error_message
  };
};

/**
 * Get queue statistics
 * @returns {Promise<Object>}
 */
const getQueueStats = async () => {
  const stats = {};
  
  for (const [name, queueName] of Object.entries(QUEUES)) {
    stats[name] = {
      length: await redis.getQueueLength(queueName),
      pending: await redis.peekQueue(queueName, 5)
    };
  }
  
  return stats;
};

/**
 * Publish job update via pub/sub
 * @param {string} jobId - Job ID
 * @param {string} userId - User ID
 * @param {Object} update - Update data
 * @returns {Promise<void>}
 */
const publishJobUpdate = async (jobId, userId, update) => {
  await redis.publish(`job:${jobId}`, update);
  await redis.publish(`user:${userId}:jobs`, { jobId, ...update });
  logger.debug('Job update published', { jobId, userId });
};

/**
 * Subscribe to job updates
 * @param {string} jobId - Job ID
 * @param {Function} callback - Update callback
 * @returns {Promise<void>}
 */
const subscribeToJobUpdates = async (jobId, callback) => {
  await redis.subscribe(`job:${jobId}`, callback);
};

/**
 * Subscribe to user job updates
 * @param {string} userId - User ID
 * @param {Function} callback - Update callback
 * @returns {Promise<void>}
 */
const subscribeToUserJobs = async (userId, callback) => {
  await redis.subscribe(`user:${userId}:jobs`, callback);
};

module.exports = {
  QUEUES,
  addImageGenerationJob,
  getNextImageGenerationJob,
  updateJobStatus,
  updateJobProgress,
  getJobStatus,
  getQueueStats,
  publishJobUpdate,
  subscribeToJobUpdates,
  subscribeToUserJobs
};
