const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../../middleware/errorHandler');
const { authMiddleware } = require('../../middleware/auth');
const logger = require('../../utils/logger');
const User = require('../../models/User');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 1 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password, name } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists'
    });
  }

  // Create user
  const user = await User.create({ email, password, name });

  // Generate JWT token
  const token = jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE_TIME || '7d' }
  );

  logger.info('User registered successfully', {
    userId: user.id,
    email: user.email
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingComplete: false,
        preferences: {
          style: null,
          favoriteColors: [],
          preferredFabrics: []
        }
      },
      token
    }
  });
}));

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Find user
  const user = await User.findByEmail(email);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check password
  const isPasswordValid = await User.verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    logger.warn('Failed login attempt', { email });
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Update last login
  await User.updateLastLogin(user.id);
  
  // Get user with profile
  const userWithProfile = await User.findWithProfile(user.id);

  // Generate JWT token
  const token = jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE_TIME || '7d' }
  );

  logger.info('User logged in successfully', {
    userId: user.id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: userWithProfile.id,
        email: userWithProfile.email,
        name: userWithProfile.name,
        role: userWithProfile.role,
        preferences: userWithProfile.preferences,
        lastLogin: userWithProfile.lastLogin,
        onboardingComplete: userWithProfile.onboardingComplete
      },
      token
    }
  });
}));

/**
 * GET /api/auth/profile
 * Get user profile
 */
router.get('/profile', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findWithProfile(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
        preferences: user.preferences,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    }
  });
}));

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authMiddleware, [
  body('name').optional().trim().isLength({ min: 1 }),
  body('preferences.style').optional().isString(),
  body('preferences.favoriteColors').optional().isArray(),
  body('preferences.preferredFabrics').optional().isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Update user data
  const { name, preferences } = req.body;
  
  const user = await User.updateProfile(req.user.id, { name, preferences });

  logger.info('User profile updated', {
    userId: user.id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferences: user.preferences,
        updatedAt: user.updatedAt
      }
    }
  });
}));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authMiddleware, [
  body('currentPassword').exists(),
  body('newPassword').isLength({ min: 6 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;
  const user = await User.findByEmail(req.user.email);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await User.verifyPassword(currentPassword, user.password_hash);
  if (!isCurrentPasswordValid) {
    return res.status(400).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  await User.updatePassword(user.id, newPassword);

  logger.info('User password changed', {
    userId: user.id,
    email: user.email
  });

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * POST /api/auth/refresh-token
 * Refresh JWT token
 */
router.post('/refresh-token', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Generate new JWT token
  const token = jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE_TIME || '7d' }
  );

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: { token }
  });
}));

/**
 * GET /api/auth/stats
 * Get user stats
 */
router.get('/stats', authMiddleware, asyncHandler(async (req, res) => {
  const totalUsers = await User.count();
  const userStats = await User.getStats(req.user.id);
  
  const stats = {
    totalUsers,
    userCommands: userStats.total_commands,
    userJobs: userStats.total_jobs,
    userImages: userStats.total_images,
    userOutliers: userStats.outlier_images,
    userCostUsd: parseFloat(userStats.total_cost_usd || 0)
  };

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * DELETE /api/auth/users/me
 * Soft-delete current user's account and schedule permanent deletion
 */
router.delete('/users/me', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Mark account for deletion (soft delete)
    await db.query(
      'UPDATE users SET deleted_at = NOW(), status = $1 WHERE id = $2',
      ['deleted', userId]
    );
    
    // Schedule actual deletion for 30 days later (implement with cron job separately)
    
    // Clear user session
    res.json({ 
      success: true, 
      message: 'Account scheduled for deletion' 
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}));

module.exports = router;
