-- Add missing columns to generations table for PODNA agent system

ALTER TABLE generations ADD COLUMN url TEXT;
ALTER TABLE generations ADD COLUMN url_upscaled TEXT;
ALTER TABLE generations ADD COLUMN r2_key VARCHAR(500);
ALTER TABLE generations ADD COLUMN r2_key_upscaled VARCHAR(500);
ALTER TABLE generations ADD COLUMN width INTEGER;
ALTER TABLE generations ADD COLUMN height INTEGER;
ALTER TABLE generations ADD COLUMN provider VARCHAR(100) DEFAULT 'imagen-4-ultra';
ALTER TABLE generations ADD COLUMN params JSONB;
ALTER TABLE generations ADD COLUMN seed VARCHAR(100);
ALTER TABLE generations ADD COLUMN cost_cents INTEGER;
ALTER TABLE generations ADD COLUMN is_upscaled BOOLEAN DEFAULT false;
ALTER TABLE generations ADD COLUMN upscale_cost_cents INTEGER;

-- Create index for prompt_id
CREATE INDEX IF NOT EXISTS idx_generations_prompt_id ON generations(prompt_id);
