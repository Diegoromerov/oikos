-- Tabla: color_dnas
CREATE TABLE IF NOT EXISTS color_dnas (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    harmonic_palette VARCHAR(100) NOT NULL,
    skin_undertone VARCHAR(50) NOT NULL,
    hair_porosity VARCHAR(50) NOT NULL,
    forbidden_colors JSONB NOT NULL DEFAULT '[]',
    forbidden_reason TEXT,
    signature_colors JSONB NOT NULL DEFAULT '[]',
    adventure_index DECIMAL(3,2) CHECK (adventure_index >= 0 AND adventure_index <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: color_recommendations
CREATE TABLE IF NOT EXISTS color_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color_id VARCHAR(50) NOT NULL,
    brand_name VARCHAR(100) NOT NULL,
    color_name VARCHAR(200) NOT NULL,
    reference VARCHAR(50) NOT NULL,
    color_value VARCHAR(20) NOT NULL,
    mood VARCHAR(50) NOT NULL,
    
    harmony_score DECIMAL(5,2) NOT NULL,
    skin_match DECIMAL(5,2),
    eye_match DECIMAL(5,2),
    trend_match DECIMAL(5,2),
    technical_viability DECIMAL(5,2),
    lifestyle_match DECIMAL(5,2),
    
    is_forbidden BOOLEAN DEFAULT FALSE,
    extra_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, color_id, mood)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_color_recommendations_user_id ON color_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_color_recommendations_mood ON color_recommendations(mood);
CREATE INDEX IF NOT EXISTS idx_color_recommendations_harmony_score ON color_recommendations(harmony_score DESC);

-- Tabla: color_try_on_history
CREATE TABLE IF NOT EXISTS color_try_on_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color_id VARCHAR(50) NOT NULL,
    light_condition VARCHAR(50),
    screenshot_url TEXT,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_try_on_history_user_id ON color_try_on_history(user_id);
