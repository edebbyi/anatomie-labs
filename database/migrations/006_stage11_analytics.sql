-- =====================================================
-- Stage 11: Analytics & Insights Migration
-- =====================================================
-- Creates tables and views for VLT-powered analytics,
-- style evolution tracking, and personalized recommendations
-- =====================================================

-- =====================================================
-- 1. ANALYTICS EVENTS TABLE
-- =====================================================
-- Track all generation events for time-series analysis
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'generation', 'feedback', 'outlier', 'validation'
    event_timestamp TIMESTAMP DEFAULT NOW(),
    generation_id VARCHAR(255),
    asset_id INTEGER,
    
    -- VLT attributes snapshot
    vlt_attributes JSONB,
    
    -- Style cluster at time of event
    cluster_id INTEGER,
    cluster_name VARCHAR(255),
    
    -- Event metrics
    metrics JSONB, -- { outlier_score, clip_score, user_rating, etc }
    
    -- Contextual data
    context JSONB, -- { provider, cost, generation_time, etc }
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_user_time ON analytics_events(user_id, event_timestamp);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_cluster ON analytics_events(cluster_id);
CREATE INDEX idx_analytics_timestamp ON analytics_events(event_timestamp);

-- =====================================================
-- 2. STYLE EVOLUTION TRACKING
-- =====================================================
-- Track how user style preferences evolve over time
CREATE TABLE IF NOT EXISTS style_evolution (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    
    -- Cluster distribution at this point in time
    cluster_distribution JSONB, -- { cluster_1: 0.65, cluster_2: 0.25, cluster_0: 0.10 }
    
    -- Dominant attributes
    dominant_colors JSONB, -- { black: 45, beige: 25, white: 15 }
    dominant_styles JSONB, -- { contemporary: 60, romantic: 25, casual: 15 }
    dominant_silhouettes JSONB, -- { fitted: 50, flowing: 30, structured: 20 }
    dominant_fabrications JSONB, -- { silk: 40, cotton: 30, wool: 20 }
    
    -- Success metrics
    total_generations INTEGER DEFAULT 0,
    total_outliers INTEGER DEFAULT 0,
    outlier_rate DECIMAL(5,2), -- percentage
    avg_clip_score DECIMAL(5,2),
    avg_user_rating DECIMAL(3,2),
    
    -- Trend indicators
    trend_direction VARCHAR(20), -- 'stable', 'diversifying', 'converging'
    trend_strength DECIMAL(3,2), -- 0-1
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (user_id, snapshot_date)
);

CREATE INDEX idx_style_evo_user_date ON style_evolution(user_id, snapshot_date);

-- =====================================================
-- 3. CLUSTER PERFORMANCE ANALYSIS
-- =====================================================
-- Track performance metrics per user style cluster
CREATE TABLE IF NOT EXISTS cluster_performance (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    cluster_id INTEGER NOT NULL,
    cluster_name VARCHAR(255),
    
    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Generation counts
    total_generations INTEGER DEFAULT 0,
    total_outliers INTEGER DEFAULT 0,
    total_favorites INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,
    
    -- Success rates
    outlier_rate DECIMAL(5,2), -- percentage
    favorite_rate DECIMAL(5,2),
    rejection_rate DECIMAL(5,2),
    
    -- Quality metrics
    avg_clip_score DECIMAL(5,2),
    avg_user_rating DECIMAL(3,2),
    avg_validation_score DECIMAL(5,2),
    
    -- Most successful attributes in this cluster
    top_attributes JSONB, -- { garmentType: 'dress', color: 'black', style: 'elegant' }
    
    -- Provider performance for this cluster
    best_provider VARCHAR(50),
    provider_scores JSONB, -- { 'google-imagen': 0.85, 'stable-diffusion-xl': 0.72 }
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (user_id, cluster_id, period_start, period_end)
);

CREATE INDEX idx_cluster_perf_user ON cluster_performance(user_id);
CREATE INDEX idx_cluster_perf_period ON cluster_performance(period_start, period_end);

-- =====================================================
-- 4. ATTRIBUTE SUCCESS TRACKING (ENHANCED)
-- =====================================================
-- Already exists from Stage 10, but add analytics view
CREATE OR REPLACE VIEW attribute_performance_analytics AS
SELECT 
    attribute_name,
    attribute_value,
    outlier_count,
    total_count,
    outlier_rate,
    avg_clip_score,
    avg_user_rating,
    CASE 
        WHEN outlier_rate >= 60 THEN 'excellent'
        WHEN outlier_rate >= 45 THEN 'good'
        WHEN outlier_rate >= 30 THEN 'average'
        ELSE 'poor'
    END as performance_tier,
    RANK() OVER (PARTITION BY attribute_name ORDER BY outlier_rate DESC) as rank_in_category
FROM vlt_attribute_success
WHERE total_count >= 5  -- Min sample size
ORDER BY outlier_rate DESC;

-- =====================================================
-- 5. INSIGHTS CACHE
-- =====================================================
-- Store generated insights for quick retrieval
CREATE TABLE IF NOT EXISTS insights_cache (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    insight_type VARCHAR(50) NOT NULL, -- 'cluster_performance', 'attribute_recommendation', 'style_evolution'
    
    -- Insight content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    insight_data JSONB, -- Full insight details
    
    -- Metadata
    confidence_score DECIMAL(3,2), -- 0-1
    priority INTEGER DEFAULT 0, -- Higher = show first
    category VARCHAR(50), -- 'success', 'opportunity', 'warning', 'trend'
    
    -- Validity
    generated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- When this insight becomes stale
    is_active BOOLEAN DEFAULT TRUE,
    
    -- User interaction
    viewed_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_insights_user_active ON insights_cache(user_id, is_active);
CREATE INDEX idx_insights_type ON insights_cache(insight_type);
CREATE INDEX idx_insights_expires ON insights_cache(expires_at);

-- =====================================================
-- 6. PERSONALIZED RECOMMENDATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS personalized_recommendations (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    
    -- Recommendation details
    recommendation_type VARCHAR(50) NOT NULL, -- 'try_attribute', 'boost_cluster', 'use_provider'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Actionable data
    action_data JSONB, -- { attribute: 'fabrication', value: 'silk', boost: 1.5 }
    expected_improvement DECIMAL(5,2), -- Expected outlier rate increase
    
    -- Reasoning
    based_on JSONB, -- { cluster: 1, historical_data: true, outlier_rate: 0.65 }
    confidence DECIMAL(3,2), -- 0-1
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, applied, dismissed
    applied_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    
    -- Tracking
    generated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recommendations_user_status ON personalized_recommendations(user_id, status);
CREATE INDEX idx_recommendations_type ON personalized_recommendations(recommendation_type);

-- =====================================================
-- 7. GLOBAL TRENDS (CROSS-USER INSIGHTS)
-- =====================================================
CREATE TABLE IF NOT EXISTS global_trends (
    id SERIAL PRIMARY KEY,
    trend_date DATE NOT NULL,
    
    -- Trending attributes
    trending_colors JSONB, -- { black: 450, navy: 320, beige: 280 }
    trending_styles JSONB, -- { contemporary: 520, minimalist: 380 }
    trending_fabrications JSONB,
    trending_silhouettes JSONB,
    
    -- Success patterns
    top_combinations JSONB, -- [{ attrs: {color: 'black', style: 'elegant'}, outlier_rate: 0.68 }]
    
    -- Provider trends
    most_used_provider VARCHAR(50),
    provider_usage JSONB, -- { 'google-imagen': 450, 'stable-diffusion-xl': 320 }
    provider_success_rates JSONB,
    
    -- Aggregate metrics
    total_generations INTEGER,
    total_outliers INTEGER,
    global_outlier_rate DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (trend_date)
);

-- =====================================================
-- 8. ANALYTICS VIEWS
-- =====================================================

-- User Style Summary View
CREATE OR REPLACE VIEW user_style_summary AS
SELECT 
    g.user_id,
    COUNT(DISTINCT g.id) as total_generations,
    COUNT(DISTINCT o.id) as total_outliers,
    ROUND(COUNT(DISTINCT o.id)::DECIMAL / NULLIF(COUNT(DISTINCT g.id), 0) * 100, 2) as outlier_rate,
    AVG(f.clip_score) as avg_clip_score,
    AVG(f.user_rating) as avg_user_rating,
    MIN(g.created_at) as first_generation,
    MAX(g.created_at) as latest_generation,
    COUNT(DISTINCT DATE(g.created_at)) as active_days
FROM generations g
LEFT JOIN outliers o ON g.id = o.generation_id
LEFT JOIN user_feedback f ON g.id = f.generation_id
GROUP BY g.user_id;

-- Cluster Performance Summary
CREATE OR REPLACE VIEW cluster_performance_summary AS
SELECT 
    cp.user_id,
    cp.cluster_id,
    cp.cluster_name,
    cp.outlier_rate,
    cp.avg_clip_score,
    cp.avg_user_rating,
    cp.best_provider,
    cp.top_attributes,
    RANK() OVER (PARTITION BY cp.user_id ORDER BY cp.outlier_rate DESC) as performance_rank
FROM cluster_performance cp
WHERE cp.period_end >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY cp.outlier_rate DESC;

-- Recent Insights View
CREATE OR REPLACE VIEW recent_insights AS
SELECT 
    i.user_id,
    i.insight_type,
    i.title,
    i.description,
    i.confidence_score,
    i.priority,
    i.category,
    i.generated_at,
    CASE 
        WHEN i.viewed_at IS NOT NULL THEN 'viewed'
        WHEN i.dismissed_at IS NOT NULL THEN 'dismissed'
        ELSE 'new'
    END as status
FROM insights_cache i
WHERE i.is_active = TRUE 
  AND (i.expires_at IS NULL OR i.expires_at > NOW())
ORDER BY i.priority DESC, i.generated_at DESC;

-- Trending Attributes View
CREATE OR REPLACE VIEW trending_attributes_today AS
SELECT 
    trend_date,
    jsonb_object_keys(trending_colors) as color,
    (trending_colors->>jsonb_object_keys(trending_colors))::INTEGER as color_count,
    jsonb_object_keys(trending_styles) as style,
    (trending_styles->>jsonb_object_keys(trending_styles))::INTEGER as style_count
FROM global_trends
WHERE trend_date = CURRENT_DATE
ORDER BY color_count DESC, style_count DESC;

-- =====================================================
-- 9. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Auto-update cluster performance when new outlier created
CREATE OR REPLACE FUNCTION update_cluster_performance_on_outlier()
RETURNS TRIGGER AS $$
BEGIN
    -- Update today's cluster performance
    INSERT INTO cluster_performance (
        user_id,
        cluster_id,
        cluster_name,
        period_start,
        period_end,
        total_generations,
        total_outliers,
        outlier_rate
    )
    SELECT 
        g.user_id,
        g.style_cluster_id,
        'Cluster ' || g.style_cluster_id,
        CURRENT_DATE,
        CURRENT_DATE,
        1,
        1,
        100.0
    FROM generations g
    WHERE g.id = NEW.generation_id
    ON CONFLICT (user_id, cluster_id, period_start, period_end)
    DO UPDATE SET
        total_generations = cluster_performance.total_generations + 1,
        total_outliers = cluster_performance.total_outliers + 1,
        outlier_rate = (cluster_performance.total_outliers + 1.0) / (cluster_performance.total_generations + 1.0) * 100,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cluster_perf_on_outlier
AFTER INSERT ON outliers
FOR EACH ROW
EXECUTE FUNCTION update_cluster_performance_on_outlier();

-- Auto-create analytics event on generation
CREATE OR REPLACE FUNCTION create_analytics_event_on_generation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO analytics_events (
        user_id,
        event_type,
        event_timestamp,
        generation_id,
        vlt_attributes,
        cluster_id,
        context
    ) VALUES (
        NEW.user_id,
        'generation',
        NEW.created_at,
        NEW.id,
        NEW.vlt_spec,
        NEW.style_cluster_id,
        jsonb_build_object(
            'provider', NEW.provider,
            'total_cost', NEW.total_cost,
            'generation_time', EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at))
        )
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_analytics_event
AFTER INSERT ON generations
FOR EACH ROW
EXECUTE FUNCTION create_analytics_event_on_generation();

-- =====================================================
-- 10. HELPER FUNCTIONS
-- =====================================================

-- Calculate style evolution score
CREATE OR REPLACE FUNCTION calculate_style_evolution(
    p_user_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    trend_direction VARCHAR(20),
    trend_strength DECIMAL(3,2),
    cluster_shift JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH snapshots AS (
        SELECT 
            snapshot_date,
            cluster_distribution,
            outlier_rate
        FROM style_evolution
        WHERE user_id = p_user_id
          AND snapshot_date >= CURRENT_DATE - p_days
        ORDER BY snapshot_date
    )
    SELECT 
        CASE 
            WHEN COUNT(*) < 2 THEN 'stable'::VARCHAR(20)
            WHEN STDDEV(outlier_rate) > 10 THEN 'volatile'::VARCHAR(20)
            WHEN AVG(outlier_rate) > LAG(AVG(outlier_rate)) OVER () THEN 'improving'::VARCHAR(20)
            ELSE 'stable'::VARCHAR(20)
        END,
        COALESCE(STDDEV(outlier_rate) / 100, 0)::DECIMAL(3,2),
        jsonb_build_object('shift', 'calculated')
    FROM snapshots;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. INITIAL DATA & INDEXES
-- =====================================================

-- Create composite indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_user_cluster_time 
ON analytics_events(user_id, cluster_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_style_evo_user_recent 
ON style_evolution(user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_cluster_perf_user_recent 
ON cluster_performance(user_id, period_end DESC);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Stage 11 tables created successfully
-- Run: SELECT table_name FROM information_schema.tables 
--      WHERE table_schema = 'public' AND table_name LIKE '%analytics%'
-- =====================================================
