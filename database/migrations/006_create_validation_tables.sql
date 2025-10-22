-- Migration: Create Validation Tables for Stage 8
-- Created: 2025-10-11
-- Description: Tables for VLT validation, consistency scoring, and quality control

-- =====================================================
-- Table: validation_results
-- Main validation tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS validation_results (
  id SERIAL PRIMARY KEY,
  generation_id VARCHAR(100) NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  asset_id INTEGER REFERENCES generation_assets(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  overall_score DECIMAL(5,2),
  consistency_score DECIMAL(5,2),
  style_consistency_score DECIMAL(5,2),
  is_outlier BOOLEAN DEFAULT FALSE,
  outlier_score DECIMAL(5,4),
  is_flagged BOOLEAN DEFAULT FALSE,
  is_rejected BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,
  validation_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_validation_results_generation_id ON validation_results(generation_id);
CREATE INDEX idx_validation_results_asset_id ON validation_results(asset_id);
CREATE INDEX idx_validation_results_status ON validation_results(status);
CREATE INDEX idx_validation_results_overall_score ON validation_results(overall_score DESC);
CREATE INDEX idx_validation_results_is_outlier ON validation_results(is_outlier);
CREATE INDEX idx_validation_results_is_flagged ON validation_results(is_flagged);
CREATE INDEX idx_validation_results_is_rejected ON validation_results(is_rejected);
CREATE INDEX idx_validation_results_created_at ON validation_results(created_at DESC);

COMMENT ON TABLE validation_results IS 'VLT validation results and quality scores';
COMMENT ON COLUMN validation_results.status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN validation_results.overall_score IS 'Overall validation score 0-100';
COMMENT ON COLUMN validation_results.consistency_score IS 'Attribute consistency score 0-100';
COMMENT ON COLUMN validation_results.style_consistency_score IS 'Style consistency score 0-100';
COMMENT ON COLUMN validation_results.is_outlier IS 'Flagged as outlier by Isolation Forest';
COMMENT ON COLUMN validation_results.outlier_score IS 'Outlier score from -1 (outlier) to 1 (inlier)';
COMMENT ON COLUMN validation_results.validation_data IS 'Full validation data including VLT analysis and comparisons';

-- =====================================================
-- Table: attribute_comparisons
-- Detailed attribute-level comparisons
-- =====================================================
CREATE TABLE IF NOT EXISTS attribute_comparisons (
  id SERIAL PRIMARY KEY,
  validation_result_id INTEGER NOT NULL REFERENCES validation_results(id) ON DELETE CASCADE,
  attribute_name VARCHAR(100) NOT NULL,
  target_value TEXT,
  detected_value TEXT,
  match_type VARCHAR(50),
  similarity_score DECIMAL(5,2),
  is_match BOOLEAN,
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_attribute_comparisons_validation_id ON attribute_comparisons(validation_result_id);
CREATE INDEX idx_attribute_comparisons_attribute_name ON attribute_comparisons(attribute_name);
CREATE INDEX idx_attribute_comparisons_is_match ON attribute_comparisons(is_match);
CREATE INDEX idx_attribute_comparisons_similarity_score ON attribute_comparisons(similarity_score DESC);

COMMENT ON TABLE attribute_comparisons IS 'Detailed attribute-level validation comparisons';
COMMENT ON COLUMN attribute_comparisons.match_type IS 'Match type: exact, partial, semantic, none';
COMMENT ON COLUMN attribute_comparisons.similarity_score IS 'Similarity score 0-100 for partial/semantic matches';
COMMENT ON COLUMN attribute_comparisons.weight IS 'Weight for this attribute in overall score calculation';

-- =====================================================
-- Table: validation_embeddings
-- Store embeddings for style consistency analysis
-- =====================================================
CREATE TABLE IF NOT EXISTS validation_embeddings (
  id SERIAL PRIMARY KEY,
  validation_result_id INTEGER NOT NULL REFERENCES validation_results(id) ON DELETE CASCADE,
  embedding_type VARCHAR(50) NOT NULL,
  embedding_vector FLOAT8[] NOT NULL,
  cluster_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_validation_embeddings_validation_id ON validation_embeddings(validation_result_id);
CREATE INDEX idx_validation_embeddings_type ON validation_embeddings(embedding_type);
CREATE INDEX idx_validation_embeddings_cluster_id ON validation_embeddings(cluster_id);

COMMENT ON TABLE validation_embeddings IS 'Embeddings for style consistency analysis';
COMMENT ON COLUMN validation_embeddings.embedding_type IS 'Type: color_histogram, clip_embedding, etc.';
COMMENT ON COLUMN validation_embeddings.cluster_id IS 'Assigned cluster from GMM clustering';

-- =====================================================
-- Table: validation_metrics
-- Aggregate metrics for monitoring
-- =====================================================
CREATE TABLE IF NOT EXISTS validation_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  provider_id VARCHAR(100) REFERENCES model_providers(id),
  total_validations INTEGER DEFAULT 0,
  passed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  outlier_count INTEGER DEFAULT 0,
  avg_overall_score DECIMAL(5,2),
  avg_consistency_score DECIMAL(5,2),
  avg_style_score DECIMAL(5,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_validation_metrics_date_provider ON validation_metrics(metric_date, COALESCE(provider_id, 'all'));
CREATE INDEX idx_validation_metrics_date ON validation_metrics(metric_date DESC);
CREATE INDEX idx_validation_metrics_provider_id ON validation_metrics(provider_id);

COMMENT ON TABLE validation_metrics IS 'Daily aggregate validation metrics';
COMMENT ON COLUMN validation_metrics.metric_date IS 'Date for the metrics';
COMMENT ON COLUMN validation_metrics.provider_id IS 'Provider ID or NULL for overall metrics';

-- =====================================================
-- Function: Update validation updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_validation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Auto-update updated_at for validation_results
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_validation_updated_at ON validation_results;
CREATE TRIGGER trigger_update_validation_updated_at
  BEFORE UPDATE ON validation_results
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_updated_at();

-- =====================================================
-- Trigger: Auto-update updated_at for validation_metrics
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_validation_metrics_updated_at ON validation_metrics;
CREATE TRIGGER trigger_update_validation_metrics_updated_at
  BEFORE UPDATE ON validation_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_updated_at();

-- =====================================================
-- Function: Update validation metrics
-- Called after validation completion
-- =====================================================
CREATE OR REPLACE FUNCTION update_validation_metrics_from_result()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_id VARCHAR(100);
  v_passed BOOLEAN;
BEGIN
  -- Only process completed validations
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;
  
  -- Get provider from generation asset
  SELECT ga.provider_id INTO v_provider_id
  FROM generation_assets ga
  WHERE ga.id = NEW.asset_id;
  
  -- Determine if validation passed (score >= 70 and not rejected)
  v_passed := (NEW.overall_score >= 70.0 AND NEW.is_rejected = FALSE);
  
  -- Update or insert metrics for this provider
  INSERT INTO validation_metrics (
    metric_date,
    provider_id,
    total_validations,
    passed_count,
    failed_count,
    outlier_count,
    avg_overall_score,
    avg_consistency_score,
    avg_style_score
  ) VALUES (
    CURRENT_DATE,
    v_provider_id,
    1,
    CASE WHEN v_passed THEN 1 ELSE 0 END,
    CASE WHEN v_passed THEN 0 ELSE 1 END,
    CASE WHEN NEW.is_outlier THEN 1 ELSE 0 END,
    NEW.overall_score,
    NEW.consistency_score,
    NEW.style_consistency_score
  )
  ON CONFLICT (metric_date, COALESCE(provider_id, 'all'))
  DO UPDATE SET
    total_validations = validation_metrics.total_validations + 1,
    passed_count = validation_metrics.passed_count + CASE WHEN v_passed THEN 1 ELSE 0 END,
    failed_count = validation_metrics.failed_count + CASE WHEN v_passed THEN 0 ELSE 1 END,
    outlier_count = validation_metrics.outlier_count + CASE WHEN NEW.is_outlier THEN 1 ELSE 0 END,
    avg_overall_score = (
      (validation_metrics.avg_overall_score * validation_metrics.total_validations + NEW.overall_score) / 
      (validation_metrics.total_validations + 1)
    ),
    avg_consistency_score = (
      (validation_metrics.avg_consistency_score * validation_metrics.total_validations + NEW.consistency_score) / 
      (validation_metrics.total_validations + 1)
    ),
    avg_style_score = (
      (validation_metrics.avg_style_score * validation_metrics.total_validations + NEW.style_consistency_score) / 
      (validation_metrics.total_validations + 1)
    ),
    updated_at = NOW();
  
  -- Also update overall metrics (NULL provider_id)
  INSERT INTO validation_metrics (
    metric_date,
    provider_id,
    total_validations,
    passed_count,
    failed_count,
    outlier_count,
    avg_overall_score,
    avg_consistency_score,
    avg_style_score
  ) VALUES (
    CURRENT_DATE,
    NULL,
    1,
    CASE WHEN v_passed THEN 1 ELSE 0 END,
    CASE WHEN v_passed THEN 0 ELSE 1 END,
    CASE WHEN NEW.is_outlier THEN 1 ELSE 0 END,
    NEW.overall_score,
    NEW.consistency_score,
    NEW.style_consistency_score
  )
  ON CONFLICT (metric_date, COALESCE(provider_id, 'all'))
  DO UPDATE SET
    total_validations = validation_metrics.total_validations + 1,
    passed_count = validation_metrics.passed_count + CASE WHEN v_passed THEN 1 ELSE 0 END,
    failed_count = validation_metrics.failed_count + CASE WHEN v_passed THEN 0 ELSE 1 END,
    outlier_count = validation_metrics.outlier_count + CASE WHEN NEW.is_outlier THEN 1 ELSE 0 END,
    avg_overall_score = (
      (validation_metrics.avg_overall_score * validation_metrics.total_validations + NEW.overall_score) / 
      (validation_metrics.total_validations + 1)
    ),
    avg_consistency_score = (
      (validation_metrics.avg_consistency_score * validation_metrics.total_validations + NEW.consistency_score) / 
      (validation_metrics.total_validations + 1)
    ),
    avg_style_score = (
      (validation_metrics.avg_style_score * validation_metrics.total_validations + NEW.style_consistency_score) / 
      (validation_metrics.total_validations + 1)
    ),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Update metrics on validation completion
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_validation_metrics ON validation_results;
CREATE TRIGGER trigger_update_validation_metrics
  AFTER INSERT OR UPDATE OF status ON validation_results
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_metrics_from_result();

-- =====================================================
-- View: validation_summary
-- Convenient view for validation stats
-- =====================================================
CREATE OR REPLACE VIEW validation_summary AS
SELECT 
  vr.id,
  vr.generation_id,
  vr.asset_id,
  vr.status,
  vr.overall_score,
  vr.consistency_score,
  vr.style_consistency_score,
  vr.is_outlier,
  vr.is_flagged,
  vr.is_rejected,
  vr.rejection_reason,
  ga.cdn_url,
  ga.provider_id,
  mp.name as provider_name,
  g.user_id,
  vr.created_at,
  vr.updated_at,
  COUNT(ac.id) as attribute_count,
  SUM(CASE WHEN ac.is_match THEN 1 ELSE 0 END) as matched_attributes,
  AVG(ac.similarity_score) as avg_similarity_score
FROM validation_results vr
LEFT JOIN generation_assets ga ON vr.asset_id = ga.id
LEFT JOIN model_providers mp ON ga.provider_id = mp.id
LEFT JOIN generations g ON vr.generation_id = g.id
LEFT JOIN attribute_comparisons ac ON vr.id = ac.validation_result_id
GROUP BY vr.id, ga.cdn_url, ga.provider_id, mp.name, g.user_id;

COMMENT ON VIEW validation_summary IS 'Summary view of validations with stats';

-- =====================================================
-- View: provider_validation_stats
-- Per-provider validation statistics
-- =====================================================
CREATE OR REPLACE VIEW provider_validation_stats AS
SELECT 
  mp.id as provider_id,
  mp.name as provider_name,
  COUNT(vr.id) as total_validations,
  SUM(CASE WHEN vr.overall_score >= 70 AND vr.is_rejected = FALSE THEN 1 ELSE 0 END) as passed_count,
  SUM(CASE WHEN vr.overall_score < 70 OR vr.is_rejected = TRUE THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN vr.is_outlier THEN 1 ELSE 0 END) as outlier_count,
  SUM(CASE WHEN vr.is_flagged THEN 1 ELSE 0 END) as flagged_count,
  SUM(CASE WHEN vr.is_rejected THEN 1 ELSE 0 END) as rejected_count,
  AVG(vr.overall_score) as avg_overall_score,
  AVG(vr.consistency_score) as avg_consistency_score,
  AVG(vr.style_consistency_score) as avg_style_score,
  STDDEV(vr.overall_score) as stddev_overall_score,
  MIN(vr.overall_score) as min_overall_score,
  MAX(vr.overall_score) as max_overall_score,
  (SUM(CASE WHEN vr.overall_score >= 70 AND vr.is_rejected = FALSE THEN 1 ELSE 0 END)::FLOAT / 
   NULLIF(COUNT(vr.id), 0) * 100) as pass_rate,
  MAX(vr.created_at) as last_validation_at
FROM model_providers mp
LEFT JOIN generation_assets ga ON mp.id = ga.provider_id
LEFT JOIN validation_results vr ON ga.id = vr.asset_id AND vr.status = 'completed'
GROUP BY mp.id, mp.name;

COMMENT ON VIEW provider_validation_stats IS 'Per-provider validation statistics and quality metrics';

-- =====================================================
-- View: recent_flagged_validations
-- Recent flagged or rejected validations for review
-- =====================================================
CREATE OR REPLACE VIEW recent_flagged_validations AS
SELECT 
  vr.id,
  vr.generation_id,
  vr.asset_id,
  ga.cdn_url,
  mp.name as provider_name,
  vr.overall_score,
  vr.consistency_score,
  vr.is_outlier,
  vr.is_flagged,
  vr.is_rejected,
  vr.rejection_reason,
  vr.created_at,
  g.user_id
FROM validation_results vr
JOIN generation_assets ga ON vr.asset_id = ga.id
LEFT JOIN model_providers mp ON ga.provider_id = mp.id
JOIN generations g ON vr.generation_id = g.id
WHERE (vr.is_flagged = TRUE OR vr.is_rejected = TRUE)
  AND vr.status = 'completed'
ORDER BY vr.created_at DESC;

COMMENT ON VIEW recent_flagged_validations IS 'Recent flagged or rejected validations for review';
