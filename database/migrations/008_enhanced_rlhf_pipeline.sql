-- Database Migration for Enhanced RLHF Pipeline
-- Adds support for:
-- 1. Continuous Learning Agent (interaction tracking)
-- 2. Validation Agent (validation results)
-- 3. Thompson Sampling (alpha/beta parameters)
-- 4. Style Tag Metadata (rich metadata for tags)

-- ===========================================
-- 1. INTERACTION EVENTS TABLE
-- Tracks all user interactions (implicit + explicit)
-- ===========================================
CREATE TABLE IF NOT EXISTS interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,  -- 'view', 'scroll', 'regenerate', 'save', 'share', etc.
  duration_ms INTEGER,               -- Time spent viewing
  scroll_depth DECIMAL(3,2),        -- 0.0 to 1.0
  metadata JSONB,                   -- Additional event data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_interaction_user (user_id),
  INDEX idx_interaction_generation (generation_id),
  INDEX idx_interaction_type (event_type),
  INDEX idx_interaction_created (created_at)
);

-- ===========================================
-- 2. STYLE TAG METADATA TABLE
-- Stores rich metadata for each style tag
-- Example: "sporty chic" → {cuffed sweatpants, navy blue, cotton, etc.}
-- ===========================================
CREATE TABLE IF NOT EXISTS style_tag_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  style_tag VARCHAR(100) NOT NULL,
  
  -- Signature attributes (the DNA of this style tag)
  signature_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Format: {
  --   "garment_types": {"sweatpants": 0.8, "hoodie": 0.6},
  --   "colors": {"navy": 0.9, "gray": 0.7},
  --   "fabrics": {"cotton": 0.8, "fleece": 0.5},
  --   "silhouettes": {"relaxed": 0.9},
  --   "finishes": {"matte": 0.7}
  -- }
  
  -- Interaction statistics
  interaction_count INTEGER DEFAULT 0,
  positive_interactions INTEGER DEFAULT 0,
  negative_interactions INTEGER DEFAULT 0,
  
  -- Confidence score (0.0 to 1.0)
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(user_id, style_tag)
);

-- Indexes for style_tag_metadata
CREATE INDEX IF NOT EXISTS idx_style_tag_metadata_user ON style_tag_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_style_tag_metadata_confidence ON style_tag_metadata(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_style_tag_metadata_signature_attrs ON style_tag_metadata USING gin(signature_attributes);

-- ===========================================
-- 3. THOMPSON SAMPLING PARAMETERS TABLE
-- Stores Beta distribution parameters for Thompson Sampling
-- Each row represents one "arm" in the multi-armed bandit
-- ===========================================
CREATE TABLE IF NOT EXISTS thompson_sampling_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,  -- 'garments', 'colors', 'fabrics', etc.
  attribute VARCHAR(100) NOT NULL, -- 'dress', 'black', 'cotton', etc.
  
  -- Beta distribution parameters
  alpha INTEGER DEFAULT 2,  -- Successes + 2 (prior)
  beta INTEGER DEFAULT 2,   -- Failures + 2 (prior)
  
  -- Statistics
  total_samples INTEGER DEFAULT 0,
  estimated_success_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE 
      WHEN (alpha + beta - 4) > 0 THEN (alpha - 2)::decimal / (alpha + beta - 4)
      ELSE 0.5
    END
  ) STORED,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  UNIQUE(user_id, category, attribute)
);

-- Indexes for thompson_sampling_params
CREATE INDEX IF NOT EXISTS idx_thompson_params_user ON thompson_sampling_params(user_id);
CREATE INDEX IF NOT EXISTS idx_thompson_params_category ON thompson_sampling_params(category);
CREATE INDEX IF NOT EXISTS idx_thompson_params_success_rate ON thompson_sampling_params(estimated_success_rate DESC);

-- ===========================================
-- 4. VALIDATION RESULTS TABLE
-- Stores validation results to prevent hallucinations
-- ===========================================
CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES portfolio_images(id) ON DELETE CASCADE,
  descriptor_id UUID REFERENCES image_descriptors(id) ON DELETE CASCADE,
  
  -- Validation scores
  validation_score DECIMAL(3,2),  -- Overall validation confidence (0.0 to 1.0)
  color_validation_score DECIMAL(3,2),
  logical_consistency_score DECIMAL(3,2),
  cross_validation_score DECIMAL(3,2),
  
  -- Issues detected
  issues JSONB DEFAULT '[]'::jsonb,
  
  -- Corrected descriptor (if validation failed)
  corrected_descriptor JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for validation_results
CREATE INDEX IF NOT EXISTS idx_validation_results_image ON validation_results(image_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_descriptor ON validation_results(descriptor_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_score ON validation_results(validation_score DESC);

-- ===========================================
-- 5. VIEWS FOR MONITORING AND ANALYTICS
-- ===========================================

-- View: User learning progress
CREATE OR REPLACE VIEW user_learning_progress AS
SELECT 
  ie.user_id,
  COUNT(*) as total_interactions,
  COUNT(CASE WHEN ie.event_type = 'view' AND ie.duration_ms > 5000 THEN 1 END) as long_views,
  COUNT(CASE WHEN ie.event_type = 'save' THEN 1 END) as saves,
  COUNT(CASE WHEN ie.event_type = 'share' THEN 1 END) as shares,
  AVG(ie.duration_ms) as avg_view_duration,
  MAX(ie.created_at) as last_interaction
FROM interaction_events ie
GROUP BY ie.user_id;

-- View: Style tag performance
CREATE OR REPLACE VIEW style_tag_performance AS
SELECT 
  stm.user_id,
  stm.style_tag,
  stm.confidence_score,
  stm.interaction_count,
  stm.positive_interactions,
  stm.negative_interactions,
  (stm.positive_interactions::decimal / NULLIF(stm.interaction_count, 0)) as positive_rate,
  stm.updated_at
FROM style_tag_metadata stm
ORDER BY stm.confidence_score DESC;

-- View: Validation quality metrics
CREATE OR REPLACE VIEW validation_quality_metrics AS
SELECT 
  DATE(vr.created_at) as date,
  COUNT(*) as total_validations,
  AVG(vr.validation_score) as avg_validation_score,
  COUNT(CASE WHEN vr.validation_score >= 0.8 THEN 1 END) as high_quality,
  COUNT(CASE WHEN vr.validation_score < 0.6 THEN 1 END) as low_quality,
  AVG(vr.color_validation_score) as avg_color_score,
  AVG(vr.logical_consistency_score) as avg_logic_score
FROM validation_results vr
GROUP BY DATE(vr.created_at)
ORDER BY date DESC;

-- ===========================================
-- 6. FUNCTIONS FOR ADVANCED QUERIES
-- ===========================================

-- Function: Get top style tags for a user
CREATE OR REPLACE FUNCTION get_top_style_tags(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  style_tag VARCHAR(100),
  confidence_score DECIMAL(3,2),
  interaction_count INTEGER,
  signature_attributes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    stm.style_tag,
    stm.confidence_score,
    stm.interaction_count,
    stm.signature_attributes
  FROM style_tag_metadata stm
  WHERE stm.user_id = p_user_id
  ORDER BY stm.confidence_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Thompson Sampling recommendations
CREATE OR REPLACE FUNCTION get_thompson_recommendations(p_user_id UUID, p_category VARCHAR(50))
RETURNS TABLE (
  attribute VARCHAR(100),
  estimated_success_rate DECIMAL(5,4),
  recommendation_score DECIMAL(10,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tsp.attribute,
    tsp.estimated_success_rate,
    -- Thompson Score: alpha / (alpha + beta) with uncertainty bonus
    (tsp.alpha::decimal / (tsp.alpha + tsp.beta)) + 
    (1.0 / SQRT(tsp.alpha + tsp.beta)) as recommendation_score
  FROM thompson_sampling_params tsp
  WHERE tsp.user_id = p_user_id 
    AND tsp.category = p_category
  ORDER BY recommendation_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 7. TRIGGERS FOR AUTO-UPDATES
-- ===========================================

-- Trigger: Update style_tag_metadata.updated_at
CREATE OR REPLACE FUNCTION update_style_tag_metadata_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_style_tag_metadata_updated_at
  BEFORE UPDATE ON style_tag_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_style_tag_metadata_timestamp();

-- Trigger: Update thompson_sampling_params.updated_at
CREATE OR REPLACE FUNCTION update_thompson_params_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_thompson_params_updated_at
  BEFORE UPDATE ON thompson_sampling_params
  FOR EACH ROW
  EXECUTE FUNCTION update_thompson_params_timestamp();

-- ===========================================
-- 8. SEED DATA (Optional - for testing)
-- ===========================================

-- Example: Initialize Thompson Sampling parameters for new users
-- This can be called when a user first uploads a portfolio
CREATE OR REPLACE FUNCTION initialize_thompson_params(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_garments TEXT[] := ARRAY['dress', 'blazer', 'pants', 'skirt', 'jacket', 'top'];
  v_colors TEXT[] := ARRAY['black', 'white', 'navy', 'beige', 'gray'];
  v_fabrics TEXT[] := ARRAY['cotton', 'silk', 'wool', 'linen'];
  v_item TEXT;
BEGIN
  -- Initialize garments
  FOREACH v_item IN ARRAY v_garments LOOP
    INSERT INTO thompson_sampling_params (user_id, category, attribute)
    VALUES (p_user_id, 'garments', v_item)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Initialize colors
  FOREACH v_item IN ARRAY v_colors LOOP
    INSERT INTO thompson_sampling_params (user_id, category, attribute)
    VALUES (p_user_id, 'colors', v_item)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Initialize fabrics
  FOREACH v_item IN ARRAY v_fabrics LOOP
    INSERT INTO thompson_sampling_params (user_id, category, attribute)
    VALUES (p_user_id, 'fabrics', v_item)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 9. INDEXES FOR PERFORMANCE
-- ===========================================

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_generations_user_created 
  ON generations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created 
  ON feedback(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interaction_events_user_created 
  ON interaction_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_style_tag_metadata_user_confidence 
  ON style_tag_metadata(user_id, confidence_score DESC);

-- JSONB indexes for signature_attributes searches
CREATE INDEX IF NOT EXISTS idx_style_tag_metadata_signature_attrs 
  ON style_tag_metadata USING gin(signature_attributes);

-- ===========================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ===========================================

COMMENT ON TABLE interaction_events IS 
  'Tracks all user interactions with generated images for implicit feedback learning';

COMMENT ON TABLE style_tag_metadata IS 
  'Stores rich metadata for style tags - the DNA of each style (e.g., sporty chic → cuffed sweatpants, navy)';

COMMENT ON TABLE thompson_sampling_params IS 
  'Thompson Sampling (Beta distribution) parameters for multi-armed bandit exploration/exploitation';

COMMENT ON TABLE validation_results IS 
  'Validation results from Validation Agent to prevent hallucinations';

COMMENT ON COLUMN thompson_sampling_params.alpha IS 
  'Number of successes + 2 (prior) - increases with positive feedback';

COMMENT ON COLUMN thompson_sampling_params.beta IS 
  'Number of failures + 2 (prior) - increases with negative feedback';

COMMENT ON COLUMN style_tag_metadata.signature_attributes IS 
  'JSON object with weighted distributions of garments, colors, fabrics, etc. that define this style tag';

-- ===========================================
-- MIGRATION COMPLETE
-- ===========================================

-- To apply this migration:
-- 1. Run this SQL file in your PostgreSQL database
-- 2. Verify all tables and indexes were created successfully
-- 3. Test the new agents with the new schema
-- 4. Monitor the views for learning progress

-- To rollback (if needed):
/*
DROP TABLE IF EXISTS interaction_events CASCADE;
DROP TABLE IF EXISTS style_tag_metadata CASCADE;
DROP TABLE IF EXISTS thompson_sampling_params CASCADE;
DROP TABLE IF EXISTS validation_results CASCADE;
DROP VIEW IF EXISTS user_learning_progress CASCADE;
DROP VIEW IF EXISTS style_tag_performance CASCADE;
DROP VIEW IF EXISTS validation_quality_metrics CASCADE;
DROP FUNCTION IF EXISTS get_top_style_tags CASCADE;
DROP FUNCTION IF EXISTS get_thompson_recommendations CASCADE;
DROP FUNCTION IF EXISTS initialize_thompson_params CASCADE;
*/