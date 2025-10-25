/**
 * Database Migration: Add user deletion fields
 * 
 * Adds deleted_at timestamp and status columns to the users table
 * to support account deletion with 30-day grace period
 */

-- Add deleted_at column to track when account was marked for deletion
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add status column to track user account status
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Add comments for documentation
COMMENT ON COLUMN users.deleted_at IS 'Timestamp when account was marked for deletion (soft delete)';
COMMENT ON COLUMN users.status IS 'User account status (active, deleted, suspended, etc.)';

-- Update existing users to have status = 'active'
UPDATE users 
SET status = 'active' 
WHERE status IS NULL OR status = '';

-- Verify the migration
DO $$ 
DECLARE
  deleted_at_exists BOOLEAN;
  status_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'deleted_at'
  ) INTO deleted_at_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'status'
  ) INTO status_exists;
  
  IF deleted_at_exists AND status_exists THEN
    RAISE NOTICE '✅ Migration successful: deleted_at and status columns added to users table';
  ELSE
    RAISE EXCEPTION '❌ Migration failed: columns not properly added';
  END IF;
END $$;