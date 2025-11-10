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