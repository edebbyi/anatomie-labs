/**
 * Migration: Add prompt group tracking to generations
 */

ALTER TABLE generations
ADD COLUMN IF NOT EXISTS prompt_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_generations_prompt_group_id
ON generations(prompt_group_id);
