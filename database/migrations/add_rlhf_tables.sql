-- RLHF Token Weights Table
-- Stores learned weights for prompt tokens based on user feedback

CREATE TABLE IF NOT EXISTS rlhf_token_weights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- lighting, style, composition, etc.
    token VARCHAR(255) NOT NULL, -- specific token like 'cinematic lighting'
    weight DECIMAL(5,3) DEFAULT 1.000, -- learned weight (0.0 - 2.0)
    usage_count INTEGER DEFAULT 0,
    positive_feedback INTEGER DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, category, token)
);

-- Index for fast weight lookups
CREATE INDEX idx_rlhf_weights_user_category ON rlhf_token_weights(user_id, category);
CREATE INDEX idx_rlhf_weights_weight ON rlhf_token_weights(weight DESC);

-- RLHF Feedback Log Table
-- Logs all user feedback for batch learning and analytics

CREATE TABLE IF NOT EXISTS rlhf_feedback_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    generation_id UUID, -- generation_jobs(id) if available
    feedback_type VARCHAR(50) NOT NULL, -- save, share, generate_similar, like, dislike, delete
    tokens_used JSONB, -- {lighting: ['cinematic lighting'], style: ['elegant'], ...}
    reward DECIMAL(5,3), -- computed reward signal
    time_viewed INTEGER DEFAULT 0, -- milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for analytics queries
CREATE INDEX idx_rlhf_feedback_user ON rlhf_feedback_log(user_id, created_at DESC);
CREATE INDEX idx_rlhf_feedback_type ON rlhf_feedback_log(feedback_type);
CREATE INDEX idx_rlhf_feedback_reward ON rlhf_feedback_log(reward DESC);

-- Comments for documentation
COMMENT ON TABLE rlhf_token_weights IS 'Learned weights for prompt tokens based on RLHF';
COMMENT ON COLUMN rlhf_token_weights.weight IS 'Learned weight value (0.0 to 2.0, default 1.0)';
COMMENT ON COLUMN rlhf_token_weights.category IS 'Token category: lighting, style, composition, quality, mood, modelPose';
COMMENT ON COLUMN rlhf_token_weights.usage_count IS 'Number of times this token has been used in generations';

COMMENT ON TABLE rlhf_feedback_log IS 'Log of all user feedback for RLHF training';
COMMENT ON COLUMN rlhf_feedback_log.reward IS 'Computed reward signal from feedback (-1.0 to 1.5)';
COMMENT ON COLUMN rlhf_feedback_log.tokens_used IS 'JSON object of token categories and values used in generation';
