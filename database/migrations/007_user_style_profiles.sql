-- Migration: User Style Profiles Table
-- Creates table to store style clustering results and coverage analysis

-- Create user_style_profiles table
CREATE TABLE IF NOT EXISTS user_style_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    profile_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_style_profiles_user_id ON user_style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_style_profiles_updated_at ON user_style_profiles(updated_at DESC);

-- Create GIN index on profile_data JSONB for efficient queries on style data
CREATE INDEX IF NOT EXISTS idx_user_style_profiles_profile_data ON user_style_profiles USING GIN(profile_data);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_style_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_style_profiles_updated_at ON user_style_profiles;
CREATE TRIGGER trigger_update_user_style_profiles_updated_at
    BEFORE UPDATE ON user_style_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_style_profiles_updated_at();

-- Add comments
COMMENT ON TABLE user_style_profiles IS 'Stores user style clustering results and coverage analysis';
COMMENT ON COLUMN user_style_profiles.user_id IS 'Reference to users table';
COMMENT ON COLUMN user_style_profiles.profile_data IS 'JSONB containing style clusters, coverage analysis, and insights';
COMMENT ON COLUMN user_style_profiles.created_at IS 'When the style profile was first created';
COMMENT ON COLUMN user_style_profiles.updated_at IS 'When the style profile was last updated';

-- Sample query examples (commented out)
-- Get user style profile:
-- SELECT profile_data FROM user_style_profiles WHERE user_id = $1;

-- Get dominant style for user:
-- SELECT profile_data->'insights'->>'dominantStyle' as dominant_style 
-- FROM user_style_profiles WHERE user_id = $1;

-- Get style coverage:
-- SELECT profile_data->'coverage'->>'overallCoverage' as coverage 
-- FROM user_style_profiles WHERE user_id = $1;

-- Find users with similar dominant styles:
-- SELECT user_id, profile_data->'insights'->>'dominantStyle' as dominant_style
-- FROM user_style_profiles 
-- WHERE profile_data->'insights'->>'dominantStyle' = 'sporty';

-- Get cluster distribution for user:
-- SELECT jsonb_array_elements(profile_data->'coverage'->'clusterDistribution') as clusters
-- FROM user_style_profiles WHERE user_id = $1;