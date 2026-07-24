-- Migration 030: Portería tables with RLS
-- Depends on: 027_tenants_rls_template.sql, 028_usuarios_unidades_rls.sql, 029_financiero_facturas_pagos_rls.sql

-- ============================================================================
-- VISITANTES PREAUTORIZADOS TABLE
-- ============================================================================
CREATE TABLE visitantes_preautorizados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    autorizado_por_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    nombre_visitante VARCHAR(200) NOT NULL,
    documento_visitante VARCHAR(50),
    tipo_visitante VARCHAR(30) NOT NULL DEFAULT 'visitante'
        CHECK (tipo_visitante IN ('visitante', 'domicilio', 'servicio', 'proveedor')),
    qr_code VARCHAR(200) UNIQUE NOT NULL,
    valido_desde TIMESTAMPTZ NOT NULL,
    valido_hasta TIMESTAMPTZ NOT NULL,
    usado_en TIMESTAMPTZ,
    local_uuid VARCHAR(100) UNIQUE NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_visitantes_preautorizados_tenant_id ON visitantes_preautorizados(tenant_id);
CREATE INDEX idx_visitantes_preautorizados_unidad_id ON visitantes_preautorizados(unidad_id);
CREATE INDEX idx_visitantes_preautorizados_qr_code ON visitantes_preautorizados(qr_code);
CREATE INDEX idx_visitantes_preautorizados_valido_ventana ON visitantes_preautorizados(valido_desde, valido_hasta);
CREATE INDEX idx_visitantes_preautorizados_local_uuid ON visitantes_preautorizados(local_uuid);

-- Updated at trigger
CREATE TRIGGER update_visitantes_preautorizados_updated_at
    BEFORE UPDATE ON visitantes_preautorizados
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on visitantes_preautorizados
ALTER TABLE visitantes_preautorizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY visitantes_preautorizados_superadmin_policy ON visitantes_preautorizados
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY visitantes_preautorizados_tenant_isolation_policy ON visitantes_preautorizados
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- ============================================================================
-- REGISTROS ACCESO TABLE
-- ============================================================================
CREATE TABLE registros_acceso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    visitante_preautorizado_id UUID REFERENCES visitantes_preautorizados(id) ON DELETE SET NULL,
    -- Datos de registro manual (si no hubo preautorización)
    nombre_visitante VARCHAR(200),
    documento_visitante VARCHAR(50),
    tipo_visitante VARCHAR(30),
    tipo_acceso VARCHAR(20) NOT NULL DEFAULT 'peatonal'
        CHECK (tipo_acceso IN ('peatonal', 'vehicular')),
    placa_vehiculo VARCHAR(20),
    direccion VARCHAR(10) NOT NULL DEFAULT 'entrada'
        CHECK (direccion IN ('entrada', 'salida')),
    portero_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    timestamp_local TIMESTAMPTZ NOT NULL,
    sincronizado_en TIMESTAMPTZ,
    device_id VARCHAR(100),
    local_uuid VARCHAR(100) UNIQUE NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_registros_acceso_tenant_id ON registros_acceso(tenant_id);
CREATE INDEX idx_registros_acceso_unidad_id ON registros_acceso(unidad_id);
CREATE INDEX idx_registros_acceso_visitante_preautorizado_id ON registros_acceso(visitante_preautorizado_id);
CREATE INDEX idx_registros_acceso_portero_id ON registros_acceso(portero_id);
CREATE INDEX idx_registros_acceso_timestamp_local ON registros_acceso(timestamp_local DESC);
CREATE INDEX idx_registros_acceso_sincronizado_en ON registros_acceso(sincronizado_en) WHERE sincronizado_en IS NULL;
CREATE INDEX idx_registros_acceso_local_uuid ON registros_acceso(local_uuid);

-- Updated at trigger
CREATE TRIGGER update_registros_acceso_updated_at
    BEFORE UPDATE ON registros_acceso
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on registros_acceso
ALTER TABLE registros_acceso ENABLE ROW LEVEL SECURITY;

CREATE POLICY registros_acceso_superadmin_policy ON registros_acceso
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY registros_acceso_tenant_isolation_policy ON registros_acceso
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- ============================================================================
-- CORRESPONDENCIA TABLE
-- ============================================================================
CREATE TABLE correspondencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('carta', 'paquete', 'encomienda', 'documento')),
    foto_url VARCHAR(500),
    portero_receptor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    recibido_en TIMESTAMPTZ NOT NULL,
    entregado_en TIMESTAMPTZ,
    firma_digital VARCHAR(1000),
    recibido_por VARCHAR(50),
    local_uuid VARCHAR(100) UNIQUE NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_correspondencia_tenant_id ON correspondencia(tenant_id);
CREATE INDEX idx_correspondencia_unidad_id ON correspondencia(unidad_id);
CREATE INDEX idx_correspondencia_portero_receptor_id ON correspondencia(portero_receptor_id);
CREATE INDEX idx_correspondencia_recibido_en ON correspondencia(recibido_en DESC);
CREATE INDEX idx_correspondencia_entregado_en ON correspondencia(entregado_en) WHERE entregado_en IS NULL;
CREATE INDEX idx_correspondencia_local_uuid ON correspondencia(local_uuid);

-- Updated at trigger
CREATE TRIGGER update_correspondencia_updated_at
    BEFORE UPDATE ON correspondencia
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on correspondencia
ALTER TABLE correspondencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY correspondencia_superadmin_policy ON correspondencia
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY correspondencia_tenant_isolation_policy ON correspondencia
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- ============================================================================
-- MINUTAS TURNO TABLE
-- ============================================================================
CREATE TABLE minutas_turno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    portero_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    turno_inicio TIMESTAMPTZ NOT NULL,
    turno_fin TIMESTAMPTZ,
    novedades TEXT,
    local_uuid VARCHAR(100) UNIQUE NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_minutas_turno_tenant_id ON minutas_turno(tenant_id);
CREATE INDEX idx_minutas_turno_portero_id ON minutas_turno(portero_id);
CREATE INDEX idx_minutas_turno_turno_inicio ON minutas_turno(turno_inicio DESC);
CREATE INDEX idx_minutas_turno_local_uuid ON minutas_turno(local_uuid);

-- Updated at trigger
CREATE TRIGGER update_minutas_turno_updated_at
    BEFORE UPDATE ON minutas_turno
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on minutas_turno
ALTER TABLE minutas_turno ENABLE ROW LEVEL SECURITY;

CREATE POLICY minutas_turno_superadmin_policy ON minutas_turno
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY minutas_turno_tenant_isolation_policy ON minutas_turno
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- ============================================================================
-- INCIDENTES TABLE
-- ============================================================================
CREATE TABLE incidentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    portero_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_incidente VARCHAR(30) NOT NULL
        CHECK (tipo_incidente IN ('panico', 'incidente', 'mantenimiento_urgente')),
    descripcion TEXT NOT NULL,
    foto_url VARCHAR(500),
    prioridad_envio BOOLEAN NOT NULL DEFAULT false,
    local_uuid VARCHAR(100) UNIQUE NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_incidentes_tenant_id ON incidentes(tenant_id);
CREATE INDEX idx_incidentes_portero_id ON incidentes(portero_id);
CREATE INDEX idx_incidentes_creado_en ON incidentes(creado_en DESC);
CREATE INDEX idx_incidentes_prioridad_envio ON incidentes(prioridad_envio) WHERE prioridad_envio = true;
CREATE INDEX idx_incidentes_local_uuid ON incidentes(local_uuid);

-- Updated at trigger
CREATE TRIGGER update_incidentes_updated_at
    BEFORE UPDATE ON incidentes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on incidentes
ALTER TABLE incidentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY incidentes_superadmin_policy ON incidentes
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY incidentes_tenant_isolation_policy ON incidentes
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE visitantes_preautorizados IS 'Visitantes preautorizados por residentes. QR code contiene JWT firmado para validación offline.';
COMMENT ON COLUMN visitantes_preautorizados.qr_code IS 'JWT firmado con datos: unidadId, visitanteId, tenantId, validoDesde, validoHasta. Validación offline sin consulta a BD.';
COMMENT ON COLUMN visitantes_preautorizados.local_uuid IS 'UUID generado en dispositivo móvil para idempotencia en sincronización.';
COMMENT ON TABLE registros_acceso IS 'Registros de ingreso/salida (peatonal/vehicular). Sincronización diferida con local_uuid para idempotencia.';
COMMENT ON COLUMN registros_acceso.timestamp_local IS 'Timestamp en el dispositivo al momento del registro (puede diferir del servidor).';
COMMENT ON COLUMN registros_acceso.sincronizado_en IS 'Null = pendiente sincronización. Seteado al confirmar upsert en backend.';
COMMENT ON TABLE correspondencia IS 'Correspondencia recibida/entregada en portería. Firma digital base64 opcional.';
COMMENT ON TABLE minutas_turno IS 'Minutas de turno de porteros. Novedades en texto libre.';
COMMENT ON TABLE incidentes IS 'Incidentes reportados por porteros. prioridad_envio=true fuerza intento de sync inmediato (botón pánico).';
COMMENT ON COLUMN incidentes.prioridad_envio IS 'Si true, el dispositivo intenta sincronizar inmediatamente además de la cola normal.';