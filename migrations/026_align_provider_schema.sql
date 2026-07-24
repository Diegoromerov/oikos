BEGIN;

-- Agregar columnas de compliance
ALTER TABLE perfiles_prestador
  ADD COLUMN IF NOT EXISTS tarjeta_profesional_url TEXT,
  ADD COLUMN IF NOT EXISTS certificado_bioseguridad_url TEXT,
  ADD COLUMN IF NOT EXISTS poliza_gracia_hasta DATE;

-- Agregar configuración horaria
ALTER TABLE perfiles_prestador
  ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active_start_hour TIME,
  ADD COLUMN IF NOT EXISTS active_end_hour TIME;

-- Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_perfiles_prestador_estatus 
  ON perfiles_prestador(estatus_verificacion);
CREATE INDEX IF NOT EXISTS idx_perfiles_prestador_is_online 
  ON perfiles_prestador(is_online) WHERE is_online = true;

COMMIT;
