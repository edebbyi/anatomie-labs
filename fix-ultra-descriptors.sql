-- Fix ultra_detailed_descriptors table
-- This creates the table without the problematic subquery in generated column

-- Ultra-detailed descriptors table
CREATE TABLE IF NOT EXISTS ultra_detailed_descriptors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL UNIQUE REFERENCES portfolio_images(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Complete ultra-detailed analysis (JSONB for flexibility)
    executive_summary JSONB NOT NULL,
    garments JSONB NOT NULL,
    model_demographics JSONB,
    photography JSONB NOT NULL,
    styling_context JSONB,
    contextual_attributes JSONB,
    technical_fashion_notes JSONB,
    metadata JSONB NOT NULL,

    -- Quality metrics (extracted for fast querying)
    completeness_percentage NUMERIC DEFAULT 0,
    overall_confidence NUMERIC DEFAULT 0,

    -- Generated columns for fast querying
    primary_garment TEXT GENERATED ALWAYS AS (
        garments->0->>'type'
    ) STORED,

    garment_count INT GENERATED ALWAYS AS (
        jsonb_array_length(garments)
    ) STORED,

    fabric_type TEXT GENERATED ALWAYS AS (
        garments->0->'fabric'->>'primary_material'
    ) STORED,

    dominant_colors TEXT[],  -- Populated by application code

    model_ethnicity TEXT GENERATED ALWAYS AS (
        model_demographics->'ethnicity'->>'observed_characteristics'
    ) STORED,

    model_body_type TEXT GENERATED ALWAYS AS (
        model_demographics->'body_type'->>'overall_build'
    ) STORED,

    shot_type TEXT GENERATED ALWAYS AS (
        photography->'shot_composition'->>'type'
    ) STORED,

    lighting_type TEXT GENERATED ALWAYS AS (
        photography->'lighting'->>'type'
    ) STORED,

    season TEXT GENERATED ALWAYS AS (
        contextual_attributes->>'season'
    ) STORED,

    occasion TEXT GENERATED ALWAYS AS (
        contextual_attributes->>'occasion'
    ) STORED,

    style_aesthetic TEXT GENERATED ALWAYS AS (
        contextual_attributes->>'mood_aesthetic'
    ) STORED,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Descriptor quality log table
CREATE TABLE IF NOT EXISTS descriptor_quality_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descriptor_id UUID REFERENCES ultra_detailed_descriptors(id) ON DELETE CASCADE,
    image_id UUID REFERENCES portfolio_images(id),
    user_id UUID REFERENCES users(id),

    -- Quality metrics
    overall_confidence NUMERIC,
    completeness_percentage NUMERIC,
    garment_count INT,

    -- Flags
    requires_review BOOLEAN DEFAULT FALSE,
    review_reason TEXT,

    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Descriptor corrections table (for continuous improvement)
CREATE TABLE IF NOT EXISTS descriptor_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descriptor_id UUID REFERENCES ultra_detailed_descriptors(id) ON DELETE CASCADE,
    image_id UUID REFERENCES portfolio_images(id),
    user_id UUID REFERENCES users(id),

    -- Correction details
    field_path TEXT NOT NULL,
    ai_value TEXT,
    corrected_value TEXT NOT NULL,

    -- Metadata
    corrected_by UUID REFERENCES users(id),
    correction_reason TEXT,

    corrected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ultra_user_id ON ultra_detailed_descriptors(user_id);
CREATE INDEX IF NOT EXISTS idx_ultra_image_id ON ultra_detailed_descriptors(image_id);
CREATE INDEX IF NOT EXISTS idx_ultra_primary_garment ON ultra_detailed_descriptors(primary_garment);
CREATE INDEX IF NOT EXISTS idx_ultra_fabric_type ON ultra_detailed_descriptors(fabric_type);
CREATE INDEX IF NOT EXISTS idx_ultra_dominant_colors ON ultra_detailed_descriptors USING gin(dominant_colors);
CREATE INDEX IF NOT EXISTS idx_ultra_model_body_type ON ultra_detailed_descriptors(model_body_type);
CREATE INDEX IF NOT EXISTS idx_ultra_shot_type ON ultra_detailed_descriptors(shot_type);
CREATE INDEX IF NOT EXISTS idx_ultra_season ON ultra_detailed_descriptors(season);
CREATE INDEX IF NOT EXISTS idx_ultra_occasion ON ultra_detailed_descriptors(occasion);
CREATE INDEX IF NOT EXISTS idx_ultra_style_aesthetic ON ultra_detailed_descriptors(style_aesthetic);
CREATE INDEX IF NOT EXISTS idx_ultra_confidence ON ultra_detailed_descriptors(overall_confidence);
CREATE INDEX IF NOT EXISTS idx_ultra_completeness ON ultra_detailed_descriptors(completeness_percentage);
CREATE INDEX IF NOT EXISTS idx_ultra_created_at ON ultra_detailed_descriptors(created_at);
CREATE INDEX IF NOT EXISTS idx_quality_log_requires_review ON descriptor_quality_log(requires_review) WHERE requires_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_quality_log_logged_at ON descriptor_quality_log(logged_at);
CREATE INDEX IF NOT EXISTS idx_corrections_field_path ON descriptor_corrections(field_path);
CREATE INDEX IF NOT EXISTS idx_corrections_descriptor ON descriptor_corrections(descriptor_id);
CREATE INDEX IF NOT EXISTS idx_corrections_corrected_at ON descriptor_corrections(corrected_at);

-- Create trigger
CREATE TRIGGER update_ultra_detailed_descriptors_updated_at BEFORE UPDATE ON ultra_detailed_descriptors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
