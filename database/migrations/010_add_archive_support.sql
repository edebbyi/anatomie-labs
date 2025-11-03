-- Migration: Add archive support for images
-- Purpose: Add columns to track archived images and auto-delete after 15 days

-- Add archived column to generations table
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add archived_at timestamp
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster archive queries
CREATE INDEX IF NOT EXISTS idx_generations_archived ON generations(archived);

-- Create index for archive cleanup queries (archived_at older than 15 days)
CREATE INDEX IF NOT EXISTS idx_generations_archived_at ON generations(archived_at) 
WHERE archived = TRUE;

-- Create composite index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_generations_user_archived ON generations(user_id, archived)
WHERE archived = FALSE;