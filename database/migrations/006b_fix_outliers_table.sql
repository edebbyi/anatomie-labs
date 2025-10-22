-- Fix for Stage 11 Analytics: Create outliers table if missing
-- This is needed for the analytics materialized views

-- Create outliers table (Stage 8 dependency)
CREATE TABLE IF NOT EXISTS outliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id VARCHAR(100) NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outlier_score DECIMAL(5,4),
    clip_score DECIMAL(5,4),
    user_rating INTEGER,
    cluster_id INTEGER,
    detection_method VARCHAR(50),
    is_outlier BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_outliers_generation ON outliers(generation_id);
CREATE INDEX IF NOT EXISTS idx_outliers_user ON outliers(user_id);
CREATE INDEX IF NOT EXISTS idx_outliers_score ON outliers(outlier_score DESC);
CREATE INDEX IF NOT EXISTS idx_outliers_created ON outliers(created_at DESC);

-- Drop existing materialized views (if they exist with errors)
DROP MATERIALIZED VIEW IF EXISTS vlt_attribute_success CASCADE;
DROP MATERIALIZED VIEW IF EXISTS style_profile_success CASCADE;
DROP MATERIALIZED VIEW IF EXISTS provider_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_analytics_summary CASCADE;

-- Recreate materialized view: VLT attribute success rates
CREATE MATERIALIZED VIEW vlt_attribute_success AS
SELECT 
    jsonb_object_keys(g.vlt_spec) as attribute_name,
    g.vlt_spec->>jsonb_object_keys(g.vlt_spec) as attribute_value,
    COUNT(*) as total_occurrences,
    COUNT(o.id) as outlier_count,
    ROUND(
        CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100, 
        2
    ) as outlier_rate,
    AVG(COALESCE(o.clip_score, 0)) as avg_clip_score,
    AVG(COALESCE(o.user_rating, 0)) as avg_user_rating,
    MAX(g.created_at) as last_used
FROM generations g
LEFT JOIN outliers o ON g.id = o.generation_id
WHERE g.vlt_spec IS NOT NULL
GROUP BY attribute_name, attribute_value
HAVING COUNT(*) >= 3;

-- Create index on materialized view
CREATE INDEX idx_vlt_attr_success_rate ON vlt_attribute_success(outlier_rate DESC);
CREATE INDEX idx_vlt_attr_name ON vlt_attribute_success(attribute_name);

-- Recreate materialized view: Style profile success
CREATE MATERIALIZED VIEW style_profile_success AS
SELECT 
    g.user_id,
    COALESCE(g.style_cluster_id::TEXT, 'unclassified') as style_profile,
    COUNT(*) as total_generations,
    COUNT(o.id) as outlier_count,
    ROUND(
        CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100,
        2
    ) as outlier_rate,
    AVG(COALESCE(o.clip_score, 0)) as avg_clip_score,
    AVG(COALESCE(o.user_rating, 0)) as avg_user_rating,
    g.vlt_spec as top_attributes
FROM generations g
LEFT JOIN outliers o ON g.id = o.generation_id
GROUP BY g.user_id, style_profile, g.vlt_spec
HAVING COUNT(*) >= 5;

-- Create indexes on materialized view
CREATE INDEX idx_style_prof_user ON style_profile_success(user_id);
CREATE INDEX idx_style_prof_rate ON style_profile_success(outlier_rate DESC);

-- Recreate materialized view: Provider performance
CREATE MATERIALIZED VIEW provider_performance AS
SELECT 
    g.model_provider,
    g.model_version,
    COUNT(*) as total_generations,
    COUNT(o.id) as outlier_count,
    ROUND(
        CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100,
        2
    ) as outlier_rate,
    AVG(COALESCE(o.clip_score, 0)) as avg_clip_score,
    AVG(g.generation_time_ms) as avg_generation_time,
    SUM(g.cost) as total_cost,
    AVG(g.cost) as avg_cost
FROM generations g
LEFT JOIN outliers o ON g.id = o.generation_id
WHERE g.model_provider IS NOT NULL
GROUP BY g.model_provider, g.model_version
HAVING COUNT(*) >= 10;

-- Create indexes on materialized view
CREATE INDEX idx_provider_perf_rate ON provider_performance(outlier_rate DESC);
CREATE INDEX idx_provider_perf_provider ON provider_performance(model_provider);

-- Recreate materialized view: User analytics summary
CREATE MATERIALIZED VIEW user_analytics_summary AS
SELECT 
    g.user_id,
    COUNT(*) as total_generations,
    COUNT(o.id) as total_outliers,
    ROUND(
        CAST(COUNT(o.id) AS DECIMAL) / NULLIF(COUNT(*), 0) * 100,
        2
    ) as overall_outlier_rate,
    AVG(COALESCE(o.clip_score, 0)) as avg_clip_score,
    AVG(COALESCE(o.user_rating, 0)) as avg_user_rating,
    MAX(g.created_at) as last_generation,
    COUNT(DISTINCT g.style_cluster_id) as distinct_styles_tried,
    SUM(g.cost) as total_cost_spent
FROM generations g
LEFT JOIN outliers o ON g.id = o.generation_id
GROUP BY g.user_id;

-- Create indexes on materialized view
CREATE INDEX idx_user_analytics_user ON user_analytics_summary(user_id);
CREATE INDEX idx_user_analytics_rate ON user_analytics_summary(overall_outlier_rate DESC);

-- Grant permissions
GRANT SELECT ON vlt_attribute_success TO PUBLIC;
GRANT SELECT ON style_profile_success TO PUBLIC;
GRANT SELECT ON provider_performance TO PUBLIC;
GRANT SELECT ON user_analytics_summary TO PUBLIC;

-- Add comment
COMMENT ON TABLE outliers IS 'Tracks outlier generations for analytics (Stage 8 dependency for Stage 11)';
COMMENT ON MATERIALIZED VIEW vlt_attribute_success IS 'Aggregated VLT attribute success rates for analytics';
COMMENT ON MATERIALIZED VIEW style_profile_success IS 'Style profile performance metrics';
COMMENT ON MATERIALIZED VIEW provider_performance IS 'AI provider performance comparison';
COMMENT ON MATERIALIZED VIEW user_analytics_summary IS 'High-level user analytics summary';
