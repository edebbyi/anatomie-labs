const db = require('../services/database');

class UserPreferences {
  static async getPreferences(userId) {
    const query = `
      SELECT preferences
      FROM user_preferences
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0]?.preferences || {};
  }

  static async updatePreferences(userId, patch) {
    // First check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const query = `
      INSERT INTO user_preferences (user_id, preferences)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (user_id) DO UPDATE
      SET preferences = COALESCE(user_preferences.preferences, '{}'::jsonb) || EXCLUDED.preferences,
          updated_at = CURRENT_TIMESTAMP
      RETURNING preferences
    `;

    const result = await db.query(query, [userId, JSON.stringify(patch)]);
    return result.rows[0]?.preferences || {};
  }

  static async markPodsIntroSeen(userId, { dismissed = false } = {}) {
    const timestamp = new Date().toISOString();

    const patch = {
      has_seen_pods_intro: true,
      pods_intro_seen_at: timestamp,
      pods: {
        hasSeenIntro: true,
        introSeenAt: timestamp,
        dismissedViaSkip: dismissed
      }
    };

    return await this.updatePreferences(userId, patch);
  }
}

module.exports = UserPreferences;
