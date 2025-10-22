const logger = require('../utils/logger');

/**
 * Global error handling middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let code = error.code || 'INTERNAL_ERROR';

  // Log error with context
  logger.logError(error, {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    params: req.params,
    userId: req.user?.id,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Handle specific error types
  switch (error.name) {
    case 'ValidationError':
      statusCode = 400;
      message = 'Validation Error';
      code = 'VALIDATION_ERROR';
      break;
    
    case 'CastError':
      statusCode = 400;
      message = 'Invalid ID format';
      code = 'INVALID_ID';
      break;
    
    case 'JsonWebTokenError':
      statusCode = 401;
      message = 'Invalid token';
      code = 'INVALID_TOKEN';
      break;
    
    case 'TokenExpiredError':
      statusCode = 401;
      message = 'Token expired';
      code = 'TOKEN_EXPIRED';
      break;
    
    case 'MulterError':
      statusCode = 400;
      if (error.code === 'LIMIT_FILE_SIZE') {
        message = 'File too large';
        code = 'FILE_TOO_LARGE';
      } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        message = 'Unexpected field';
        code = 'UNEXPECTED_FILE';
      }
      break;
    
    case 'MongoError':
    case 'MongooseError':
      statusCode = 500;
      message = 'Database error';
      code = 'DATABASE_ERROR';
      break;
    
    case 'AxiosError':
      if (error.response) {
        statusCode = error.response.status;
        message = `External API error: ${error.response.statusText}`;
        code = 'EXTERNAL_API_ERROR';
      } else {
        statusCode = 500;
        message = 'Network error';
        code = 'NETWORK_ERROR';
      }
      break;
  }

  // Custom error handling for specific services
  if (error.message.includes('VLT analysis failed')) {
    statusCode = 502;
    message = 'Image analysis service unavailable';
    code = 'VLT_SERVICE_ERROR';
  }

  if (error.message.includes('Image generation failed')) {
    statusCode = 502;
    message = 'Image generation service unavailable';
    code = 'IMAGE_GENERATION_ERROR';
  }

  if (error.message.includes('Voice recognition failed')) {
    statusCode = 502;
    message = 'Voice recognition service unavailable';
    code = 'VOICE_SERVICE_ERROR';
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    message,
    code,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Include additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = error;
  }

  // Include validation errors if present
  if (error.errors) {
    errorResponse.validationErrors = error.errors;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFound = (req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Rate limit error handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const rateLimitHandler = (req, res) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl
  });

  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  rateLimitHandler
};