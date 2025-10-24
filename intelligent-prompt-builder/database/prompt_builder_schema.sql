-- ============================================
-- INTELLIGENT PROMPT BUILDER DATABASE SCHEMA
-- ============================================

-- Table: prompts (updated)
-- Stores generated prompts with new structure
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  positive_prompt TEXT NOT NULL,
  negative_prompt TEXT,
  metadata JSONB,
  creativity DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_prompts_user_id (user_id),
  INDEX idx_prompts_created_at (created_at DESC),
  INDEX idx_prompts_metadata (metadata) USING GIN
);

-- Table: thompson_sampling_params
-- Stores alpha/beta parameters for Thompson Sampling
CREATE TABLE IF NOT EXISTS thompson_sampling_params (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,  -- 'garments', 'fabrics', 'colors', 'construction', 'photography'
  attribute VARCHAR(255) NOT NULL, -- specific value (e.g., 'blazer', 'wool', 'navy')
  alpha INTEGER DEFAULT 2,         -- success count
  beta INTEGER DEFAULT 2,          -- failure count
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE (user_id, category, attribute),
  
  -- Indexes
  INDEX idx_thompson_user_id (user_id),
  INDEX idx_thompson_category (category),
  INDEX idx_thompson_updated (updated_at DESC)
);

-- Table: prompt_feedback
-- Stores user feedback on generated images
CREATE TABLE IF NOT EXISTS prompt_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  image_id UUID,
  liked BOOLEAN DEFAULT FALSE,
  saved BOOLEAN DEFAULT FALSE,
  shared BOOLEAN DEFAULT FALSE,
  feedback_type VARCHAR(50), -- 'like', 'dislike', 'save', 'share'
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_feedback_user_id (user_id),
  INDEX idx_feedback_prompt_id (prompt_id),
  INDEX idx_feedback_created_at (created_at DESC)
);

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- View: Top performing prompts per user
CREATE OR REPLACE VIEW top_performing_prompts AS
SELECT 
  p.user_id,
  p.id as prompt_id,
  p.positive_prompt,
  p.metadata->>'garment_type' as garment_type,
  COUNT(CASE WHEN pf.liked THEN 1 END) as likes,
  COUNT(CASE WHEN pf.saved THEN 1 END) as saves,
  COUNT(CASE WHEN pf.shared THEN 1 END) as shares,
  (COUNT(CASE WHEN pf.liked THEN 1 END) + 
   COUNT(CASE WHEN pf.saved THEN 1 END) * 2 + 
   COUNT(CASE WHEN pf.shared THEN 1 END) * 3) as total_score,
  p.created_at
FROM prompts p
LEFT JOIN prompt_feedback pf ON p.id = pf.prompt_id
GROUP BY p.id, p.user_id, p.positive_prompt, p.metadata, p.created_at
HAVING COUNT(pf.id) > 0
ORDER BY total_score DESC;

-- View: Thompson Sampling effectiveness
CREATE OR REPLACE VIEW thompson_sampling_effectiveness AS
SELECT 
  user_id,
  category,
  attribute,
  alpha,
  beta,
  (alpha::DECIMAL / (alpha + beta)) as success_rate,
  (alpha + beta) as total_trials,
  updated_at
FROM thompson_sampling_params
WHERE (alpha + beta) > 5  -- Only show attributes with enough data
ORDER BY success_rate DESC, total_trials DESC;

-- View: Prompt generation stats per user
CREATE OR REPLACE VIEW prompt_generation_stats AS
SELECT 
  user_id,
  COUNT(*) as total_prompts,
  AVG(creativity) as avg_creativity,
  COUNT(CASE WHEN metadata->>'default' = 'true' THEN 1 END) as default_prompts,
  COUNT(CASE WHEN metadata->>'default' IS NULL THEN 1 END) as personalized_prompts,
  MIN(created_at) as first_prompt,
  MAX(created_at) as last_prompt
FROM prompts
GROUP BY user_id;

-- View: Category performance by user
CREATE OR REPLACE VIEW category_performance AS
SELECT 
  tsp.user_id,
  tsp.category,
  COUNT(*) as unique_attributes,
  AVG(tsp.alpha::DECIMAL / (tsp.alpha + tsp.beta)) as avg_success_rate,
  SUM(tsp.alpha) as total_successes,
  SUM(tsp.beta) as total_failures,
  MAX(tsp.updated_at) as last_updated
FROM thompson_sampling_params tsp
GROUP BY tsp.user_id, tsp.category;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Get user's best performing attributes
CREATE OR REPLACE FUNCTION get_top_attributes(
  p_user_id VARCHAR(255),
  p_category VARCHAR(100),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  attribute VARCHAR(255),
  success_rate DECIMAL,
  total_trials INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tsp.attribute,
    (tsp.alpha::DECIMAL / (tsp.alpha + tsp.beta)) as success_rate,
    (tsp.alpha + tsp.beta) as total_trials
  FROM thompson_sampling_params tsp
  WHERE tsp.user_id = p_user_id
    AND tsp.category = p_category
    AND (tsp.alpha + tsp.beta) >= 3  -- Minimum trials
  ORDER BY success_rate DESC, total_trials DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function: Reset Thompson parameters for user
CREATE OR REPLACE FUNCTION reset_thompson_params(p_user_id VARCHAR(255))
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM thompson_sampling_params
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Decay Thompson parameters (reduce confidence over time)
CREATE OR REPLACE FUNCTION decay_thompson_params(
  p_days_old INTEGER DEFAULT 90,
  p_decay_factor DECIMAL DEFAULT 0.5
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE thompson_sampling_params
  SET 
    alpha = GREATEST(2, FLOOR(alpha * p_decay_factor)),
    beta = GREATEST(2, FLOOR(beta * p_decay_factor)),
    updated_at = NOW()
  WHERE updated_at < (NOW() - (p_days_old || ' days')::INTERVAL);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA & INDEXES
-- ============================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompts_user_garment 
  ON prompts(user_id, (metadata->>'garment_type'));

CREATE INDEX IF NOT EXISTS idx_thompson_success_rate 
  ON thompson_sampling_params((alpha::DECIMAL / (alpha + beta)) DESC);

-- ============================================
-- PERMISSIONS (adjust as needed)
-- ============================================

-- GRANT SELECT, INSERT, UPDATE ON prompts TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON thompson_sampling_params TO app_user;
-- GRANT SELECT, INSERT ON prompt_feedback TO app_user;
-- GRANT SELECT ON top_performing_prompts TO app_user;
-- GRANT SELECT ON thompson_sampling_effectiveness TO app_user;
-- GRANT SELECT ON prompt_generation_stats TO app_user;
-- GRANT SELECT ON category_performance TO app_user;

-- ============================================
-- MAINTENANCE JOBS (run periodically)
-- ============================================

-- Job: Decay old Thompson parameters (run monthly)
-- SELECT decay_thompson_params(90, 0.7);

-- Job: Cleanup old prompts (run weekly)
-- DELETE FROM prompts WHERE created_at < NOW() - INTERVAL '6 months';

-- ============================================
-- MIGRATION NOTES
-- ============================================

/*
MIGRATION FROM OLD SYSTEM:

1. This schema is additive - existing tables remain untouched
2. Old `prompts` table columns can coexist:
   - Old: text, json_spec, mode, weights
   - New: positive_prompt, negative_prompt, metadata, creativity
3. Gradual migration:
   - Deploy new schema
   - Run IntelligentPromptBuilder in parallel
   - Compare outputs
   - Gradually switch traffic
   - Deprecate old columns

ROLLBACK PLAN:
- Old prompt builders (advancedPromptBuilderAgent, promptGeneratorAgent) 
  still work with existing schema
- Can switch back at any time
- New tables are isolated
*/
