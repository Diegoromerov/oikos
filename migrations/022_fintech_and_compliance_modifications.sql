-- Migración 022: Cumplimiento Tributario y Legal (Onboarding de Prestadores y Facturación Electrónica)
-- Ejecutar en PostgreSQL

-- 1. Agregar columna de propina a bookings (100% transferible al prestador)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS propina NUMERIC(10,2) DEFAULT 0.00 CHECK (propina >= 0);

-- 2. Agregar campos fintech y tributarios a perfiles_prestador
ALTER TABLE perfiles_prestador
ADD COLUMN IF NOT EXISTS regimen_tributario VARCHAR(20) DEFAULT 'ORDINARIO' CHECK (regimen_tributario IN ('SIMPLE', 'ORDINARIO')),
ADD COLUMN IF NOT EXISTS facturacion_electronica_configurada BOOLEAN DEFAULT FALSE;

-- 3. Agregar campos obligatorios de cumplimiento legal (Ley 711/2001, Res 2292/2021, Ley 2466/2025)
ALTER TABLE perfiles_prestador
ADD COLUMN IF NOT EXISTS tarjeta_profesional_url TEXT,
ADD COLUMN IF NOT EXISTS certificado_bioseguridad_url TEXT,
ADD COLUMN IF NOT EXISTS poliza_responsabilidad_civil_url TEXT,
ADD COLUMN IF NOT EXISTS poliza_gracia_hasta TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contrato_comision_aceptado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS independencia_laboral_aceptada BOOLEAN DEFAULT FALSE;
