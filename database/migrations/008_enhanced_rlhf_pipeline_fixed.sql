-- Database Migration for Enhanced RLHF Pipeline (FIXED VERSION)
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
  generation_id VARCHAR(100) NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,  -- 'view', 'scroll', 'regenerate', 'save', 'share', etc.
  duration_ms INTEGER,               -- Time spent viewing
  scroll_depth DECIMAL(3,2),        -- 0.0 to 1.0
  metadata JSONB,                   -- Additional event data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for interaction_events
CREATE INDEX IF NOT EXISTS idx_interaction_user ON interaction_events(user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_generation ON interaction_events(generation_id);
CREATE INDEX IF NOT EXISTS idx_interaction_type ON interaction_events(event_type);
CREATE INDEX IF NOT EXISTS idx_interaction_created ON interaction_events(created_at);

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
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = ie.user_id)
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
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = stm.user_id)
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
WHERE EXISTS (SELECT 1 FROM portfolio_images pi WHERE pi.id = vr.image_id)
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

-- Function: Update style tag metadata
CREATE OR REPLACE FUNCTION update_style_tag_metadata(
  p_user_id UUID,
  p_style_tag VARCHAR(100),
  p_signal_strength DECIMAL(5,2)
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO style_tag_metadata (
    user_id, style_tag, interaction_count, positive_interactions, negative_interactions, confidence_score
  )
  VALUES (
    p_user_id, p_style_tag, 1, 
    CASE WHEN p_signal_strength > 0 THEN 1 ELSE 0 END,
    CASE WHEN p_signal_strength < 0 THEN 1 ELSE 0 END,
    0.5 + p_signal_strength * 0.1
  )
  ON CONFLICT (user_id, style_tag)
  DO UPDATE SET
    interaction_count = style_tag_metadata.interaction_count + 1,
    positive_interactions = style_tag_metadata.positive_interactions + 
      CASE WHEN p_signal_strength > 0 THEN 1 ELSE 0 END,
    negative_interactions = style_tag_metadata.negative_interactions + 
      CASE WHEN p_signal_strength < 0 THEN 1 ELSE 0 END,
    confidence_score = GREATEST(0.0, LEAST(1.0, 
      style_tag_metadata.confidence_score + p_signal_strength * 0.05))
  WHERE style_tag_metadata.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update Thompson Sampling parameters
CREATE OR REPLACE FUNCTION update_thompson_params(
  p_user_id UUID,
  p_category VARCHAR(50),
  p_attribute VARCHAR(100),
  p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO thompson_sampling_params (
    user_id, category, attribute, alpha, beta
  )
  VALUES (
    p_user_id, p_category, p_attribute,
    CASE WHEN p_success THEN 3 ELSE 2 END,
    CASE WHEN p_success THEN 2 ELSE 3 END
  )
  ON CONFLICT (user_id, category, attribute)
  DO UPDATE SET
    alpha = thompson_sampling_params.alpha + CASE WHEN p_success THEN 1 ELSE 0 END,
    beta = thompson_sampling_params.beta + CASE WHEN p_success THEN 0 ELSE 1 END,
    updated_at = CURRENT_TIMESTAMP
  WHERE thompson_sampling_params.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 7. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ===========================================

-- Trigger function for style_tag_metadata
CREATE OR REPLACE FUNCTION update_style_tag_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for style_tag_metadata
DROP TRIGGER IF EXISTS trigger_style_tag_metadata_updated_at ON style_tag_metadata;
CREATE TRIGGER trigger_style_tag_metadata_updated_at
  BEFORE UPDATE ON style_tag_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_style_tag_metadata_updated_at();

-- Trigger function for thompson_sampling_params
CREATE OR REPLACE FUNCTION update_thompson_params_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for thompson_sampling_params
DROP TRIGGER IF EXISTS trigger_thompson_params_updated_at ON thompson_sampling_params;
CREATE TRIGGER trigger_thompson_params_updated_at
  BEFORE UPDATE ON thompson_sampling_params
  FOR EACH ROW
  EXECUTE FUNCTION update_thompson_params_updated_at();

-- ===========================================
-- 8. ADDITIONAL INDEXES FOR PERFORMANCE
-- ===========================================

-- Additional indexes for generations table
CREATE INDEX IF NOT EXISTS idx_generations_user_created ON generations(user_id, created_at DESC);

-- Additional indexes for style_tag_metadata
CREATE INDEX IF NOT EXISTS idx_style_tag_metadata_user_confidence ON style_tag_metadata(user_id, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_style_tag_metadata_signature_attrs_gin ON style_tag_metadata USING gin(signature_attributes);

-- ===========================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ===========================================

COMMENT ON TABLE interaction_events IS 'Tracks all user interactions for continuous learning';
COMMENT ON TABLE style_tag_metadata IS 'Stores rich metadata for each style tag';
COMMENT ON TABLE thompson_sampling_params IS 'Beta distribution parameters for Thompson Sampling';
COMMENT ON TABLE validation_results IS 'Stores validation results to prevent hallucinations';

COMMENT ON COLUMN interaction_events.event_type IS 'Type of interaction: view, scroll, regenerate, save, share, etc.';
COMMENT ON COLUMN style_tag_metadata.signature_attributes IS 'The DNA of this style tag (garment types, colors, fabrics, etc.)';
COMMENT ON COLUMN thompson_sampling_params.alpha IS 'Successes + 2 (Beta distribution parameter)';
COMMENT ON COLUMN validation_results.validation_score IS 'Overall validation confidence (0.0 to 1.0)';
