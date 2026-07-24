-- Migration 029: Financial tables (facturas, pagos) with RLS
-- Depends on: 027_tenants_rls_template.sql, 028_users_roles_rls.sql, unidades table

-- ============================================================================
-- FACTURAS TABLE
-- ============================================================================
CREATE TABLE facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL, -- FK to unidades table (added later)
    numero_factura VARCHAR(50),
    tipo VARCHAR(30) NOT NULL 
        CHECK (tipo IN ('ordinaria', 'extraordinaria')),
    periodo VARCHAR(20) NOT NULL, -- Format: YYYY-MM
    monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    fecha_emision TIMESTAMPTZ NOT NULL,
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    estado_sync VARCHAR(30) NOT NULL DEFAULT 'pendiente'
        CHECK (estado_sync IN ('pendiente', 'sincronizado', 'error')),
    siigo_factura_id VARCHAR(100),
    error_sync TEXT,
    intentos_sync INTEGER NOT NULL DEFAULT 0,
    ultimo_intento_sync TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_facturas_tenant_id ON facturas(tenant_id);
CREATE INDEX idx_facturas_unidad_id ON facturas(unidad_id);
CREATE INDEX idx_facturas_estado_sync ON facturas(estado_sync);
CREATE INDEX idx_facturas_periodo ON facturas(periodo);
CREATE INDEX idx_facturas_tenant_unidad_periodo ON facturas(tenant_id, unidad_id, periodo);

-- Updated at trigger
CREATE TRIGGER update_facturas_updated_at
    BEFORE UPDATE ON facturas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on facturas
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY facturas_superadmin_policy ON facturas
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY facturas_tenant_isolation_policy ON facturas
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');


-- ============================================================================
-- PAGOS TABLE
-- ============================================================================
CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL, -- FK to unidades table
    factura_id UUID REFERENCES facturas(id) ON DELETE SET NULL,
    monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    metodo_pago VARCHAR(30) NOT NULL DEFAULT 'wompi'
        CHECK (metodo_pago IN ('wompi', 'efectivo', 'transferencia', 'cheque', 'otro')),
    wompi_transaction_id VARCHAR(100) UNIQUE,
    wompi_payment_link_id VARCHAR(100),
    estado_sync VARCHAR(50) NOT NULL DEFAULT 'pendiente_de_sincronizar_siigo'
        CHECK (estado_sync IN ('pendiente_de_sincronizar_siigo', 'sincronizado', 'error')),
    siigo_pago_id VARCHAR(100),
    error_sync TEXT,
    intentos_sync INTEGER NOT NULL DEFAULT 0,
    ultimo_intento_sync TIMESTAMPTZ,
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referencia_bancaria VARCHAR(100),
    metadata JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pagos_tenant_id ON pagos(tenant_id);
CREATE INDEX idx_pagos_unidad_id ON pagos(unidad_id);
CREATE INDEX idx_pagos_factura_id ON pagos(factura_id);
CREATE INDEX idx_pagos_estado_sync ON pagos(estado_sync);
CREATE INDEX idx_pagos_wompi_tx ON pagos(wompi_transaction_id) WHERE wompi_transaction_id IS NOT NULL;
CREATE INDEX idx_pagos_tenant_unidad_fecha ON pagos(tenant_id, unidad_id, fecha_pago DESC);

-- Updated at trigger
CREATE TRIGGER update_pagos_updated_at
    BEFORE UPDATE ON pagos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on pagos
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY pagos_superadmin_policy ON pagos
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY pagos_tenant_isolation_policy ON pagos
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');


-- ============================================================================
-- SYNC JOBS TABLE (for BullMQ retry tracking)
-- ============================================================================
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('factura', 'pago', 'estado_cuenta')),
    entidad_id UUID NOT NULL, -- factura_id or pago_id
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'procesando', 'completado', 'error', 'cancelado')),
    intentos INTEGER NOT NULL DEFAULT 0,
    max_intentos INTEGER NOT NULL DEFAULT 5,
    error_ultimo_intento TEXT,
    programado_para TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    procesado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_jobs_tenant_estado ON sync_jobs(tenant_id, estado);
CREATE INDEX idx_sync_jobs_programado ON sync_jobs(programado_para) WHERE estado = 'pendiente';

CREATE TRIGGER update_sync_jobs_updated_at
    BEFORE UPDATE ON sync_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_jobs_superadmin_policy ON sync_jobs
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY sync_jobs_tenant_isolation_policy ON sync_jobs
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');


COMMENT ON TABLE facturas IS 'Facturas de cuotas ordinarias/extraordinarias. RLS enforced via tenant_id.';
COMMENT ON COLUMN facturas.estado_sync IS 'pendiente | sincronizado | error (con SIIGO)';
COMMENT ON COLUMN facturas.siigo_factura_id IS 'ID de factura en SIIGO tras sincronización exitosa';

COMMENT ON TABLE pagos IS 'Pagos recibidos (Wompi, efectivo, etc.). RLS enforced via tenant_id.';
COMMENT ON COLUMN pagos.estado_sync IS 'pendiente_de_sincronizar_siigo | sincronizado | error';
COMMENT ON COLUMN pagos.wompi_transaction_id IS 'ID de transacción en Wompi (unique when present)';

COMMENT ON TABLE sync_jobs IS 'Cola de sincronización persistente para BullMQ retry logic. Permite reintentos tras reinicios.';