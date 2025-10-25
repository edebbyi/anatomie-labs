-- Podna Agent System Database Migration
-- Simplified agent-based fashion design system

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

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

-- Temporarily drop prompts table to avoid foreign key issues
DROP TABLE IF EXISTS prompts CASCADE;

-- Generations (generated images) - Modified to match existing schema
CREATE TABLE IF NOT EXISTS generations_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Changed to UUID
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID, -- Will add foreign key constraint later
    
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

-- Rename tables to update schema
DROP TABLE IF EXISTS generations CASCADE;
ALTER TABLE generations_new RENAME TO generations;

-- Recreate prompts table with proper schema
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    generation_id UUID, -- Will reference generations(id), but created first
    
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

-- Add foreign key constraints after both tables are created
ALTER TABLE prompts 
    ADD CONSTRAINT fk_prompts_generation 
    FOREIGN KEY (generation_id) 
    REFERENCES generations(id) 
    ON DELETE SET NULL;

ALTER TABLE generations
    ADD CONSTRAINT fk_generations_prompt
    FOREIGN KEY (prompt_id)
    REFERENCES prompts(id)
    ON DELETE SET NULL;

-- Feedback (user likes/dislikes) - Create with proper schema
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

-- Learning events (model updates)
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

-- Prompt history (for bandit strategy)
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

-- Indexes for performance
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

-- Comments for documentation
COMMENT ON TABLE portfolios IS 'User uploaded image portfolios (ZIP files)';
COMMENT ON TABLE portfolio_images IS 'Individual images from user portfolios';
COMMENT ON TABLE image_embeddings IS 'Vector embeddings for semantic search';
COMMENT ON TABLE image_descriptors IS 'Normalized fashion attributes extracted by vision models';
COMMENT ON TABLE style_profiles IS 'Aggregated user style preferences and trends';
COMMENT ON TABLE prompts IS 'Text prompts for image generation';
COMMENT ON TABLE generations IS 'AI-generated fashion images';
COMMENT ON TABLE feedback IS 'User feedback (likes, dislikes, critiques)';
COMMENT ON TABLE learning_events IS 'Learning loop updates to user preferences';
COMMENT ON TABLE prompt_history IS 'Historical prompt performance for bandit strategy';