-- backend/migrations/023_beauty_scan_engine_job_schema.sql

-- Tabla de trabajos de escaneo
CREATE TABLE IF NOT EXISTS beauty_scan_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  state VARCHAR(20) NOT NULL CHECK (state IN ('pending', 'processing', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  incognito_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON beauty_scan_jobs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON beauty_scan_jobs(state);

-- Tabla de consentimientos biométricos
CREATE TABLE IF NOT EXISTS beauty_scan_consents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  consent_face BOOLEAN DEFAULT FALSE,
  consent_biometric BOOLEAN DEFAULT FALSE,
  consent_marketing BOOLEAN DEFAULT FALSE,
  retention_days INTEGER DEFAULT 30,
  ip_address INET,
  consented_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consents_user ON beauty_scan_consents(user_id, consented_at DESC);

-- Beauty Profile (compartido con orquestador)
CREATE TABLE IF NOT EXISTS beauty_profile (
  user_id INTEGER PRIMARY KEY,
  undertone VARCHAR(20) NOT NULL CHECK (undertone IN ('calido', 'frio', 'neutro')),
  season VARCHAR(20) NOT NULL CHECK (season IN ('primavera', 'verano', 'otono', 'invierno')),
  skin_depth VARCHAR(20) CHECK (skin_depth IN ('claro', 'medio', 'oscuro')),
  contrast_level VARCHAR(20) CHECK (contrast_level IN ('bajo', 'medio', 'alto')),
  recommended_palette JSONB NOT NULL,
  avoid_colors JSONB,
  face_shape VARCHAR(50),
  skin_type VARCHAR(50),
  hair_condition VARCHAR(50),
  beauty_score INTEGER,
  is_fallback BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_expires ON beauty_profile(expires_at);

-- Trigger para actualizar last_updated automáticamente
CREATE OR REPLACE FUNCTION update_beauty_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_beauty_profile_timestamp ON beauty_profile;
CREATE TRIGGER trigger_update_beauty_profile_timestamp
BEFORE UPDATE ON beauty_profile
FOR EACH ROW
EXECUTE FUNCTION update_beauty_profile_timestamp();
