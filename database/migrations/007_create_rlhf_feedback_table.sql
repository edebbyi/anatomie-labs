-- Migration: Create RLHF Feedback Table
-- Created: 2025-10-11
-- Description: Table for storing feedback including discarded images for RLHF learning

-- =====================================================
-- Table: rlhf_feedback
-- Stores all feedback for RLHF learning
-- =====================================================
CREATE TABLE IF NOT EXISTS rlhf_feedback (
  id SERIAL PRIMARY KEY,
  generation_id VARCHAR(100) REFERENCES generations(id) ON DELETE CASCADE,
  asset_id INTEGER REFERENCES generation_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  feedback_type VARCHAR(50) NOT NULL,
  feedback_source VARCHAR(50) NOT NULL,
  quality_score DECIMAL(5,2),
  validation_score DECIMAL(5,2),
  is_negative_example BOOLEAN DEFAULT FALSE,
  is_positive_example BOOLEAN DEFAULT FALSE,
  weight DECIMAL(3,2) DEFAULT 1.0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rlhf_feedback_generation_id ON rlhf_feedback(generation_id);
CREATE INDEX idx_rlhf_feedback_asset_id ON rlhf_feedback(asset_id);
CREATE INDEX idx_rlhf_feedback_user_id ON rlhf_feedback(user_id);
CREATE INDEX idx_rlhf_feedback_type ON rlhf_feedback(feedback_type);
CREATE INDEX idx_rlhf_feedback_source ON rlhf_feedback(feedback_source);
CREATE INDEX idx_rlhf_feedback_is_negative ON rlhf_feedback(is_negative_example);
CREATE INDEX idx_rlhf_feedback_is_positive ON rlhf_feedback(is_positive_example);
CREATE INDEX idx_rlhf_feedback_created_at ON rlhf_feedback(created_at DESC);

COMMENT ON TABLE rlhf_feedback IS 'All feedback for RLHF learning including discarded images';
COMMENT ON COLUMN rlhf_feedback.feedback_type IS 'Type: discarded, user_like, user_dislike, validation_failed, etc.';
COMMENT ON COLUMN rlhf_feedback.feedback_source IS 'Source: validation_filter, user_action, system, etc.';
COMMENT ON COLUMN rlhf_feedback.is_negative_example IS 'True if this is a negative example for learning';
COMMENT ON COLUMN rlhf_feedback.is_positive_example IS 'True if this is a positive example for learning';
COMMENT ON COLUMN rlhf_feedback.weight IS 'Weight for this feedback in training (0-1)';

-- =====================================================
-- View: rlhf_negative_examples
-- Negative examples for RLHF training
-- =====================================================
CREATE OR REPLACE VIEW rlhf_negative_examples AS
SELECT 
  rf.id,
  rf.generation_id,
  rf.asset_id,
  rf.feedback_type,
  rf.feedback_source,
  rf.quality_score,
  rf.validation_score,
  rf.metadata,
  rf.created_at,
  ga.cdn_url,
  ga.provider_id,
  mp.name as provider_name,
  g.pipeline_data->>'enhanced' as enhanced_prompt,
  g.pipeline_data->>'optimized' as optimized_prompt
FROM rlhf_feedback rf
JOIN generation_assets ga ON rf.asset_id = ga.id
LEFT JOIN model_providers mp ON ga.provider_id = mp.id
JOIN generations g ON rf.generation_id = g.id
WHERE rf.is_negative_example = TRUE
ORDER BY rf.created_at DESC;

COMMENT ON VIEW rlhf_negative_examples IS 'Negative examples for RLHF training';

-- =====================================================
-- View: rlhf_positive_examples
-- Positive examples for RLHF training
-- =====================================================
CREATE OR REPLACE VIEW rlhf_positive_examples AS
SELECT 
  rf.id,
  rf.generation_id,
  rf.asset_id,
  rf.feedback_type,
  rf.feedback_source,
  rf.quality_score,
  rf.validation_score,
  rf.metadata,
  rf.created_at,
  ga.cdn_url,
  ga.provider_id,
  mp.name as provider_name,
  g.pipeline_data->>'enhanced' as enhanced_prompt,
  g.pipeline_data->>'optimized' as optimized_prompt
FROM rlhf_feedback rf
JOIN generation_assets ga ON rf.asset_id = ga.id
LEFT JOIN model_providers mp ON ga.provider_id = mp.id
JOIN generations g ON rf.generation_id = g.id
WHERE rf.is_positive_example = TRUE
ORDER BY rf.created_at DESC;

COMMENT ON VIEW rlhf_positive_examples IS 'Positive examples for RLHF training';

-- =====================================================
-- View: rlhf_feedback_summary
-- Summary of feedback by provider and type
-- =====================================================
CREATE OR REPLACE VIEW rlhf_feedback_summary AS
SELECT 
  ga.provider_id,
  mp.name as provider_name,
  rf.feedback_type,
  rf.feedback_source,
  COUNT(*) as feedback_count,
  SUM(CASE WHEN rf.is_negative_example THEN 1 ELSE 0 END) as negative_count,
  SUM(CASE WHEN rf.is_positive_example THEN 1 ELSE 0 END) as positive_count,
  AVG(rf.quality_score) as avg_quality_score,
  AVG(rf.validation_score) as avg_validation_score,
  MAX(rf.created_at) as latest_feedback
FROM rlhf_feedback rf
JOIN generation_assets ga ON rf.asset_id = ga.id
LEFT JOIN model_providers mp ON ga.provider_id = mp.id
GROUP BY ga.provider_id, mp.name, rf.feedback_type, rf.feedback_source
ORDER BY feedback_count DESC;

COMMENT ON VIEW rlhf_feedback_summary IS 'Summary of feedback by provider and type';

-- =====================================================
-- Function: Create positive feedback from validation
-- Automatically create positive feedback for high-scoring validations
-- =====================================================
CREATE OR REPLACE FUNCTION create_positive_feedback_from_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for completed validations with high scores
  IF NEW.status = 'completed' AND NEW.overall_score >= 85.0 AND NEW.is_rejected = FALSE THEN
    INSERT INTO rlhf_feedback (
      generation_id,
      asset_id,
      feedback_type,
      feedback_source,
      quality_score,
      validation_score,
      is_positive_example,
      weight,
      metadata,
      created_at
    ) VALUES (
      NEW.generation_id,
      NEW.asset_id,
      'high_quality',
      'validation_auto',
      NEW.overall_score,
      NEW.consistency_score,
      TRUE,
      1.0,
      jsonb_build_object(
        'validation_id', NEW.id,
        'scores', jsonb_build_object(
          'overall', NEW.overall_score,
          'consistency', NEW.consistency_score,
          'style', NEW.style_consistency_score
        )
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Auto-create positive feedback for high scores
-- =====================================================
DROP TRIGGER IF EXISTS trigger_create_positive_feedback ON validation_results;
CREATE TRIGGER trigger_create_positive_feedback
  AFTER INSERT OR UPDATE OF status ON validation_results
  FOR EACH ROW
  EXECUTE FUNCTION create_positive_feedback_from_validation();

-- =====================================================
-- Function: Get RLHF training data
-- Retrieve training data for RLHF model updates
-- =====================================================
CREATE OR REPLACE FUNCTION get_rlhf_training_data(
  p_provider_id VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT 1000,
  p_negative_only BOOLEAN DEFAULT FALSE,
  p_positive_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  feedback_id INTEGER,
  generation_id VARCHAR,
  asset_id INTEGER,
  provider_id VARCHAR,
  provider_name VARCHAR,
  feedback_type VARCHAR,
  is_negative BOOLEAN,
  is_positive BOOLEAN,
  quality_score DECIMAL,
  validation_score DECIMAL,
  enhanced_prompt TEXT,
  optimized_prompt TEXT,
  metadata JSONB,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rf.id,
    rf.generation_id,
    rf.asset_id,
    ga.provider_id,
    mp.name,
    rf.feedback_type,
    rf.is_negative_example,
    rf.is_positive_example,
    rf.quality_score,
    rf.validation_score,
    (g.pipeline_data->>'enhanced')::TEXT,
    (g.pipeline_data->>'optimized')::TEXT,
    rf.metadata,
    rf.created_at
  FROM rlhf_feedback rf
  JOIN generation_assets ga ON rf.asset_id = ga.id
  LEFT JOIN model_providers mp ON ga.provider_id = mp.id
  JOIN generations g ON rf.generation_id = g.id
  WHERE 
    (p_provider_id IS NULL OR ga.provider_id = p_provider_id)
    AND (NOT p_negative_only OR rf.is_negative_example = TRUE)
    AND (NOT p_positive_only OR rf.is_positive_example = TRUE)
  ORDER BY rf.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_rlhf_training_data IS 'Retrieve training data for RLHF model updates';
