-- Migration: Create Generation Tables for Stage 6
-- Created: 2025-10-10
-- Description: Tables for image generations, assets, and feedback

-- =====================================================
-- Table: generations
-- Main generation tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS generations (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  cost DECIMAL(10,4),
  settings JSONB DEFAULT '{}'::jsonb,
  pipeline_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX idx_generations_completed_at ON generations(completed_at DESC) WHERE completed_at IS NOT NULL;

COMMENT ON TABLE generations IS 'Image generation requests and status tracking';
COMMENT ON COLUMN generations.status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN generations.pipeline_data IS 'Full pipeline data (VLT, enhancement, routing, RLHF)';
COMMENT ON COLUMN generations.settings IS 'Generation settings as JSON';

-- =====================================================
-- Table: generation_assets
-- Stores generated images and related assets
-- =====================================================
CREATE TABLE IF NOT EXISTS generation_assets (
  id SERIAL PRIMARY KEY,
  generation_id VARCHAR(100) NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  r2_key VARCHAR(500) NOT NULL,
  cdn_url TEXT NOT NULL,
  asset_type VARCHAR(50) DEFAULT 'image',
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  provider_id VARCHAR(100) REFERENCES model_providers(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_generation_assets_generation_id ON generation_assets(generation_id);
CREATE INDEX idx_generation_assets_provider_id ON generation_assets(provider_id);
CREATE INDEX idx_generation_assets_created_at ON generation_assets(created_at DESC);

COMMENT ON TABLE generation_assets IS 'Generated images and assets';
COMMENT ON COLUMN generation_assets.r2_key IS 'Cloudflare R2 storage key';
COMMENT ON COLUMN generation_assets.cdn_url IS 'Public CDN URL';
COMMENT ON COLUMN generation_assets.asset_type IS 'Type: image, thumbnail, etc.';

-- =====================================================
-- Table: generation_feedback
-- User feedback on generated images
-- =====================================================
CREATE TABLE IF NOT EXISTS generation_feedback (
  id SERIAL PRIMARY KEY,
  generation_id VARCHAR(100) NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  asset_id INTEGER REFERENCES generation_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feedback_type VARCHAR(50) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_generation_feedback_generation_id ON generation_feedback(generation_id);
CREATE INDEX idx_generation_feedback_asset_id ON generation_feedback(asset_id);
CREATE INDEX idx_generation_feedback_user_id ON generation_feedback(user_id);
CREATE INDEX idx_generation_feedback_type ON generation_feedback(feedback_type);
CREATE INDEX idx_generation_feedback_created_at ON generation_feedback(created_at DESC);

COMMENT ON TABLE generation_feedback IS 'User feedback on generated images';
COMMENT ON COLUMN generation_feedback.feedback_type IS 'Type: outlier, heart, comment, rating';
COMMENT ON COLUMN generation_feedback.rating IS 'User rating 1-5 stars';

-- =====================================================
-- Function: Update generation updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_generation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Auto-update updated_at for generations
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_generation_updated_at ON generations;
CREATE TRIGGER trigger_update_generation_updated_at
  BEFORE UPDATE ON generations
  FOR EACH ROW
  EXECUTE FUNCTION update_generation_updated_at();

-- =====================================================
-- View: generation_summary
-- Convenient view for generation stats
-- =====================================================
CREATE OR REPLACE VIEW generation_summary AS
SELECT 
  g.id,
  g.user_id,
  g.status,
  g.cost,
  g.created_at,
  g.completed_at,
  COUNT(ga.id) as asset_count,
  EXTRACT(EPOCH FROM (COALESCE(g.completed_at, NOW()) - g.created_at)) as duration_seconds,
  (g.pipeline_data->>'routing'->'provider'->>'name')::text as provider_name
FROM generations g
LEFT JOIN generation_assets ga ON g.id = ga.generation_id
GROUP BY g.id;

COMMENT ON VIEW generation_summary IS 'Summary view of generations with stats';

-- =====================================================
-- View: user_generation_stats
-- User statistics
-- =====================================================
CREATE OR REPLACE VIEW user_generation_stats AS
SELECT 
  user_id,
  COUNT(*) as total_generations,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(cost) as total_cost,
  AVG(cost) as avg_cost_per_generation,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds,
  MAX(created_at) as last_generation_at
FROM generations
WHERE user_id IS NOT NULL
GROUP BY user_id;

COMMENT ON VIEW user_generation_stats IS 'Per-user generation statistics';
