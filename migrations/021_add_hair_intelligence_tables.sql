-- Tabla: hair_health_reports
CREATE TABLE IF NOT EXISTS hair_health_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES beauty_scan_sessions(id) ON DELETE SET NULL,
    
    -- Métricas de diagnóstico
    curl_pattern VARCHAR(10),
    porosity_level VARCHAR(20),
    density_level VARCHAR(20),
    gray_hair_percentage DECIMAL(5,2),
    current_color_level INTEGER,
    
    -- Puntuaciones calculadas
    damage_index DECIMAL(5,2),
    moisture_level DECIMAL(5,2),
    elasticity_score DECIMAL(5,2),
    overall_health_score DECIMAL(5,2),
    
    -- Metadatos de IA
    ai_confidence_score DECIMAL(5,2),
    analysis_metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hair_reports_user_id ON hair_health_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_hair_reports_created_at ON hair_health_reports(created_at DESC);

-- Tabla: hair_treatment_plans
CREATE TABLE IF NOT EXISTS hair_treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES hair_health_reports(id) ON DELETE CASCADE,
    
    recommended_shampoos JSONB DEFAULT '[]',
    recommended_conditioners JSONB DEFAULT '[]',
    recommended_masks JSONB DEFAULT '[]',
    protein_treatment_needed BOOLEAN DEFAULT FALSE,
    protein_frequency_days INTEGER,
    heat_protection_required BOOLEAN DEFAULT TRUE,
    trim_recommendation_cm DECIMAL(3,1),
    trim_frequency_weeks INTEGER,
    ingredients_to_avoid JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hair_treatment_plans_report_id ON hair_treatment_plans(report_id);
