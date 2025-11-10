-- Designer BFF Database Schema
-- PostgreSQL 14+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For ML embeddings and vector similarity search

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false
);

-- User preferences and style profiles
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    style_preference VARCHAR(100),
    favorite_colors JSONB DEFAULT '[]'::jsonb,
    preferred_fabrics JSONB DEFAULT '[]'::jsonb,
    preferred_silhouettes JSONB DEFAULT '[]'::jsonb,
    style_vector VECTOR(512), -- For ML-based matching
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Voice commands history
CREATE TABLE voice_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    parsed_command JSONB NOT NULL,
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INTEGER
);

-- VLT specifications
CREATE TABLE vlt_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    voice_command_id UUID REFERENCES voice_commands(id) ON DELETE SET NULL,
    garment_type VARCHAR(100),
    silhouette VARCHAR(100),
    fabric JSONB,
    colors JSONB,
    construction JSONB,
    style JSONB,
    prompt_text TEXT,
    confidence FLOAT,
    attributes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Image generation jobs
CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vlt_spec_id UUID REFERENCES vlt_specifications(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'queued', -- queued, processing, completed, failed
    quantity INTEGER NOT NULL,
    model_provider VARCHAR(100), -- imagen, dalle, midjourney, stable-diffusion
    generation_params JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cost DECIMAL(10, 4),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Generated images (metadata - actual images in R2)
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES generation_jobs(id) ON DELETE CASCADE,
    vlt_spec_id UUID REFERENCES vlt_specifications(id) ON DELETE SET NULL,
    r2_key VARCHAR(500) NOT NULL, -- Cloudflare R2 object key
    r2_bucket VARCHAR(255) NOT NULL,
    cdn_url TEXT, -- Public CDN URL
    thumbnail_url TEXT,
    original_size INTEGER, -- bytes
    enhanced_size INTEGER, -- after GFPGAN + Real-ESRGAN
    width INTEGER,
    height INTEGER,
    format VARCHAR(20),
    vlt_analysis JSONB, -- VLT validation results
    quality_score FLOAT,
    is_outlier BOOLEAN DEFAULT false,
    outlier_marked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    generation_cost DECIMAL(10, 4),
    enhancement_cost DECIMAL(10, 4)
);

-- User feedback on images
CREATE TABLE image_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50), -- outlier, favorite, dislike
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(image_id, user_id) -- One feedback per user per image
);

-- Collections/Galleries
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Collection images (many-to-many)
CREATE TABLE collection_images (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, image_id)
);

-- Prompt optimization history (RLHF)
CREATE TABLE prompt_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_prompt TEXT NOT NULL,
    optimized_prompt TEXT NOT NULL,
    success_rate FLOAT,
    outlier_rate FLOAT,
    avg_quality_score FLOAT,
    total_generations INTEGER DEFAULT 0,
    total_outliers INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Global learning data (aggregate feedback)
CREATE TABLE global_learning (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attribute_type VARCHAR(100), -- style, color, fabric, silhouette
    attribute_value VARCHAR(255),
    success_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    success_rate FLOAT,
    user_count INTEGER DEFAULT 0, -- How many users liked this
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(attribute_type, attribute_value)
);

-- Cost tracking
CREATE TABLE cost_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    service_type VARCHAR(100), -- vlt, image_gen, enhancement, storage
    service_provider VARCHAR(100),
    operation VARCHAR(100),
    cost DECIMAL(10, 6),
    quantity INTEGER DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Nightly generation schedule
CREATE TABLE nightly_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_date DATE NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed
    prompt_count INTEGER DEFAULT 50,
    target_image_count INTEGER DEFAULT 200,
    actual_image_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_cost DECIMAL(10, 4),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics snapshots
CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_images INTEGER,
    total_outliers INTEGER,
    outlier_rate FLOAT,
    favorite_styles JSONB,
    top_attributes JSONB,
    cost_this_period DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, snapshot_date)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_created_at ON images(created_at);
CREATE INDEX idx_images_is_outlier ON images(is_outlier);
CREATE INDEX idx_images_job_id ON images(job_id);
CREATE INDEX idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX idx_image_feedback_image_id ON image_feedback(image_id);
CREATE INDEX idx_image_feedback_user_id ON image_feedback(user_id);
CREATE INDEX idx_cost_tracking_user_id ON cost_tracking(user_id);
CREATE INDEX idx_cost_tracking_created_at ON cost_tracking(created_at);
CREATE INDEX idx_global_learning_attribute ON global_learning(attribute_type, attribute_value);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Portfolios table (uploaded image collections)
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'My Portfolio',
    zip_filename VARCHAR(500),
    image_count INTEGER DEFAULT 0,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio images (individual images from the ZIP)
CREATE TABLE IF NOT EXISTS portfolio_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(500),
    url_original TEXT NOT NULL,
    url_preview TEXT,
    r2_key VARCHAR(500),
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Image embeddings (vector representations)
CREATE TABLE IF NOT EXISTS image_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID REFERENCES portfolio_images(id) ON DELETE CASCADE,
    vector vector(512), -- CLIP/ViT embeddings
    model_name VARCHAR(100) DEFAULT 'clip-vit-base',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Image descriptors (normalized fashion attributes)
CREATE TABLE IF NOT EXISTS image_descriptors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID REFERENCES portfolio_images(id) ON DELETE CASCADE UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Fashion attributes (normalized JSON)
    garment_type VARCHAR(100),
    silhouette VARCHAR(100),
    fit VARCHAR(100),
    neckline VARCHAR(100),
    sleeve_length VARCHAR(100),
    fabric VARCHAR(100),
    finish VARCHAR(100),
    texture VARCHAR(100),
    color_palette JSONB DEFAULT '[]'::jsonb,
    pattern VARCHAR(100),
    embellishments JSONB DEFAULT '[]'::jsonb,

    -- Photography attributes
    lighting JSONB, -- {type, direction}
    camera JSONB, -- {angle, height}
    background VARCHAR(255),
    pose VARCHAR(255),

    -- Raw analysis
    raw_analysis JSONB, -- Full response from vision model
    confidence FLOAT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Style profiles (aggregated user style)
CREATE TABLE IF NOT EXISTS style_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,

    -- Style clusters/labels
    style_labels JSONB DEFAULT '[]'::jsonb, -- [{name, score, examples}]

    -- Trend data (aggregated stats)
    garment_distribution JSONB DEFAULT '{}'::jsonb, -- {dress: 0.41, blazer: 0.15, ...}
    color_distribution JSONB DEFAULT '{}'::jsonb, -- {blue: 0.20, navy: 0.15, ...}
    fabric_distribution JSONB DEFAULT '{}'::jsonb, -- {linen: 0.17, silk: 0.12, ...}
    silhouette_distribution JSONB DEFAULT '{}'::jsonb,

    -- Style clusters
    clusters JSONB DEFAULT '[]'::jsonb, -- [{name, weight, signature_attributes}]

    -- Summary text
    summary_text TEXT,

    -- Stats
    total_images INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ultra-detailed descriptors table
CREATE TABLE IF NOT EXISTS ultra_detailed_descriptors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

    -- Generated columns for fast querying
    primary_garment TEXT GENERATED ALWAYS AS (
        garments->0->>'type'
    ) STORED,

    garment_count INT GENERATED ALWAYS AS (
        jsonb_array_length(garments)
    ) STORED,

    fabric_type TEXT GENERATED ALWAYS AS (
        garments->0->'fabric'->>'primary_material'
    ) STORED,

    dominant_colors TEXT[],  -- Populated by application code

    model_ethnicity TEXT GENERATED ALWAYS AS (
        model_demographics->'ethnicity'->>'observed_characteristics'
    ) STORED,

    model_body_type TEXT GENERATED ALWAYS AS (
        model_demographics->'body_type'->>'overall_build'
    ) STORED,

    shot_type TEXT GENERATED ALWAYS AS (
        photography->'shot_composition'->>'type'
    ) STORED,

    lighting_type TEXT GENERATED ALWAYS AS (
        photography->'lighting'->>'type'
    ) STORED,

    season TEXT GENERATED ALWAYS AS (
        contextual_attributes->>'season'
    ) STORED,

    occasion TEXT GENERATED ALWAYS AS (
        contextual_attributes->>'occasion'
    ) STORED,

    style_aesthetic TEXT GENERATED ALWAYS AS (
        contextual_attributes->>'mood_aesthetic'
    ) STORED,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Descriptor quality log table
CREATE TABLE IF NOT EXISTS descriptor_quality_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Descriptor corrections table (for continuous improvement)
CREATE TABLE IF NOT EXISTS descriptor_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

    corrected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prompts table
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    generation_id UUID, -- Will reference generations(id)

    -- Prompt content
    text TEXT NOT NULL,
    json_spec JSONB, -- Structured prompt specification

    -- Prompt strategy
    mode VARCHAR(50) DEFAULT 'exploratory', -- exploratory, targeted
    weights JSONB, -- Attribute weights used

    -- Performance tracking
    score FLOAT, -- Success score based on feedback
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Generations table (generated images)
CREATE TABLE IF NOT EXISTS generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,

    -- Image storage
    url TEXT,
    url_upscaled TEXT, -- Real-ESRGAN upscaled version
    r2_key VARCHAR(500),
    r2_key_upscaled VARCHAR(500),

    -- Image properties
    width INTEGER,
    height INTEGER,

    -- Generation params
    provider VARCHAR(100) DEFAULT 'imagen-4-ultra', -- imagen-4-ultra, stable-diffusion, dall-e
    params JSONB, -- {seed, cfg_scale, steps, etc}
    seed VARCHAR(100),

    -- Costs
    cost_cents INTEGER, -- Cost in cents

    -- Post-processing
    is_upscaled BOOLEAN DEFAULT false,
    upscale_cost_cents INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update prompts foreign key to reference generations
ALTER TABLE prompts
    DROP CONSTRAINT IF EXISTS fk_prompts_generation;

ALTER TABLE prompts
    ADD CONSTRAINT fk_prompts_generation
    FOREIGN KEY (generation_id)
    REFERENCES generations(id)
    ON DELETE SET NULL;

-- Feedback table (user likes/dislikes)
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,

    -- Feedback type
    type VARCHAR(50) NOT NULL, -- like, dislike, swipe_left, swipe_right

    -- Critique text
    note TEXT, -- e.g., "make this blue", "longer sleeves"

    -- Parsed critique (structured)
    parsed_critique JSONB, -- {attributes: {color: 'blue', sleeve_length: 'long'}}

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, generation_id) -- One feedback per user per generation
);

-- Learning events table (model updates)
CREATE TABLE IF NOT EXISTS learning_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,
    feedback_id UUID REFERENCES feedback(id) ON DELETE SET NULL,

    -- Delta (changes to weights/preferences)
    delta JSONB, -- {color.blue: +0.3, silhouette.a_line: +0.1}

    -- Event type
    event_type VARCHAR(50), -- feedback_update, profile_regeneration, manual_override

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prompt history table (for bandit strategy)
CREATE TABLE IF NOT EXISTS prompt_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,

    -- Success metrics
    was_liked BOOLEAN,
    was_disliked BOOLEAN,
    success_score FLOAT, -- Computed score

    -- Bandit strategy tracking
    exploration BOOLEAN DEFAULT false, -- Was this exploratory?

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Additional indexes for new tables
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_images_portfolio_id ON portfolio_images(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_images_user_id ON portfolio_images(user_id);
CREATE INDEX IF NOT EXISTS idx_image_embeddings_image_id ON image_embeddings(image_id);
CREATE INDEX IF NOT EXISTS idx_image_descriptors_image_id ON image_descriptors(image_id);
CREATE INDEX IF NOT EXISTS idx_image_descriptors_user_id ON image_descriptors(user_id);
CREATE INDEX IF NOT EXISTS idx_style_profiles_user_id ON style_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_prompt_id ON generations(prompt_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_generation_id ON feedback(generation_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_id ON learning_events(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_history_user_id ON prompt_history(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_history_prompt_id ON prompt_history(prompt_id);
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
CREATE INDEX IF NOT EXISTS idx_quality_log_requires_review ON descriptor_quality_log(requires_review) WHERE requires_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_quality_log_logged_at ON descriptor_quality_log(logged_at);
CREATE INDEX IF NOT EXISTS idx_corrections_field_path ON descriptor_corrections(field_path);
CREATE INDEX IF NOT EXISTS idx_corrections_descriptor ON descriptor_corrections(descriptor_id);
CREATE INDEX IF NOT EXISTS idx_corrections_corrected_at ON descriptor_corrections(corrected_at);

-- Triggers for updated_at columns
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_style_profiles_updated_at BEFORE UPDATE ON style_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ultra_detailed_descriptors_updated_at BEFORE UPDATE ON ultra_detailed_descriptors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();