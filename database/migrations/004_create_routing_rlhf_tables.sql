-- Migration: Create Routing and RLHF Tables for Stages 4-5
-- Created: 2025-10-10
-- Description: Tables for model routing decisions, RLHF optimization, and performance tracking

-- =====================================================
-- Table: routing_decisions
-- Stores model routing decisions and scores
-- =====================================================
CREATE TABLE IF NOT EXISTS routing_decisions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider_id VARCHAR(100) NOT NULL,
  prompt_text TEXT,
  score DECIMAL(5,4),
  features JSONB DEFAULT '{}'::jsonb,
  all_scores JSONB DEFAULT '[]'::jsonb,
  strategy VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_routing_decisions_user_id ON routing_decisions(user_id);
CREATE INDEX idx_routing_decisions_provider_id ON routing_decisions(provider_id);
CREATE INDEX idx_routing_decisions_created_at ON routing_decisions(created_at DESC);
CREATE INDEX idx_routing_decisions_features ON routing_decisions USING GIN(features);

COMMENT ON TABLE routing_decisions IS 'Model routing decisions for Stage 4';
COMMENT ON COLUMN routing_decisions.features IS 'Prompt features analyzed for routing (JSON)';
COMMENT ON COLUMN routing_decisions.all_scores IS 'All provider scores (JSON array)';

-- =====================================================
-- Table: prompt_optimizations
-- Stores RLHF prompt optimizations
-- =====================================================
CREATE TABLE IF NOT EXISTS prompt_optimizations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  original_prompt JSONB,
  optimized_prompt JSONB,
  reward_score DECIMAL(5,4),
  expected_reward DECIMAL(5,4),
  modifications JSONB DEFAULT '[]'::jsonb,
  successful_terms TEXT[],
  success_rate DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prompt_optimizations_user_id ON prompt_optimizations(user_id);
CREATE INDEX idx_prompt_optimizations_reward_score ON prompt_optimizations(reward_score DESC);
CREATE INDEX idx_prompt_optimizations_created_at ON prompt_optimizations(created_at DESC);
CREATE INDEX idx_prompt_optimizations_success_rate ON prompt_optimizations(success_rate DESC) WHERE success_rate > 0.7;

COMMENT ON TABLE prompt_optimizations IS 'RLHF prompt optimizations for Stage 5';
COMMENT ON COLUMN prompt_optimizations.modifications IS 'Applied modifications (JSON array)';
COMMENT ON COLUMN prompt_optimizations.successful_terms IS 'Terms that led to success';

-- =====================================================
-- Table: reward_scores
-- Stores reward scores from user feedback
-- =====================================================
CREATE TABLE IF NOT EXISTS reward_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_id INTEGER,
  image_id UUID REFERENCES images(id) ON DELETE CASCADE,
  feedback_type VARCHAR(50),
  total_reward DECIMAL(5,4),
  components JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reward_scores_user_id ON reward_scores(user_id);
CREATE INDEX idx_reward_scores_image_id ON reward_scores(image_id);
CREATE INDEX idx_reward_scores_feedback_type ON reward_scores(feedback_type);
CREATE INDEX idx_reward_scores_total_reward ON reward_scores(total_reward DESC);
CREATE INDEX idx_reward_scores_created_at ON reward_scores(created_at DESC);

COMMENT ON TABLE reward_scores IS 'Reward scores for RLHF learning';
COMMENT ON COLUMN reward_scores.components IS 'Reward component breakdown (JSON)';

-- =====================================================
-- Table: model_performance_metrics
-- Tracks performance of each model provider
-- =====================================================
CREATE TABLE IF NOT EXISTS model_performance_metrics (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider_id VARCHAR(100) NOT NULL,
  success_rate DECIMAL(5,4),
  quality_score DECIMAL(5,4),
  avg_latency INTEGER,
  avg_cost DECIMAL(10,4),
  total_generations INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_model_performance_user_id ON model_performance_metrics(user_id);
CREATE INDEX idx_model_performance_provider_id ON model_performance_metrics(provider_id);
CREATE INDEX idx_model_performance_success_rate ON model_performance_metrics(success_rate DESC);
CREATE INDEX idx_model_performance_quality_score ON model_performance_metrics(quality_score DESC);

COMMENT ON TABLE model_performance_metrics IS 'Performance metrics for each model provider';
COMMENT ON COLUMN model_performance_metrics.avg_latency IS 'Average generation time in milliseconds';
COMMENT ON COLUMN model_performance_metrics.avg_cost IS 'Average cost per generation';

-- =====================================================
-- Table: model_providers
-- Stores configuration for available model providers
-- =====================================================
CREATE TABLE IF NOT EXISTS model_providers (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cost_per_image DECIMAL(10,4),
  avg_quality DECIMAL(5,4),
  avg_latency INTEGER,
  max_resolution_width INTEGER,
  max_resolution_height INTEGER,
  strengths TEXT[],
  weaknesses TEXT[],
  supported_aspect_ratios TEXT[],
  rate_limit INTEGER,
  is_available BOOLEAN DEFAULT true,
  is_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_model_providers_available ON model_providers(is_available, is_enabled) WHERE is_available = true AND is_enabled = true;
CREATE INDEX idx_model_providers_cost ON model_providers(cost_per_image);
CREATE INDEX idx_model_providers_quality ON model_providers(avg_quality DESC);

COMMENT ON TABLE model_providers IS 'Configuration for image generation model providers';
COMMENT ON COLUMN model_providers.strengths IS 'Array of provider strengths';
COMMENT ON COLUMN model_providers.weaknesses IS 'Array of provider weaknesses';

-- =====================================================
-- Insert default model providers
-- =====================================================
INSERT INTO model_providers (id, name, cost_per_image, avg_quality, avg_latency, 
                             max_resolution_width, max_resolution_height,
                             strengths, weaknesses, supported_aspect_ratios, rate_limit)
VALUES 
  ('google-imagen', 'Google Imagen 3', 0.04, 0.90, 8000, 1024, 1024,
   ARRAY['photorealism', 'fashion', 'complex-compositions', 'color-accuracy'],
   ARRAY['abstract-art', 'text-in-image'],
   ARRAY['1:1', '16:9', '9:16', '4:3', '3:4'], 100),
  
  ('openai-dalle3', 'DALL-E 3', 0.08, 0.88, 12000, 1024, 1024,
   ARRAY['artistic', 'creative-concepts', 'text-in-image', 'diverse-styles'],
   ARRAY['photorealism', 'specific-fashion-details'],
   ARRAY['1:1', '16:9', '9:16'], 50),
  
  ('midjourney-v6', 'Midjourney v6', 0.06, 0.92, 25000, 2048, 2048,
   ARRAY['artistic', 'fashion', 'editorial', 'style-consistency'],
   ARRAY['speed', 'api-access'],
   ARRAY['1:1', '2:3', '3:2', '16:9', '9:16'], 20),
  
  ('stable-diffusion-xl', 'Stable Diffusion XL', 0.02, 0.82, 6000, 1024, 1024,
   ARRAY['cost-effective', 'fast', 'customizable', 'flexibility'],
   ARRAY['quality-consistency', 'fashion-accuracy'],
   ARRAY['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'], 200)
ON CONFLICT (id) DO UPDATE SET
  cost_per_image = EXCLUDED.cost_per_image,
  avg_quality = EXCLUDED.avg_quality,
  avg_latency = EXCLUDED.avg_latency,
  updated_at = NOW();

-- =====================================================
-- Update generation_jobs table to include routing info
-- =====================================================
ALTER TABLE generation_jobs 
ADD COLUMN IF NOT EXISTS routing_decision_id INTEGER REFERENCES routing_decisions(id),
ADD COLUMN IF NOT EXISTS rlhf_optimization_id INTEGER REFERENCES prompt_optimizations(id),
ADD COLUMN IF NOT EXISTS selected_provider VARCHAR(100) REFERENCES model_providers(id);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_routing ON generation_jobs(routing_decision_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_rlhf ON generation_jobs(rlhf_optimization_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_provider ON generation_jobs(selected_provider);

-- =====================================================
-- Function: Update model performance metrics
-- =====================================================
CREATE OR REPLACE FUNCTION update_model_performance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO model_performance_metrics 
    (user_id, provider_id, success_rate, quality_score, avg_latency, avg_cost, total_generations)
  VALUES 
    (NEW.user_id, NEW.selected_provider, 
     CASE WHEN NEW.status = 'completed' THEN 1.0 ELSE 0.0 END,
     0.8, -- placeholder, should come from actual quality metrics
     EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at)) * 1000,
     0.04, -- placeholder, should come from actual cost
     1)
  ON CONFLICT (user_id, provider_id) 
  DO UPDATE SET
    success_rate = (model_performance_metrics.success_rate * model_performance_metrics.total_generations + 
                   CASE WHEN NEW.status = 'completed' THEN 1.0 ELSE 0.0 END) / 
                   (model_performance_metrics.total_generations + 1),
    total_generations = model_performance_metrics.total_generations + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Auto-update performance metrics on job completion
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_model_performance ON generation_jobs;
CREATE TRIGGER trigger_update_model_performance
  AFTER INSERT OR UPDATE OF status ON generation_jobs
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'failed') AND NEW.selected_provider IS NOT NULL)
  EXECUTE FUNCTION update_model_performance();

-- =====================================================
-- Views for analytics
-- =====================================================

-- View: Routing performance by provider
CREATE OR REPLACE VIEW v_routing_performance AS
SELECT 
  provider_id,
  COUNT(*) as total_decisions,
  AVG(score) as avg_score,
  COUNT(DISTINCT user_id) as unique_users,
  DATE_TRUNC('day', created_at) as decision_date
FROM routing_decisions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY provider_id, DATE_TRUNC('day', created_at)
ORDER BY decision_date DESC, total_decisions DESC;

-- View: RLHF optimization performance
CREATE OR REPLACE VIEW v_rlhf_performance AS
SELECT 
  user_id,
  COUNT(*) as total_optimizations,
  AVG(reward_score) as avg_reward,
  AVG(expected_reward) as avg_expected,
  AVG(expected_reward - reward_score) as avg_improvement,
  DATE_TRUNC('week', created_at) as optimization_week
FROM prompt_optimizations
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY user_id, DATE_TRUNC('week', created_at)
ORDER BY optimization_week DESC, total_optimizations DESC;

-- View: Model provider comparison
CREATE OR REPLACE VIEW v_model_provider_comparison AS
SELECT 
  mp.id,
  mp.name,
  mp.cost_per_image,
  mp.avg_quality as configured_quality,
  COALESCE(AVG(mpm.quality_score), mp.avg_quality) as actual_quality,
  COALESCE(AVG(mpm.success_rate), 0.8) as success_rate,
  COUNT(rd.id) as times_selected,
  mp.is_available,
  mp.is_enabled
FROM model_providers mp
LEFT JOIN routing_decisions rd ON mp.id = rd.provider_id
LEFT JOIN model_performance_metrics mpm ON mp.id = mpm.provider_id
WHERE mp.is_available = true
GROUP BY mp.id, mp.name, mp.cost_per_image, mp.avg_quality, mp.is_available, mp.is_enabled
ORDER BY times_selected DESC;

-- =====================================================
-- Grants (adjust as needed for your security model)
-- =====================================================
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO your_app_role;
-- GRANT SELECT ON ALL VIEWS IN SCHEMA public TO your_app_role;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_role;
