-- Migration: add generated helper columns for ultra_detailed_descriptors
-- Needed because newer prompt builders reference primary_garment for fast lookups.

BEGIN;

-- Ensure primary_garment generated column exists
ALTER TABLE ultra_detailed_descriptors
  ADD COLUMN IF NOT EXISTS primary_garment TEXT
    GENERATED ALWAYS AS ((garments->0->>'type')) STORED;

-- Optional helper columns that newer services expect but older databases may lack
ALTER TABLE ultra_detailed_descriptors
  ADD COLUMN IF NOT EXISTS garment_count INT
    GENERATED ALWAYS AS (jsonb_array_length(garments)) STORED;

ALTER TABLE ultra_detailed_descriptors
  ADD COLUMN IF NOT EXISTS fabric_type TEXT
    GENERATED ALWAYS AS (garments->0->'fabric'->>'primary_material') STORED;

-- Indexes for the new generated columns
CREATE INDEX IF NOT EXISTS idx_ultra_primary_garment
  ON ultra_detailed_descriptors(primary_garment);

CREATE INDEX IF NOT EXISTS idx_ultra_garment_count
  ON ultra_detailed_descriptors(garment_count);

CREATE INDEX IF NOT EXISTS idx_ultra_fabric_type
  ON ultra_detailed_descriptors(fabric_type);

COMMIT;
