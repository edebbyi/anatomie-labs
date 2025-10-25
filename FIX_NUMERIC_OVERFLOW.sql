/**
 * Fix for numeric field overflow issue
 * 
 * The avg_confidence and avg_completeness columns may have incorrect definitions
 * that cause numeric overflow errors when inserting values.
 */

-- First, check current column definitions
-- \d style_profiles

-- Fix the column definitions to ensure proper numeric ranges
ALTER TABLE style_profiles 
ALTER COLUMN avg_confidence TYPE DECIMAL(4,3),
ALTER COLUMN avg_completeness TYPE DECIMAL(5,2);

-- Add constraints to ensure values are within valid ranges
ALTER TABLE style_profiles 
ADD CONSTRAINT chk_avg_confidence_range 
CHECK (avg_confidence >= 0 AND avg_confidence <= 9.999);

ALTER TABLE style_profiles 
ADD CONSTRAINT chk_avg_completeness_range 
CHECK (avg_completeness >= 0 AND avg_completeness <= 999.99);

-- Update any existing rows that might have invalid values
UPDATE style_profiles 
SET avg_confidence = GREATEST(LEAST(avg_confidence, 9.999), 0)
WHERE avg_confidence IS NOT NULL;

UPDATE style_profiles 
SET avg_completeness = GREATEST(LEAST(avg_completeness, 999.99), 0)
WHERE avg_completeness IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN style_profiles.avg_confidence IS 'Average confidence score across all analyzed images (0.000-9.999)';
COMMENT ON COLUMN style_profiles.avg_completeness IS 'Average completeness percentage of image analysis (0.00-999.99)';