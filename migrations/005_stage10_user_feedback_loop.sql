-- Stage 10: User Feedback Loop Schema
-- Captures user feedback, outliers, and enables continuous model improvement

-- User feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User and generation info
  user_id UUID NOT NULL,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES generation_assets(id) ON DELETE CASCADE,
  
  -- Feedback type
  feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN (
    'outlier',           -- Marked as successful generation
    'rejected',          -- User rejected this image
    'neutral',           -- No strong opinion
    'favorite'           -- User favorited
  )),
  
  -- Ratings and scores
  user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
  clip_score DECIMAL(5,4),                -- Automated CLIP quality metric
  is_outlier BOOLEAN DEFAULT FALSE,       -- Successful generation flag
  
  -- Qualitative feedback
  comment TEXT,
  tags TEXT[],                            -- User-added tags
  
  -- VLT attributes at time of feedback
  vlt_attributes JSONB,                   -- Snapshot of VLT specs
  
  -- Context
  feedback_source VARCHAR(50) DEFAULT 'web',  -- web, mobile, api
  session_id VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_generation ON user_feedback(generation_id);
CREATE INDEX idx_user_feedback_asset ON user_feedback(asset_id);
CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_user_feedback_outlier ON user_feedback(is_outlier);
CREATE INDEX idx_user_feedback_created ON user_feedback(created_at DESC);
CREATE INDEX idx_user_feedback_vlt ON user_feedback USING GIN (vlt_attributes);

-- Outlier tracking table (successful generations)
CREATE TABLE IF NOT EXISTS outliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  user_id UUID NOT NULL,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES generation_assets(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES user_feedback(id) ON DELETE SET NULL,
  
  -- Success metrics
  clip_score DECIMAL(5,4),
  user_rating INTEGER,
  validation_score DECIMAL(5,2),
  
  -- VLT attributes that worked
  successful_attributes JSONB NOT NULL,   -- VLT attributes that led to success
  
  -- Style and prompt data
  style_profile VARCHAR(100),
  prompt_used TEXT,
  negative_prompt TEXT,
  provider_used VARCHAR(100),
  
  -- Learning flags
  used_for_training BOOLEAN DEFAULT FALSE,
  training_added_at TIMESTAMP,
  rlhf_updated BOOLEAN DEFAULT FALSE,
  rlhf_updated_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure uniqueness
  UNIQUE(asset_id, user_id)
);

CREATE INDEX idx_outliers_user ON outliers(user_id);
CREATE INDEX idx_outliers_generation ON outliers(generation_id);
CREATE INDEX idx_outliers_asset ON outliers(asset_id);
CREATE INDEX idx_outliers_training ON outliers(used_for_training);
CREATE INDEX idx_outliers_attributes ON outliers USING GIN (successful_attributes);
CREATE INDEX idx_outliers_created ON outliers(created_at DESC);

-- VLT attribute success tracking
CREATE TABLE IF NOT EXISTS vlt_attribute_success (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Attribute details
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(255) NOT NULL,
  
  -- Success metrics
  total_occurrences INTEGER DEFAULT 0,
  outlier_count INTEGER DEFAULT 0,
  outlier_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_occurrences > 0 THEN (outlier_count::numeric / total_occurrences * 100)
      ELSE 0
    END
  ) STORED,
  
  -- Average scores
  avg_clip_score DECIMAL(5,4),
  avg_user_rating DECIMAL(3,2),
  avg_validation_score DECIMAL(5,2),
  
  -- Last occurrence
  last_seen_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure uniqueness
  UNIQUE(attribute_name, attribute_value)
);

CREATE INDEX idx_vlt_success_attribute ON vlt_attribute_success(attribute_name);
CREATE INDEX idx_vlt_success_rate ON vlt_attribute_success(outlier_rate DESC);
CREATE INDEX idx_vlt_success_updated ON vlt_attribute_success(updated_at DESC);

-- Style profile success tracking
CREATE TABLE IF NOT EXISTS style_profile_success (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Profile info
  user_id UUID NOT NULL,
  style_profile VARCHAR(100) NOT NULL,
  
  -- Success metrics
  total_generations INTEGER DEFAULT 0,
  outlier_count INTEGER DEFAULT 0,
  outlier_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_generations > 0 THEN (outlier_count::numeric / total_generations * 100)
      ELSE 0
    END
  ) STORED,
  
  -- Average scores
  avg_clip_score DECIMAL(5,4),
  avg_user_rating DECIMAL(3,2),
  
  -- Most successful VLT attributes for this profile
  top_attributes JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, style_profile)
);

CREATE INDEX idx_style_success_user ON style_profile_success(user_id);
CREATE INDEX idx_style_success_profile ON style_profile_success(style_profile);
CREATE INDEX idx_style_success_rate ON style_profile_success(outlier_rate DESC);

-- Learning updates log
CREATE TABLE IF NOT EXISTS learning_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Update type
  update_type VARCHAR(50) NOT NULL CHECK (update_type IN (
    'rlhf_prompt_update',
    'style_profile_update',
    'training_data_added',
    'attribute_weight_adjusted',
    'reward_model_updated'
  )),
  
  -- What was updated
  target_component VARCHAR(100),          -- Which component was updated
  update_details JSONB NOT NULL,         -- Details of the update
  
  -- Triggered by
  triggered_by_outlier UUID REFERENCES outliers(id) ON DELETE SET NULL,
  triggered_by_feedback UUID REFERENCES user_feedback(id) ON DELETE SET NULL,
  
  -- Impact metrics
  affected_users INTEGER,
  expected_improvement VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'applied' CHECK (status IN ('applied', 'pending', 'rolled_back')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_updates_type ON learning_updates(update_type);
CREATE INDEX idx_learning_updates_outlier ON learning_updates(triggered_by_outlier);
CREATE INDEX idx_learning_updates_feedback ON learning_updates(triggered_by_feedback);
CREATE INDEX idx_learning_updates_created ON learning_updates(created_at DESC);

-- Create views for analytics

-- View: Outlier rate by attribute
CREATE OR REPLACE VIEW outlier_rate_by_attribute AS
SELECT 
  attribute_name,
  attribute_value,
  total_occurrences,
  outlier_count,
  outlier_rate,
  avg_clip_score,
  avg_user_rating,
  last_seen_at
FROM vlt_attribute_success
WHERE total_occurrences >= 5  -- Minimum sample size
ORDER BY outlier_rate DESC;

-- View: Top performing style profiles
CREATE OR REPLACE VIEW top_style_profiles AS
SELECT 
  style_profile,
  COUNT(DISTINCT user_id) as user_count,
  SUM(total_generations) as total_generations,
  SUM(outlier_count) as total_outliers,
  ROUND(AVG(outlier_rate), 2) as avg_outlier_rate,
  ROUND(AVG(avg_clip_score), 4) as avg_clip_score
FROM style_profile_success
GROUP BY style_profile
HAVING SUM(total_generations) >= 10
ORDER BY avg_outlier_rate DESC;

-- View: Recent feedback summary
CREATE OR REPLACE VIEW recent_feedback_summary AS
SELECT 
  DATE(created_at) as date,
  feedback_type,
  COUNT(*) as count,
  AVG(clip_score) as avg_clip_score,
  AVG(user_rating) as avg_rating,
  COUNT(CASE WHEN is_outlier THEN 1 END) as outlier_count
FROM user_feedback
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), feedback_type
ORDER BY date DESC, feedback_type;

-- View: Learning impact tracking
CREATE OR REPLACE VIEW learning_impact AS
SELECT 
  update_type,
  target_component,
  COUNT(*) as update_count,
  SUM(affected_users) as total_affected_users,
  MAX(created_at) as last_update
FROM learning_updates
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY update_type, target_component
ORDER BY update_count DESC;

-- Functions and triggers

-- Function: Update VLT attribute success stats
CREATE OR REPLACE FUNCTION update_vlt_attribute_success()
RETURNS TRIGGER AS $$
DECLARE
  attr_record RECORD;
  attr_key TEXT;
  attr_value TEXT;
BEGIN
  -- Only process outliers
  IF NEW.is_outlier THEN
    -- Loop through VLT attributes
    FOR attr_key, attr_value IN 
      SELECT key, value::text 
      FROM jsonb_each_text(NEW.vlt_attributes)
    LOOP
      -- Clean up the value
      attr_value := TRIM(BOTH '"' FROM attr_value);
      
      -- Update or insert attribute success record
      INSERT INTO vlt_attribute_success (
        attribute_name,
        attribute_value,
        total_occurrences,
        outlier_count,
        avg_clip_score,
        avg_user_rating,
        last_seen_at,
        updated_at
      ) VALUES (
        attr_key,
        attr_value,
        1,
        1,
        NEW.clip_score,
        NEW.user_rating,
        NOW(),
        NOW()
      )
      ON CONFLICT (attribute_name, attribute_value) 
      DO UPDATE SET
        total_occurrences = vlt_attribute_success.total_occurrences + 1,
        outlier_count = vlt_attribute_success.outlier_count + 1,
        avg_clip_score = (
          (vlt_attribute_success.avg_clip_score * vlt_attribute_success.total_occurrences + NEW.clip_score) /
          (vlt_attribute_success.total_occurrences + 1)
        ),
        avg_user_rating = (
          (COALESCE(vlt_attribute_success.avg_user_rating, 0) * vlt_attribute_success.total_occurrences + COALESCE(NEW.user_rating, 0)) /
          (vlt_attribute_success.total_occurrences + 1)
        ),
        last_seen_at = NOW(),
        updated_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update VLT stats when feedback is added
CREATE TRIGGER trigger_update_vlt_success
AFTER INSERT ON user_feedback
FOR EACH ROW
EXECUTE FUNCTION update_vlt_attribute_success();

-- Function: Auto-create outlier record
CREATE OR REPLACE FUNCTION create_outlier_record()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_outlier THEN
    -- Get generation details
    INSERT INTO outliers (
      user_id,
      generation_id,
      asset_id,
      feedback_id,
      clip_score,
      user_rating,
      successful_attributes,
      created_at
    )
    SELECT 
      NEW.user_id,
      NEW.generation_id,
      NEW.asset_id,
      NEW.id,
      NEW.clip_score,
      NEW.user_rating,
      NEW.vlt_attributes,
      NOW()
    ON CONFLICT (asset_id, user_id) DO UPDATE
    SET 
      feedback_id = NEW.id,
      clip_score = NEW.clip_score,
      user_rating = NEW.user_rating;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create outliers
CREATE TRIGGER trigger_create_outlier
AFTER INSERT OR UPDATE ON user_feedback
FOR EACH ROW
WHEN (NEW.is_outlier = TRUE)
EXECUTE FUNCTION create_outlier_record();

-- Function: Update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers: Update timestamps
CREATE TRIGGER trigger_user_feedback_timestamp
BEFORE UPDATE ON user_feedback
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_vlt_success_timestamp
BEFORE UPDATE ON vlt_attribute_success
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_style_success_timestamp
BEFORE UPDATE ON style_profile_success
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Comments for documentation
COMMENT ON TABLE user_feedback IS 'Stores all user feedback including outliers, ratings, and comments';
COMMENT ON TABLE outliers IS 'Tracks successful generations (outliers) for RLHF training';
COMMENT ON TABLE vlt_attribute_success IS 'Aggregate success rates by VLT attribute';
COMMENT ON TABLE style_profile_success IS 'Success rates by user style profile';
COMMENT ON TABLE learning_updates IS 'Log of all learning updates made to the system';

COMMENT ON VIEW outlier_rate_by_attribute IS 'Top performing VLT attributes ranked by outlier rate';
COMMENT ON VIEW top_style_profiles IS 'Best performing style profiles across all users';
COMMENT ON VIEW recent_feedback_summary IS 'Daily feedback statistics for the last 30 days';
COMMENT ON VIEW learning_impact IS 'Impact tracking of learning updates';
