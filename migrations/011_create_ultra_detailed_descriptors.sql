-- Migration: Create ultra_detailed_descriptors table for style profile generation
-- This table stores the ultra-detailed analysis results from the ingestion agent

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
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_ultra_user_id ON ultra_detailed_descriptors(user_id);
CREATE INDEX IF NOT EXISTS idx_ultra_image_id ON ultra_detailed_descriptors(image_id);
CREATE INDEX IF NOT EXISTS idx_ultra_confidence ON ultra_detailed_descriptors(overall_confidence);
CREATE INDEX IF NOT EXISTS idx_ultra_completeness ON ultra_detailed_descriptors(completeness_percentage);
CREATE INDEX IF NOT EXISTS idx_ultra_created_at ON ultra_detailed_descriptors(created_at);

-- Create quality monitoring table
CREATE TABLE IF NOT EXISTS descriptor_quality_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descriptor_id UUID REFERENCES ultra_detailed_descriptors(id) ON DELETE CASCADE,
  image_id UUID REFERENCES portfolio_images(id),
  user_id UUID REFERENCES users(id),
  
  -- Quality metrics
  overall_confidence NUMERIC,
  completeness_percentage NUMERIC,
  
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

-- Create user corrections table (for continuous improvement)
CREATE TABLE IF NOT EXISTS descriptor_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descriptor_id UUID REFERENCES ultra_detailed_descriptors(id) ON DELETE CASCADE,
  image_id UUID REFERENCES portfolio_images(id),
  user_id UUID REFERENCES users(id),
  
  -- Correction details
  field_path TEXT NOT NULL,
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

-- Verification
DO $$ 
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_name IN ('ultra_detailed_descriptors', 'descriptor_quality_log', 'descriptor_corrections')
    AND table_schema = 'public';
  
  RAISE NOTICE 'Migration complete: % tables created', table_count;
  
  IF table_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: Not all tables were created';
  END IF;
END $$;