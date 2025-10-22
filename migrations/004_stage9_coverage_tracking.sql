-- Stage 9: Coverage Analysis & Gap Tracking Schema
-- Stores coverage reports and gaps for continuous improvement

-- Coverage reports table
CREATE TABLE IF NOT EXISTS coverage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  
  -- Attribute distribution data
  distribution JSONB NOT NULL,
  
  -- Coverage metrics
  metrics JSONB NOT NULL,
  
  -- Identified gaps
  gaps JSONB NOT NULL,
  
  -- Recommendations for Stage 4
  recommendations JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  CONSTRAINT unique_generation_coverage UNIQUE (generation_id)
);

CREATE INDEX idx_coverage_reports_generation ON coverage_reports(generation_id);
CREATE INDEX idx_coverage_reports_created_at ON coverage_reports(created_at DESC);

-- Create GIN indexes for JSON querying
CREATE INDEX idx_coverage_reports_metrics ON coverage_reports USING GIN (metrics);
CREATE INDEX idx_coverage_reports_gaps ON coverage_reports USING GIN (gaps);

-- Gap tracking table (for feeding back to Stage 4)
CREATE TABLE IF NOT EXISTS attribute_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Gap information
  attribute VARCHAR(50) NOT NULL,
  missing_values TEXT[] NOT NULL,
  underrepresented_values JSONB,
  
  -- Severity and priority
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  priority INTEGER DEFAULT 0,
  
  -- Coverage statistics
  current_coverage DECIMAL(5,2) NOT NULL,
  target_coverage DECIMAL(5,2) NOT NULL,
  gap_percentage DECIMAL(5,2) GENERATED ALWAYS AS (target_coverage - current_coverage) STORED,
  
  -- Stage 4 weight adjustments
  recommended_boost DECIMAL(3,2) DEFAULT 1.0,
  applied_boost DECIMAL(3,2),
  boost_applied_at TIMESTAMP,
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'identified' CHECK (status IN ('identified', 'in_progress', 'resolved', 'ignored')),
  
  -- Related coverage report
  coverage_report_id UUID REFERENCES coverage_reports(id) ON DELETE CASCADE,
  
  -- Timestamps
  identified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attribute_gaps_attribute ON attribute_gaps(attribute);
CREATE INDEX idx_attribute_gaps_severity ON attribute_gaps(severity);
CREATE INDEX idx_attribute_gaps_status ON attribute_gaps(status);
CREATE INDEX idx_attribute_gaps_coverage_report ON attribute_gaps(coverage_report_id);

-- DPP selection results table
CREATE TABLE IF NOT EXISTS dpp_selection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  
  -- Selection metadata
  input_count INTEGER NOT NULL,
  target_count INTEGER NOT NULL,
  selected_count INTEGER NOT NULL,
  
  -- Selected asset IDs
  selected_asset_ids UUID[] NOT NULL,
  rejected_asset_ids UUID[],
  
  -- Diversity metrics
  diversity_score DECIMAL(3,2) NOT NULL,
  avg_coverage DECIMAL(5,2),
  avg_pairwise_distance DECIMAL(10,6),
  
  -- Quality statistics
  avg_quality_score DECIMAL(5,2),
  min_quality_score DECIMAL(5,2),
  max_quality_score DECIMAL(5,2),
  
  -- Attribute coverage breakdown
  attribute_coverage JSONB,
  
  -- Performance
  selection_duration_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_generation_dpp UNIQUE (generation_id)
);

CREATE INDEX idx_dpp_results_generation ON dpp_selection_results(generation_id);
CREATE INDEX idx_dpp_results_diversity ON dpp_selection_results(diversity_score DESC);
CREATE INDEX idx_dpp_results_created_at ON dpp_selection_results(created_at DESC);

-- Create view for active gaps (for Stage 4 consumption)
CREATE OR REPLACE VIEW active_attribute_gaps AS
SELECT 
  attribute,
  severity,
  missing_values,
  underrepresented_values,
  current_coverage,
  target_coverage,
  gap_percentage,
  recommended_boost,
  applied_boost,
  status,
  identified_at,
  updated_at,
  -- Count how many times this gap has appeared recently
  (
    SELECT COUNT(*)
    FROM attribute_gaps ag2
    WHERE ag2.attribute = ag.attribute
      AND ag2.status = 'identified'
      AND ag2.identified_at >= NOW() - INTERVAL '7 days'
  ) as recent_occurrence_count
FROM attribute_gaps ag
WHERE status IN ('identified', 'in_progress')
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 4
    WHEN 'high' THEN 3
    WHEN 'medium' THEN 2
    ELSE 1
  END DESC,
  gap_percentage DESC;

-- Create view for coverage trends over time
CREATE OR REPLACE VIEW coverage_trends AS
SELECT 
  DATE(cr.created_at) as date,
  COUNT(*) as report_count,
  AVG((metrics->>'overallDiversityScore')::numeric) as avg_diversity_score,
  AVG((metrics->>'avgCoveragePercent')::numeric) as avg_coverage_percent,
  COUNT(CASE WHEN (SELECT COUNT(*) FROM jsonb_array_elements(gaps) WHERE value->>'severity' = 'critical') > 0 THEN 1 END) as reports_with_critical_gaps,
  COUNT(CASE WHEN (SELECT COUNT(*) FROM jsonb_array_elements(gaps) WHERE value->>'severity' = 'high') > 0 THEN 1 END) as reports_with_high_gaps
FROM coverage_reports cr
GROUP BY DATE(cr.created_at)
ORDER BY date DESC;

-- Create view for attribute-specific coverage over time
CREATE OR REPLACE VIEW attribute_coverage_history AS
SELECT 
  cr.generation_id,
  DATE(cr.created_at) as date,
  jsonb_object_keys(metrics) as attribute,
  (metrics->>jsonb_object_keys(metrics))::jsonb->>'coveragePercent' as coverage_percent,
  (metrics->>jsonb_object_keys(metrics))::jsonb->>'entropy' as entropy,
  cr.created_at
FROM coverage_reports cr
WHERE jsonb_object_keys(metrics) NOT IN ('overallDiversityScore', 'avgCoveragePercent')
ORDER BY cr.created_at DESC;

-- Function to auto-create gaps from coverage reports
CREATE OR REPLACE FUNCTION create_gaps_from_report()
RETURNS TRIGGER AS $$
DECLARE
  gap_record JSONB;
BEGIN
  -- Iterate through gaps in the report and create gap records
  FOR gap_record IN SELECT * FROM jsonb_array_elements(NEW.gaps)
  LOOP
    INSERT INTO attribute_gaps (
      attribute,
      missing_values,
      underrepresented_values,
      severity,
      current_coverage,
      target_coverage,
      recommended_boost,
      coverage_report_id,
      status
    ) VALUES (
      gap_record->>'attribute',
      ARRAY(SELECT jsonb_array_elements_text(gap_record->'uncoveredValues')),
      gap_record->'underrepresentedValues',
      gap_record->>'severity',
      (gap_record->>'currentCoverage')::numeric,
      (gap_record->>'targetCoverage')::numeric,
      (gap_record->>'recommendedBoost')::numeric,
      NEW.id,
      'identified'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create gaps when coverage report is inserted
CREATE TRIGGER trigger_create_gaps_from_report
AFTER INSERT ON coverage_reports
FOR EACH ROW
EXECUTE FUNCTION create_gaps_from_report();

-- Function to mark gaps as resolved when coverage improves
CREATE OR REPLACE FUNCTION check_gap_resolution()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark gaps as resolved if current coverage now meets target
  UPDATE attribute_gaps
  SET 
    status = 'resolved',
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE attribute = NEW.attribute
    AND status IN ('identified', 'in_progress')
    AND NEW.current_coverage >= NEW.target_coverage;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-resolve gaps
CREATE TRIGGER trigger_check_gap_resolution
AFTER INSERT ON attribute_gaps
FOR EACH ROW
EXECUTE FUNCTION check_gap_resolution();

-- Comments for documentation
COMMENT ON TABLE coverage_reports IS 'Stores coverage analysis results from Stage 9 DPP selection';
COMMENT ON TABLE attribute_gaps IS 'Tracks identified attribute coverage gaps for Stage 4 weight adjustment';
COMMENT ON TABLE dpp_selection_results IS 'Stores DPP selection metadata and diversity metrics';
COMMENT ON VIEW active_attribute_gaps IS 'Active gaps that need attention from Stage 4';
COMMENT ON VIEW coverage_trends IS 'Historical coverage trends over time';
COMMENT ON VIEW attribute_coverage_history IS 'Attribute-specific coverage history for trend analysis';

-- Insert initial configuration (optional)
-- This can be used to set up default target coverage thresholds
CREATE TABLE IF NOT EXISTS coverage_config (
  attribute VARCHAR(50) PRIMARY KEY,
  target_coverage DECIMAL(5,2) NOT NULL,
  weight_boost_enabled BOOLEAN DEFAULT TRUE,
  min_boost DECIMAL(3,2) DEFAULT 1.0,
  max_boost DECIMAL(3,2) DEFAULT 2.0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO coverage_config (attribute, target_coverage, min_boost, max_boost) VALUES
  ('garmentType', 80.0, 1.0, 2.0),
  ('silhouette', 75.0, 1.0, 1.8),
  ('fabrication', 70.0, 1.0, 1.6),
  ('neckline', 65.0, 1.0, 1.5),
  ('sleeves', 60.0, 1.0, 1.4),
  ('length', 60.0, 1.0, 1.4)
ON CONFLICT (attribute) DO NOTHING;

COMMENT ON TABLE coverage_config IS 'Configuration for coverage analysis thresholds and weight adjustments';
