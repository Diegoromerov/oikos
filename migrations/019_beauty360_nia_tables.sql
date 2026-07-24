-- Migration 019: NIA Beauty 360 — Tablas de análisis y consentimiento
-- Requiere: 001_payment_system.sql (tabla users)

-- Tabla: beauty_consents — Consentimiento biométrico GDPR/Ley 1581
CREATE TABLE IF NOT EXISTS beauty_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, consent_version)
);

CREATE INDEX IF NOT EXISTS idx_beauty_consents_user_id ON beauty_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_consents_expires ON beauty_consents(expires_at) WHERE expires_at IS NOT NULL;

-- Tabla: beauty_scan_jobs — Tracking de análisis NIA Beauty 360
CREATE TABLE IF NOT EXISTS beauty_scan_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending', 'processing', 'completed', 'failed')),
    result JSONB,
    error_message TEXT,
    incognito_mode BOOLEAN DEFAULT FALSE,
    season VARCHAR(50),
    undertone VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beauty_scan_jobs_user_id ON beauty_scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_beauty_scan_jobs_state ON beauty_scan_jobs(state);
CREATE INDEX IF NOT EXISTS idx_beauty_scan_jobs_started ON beauty_scan_jobs(started_at DESC);
