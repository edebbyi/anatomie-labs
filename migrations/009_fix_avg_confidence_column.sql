/**
 * Database Migration: Fix avg_confidence column precision
 * 
 * Fixes the numeric field overflow error by changing the column type
 * from DECIMAL(3,3) to DECIMAL(4,3) to allow values >= 1.0
 */

-- Fix the avg_confidence column definition
ALTER TABLE style_profiles 
ALTER COLUMN avg_confidence TYPE DECIMAL(4,3);

-- Add comment for documentation
COMMENT ON COLUMN style_profiles.avg_confidence IS 'Average confidence score across all analyzed images (fixed to allow values >= 1.0)';

-- Verify the fix by checking the column definition
DO $$ 
DECLARE
  column_type TEXT;
BEGIN
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
  INTO column_type
  FROM information_schema.columns 
  WHERE table_name = 'style_profiles' AND column_name = 'avg_confidence';
  
  IF column_type = 'numeric(4,3)' THEN
    RAISE NOTICE '✅ Migration successful: avg_confidence column is now DECIMAL(4,3)';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: avg_confidence column is still %', column_type;
  END IF;
END $$;