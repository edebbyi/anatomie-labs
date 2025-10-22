-- Clear Database Script
-- This script will delete all data from all tables while preserving the schema structure
-- Run this with: psql -d designer_bff -f clear_database.sql

BEGIN;

-- Disable foreign key constraints temporarily to avoid dependency issues
SET session_replication_role = replica;

-- Clear all tables in dependency order (children first, then parents)
TRUNCATE TABLE 
    analytics_snapshots,
    collection_images,
    collections,
    image_feedback,
    cost_tracking,
    nightly_batches,
    global_learning,
    prompt_optimizations,
    images,
    generation_jobs,
    vlt_specifications,
    voice_commands,
    user_profiles,
    users
RESTART IDENTITY CASCADE;

-- Re-enable foreign key constraints
SET session_replication_role = DEFAULT;

-- Reset all sequences to start from 1
-- (Note: UUIDs don't use sequences, but including this for completeness)

-- Clear any cached data or temporary files (if applicable)
-- Note: This doesn't clear R2/Cloudflare storage - you may want to do that separately

-- Display confirmation
SELECT 
    'Database cleared successfully!' as status,
    NOW() as cleared_at;

-- Show table counts to verify everything is empty
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = t.table_name) as row_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
ORDER BY table_name;

COMMIT;