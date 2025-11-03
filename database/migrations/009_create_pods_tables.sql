-- Pods Feature Schema Migration
-- Defines user pods (collections) and junction table for images

-- Enable UUID extension (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Pods table
CREATE TABLE IF NOT EXISTS pods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_count INTEGER DEFAULT 0,
    cover_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for pod to image associations
CREATE TABLE IF NOT EXISTS pod_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pod_id UUID REFERENCES pods(id) ON DELETE CASCADE,
    image_id UUID REFERENCES generations(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    position INTEGER,
    UNIQUE (pod_id, image_id)
);

CREATE INDEX IF NOT EXISTS idx_pod_images_pod_id ON pod_images(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_images_image_id ON pod_images(image_id);

-- User preferences (feature flags, dismissals, etc.)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_preferences ON user_preferences USING GIN (preferences);
