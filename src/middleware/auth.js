const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Authentication middleware for protecting routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authMiddleware = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    // Check if token starts with 'Bearer '
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user info to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    logger.debug('User authenticated', { 
      userId: req.user.id, 
      email: req.user.email 
    });

    next();
  } catch (error) {
    logger.error('Authentication failed', {
      error: error.message,
      token: req.header('Authorization')?.slice(0, 20) + '...'
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  
  if (!authHeader) {
    return next();
  }

  try {
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };
  } catch (error) {
    // Log but don't fail
    logger.debug('Optional auth failed', { error: error.message });
  }

  next();
};

/**
 * Role-based access control middleware
 * @param {Array|string} roles - Required roles
 * @returns {Function} Middleware function
 */
const requireRole = (roles) => {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roleArray.includes(req.user.role)) {
      logger.warn('Access denied - insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roleArray
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        requiredRoles: roleArray
      });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  requireRole
};