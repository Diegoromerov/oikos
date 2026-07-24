-- ============================================
-- Migración 017: Esquema de BeautyProfile e Integración Biométrica/Sesiones
-- ============================================

-- 1. Crear tabla biometric_consents
CREATE TABLE IF NOT EXISTS biometric_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) DEFAULT 'standard',
  is_active BOOLEAN DEFAULT TRUE,
  ip_address VARCHAR(45),
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para biometric_consents
CREATE INDEX IF NOT EXISTS idx_biometric_consents_user_id ON biometric_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_biometric_consents_is_active ON biometric_consents(user_id) WHERE is_active = TRUE;

-- 2. Crear tabla beauty_profiles
CREATE TABLE IF NOT EXISTS beauty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  skin_subtone VARCHAR(20) DEFAULT 'unknown' CHECK (skin_subtone IN ('cold', 'warm', 'neutral', 'unknown')),
  skin_subtone_confidence REAL DEFAULT 0.0 CHECK (skin_subtone_confidence BETWEEN 0.0 AND 1.0),
  skin_concerns JSONB DEFAULT '[]'::jsonb,
  hair_diagnosis JSONB DEFAULT '{}'::jsonb,
  hand_morphology JSONB DEFAULT '{}'::jsonb,
  brow_visajismo JSONB DEFAULT '{}'::jsonb,
  trend_affinity JSONB DEFAULT '[]'::jsonb,
  evolution_history JSONB DEFAULT '[]'::jsonb,
  beauty_score INTEGER DEFAULT 0 CHECK (beauty_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices requeridos
CREATE UNIQUE INDEX IF NOT EXISTS idx_beauty_profiles_user_id ON beauty_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_profiles_skin_subtone ON beauty_profiles(skin_subtone);
CREATE INDEX IF NOT EXISTS idx_beauty_profiles_updated_at ON beauty_profiles(updated_at);

-- 3. Crear tabla beauty_scan_sessions
CREATE TABLE IF NOT EXISTS beauty_scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  face_frontal_image_url TEXT,
  face_lateral_image_url TEXT,
  hair_image_url TEXT,
  hand_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para beauty_scan_sessions
CREATE INDEX IF NOT EXISTS idx_beauty_scan_sessions_user_id ON beauty_scan_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_scan_sessions_created_at ON beauty_scan_sessions(created_at DESC);
