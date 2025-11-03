const db = require('../services/database');
const bcrypt = require('bcryptjs');

class User {
  // Cache for column existence check
  static _hasDeletedAtColumn = null;
  
  /**
   * Check if deleted_at column exists (cached)
   * @returns {Promise<boolean>}
   */
  static async _checkDeletedAtColumn() {
    if (this._hasDeletedAtColumn !== null) {
      return this._hasDeletedAtColumn;
    }
    
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'deleted_at'
    `);
    
    this._hasDeletedAtColumn = columnCheck.rows.length > 0;
    return this._hasDeletedAtColumn;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  static async create({ email, password, name }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, role, created_at, is_active
    `;
    
    const result = await db.query(query, [email, hashedPassword, name]);
    return result.rows[0];
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null
   */
  static async findByEmail(email) {
    // Check if deleted_at column exists (cached)
    const hasDeletedAt = await this._checkDeletedAtColumn();
    
    // Build query based on column existence
    const selectColumns = hasDeletedAt 
      ? `id, email, password_hash, name, role, created_at, updated_at, 
         last_login, is_active, email_verified, deleted_at, status`
      : `id, email, password_hash, name, role, created_at, updated_at, 
         last_login, is_active, email_verified`;
    
    const whereClause = hasDeletedAt
      ? `WHERE email = $1 AND is_active = true AND (deleted_at IS NULL OR status != 'deleted')`
      : `WHERE email = $1 AND is_active = true`;
    
    const query = `SELECT ${selectColumns} FROM users ${whereClause}`;
    
    const result = await db.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  static async findById(userId) {
    // Check if deleted_at column exists (cached)
    const hasDeletedAt = await this._checkDeletedAtColumn();
    
    // Build query based on column existence
    const selectColumns = hasDeletedAt 
      ? `id, email, password_hash, name, role, created_at, updated_at, 
         last_login, is_active, email_verified, deleted_at, status`
      : `id, email, password_hash, name, role, created_at, updated_at, 
         last_login, is_active, email_verified`;
    
    const whereClause = hasDeletedAt
      ? `WHERE id = $1 AND is_active = true AND (deleted_at IS NULL OR status != 'deleted')`
      : `WHERE id = $1 AND is_active = true`;
    
    const query = `SELECT ${selectColumns} FROM users ${whereClause}`;
    
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Find user with profile
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User with profile or null
   */
  static async findWithProfile(userId) {
    // Check if deleted_at column exists (cached)
    const hasDeletedAt = await this._checkDeletedAtColumn();
    
    // Build query based on column existence
    const selectColumns = hasDeletedAt
      ? `u.id, u.email, u.name, u.role, u.created_at, u.updated_at, 
         u.last_login, u.is_active, u.email_verified, u.deleted_at, u.status`
      : `u.id, u.email, u.name, u.role, u.created_at, u.updated_at, 
         u.last_login, u.is_active, u.email_verified`;
    
    const whereClause = hasDeletedAt
      ? `WHERE u.id = $1 AND u.is_active = true AND (u.deleted_at IS NULL OR u.status != 'deleted')`
      : `WHERE u.id = $1 AND u.is_active = true`;
    
    const query = `
      SELECT 
        ${selectColumns},
        p.style_preference, p.favorite_colors, p.preferred_fabrics
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ${whereClause}
    `;
    
    const result = await db.query(query, [userId]);
    if (!result.rows[0]) return null;
    
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLogin: user.last_login,
      preferences: {
        style: user.style_preference,
        favoriteColors: user.favorite_colors || [],
        preferredFabrics: user.preferred_fabrics || []
      }
    };
  }

  /**
   * Update user last login
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    await db.query(query, [userId]);
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<Object>} Updated user
   */
  static async updateProfile(userId, { name, preferences }) {
    await db.transaction(async (client) => {
      // Update user name if provided
      if (name) {
        await client.query(
          'UPDATE users SET name = $1 WHERE id = $2',
          [name, userId]
        );
      }
      
      // Update or create user profile
      if (preferences) {
        const profileQuery = `
          INSERT INTO user_profiles (user_id, style_preference, favorite_colors, preferred_fabrics)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id) 
          DO UPDATE SET
            style_preference = COALESCE($2, user_profiles.style_preference),
            favorite_colors = COALESCE($3, user_profiles.favorite_colors),
            preferred_fabrics = COALESCE($4, user_profiles.preferred_fabrics),
            updated_at = CURRENT_TIMESTAMP
        `;
        
        await client.query(profileQuery, [
          userId,
          preferences.style || null,
          JSON.stringify(preferences.favoriteColors || []),
          JSON.stringify(preferences.preferredFabrics || [])
        ]);
      }
    });
    
    return await User.findWithProfile(userId);
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  static async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await db.query(query, [hashedPassword, userId]);
  }

  /**
   * Verify password
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {Promise<boolean>} Password match
   */
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User statistics
   */
  static async getStats(userId) {
    const query = `
      SELECT 
        COUNT(DISTINCT vc.id) as total_commands,
        COUNT(DISTINCT gj.id) as total_jobs,
        COUNT(DISTINCT i.id) as total_images,
        COUNT(DISTINCT CASE WHEN i.is_outlier = true THEN i.id END) as outlier_images,
        COALESCE(SUM(ct.cost), 0) as total_cost_usd
      FROM users u
      LEFT JOIN voice_commands vc ON u.id = vc.user_id
      LEFT JOIN generation_jobs gj ON u.id = gj.user_id
      LEFT JOIN images i ON u.id = i.user_id
      LEFT JOIN cost_tracking ct ON u.id = ct.user_id
      WHERE u.id = $1
      GROUP BY u.id
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows[0] || {
      total_commands: 0,
      total_jobs: 0,
      total_images: 0,
      outlier_images: 0,
      total_cost_usd: 0
    };
  }

  /**
   * Delete user (soft delete)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  static async softDelete(userId) {
    const query = `
      UPDATE users
      SET deleted_at = NOW(), status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await db.query(query, ['deleted', userId]);
  }

  /**
   * Count all users
   * @returns {Promise<number>} Total user count
   */
  static async count() {
    const query = 'SELECT COUNT(*) as count FROM users WHERE is_active = true';
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  }
}

module.exports = User;
