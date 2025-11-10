const db = require('./database');
const logger = require('../utils/logger');

const DEFAULT_MODEL_GENDER_PREFERENCE = Object.freeze({
  setting: 'auto',
  detected_gender: null,
  confidence: 0,
  manual_override: false,
  last_updated: null,
  alternation_counter: 0,
  model_count: Object.freeze({
    female: 0,
    male: 0,
    neutral: 0
  })
});

const DEFAULT_MODEL_GENDER_PREFERENCE_JSON = JSON.stringify(
  DEFAULT_MODEL_GENDER_PREFERENCE
);

const createDefaultModelGenderPreference = () => ({
  ...DEFAULT_MODEL_GENDER_PREFERENCE,
  model_count: { ...DEFAULT_MODEL_GENDER_PREFERENCE.model_count }
});

/**
 * Model Gender Detection Service
 * Manages model gender preferences for generation and detection of gender distribution in portfolios
 */
class ModelGenderDetectionService {
  constructor() {
    this.schemaReady = false;
    this.schemaPromise = null;
  }

  async ensureModelGenderPreferenceSupport() {
    if (this.schemaReady) {
      return;
    }

    if (!this.schemaPromise) {
      this.schemaPromise = (async () => {
        const columnCheck = await db.query(
          `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'user_style_profiles'
               AND column_name = 'model_gender_preference'
             LIMIT 1`
        );

        if (columnCheck.rowCount === 0) {
          logger.warn(
            'model_gender_preference column missing on user_style_profiles. Creating it automatically.'
          );

          await db.query(
            `ALTER TABLE user_style_profiles
               ADD COLUMN IF NOT EXISTS model_gender_preference JSONB`
          );

          await db.query(
            `CREATE INDEX IF NOT EXISTS idx_user_style_profiles_model_gender
               ON user_style_profiles USING GIN (model_gender_preference)`
          );
        }

        await db.query(
          `UPDATE user_style_profiles
             SET model_gender_preference = COALESCE(model_gender_preference, $1::jsonb)
             WHERE model_gender_preference IS NULL`,
          [DEFAULT_MODEL_GENDER_PREFERENCE_JSON]
        );

        this.schemaReady = true;
      })();
    }

    try {
      await this.schemaPromise;
    } catch (error) {
      logger.error('Failed to ensure model gender preference schema', {
        error: error.message
      });
      this.schemaPromise = null;
      throw error;
    }

    this.schemaPromise = null;
  }

  /**
   * Get user's current model gender preference
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Preference object
   */
  async getUserModelGenderPreference(userId) {
    try {
      await this.ensureModelGenderPreferenceSupport();

      const result = await db.query(
        `SELECT model_gender_preference 
         FROM user_style_profiles 
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default preference if user style profile doesn't exist
        const defaultPreference = createDefaultModelGenderPreference();

        // Try to create or update style profile
        await db.query(
          `INSERT INTO user_style_profiles (user_id, profile_data, model_gender_preference)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE
           SET model_gender_preference = $3`,
          [userId, JSON.stringify({}), JSON.stringify(defaultPreference)]
        );

        return defaultPreference;
      }

      const preference =
        result.rows[0].model_gender_preference || createDefaultModelGenderPreference();

      const normalizedSetting = this.normalizeGenderValue(preference.setting) || 'auto';
      const normalizedDetected = this.normalizeGenderValue(preference.detected_gender) || preference.detected_gender;

      return {
        ...preference,
        setting: normalizedSetting,
        detected_gender: normalizedDetected
      };
    } catch (error) {
      logger.error('Failed to get user model gender preference', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user's model gender preference
   * @param {string} userId - User ID
   * @param {Object} preferenceData - Preference data to update
   * @returns {Promise<Object>} - Updated preference
   */
  async updateUserModelGenderPreference(userId, preferenceData) {
    try {
      const {
        setting = 'auto',
        manual_override = false,
        detected_gender = null,
        confidence = 0
      } = preferenceData;

      // Get current preference (this will create profile if it doesn't exist)
      let currentPreference = await this.getUserModelGenderPreference(userId);

      const normalizedSetting = this.normalizeGenderValue(setting) || 'auto';
      const normalizedDetected = this.normalizeGenderValue(detected_gender) || currentPreference.detected_gender;

      // Update preference
      const updatedPreference = {
        ...currentPreference,
        setting: normalizedSetting,
        manual_override,
        detected_gender: normalizedDetected || currentPreference.detected_gender,
        confidence: confidence || currentPreference.confidence,
        last_updated: new Date().toISOString(),
        // Reset alternation counter when setting changes
        alternation_counter: normalizedSetting === 'both' ? currentPreference.alternation_counter : 0
      };

      // Update database (use UPSERT to ensure profile exists)
      const result = await db.query(
        `INSERT INTO user_style_profiles (user_id, profile_data, model_gender_preference)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
         SET model_gender_preference = $3
         RETURNING model_gender_preference`,
        [userId, JSON.stringify({}), JSON.stringify(updatedPreference)]
      );

      if (result.rows.length === 0) {
        throw new Error('Failed to update preference - database error');
      }

      logger.info('Updated model gender preference', {
        userId,
        setting,
        manual_override
      });

      return updatedPreference;
    } catch (error) {
      logger.error('Failed to update model gender preference', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Analyze portfolio for model gender prevalence using ultra-detailed descriptors
   * @param {string} userId - User ID
   * @param {number} portfolioId - Portfolio ID (to fetch actual descriptors)
   * @returns {Promise<Object>} - Analysis result with auto-update of preference
   */
  async analyzePortfolioForModelGender(userId, portfolioId) {
    try {
      if (!portfolioId) {
        throw new Error('portfolioId is required for model gender analysis');
      }

      // Fetch all ultra-detailed descriptors for this portfolio
      const result = await db.query(
        `SELECT 
          id,
          image_id,
          descriptors_json,
          metadata
         FROM style_descriptors
         WHERE portfolio_id = $1 AND user_id = $2
         ORDER BY created_at DESC`,
        [portfolioId, userId]
      );

      if (result.rows.length === 0) {
        logger.warn('No descriptors found for portfolio', { userId, portfolioId });
        return {
          detected_gender: 'neutral',
          confidence: 0,
          model_count_male: 0,
          model_count_female: 0,
          model_count_androgynous: 0,
          images_analyzed: 0,
          message: 'No descriptors available'
        };
      }

      // Analyze gender_presentation from descriptors
      const genderCounts = {
        feminine: 0,
        masculine: 0,
        androgynous: 0,
        unknown: 0
      };

      const descriptorDetails = [];

      for (const row of result.rows) {
        try {
          const descriptors = JSON.parse(row.descriptors_json);
          const modelDemographics = descriptors.model_demographics || {};
          const genderPresentation = modelDemographics.gender_presentation || 'unknown';
          
          // Normalize to lowercase for counting
          const normalizedGender = genderPresentation.toLowerCase();
          
          if (genderCounts.hasOwnProperty(normalizedGender)) {
            genderCounts[normalizedGender]++;
          } else {
            genderCounts.unknown++;
          }

          descriptorDetails.push({
            image_id: row.image_id,
            gender_presentation: genderPresentation,
            confidence: modelDemographics.confidence || 0.5
          });

          // Store in detection history
          await db.query(
            `INSERT INTO model_gender_detection_history 
             (user_id, portfolio_image_id, detected_gender, confidence, model_count_male, model_count_female)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [
              userId,
              row.image_id,
              normalizedGender,
              modelDemographics.confidence || 0.5,
              normalizedGender === 'masculine' ? 1 : 0,
              normalizedGender === 'feminine' ? 1 : 0
            ]
          );
        } catch (parseError) {
          logger.warn('Failed to parse descriptor for gender analysis', {
            imageId: row.image_id,
            error: parseError.message
          });
          genderCounts.unknown++;
        }
      }

      const totalImages = result.rows.length;
      
      // Determine dominant gender based on counts
      let detectedGender = 'neutral';
      let confidence = 0.5;
      
      const femalePercentage = (genderCounts.feminine / totalImages) * 100;
      const malePercentage = (genderCounts.masculine / totalImages) * 100;
      const androPercentage = (genderCounts.androgynous / totalImages) * 100;

      // Determine with confidence threshold (60% to be significant)
      if (femalePercentage > 60) {
        detectedGender = 'female';
        confidence = Math.min(femalePercentage / 100, 0.95);
      } else if (malePercentage > 60) {
        detectedGender = 'male';
        confidence = Math.min(malePercentage / 100, 0.95);
      } else if (femalePercentage > malePercentage + 15) {
        detectedGender = 'female';
        confidence = femalePercentage / 100;
      } else if (malePercentage > femalePercentage + 15) {
        detectedGender = 'male';
        confidence = malePercentage / 100;
      } else {
        detectedGender = 'both';
        confidence = 0.5;
      }

      logger.info('Portfolio model gender analysis complete', {
        userId,
        portfolioId,
        totalImages,
        detectedGender,
        confidence,
        genderCounts,
        percentages: {
          feminine: (femalePercentage).toFixed(1) + '%',
          masculine: (malePercentage).toFixed(1) + '%',
          androgynous: (androPercentage).toFixed(1) + '%'
        }
      });

      // Auto-update user preference with auto setting
      await this.updateUserModelGenderPreference(userId, {
        setting: 'auto',
        detected_gender: detectedGender,
        confidence: confidence,
        manual_override: false
      });

      return {
        detected_gender: detectedGender,
        confidence: parseFloat(confidence.toFixed(2)),
        model_count_feminine: genderCounts.feminine,
        model_count_masculine: genderCounts.masculine,
        model_count_androgynous: genderCounts.androgynous,
        images_analyzed: totalImages,
        percentages: {
          feminine: parseFloat(femalePercentage.toFixed(1)),
          masculine: parseFloat(malePercentage.toFixed(1)),
          androgynous: parseFloat(androPercentage.toFixed(1))
        },
        analysis_details: descriptorDetails
      };
    } catch (error) {
      logger.error('Failed to analyze portfolio for model gender', {
        userId,
        portfolioId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get the appropriate model gender prompt element for generation
   * @param {string} userId - User ID
   * @param {number} generationIndex - Index of generation for alternation
   * @param {boolean} trackAlternation - Whether to track alternation state
   * @returns {Promise<Object>} - Prompt element and metadata
   */
  async getModelGenderPromptElement(userId, generationIndex = 0, trackAlternation = true) {
    try {
      const preference = await this.getUserModelGenderPreference(userId);
      const { manual_override } = preference;
      const normalizedSetting = this.normalizeGenderValue(preference.setting) || 'auto';
      const normalizedDetected = this.normalizeGenderValue(preference.detected_gender);

      let promptElement = '';
      let gender = 'both';
      let effectiveSetting = normalizedSetting;

      if (normalizedSetting === 'auto') {
        // Auto mode: use detected gender if available, otherwise both
        gender = normalizedDetected || 'both';
      } else if (normalizedSetting === 'both') {
        // Alternation mode - toggle between male and female for variety
        if (trackAlternation) {
          // Alternate between male and female
          const isEven = generationIndex % 2 === 0;
          gender = isEven ? 'female' : 'male';
          
          // Update alternation counter
          await db.query(
            `UPDATE user_style_profiles 
             SET model_gender_preference = jsonb_set(
               model_gender_preference,
               '{alternation_counter}',
               to_jsonb($2)
             )
             WHERE user_id = $1`,
            [userId, generationIndex + 1]
          );
        } else {
          gender = 'both';
        }
      } else if (normalizedSetting === 'neutral') {
        gender = 'neutral';
      } else {
        // Explicit setting: female or male
        gender = normalizedSetting;
      }

      // Generate prompt element based on gender
      promptElement = this.generateModelGenderPromptElement(gender);

      // Track generation if requested
      if (trackAlternation) {
        const generationId = `gen_${userId}_${Date.now()}`;
        await this.trackGeneration(userId, generationId, effectiveSetting, gender);
      }

      logger.debug('Model gender prompt element generated', {
        userId,
        setting: effectiveSetting,
        detectedGender: normalizedDetected,
        usedGender: gender,
        manual_override,
        promptElement
      });

      return {
        promptElement,
        gender,
        setting: effectiveSetting,
        detectedGender: normalizedDetected,
        manualOverride: manual_override
      };
    } catch (error) {
      logger.error('Failed to get model gender prompt element', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate model gender prompt element with detailed descriptors
   * @param {string} gender - Gender type: 'female', 'male', 'both', 'auto', etc.
   * @returns {string} - Prompt element (unweighted - weight is applied by IntelligentPromptBuilder)
   */
  generateModelGenderPromptElement(gender) {
    const normalized = this.normalizeGenderValue(gender) || 'both';

    // These are used with formatToken() in IntelligentPromptBuilder which adds weights
    const promptElements = {
      female: 'beautiful female model facing camera',
      male: 'handsome male model facing camera',
      both: 'beautiful model facing camera',
      auto: '', // Will be determined by user portfolio analysis
      neutral: 'androgynous model facing camera',
      multiple: 'beautiful models facing camera',
      unclear: 'beautiful model facing camera'
    };

    return promptElements[normalized] || promptElements.both;
  }

  /**
   * Track generation with model gender selection
   * @param {string} userId - User ID
   * @param {string} generationId - Generation ID
   * @param {string} preference - User's preference setting
   * @param {string} usedGender - Gender actually used in generation
   * @returns {Promise<void>}
   */
  async trackGeneration(userId, generationId, preference, usedGender) {
    try {
      await db.query(
        `INSERT INTO generation_model_gender_tracking 
         (generation_id, user_id, model_gender_preference, last_gender_used)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (generation_id) DO UPDATE
         SET last_gender_used = $4, updated_at = NOW()`,
        [generationId, userId, preference, usedGender]
      );
    } catch (error) {
      logger.error('Failed to track generation', {
        userId,
        generationId,
        error: error.message
      });
      // Don't throw - tracking failure shouldn't block generation
    }
  }

  /**
   * Normalize gender preference values to canonical tokens.
   * Handles variations like "female only", "female-only", "feminine", etc.
   * @param {string|null|undefined} value
   * @returns {string|null}
   */
  normalizeGenderValue(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const stringValue = String(value).trim().toLowerCase();
    if (!stringValue) {
      return null;
    }

    const collapsed = stringValue.replace(/[\s_\-]+/g, '');

    if (['female', 'femaleonly', 'feminine', 'woman', 'women', 'womens'].includes(collapsed)) {
      return 'female';
    }

    if (['male', 'maleonly', 'masculine', 'man', 'men', 'mens'].includes(collapsed)) {
      return 'male';
    }

    if (['both', 'any', 'either', 'mixed', 'allgenders', 'coed'].includes(collapsed)) {
      return 'both';
    }

    if (['neutral', 'androgynous', 'nonbinary', 'genderneutral', 'unisex'].includes(collapsed)) {
      return 'neutral';
    }

    if (['auto', 'automatic', 'autodetect', 'detected'].includes(collapsed)) {
      return 'auto';
    }

    return collapsed;
  }

  /**
   * Get detection history for user's portfolio analysis
   * @param {string} userId - User ID
   * @param {number} limit - Result limit
   * @param {number} offset - Result offset
   * @returns {Promise<Object>} - History and pagination info
   */
  async getDetectionHistory(userId, limit = 50, offset = 0) {
    try {
      const limitValue = Math.min(limit, 200); // Cap at 200

      const result = await db.query(
        `SELECT 
          id,
          portfolio_image_id,
          detected_gender,
          confidence,
          model_count_male,
          model_count_female,
          analysis_timestamp
         FROM model_gender_detection_history
         WHERE user_id = $1
         ORDER BY analysis_timestamp DESC
         LIMIT $2 OFFSET $3`,
        [userId, limitValue, offset]
      );

      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM model_gender_detection_history WHERE user_id = $1',
        [userId]
      );

      return {
        data: result.rows,
        pagination: {
          limit: limitValue,
          offset,
          total: parseInt(countResult.rows[0].total)
        }
      };
    } catch (error) {
      logger.error('Failed to get detection history', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new ModelGenderDetectionService();
