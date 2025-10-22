-- Migration: Create Persona Tables for Stage 3
-- Created: 2025-10-10
-- Description: Tables for user style personas, embeddings, and style history

-- =====================================================
-- Table: user_personas
-- Stores user style personas with preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS user_personas (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  style_preferences JSONB DEFAULT '{}'::jsonb,
  embedding_id VARCHAR(255),
  embedding_dimension INTEGER,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_user_personas_user_id ON user_personas(user_id);
CREATE INDEX idx_user_personas_active ON user_personas(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_personas_keywords ON user_personas USING GIN(keywords);

COMMENT ON TABLE user_personas IS 'User style personas for prompt matching and consistency';
COMMENT ON COLUMN user_personas.keywords IS 'Style keywords as JSON array';
COMMENT ON COLUMN user_personas.style_preferences IS 'User preferences (lighting, composition, etc.) as JSON';
COMMENT ON COLUMN user_personas.embedding_id IS 'Reference to Pinecone vector ID';
COMMENT ON COLUMN user_personas.is_active IS 'Currently active persona for user';

-- =====================================================
-- Table: style_history
-- Tracks user's style evolution and feedback
-- =====================================================
CREATE TABLE IF NOT EXISTS style_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id INTEGER REFERENCES user_personas(id) ON DELETE SET NULL,
  image_ids JSONB DEFAULT '[]'::jsonb,
  prompt_text TEXT,
  feedback_type VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_style_history_user_id ON style_history(user_id);
CREATE INDEX idx_style_history_persona_id ON style_history(persona_id);
CREATE INDEX idx_style_history_created_at ON style_history(created_at DESC);
CREATE INDEX idx_style_history_feedback_type ON style_history(feedback_type);

COMMENT ON TABLE style_history IS 'Historical record of user style preferences and feedback';
COMMENT ON COLUMN style_history.image_ids IS 'Array of image IDs associated with this history entry';
COMMENT ON COLUMN style_history.feedback_type IS 'Type of feedback: persona_update, outlier, comment, etc.';
COMMENT ON COLUMN style_history.metadata IS 'Additional context as JSON';

-- =====================================================
-- Update vlt_specifications table to support persona matching
-- =====================================================
ALTER TABLE vlt_specifications 
ADD COLUMN IF NOT EXISTS persona_id INTEGER REFERENCES user_personas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS match_score DECIMAL(3,2);

CREATE INDEX IF NOT EXISTS idx_vlt_specifications_persona_id ON vlt_specifications(persona_id);

COMMENT ON COLUMN vlt_specifications.persona_id IS 'Associated persona if used during generation';
COMMENT ON COLUMN vlt_specifications.match_score IS 'Persona match score (0.00 to 1.00)';

-- =====================================================
-- Update images table to track persona usage
-- =====================================================
ALTER TABLE images
ADD COLUMN IF NOT EXISTS persona_id INTEGER REFERENCES user_personas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS enhanced_prompt TEXT,
ADD COLUMN IF NOT EXISTS original_vlt_spec JSONB;

CREATE INDEX IF NOT EXISTS idx_images_persona_id ON images(persona_id);

COMMENT ON COLUMN images.persona_id IS 'Persona used when generating this image';
COMMENT ON COLUMN images.enhanced_prompt IS 'Enhanced prompt after Stage 2 processing';
COMMENT ON COLUMN images.original_vlt_spec IS 'Original VLT specification as JSON';

-- =====================================================
-- Function: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Auto-update updated_at for user_personas
-- =====================================================
DROP TRIGGER IF EXISTS update_user_personas_updated_at ON user_personas;
CREATE TRIGGER update_user_personas_updated_at
  BEFORE UPDATE ON user_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Sample Data: Default personas (optional)
-- =====================================================
-- Uncomment to insert default personas for testing
/*
INSERT INTO user_personas (user_id, name, description, keywords, is_active)
SELECT 
  id,
  'Minimalist Tailoring',
  'Clean lines, monochromatic palettes, precision construction',
  '["minimalist", "tailored", "structured", "monochrome", "clean lines"]'::jsonb,
  true
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM user_personas WHERE user_id = users.id AND name = 'Minimalist Tailoring'
)
LIMIT 1;
*/
