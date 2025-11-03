-- Migration: Add pipeline_data column to generations table
-- Purpose: Store pipeline stage data and metadata for generation tracking
-- Created: 2025-11-03

-- Add pipeline_data column if it doesn't exist
ALTER TABLE generations
ADD COLUMN IF NOT EXISTS pipeline_data JSONB DEFAULT '{}'::jsonb;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_generations_pipeline_data ON generations USING GIN(pipeline_data);

COMMENT ON COLUMN generations.pipeline_data IS 'Full pipeline data including VLT, enhancement, routing, RLHF and filtering stats';