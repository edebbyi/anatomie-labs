-- Ensure style_tags column exists in style_profiles table
-- This migration is idempotent and can be run multiple times

-- Add style_tags column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'style_profiles' 
        AND column_name = 'style_tags'
    ) THEN
        ALTER TABLE style_profiles 
        ADD COLUMN style_tags TEXT[] DEFAULT '{}';
        
        RAISE NOTICE 'Added style_tags column to style_profiles table';
    ELSE
        RAISE NOTICE 'style_tags column already exists';
    END IF;
END $$;

-- Backfill style_tags from aesthetic_themes for existing profiles
UPDATE style_profiles
SET style_tags = (
    SELECT ARRAY(
        SELECT jsonb_array_elements(aesthetic_themes)->>'name'
        FROM (SELECT aesthetic_themes) AS t
        LIMIT 5
    )
)
WHERE (style_tags IS NULL OR style_tags = '{}')
  AND aesthetic_themes IS NOT NULL
  AND jsonb_array_length(aesthetic_themes) > 0;

-- Show results
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN style_tags IS NOT NULL AND array_length(style_tags, 1) > 0 THEN 1 END) as profiles_with_tags,
    COUNT(CASE WHEN style_tags IS NULL OR style_tags = '{}' THEN 1 END) as profiles_without_tags
FROM style_profiles;

