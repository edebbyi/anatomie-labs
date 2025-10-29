-- Fix generations table to add missing columns for generation service
-- This fixes the "column status does not exist" error

-- Add status column
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Add settings column for storing generation settings
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add metadata column for storing additional generation metadata
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add stage column for tracking generation progress
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS stage VARCHAR(100);

-- Add stage_data column for storing stage-specific data
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS stage_data JSONB DEFAULT '{}'::jsonb;

-- Add error column for storing error messages
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS error TEXT;

-- Add completed_at timestamp
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add updated_at timestamp
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);

-- Create index on user_id and status for user-specific queries
CREATE INDEX IF NOT EXISTS idx_generations_user_status ON generations(user_id, status);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);

-- Update existing records to have 'completed' status if they have a URL
UPDATE generations 
SET status = 'completed' 
WHERE url IS NOT NULL AND status IS NULL;

-- Update existing records to have 'failed' status if they don't have a URL
UPDATE generations 
SET status = 'failed' 
WHERE url IS NULL AND status IS NULL;

COMMENT ON COLUMN generations.status IS 'Generation status: pending, processing, completed, failed';
COMMENT ON COLUMN generations.settings IS 'Generation settings (count, provider, quality, etc.)';
COMMENT ON COLUMN generations.metadata IS 'Additional metadata about the generation';
COMMENT ON COLUMN generations.stage IS 'Current stage of generation pipeline';
COMMENT ON COLUMN generations.stage_data IS 'Data specific to the current stage';
COMMENT ON COLUMN generations.error IS 'Error message if generation failed';

