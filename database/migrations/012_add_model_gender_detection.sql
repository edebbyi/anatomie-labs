-- Migration: Add Model Gender Detection to Style Profiles
-- Adds automatic gender preference detection and storage for model selection in generations

-- Add model gender preference column to user_style_profiles
ALTER TABLE user_style_profiles
ADD COLUMN IF NOT EXISTS model_gender_preference JSONB DEFAULT '{
  "setting": "auto",
  "detected_gender": null,
  "confidence": 0,
  "manual_override": false,
  "last_updated": null,
  "alternation_counter": 0,
  "model_count": {
    "female": 0,
    "male": 0,
    "neutral": 0
  }
}'::jsonb;

-- Create index for efficient filtering by model gender preference
CREATE INDEX IF NOT EXISTS idx_user_style_profiles_model_gender 
ON user_style_profiles USING GIN(model_gender_preference);

-- Add comments
COMMENT ON COLUMN user_style_profiles.model_gender_preference IS 
'JSONB containing model gender preference settings, detection results, and alternation tracking';

-- Create table to track model gender detection history
CREATE TABLE IF NOT EXISTS model_gender_detection_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    portfolio_image_id VARCHAR(255),
    detected_gender VARCHAR(50),  -- 'male', 'female', 'neutral', 'multiple', 'unclear'
    confidence FLOAT,
    model_count_male INT DEFAULT 0,
    model_count_female INT DEFAULT 0,
    analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_model_gender_detection_user_id 
ON model_gender_detection_history(user_id);

CREATE INDEX IF NOT EXISTS idx_model_gender_detection_timestamp 
ON model_gender_detection_history(analysis_timestamp DESC);

COMMENT ON TABLE model_gender_detection_history IS 
'Tracks model gender detection results for each portfolio image analyzed';

-- Create table to track alternation state during batch generation
CREATE TABLE IF NOT EXISTS generation_model_gender_tracking (
    id SERIAL PRIMARY KEY,
    generation_id VARCHAR(255) UNIQUE,
    user_id UUID NOT NULL,
    model_gender_preference VARCHAR(50),  -- 'auto', 'female', 'male', 'both'
    images_generated INT DEFAULT 0,
    last_gender_used VARCHAR(50),
    alternation_sequence TEXT[],  -- Array of genders in order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_generation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generation_model_gender_user_id 
ON generation_model_gender_tracking(user_id);

CREATE INDEX IF NOT EXISTS idx_generation_model_gender_created_at 
ON generation_model_gender_tracking(created_at DESC);

COMMENT ON TABLE generation_model_gender_tracking IS 
'Tracks model gender selection during batch generation for alternation logic';

-- Function to update model_gender_preference timestamp
CREATE OR REPLACE FUNCTION update_model_gender_preference_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.model_gender_preference IS NOT NULL THEN
        NEW.model_gender_preference = jsonb_set(
            NEW.model_gender_preference,
            '{last_updated}',
            to_jsonb(CURRENT_TIMESTAMP::TEXT)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_model_gender_preference_timestamp ON user_style_profiles;
CREATE TRIGGER trigger_model_gender_preference_timestamp
    BEFORE UPDATE ON user_style_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_model_gender_preference_timestamp();

-- Function to update generation_model_gender_tracking timestamp
CREATE OR REPLACE FUNCTION update_generation_model_gender_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generation_model_gender_tracking_updated_at ON generation_model_gender_tracking;
CREATE TRIGGER trigger_generation_model_gender_tracking_updated_at
    BEFORE UPDATE ON generation_model_gender_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_generation_model_gender_tracking_updated_at();