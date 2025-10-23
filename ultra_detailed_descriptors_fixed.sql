/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DATABASE MIGRATION: Ultra-Detailed Descriptors (FIXED VERSION)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This creates a new table for ultra-detailed image analysis.
 * The old image_descriptors table remains for backward compatibility.
 * 
 * RUN THIS MIGRATION BEFORE deploying the new ingestion agent.
 */

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Create the new ultra_detailed_descriptors table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ultra_detailed_descriptors (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL UNIQUE REFERENCES portfolio_images(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Complete ultra-detailed analysis (JSONB for flexibility)
  executive_summary JSONB NOT NULL,
  garments JSONB NOT NULL,
  model_demographics JSONB,
  photography JSONB NOT NULL,
  styling_context JSONB,
  contextual_attributes JSONB,
  technical_fashion_notes JSONB,
  metadata JSONB NOT NULL,
  
  -- Quality metrics (extracted for fast querying)
  completeness_percentage NUMERIC DEFAULT 0,
  overall_confidence NUMERIC DEFAULT 0,
  
  -- Generated columns for fast querying (simplified version without subqueries)
  primary_garment TEXT,
  garment_count INT,
  fabric_type TEXT,
  dominant_colors TEXT[],
  model_ethnicity TEXT,
  model_body_type TEXT,
  shot_type TEXT,
  lighting_type TEXT,
  season TEXT,
  occasion TEXT,
  style_aesthetic TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create indexes for fast querying
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_ultra_user_id ON ultra_detailed_descriptors(user_id);
CREATE INDEX IF NOT EXISTS idx_ultra_image_id ON ultra_detailed_descriptors(image_id);
CREATE INDEX IF NOT EXISTS idx_ultra_primary_garment ON ultra_detailed_descriptors(primary_garment);
CREATE INDEX IF NOT EXISTS idx_ultra_fabric_type ON ultra_detailed_descriptors(fabric_type);
CREATE INDEX IF NOT EXISTS idx_ultra_dominant_colors ON ultra_detailed_descriptors USING gin(dominant_colors);
CREATE INDEX IF NOT EXISTS idx_ultra_model_body_type ON ultra_detailed_descriptors(model_body_type);
CREATE INDEX IF NOT EXISTS idx_ultra_shot_type ON ultra_detailed_descriptors(shot_type);
CREATE INDEX IF NOT EXISTS idx_ultra_season ON ultra_detailed_descriptors(season);
CREATE INDEX IF NOT EXISTS idx_ultra_occasion ON ultra_detailed_descriptors(occasion);
CREATE INDEX IF NOT EXISTS idx_ultra_style_aesthetic ON ultra_detailed_descriptors(style_aesthetic);
CREATE INDEX IF NOT EXISTS idx_ultra_confidence ON ultra_detailed_descriptors(overall_confidence);
CREATE INDEX IF NOT EXISTS idx_ultra_completeness ON ultra_detailed_descriptors(completeness_percentage);
CREATE INDEX IF NOT EXISTS idx_ultra_created_at ON ultra_detailed_descriptors(created_at);

-- Full-text search on JSON
CREATE INDEX IF NOT EXISTS idx_ultra_fulltext ON ultra_detailed_descriptors 
  USING gin(to_tsvector('english', 
    COALESCE(executive_summary::text, '') || ' ' ||
    COALESCE(garments::text, '') || ' ' ||
    COALESCE(styling_context::text, '')
  ));

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Create quality monitoring table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS descriptor_quality_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descriptor_id UUID REFERENCES ultra_detailed_descriptors(id) ON DELETE CASCADE,
  image_id UUID REFERENCES portfolio_images(id),
  user_id UUID REFERENCES users(id),
  
  -- Quality metrics
  overall_confidence NUMERIC,
  completeness_percentage NUMERIC,
  garment_count INT,
  
  -- Flags
  requires_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  
  -- Timestamps
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quality_log_requires_review 
  ON descriptor_quality_log(requires_review) 
  WHERE requires_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_quality_log_logged_at ON descriptor_quality_log(logged_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Create user corrections table (for continuous improvement)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS descriptor_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descriptor_id UUID REFERENCES ultra_detailed_descriptors(id) ON DELETE CASCADE,
  image_id UUID REFERENCES portfolio_images(id),
  user_id UUID REFERENCES users(id),
  
  -- Correction details
  field_path TEXT NOT NULL,  -- e.g., 'garments[0].fabric.primary_material'
  ai_value TEXT,
  corrected_value TEXT NOT NULL,
  
  -- Metadata
  corrected_by UUID REFERENCES users(id),
  correction_reason TEXT,
  
  -- Timestamps
  corrected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corrections_field_path ON descriptor_corrections(field_path);
CREATE INDEX IF NOT EXISTS idx_corrections_descriptor ON descriptor_corrections(descriptor_id);
CREATE INDEX IF NOT EXISTS idx_corrections_corrected_at ON descriptor_corrections(corrected_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Create useful views for analysis
-- ═══════════════════════════════════════════════════════════════════════════════

-- View: Low quality analyses requiring review
CREATE OR REPLACE VIEW low_quality_descriptors AS
SELECT 
  id,
  image_id,
  user_id,
  primary_garment,
  overall_confidence,
  completeness_percentage,
  created_at,
  metadata->'uncertain_details' as uncertain_details,
  metadata->'recommendations' as recommendations
FROM ultra_detailed_descriptors
WHERE overall_confidence < 0.70 OR completeness_percentage < 70
ORDER BY overall_confidence ASC, completeness_percentage ASC;

-- View: Daily quality metrics
CREATE OR REPLACE VIEW daily_quality_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as analysis_date,
  COUNT(*) as images_analyzed,
  AVG(overall_confidence) as avg_confidence,
  AVG(completeness_percentage) as avg_completeness,
  COUNT(*) FILTER (WHERE overall_confidence >= 0.80) as high_confidence_count,
  COUNT(*) FILTER (WHERE overall_confidence < 0.70) as low_confidence_count,
  COUNT(*) FILTER (WHERE garment_count > 1) as multi_layer_count
FROM ultra_detailed_descriptors
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY analysis_date DESC;

-- View: Most corrected fields (for prompt improvement)
CREATE OR REPLACE VIEW most_corrected_fields AS
SELECT 
  field_path,
  COUNT(*) as correction_count,
  array_agg(DISTINCT ai_value) as common_ai_values,
  array_agg(DISTINCT corrected_value) as common_corrections
FROM descriptor_corrections
WHERE corrected_at > NOW() - INTERVAL '30 days'
GROUP BY field_path
ORDER BY correction_count DESC
LIMIT 50;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 6: Create helper functions
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to get garment preferences for a user
CREATE OR REPLACE FUNCTION get_user_garment_preferences(p_user_id UUID)
RETURNS TABLE (
  garment_type TEXT,
  times_seen BIGINT,
  avg_confidence NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    primary_garment as garment_type,
    COUNT(*) as times_seen,
    AVG(overall_confidence) as avg_confidence
  FROM ultra_detailed_descriptors
  WHERE user_id = p_user_id AND primary_garment IS NOT NULL
  GROUP BY primary_garment
  ORDER BY times_seen DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get color preferences for a user
CREATE OR REPLACE FUNCTION get_user_color_preferences(p_user_id UUID)
RETURNS TABLE (
  color_name TEXT,
  times_seen BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnest(dominant_colors) as color_name,
    COUNT(*) as times_seen
  FROM ultra_detailed_descriptors
  WHERE user_id = p_user_id AND dominant_colors IS NOT NULL
  GROUP BY color_name
  ORDER BY times_seen DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to flag low quality descriptors
CREATE OR REPLACE FUNCTION flag_low_quality_descriptors()
RETURNS INTEGER AS $$
DECLARE
  flagged_count INTEGER;
BEGIN
  INSERT INTO descriptor_quality_log (
    descriptor_id,
    image_id,
    user_id,
    overall_confidence,
    completeness_percentage,
    garment_count,
    requires_review,
    review_reason
  )
  SELECT 
    id,
    image_id,
    user_id,
    overall_confidence,
    completeness_percentage,
    garment_count,
    TRUE,
    CASE 
      WHEN overall_confidence < 0.60 THEN 'Very low confidence'
      WHEN overall_confidence < 0.70 THEN 'Low confidence'
      WHEN completeness_percentage < 60 THEN 'Very low completeness'
      WHEN completeness_percentage < 70 THEN 'Low completeness'
      ELSE 'Review required'
    END
  FROM ultra_detailed_descriptors
  WHERE (overall_confidence < 0.70 OR completeness_percentage < 70)
    AND created_at > NOW() - INTERVAL '1 day'
    AND NOT EXISTS (
      SELECT 1 FROM descriptor_quality_log 
      WHERE descriptor_quality_log.descriptor_id = ultra_detailed_descriptors.id
    );
  
  GET DIAGNOSTICS flagged_count = ROW_COUNT;
  RETURN flagged_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 7: Set up automated quality monitoring (optional)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create a scheduled job to flag low quality descriptors (requires pg_cron extension)
-- Uncomment if you have pg_cron installed:

/*
SELECT cron.schedule(
  'flag-low-quality-descriptors',
  '0 2 * * *',  -- Every day at 2 AM
  $$SELECT flag_low_quality_descriptors();$$
);
*/

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verify the migration
DO $$ 
DECLARE
  table_count INT;
  index_count INT;
  view_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_name IN ('ultra_detailed_descriptors', 'descriptor_quality_log', 'descriptor_corrections');
  
  SELECT COUNT(*) INTO index_count 
  FROM pg_indexes 
  WHERE tablename = 'ultra_detailed_descriptors';
  
  SELECT COUNT(*) INTO view_count 
  FROM information_schema.views 
  WHERE table_name IN ('low_quality_descriptors', 'daily_quality_metrics', 'most_corrected_fields');
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Tables created: %', table_count;
  RAISE NOTICE '  Indexes created: %', index_count;
  RAISE NOTICE '  Views created: %', view_count;
  
  IF table_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: Not all tables were created';
  END IF;
END $$;