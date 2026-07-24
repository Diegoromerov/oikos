-- Migration 031: PQRS + Reservas with RLS
-- Depends on: 030_porteria_rls.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- PQRS TABLE
-- ============================================================================
CREATE TABLE pqrs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('peticion', 'queja', 'reclamo', 'sugerencia')),
    asunto VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_proceso', 'resuelto', 'cerrado', 'rechazado', 'reabierto')),
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    asignado_a UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    sla_fecha_limite TIMESTAMPTZ NOT NULL,
    fecha_resolucion TIMESTAMPTZ,
    archivos_adjuntos JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pqrs_tenant_id ON pqrs(tenant_id);
CREATE INDEX idx_pqrs_unidad_id ON pqrs(unidad_id);
CREATE INDEX idx_pqrs_usuario_id ON pqrs(usuario_id);
CREATE INDEX idx_pqrs_asignado_a ON pqrs(asignado_a) WHERE asignado_a IS NOT NULL;
CREATE INDEX idx_pqrs_estado ON pqrs(estado);
CREATE INDEX idx_pqrs_sla_fecha_limite ON pqrs(sla_fecha_limite) WHERE fecha_resolucion IS NULL;
CREATE INDEX idx_pqrs_tipo_prioridad ON pqrs(tipo, prioridad);

-- Updated at trigger
CREATE TRIGGER update_pqrs_updated_at
    BEFORE UPDATE ON pqrs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on pqrs
ALTER TABLE pqrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pqrs_superadmin_policy ON pqrs
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY pqrs_tenant_isolation_policy ON pqrs
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

ALTER TABLE pqrs FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- PQRS SEGUIMIENTOS TABLE
-- ============================================================================
CREATE TABLE pqrs_seguimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pqrs_id UUID NOT NULL REFERENCES pqrs(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    comentario TEXT NOT NULL,
    es_interno BOOLEAN DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pqrs_seguimientos_tenant_id ON pqrs_seguimientos(tenant_id);
CREATE INDEX idx_pqrs_seguimientos_pqrs_id ON pqrs_seguimientos(pqrs_id);
CREATE INDEX idx_pqrs_seguimientos_usuario_id ON pqrs_seguimientos(usuario_id);

-- RLS on pqrs_seguimientos
ALTER TABLE pqrs_seguimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY pqrs_seguimientos_superadmin_policy ON pqrs_seguimientos
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY pqrs_seguimientos_tenant_isolation_policy ON pqrs_seguimientos
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

ALTER TABLE pqrs_seguimientos FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- ZONAS COMUNES TABLE
-- ============================================================================
CREATE TABLE zonas_comunes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    capacidad_maxima INTEGER NOT NULL DEFAULT 1,
    costo NUMERIC(12,2) NOT NULL DEFAULT 0,
    requiere_aprobacion BOOLEAN NOT NULL DEFAULT true,
    horario_disponible JSONB NOT NULL DEFAULT '{}',
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_zonas_comunes_tenant_id ON zonas_comunes(tenant_id);
CREATE INDEX idx_zonas_comunes_activo ON zonas_comunes(activo);

-- Updated at trigger
CREATE TRIGGER update_zonas_comunes_updated_at
    BEFORE UPDATE ON zonas_comunes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on zonas_comunes
ALTER TABLE zonas_comunes ENABLE ROW LEVEL SECURITY;

CREATE POLICY zonas_comunes_superadmin_policy ON zonas_comunes
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY zonas_comunes_tenant_isolation_policy ON zonas_comunes
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

ALTER TABLE zonas_comunes FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- RESERVAS TABLE - with no-overlap constraint using GENERATED STORED columns
-- ============================================================================
CREATE TABLE reservas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    zona_comun_id UUID NOT NULL REFERENCES zonas_comunes(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    -- Generated STORED columns for exclusion constraint (IMMUTABLE)
    ts_inicio TIMESTAMP GENERATED ALWAYS AS ((fecha + hora_inicio)) STORED,
    ts_fin TIMESTAMP GENERATED ALWAYS AS ((fecha + hora_fin)) STORED,
    costo_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'cancelada')),
    aprobado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_aprobacion TIMESTAMPTZ,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reservas_tenant_id ON reservas(tenant_id);
CREATE INDEX idx_reservas_estado ON reservas(estado);
CREATE INDEX idx_reservas_unidad_id ON reservas(unidad_id);
CREATE INDEX idx_reservas_usuario_id ON reservas(usuario_id);
CREATE INDEX idx_reservas_fecha ON reservas(fecha);
CREATE INDEX idx_reservas_ts_inicio ON reservas(ts_inicio);

-- EXCLUSION CONSTRAINT for no-overlap using GENERATED STORED columns (IMMUTABLE)
-- Two confirmed reservations cannot overlap in time for the same zona_comun in same tenant
ALTER TABLE reservas ADD CONSTRAINT reservas_no_solapamiento
EXCLUDE USING gist (
    zona_comun_id WITH =,
    tenant_id WITH =,
    tsrange(ts_inicio, ts_fin, '[)') WITH &&
) WHERE (estado = 'confirmada');

-- Updated at trigger
CREATE TRIGGER update_reservas_updated_at
    BEFORE UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on reservas
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY reservas_superadmin_policy ON reservas
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY reservas_tenant_isolation_policy ON reservas
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

ALTER TABLE reservas FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- SLA CALCULATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION calcular_sla_fecha_limite(
    p_tipo VARCHAR,
    p_prioridad VARCHAR,
    p_creado_en TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_horas INTERVAL;
    v_dias_habiles INTEGER;
BEGIN
    -- Días hábiles según tipo y prioridad
    CASE p_tipo
        WHEN 'peticion' THEN
            CASE p_prioridad
                WHEN 'urgente' THEN v_dias_habiles := 1; v_horas := '24 hours';
                WHEN 'alta' THEN v_dias_habiles := 3; v_horas := '72 hours';
                WHEN 'media' THEN v_dias_habiles := 5; v_horas := '120 hours';
                WHEN 'baja' THEN v_dias_habiles := 10; v_horas := '240 hours';
            END CASE;
        WHEN 'queja' THEN
            CASE p_prioridad
                WHEN 'urgente' THEN v_dias_habiles := 1; v_horas := '24 hours';
                WHEN 'alta' THEN v_dias_habiles := 3; v_horas := '72 hours';
                WHEN 'media' THEN v_dias_habiles := 5; v_horas := '120 hours';
                WHEN 'baja' THEN v_dias_habiles := 10; v_horas := '240 hours';
            END CASE;
        WHEN 'reclamo' THEN
            CASE p_prioridad
                WHEN 'urgente' THEN v_dias_habiles := 1; v_horas := '24 hours';
                WHEN 'alta' THEN v_dias_habiles := 2; v_horas := '48 hours';
                WHEN 'media' THEN v_dias_habiles := 3; v_horas := '72 hours';
                WHEN 'baja' THEN v_dias_habiles := 5; v_horas := '120 hours';
            END CASE;
        WHEN 'sugerencia' THEN
            CASE p_prioridad
                WHEN 'urgente' THEN v_dias_habiles := 2; v_horas := '48 hours';
                WHEN 'alta' THEN v_dias_habiles := 5; v_horas := '120 hours';
                WHEN 'media' THEN v_dias_habiles := 10; v_horas := '240 hours';
                WHEN 'baja' THEN v_dias_habiles := 15; v_horas := '360 hours';
            END CASE;
    END CASE;

    -- Para simplicidad usamos intervalo directo (incluye fines de semana)
    -- Para días hábiles estrictos se requiere función más compleja
    RETURN p_creado_en + v_horas;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate SLA on insert
CREATE OR REPLACE FUNCTION trigger_calcular_sla()
RETURNS TRIGGER AS $$
BEGIN
    NEW.sla_fecha_limite := calcular_sla_fecha_limite(NEW.tipo, NEW.prioridad, NEW.creado_en);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pqrs_calcular_sla
    BEFORE INSERT ON pqrs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_calcular_sla();

-- ============================================================================
-- PQRS STATE TRANSITION VALIDATION
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_pqrs_state_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- If state is not changing, allow
    IF OLD.estado = NEW.estado THEN
        RETURN NEW;
    END IF;
    
    -- Define valid transitions
    -- abierto -> en_proceso, rechazado
    -- en_proceso -> resuelto, reabierto
    -- resuelto -> cerrado, reabierto
    -- cerrado -> (no transitions allowed, final state)
    -- rechazado -> (no transitions allowed, final state)
    -- reabierto -> en_proceso, resuelto
    
    CASE OLD.estado
        WHEN 'abierto' THEN
            IF NEW.estado NOT IN ('en_proceso', 'rechazado') THEN
                RAISE EXCEPTION 'Invalid state transition: % -> % (allowed: en_proceso, rechazado)', OLD.estado, NEW.estado;
            END IF;
        WHEN 'en_proceso' THEN
            IF NEW.estado NOT IN ('resuelto', 'reabierto') THEN
                RAISE EXCEPTION 'Invalid state transition: % -> % (allowed: resuelto, reabierto)', OLD.estado, NEW.estado;
            END IF;
        WHEN 'resuelto' THEN
            IF NEW.estado NOT IN ('cerrado', 'reabierto') THEN
                RAISE EXCEPTION 'Invalid state transition: % -> % (allowed: cerrado, reabierto)', OLD.estado, NEW.estado;
            END IF;
        WHEN 'cerrado' THEN
            RAISE EXCEPTION 'Cannot transition from final state: cerrado';
        WHEN 'rechazado' THEN
            RAISE EXCEPTION 'Cannot transition from final state: rechazado';
        WHEN 'reabierto' THEN
            IF NEW.estado NOT IN ('en_proceso', 'resuelto') THEN
                RAISE EXCEPTION 'Invalid state transition: % -> % (allowed: en_proceso, resuelto)', OLD.estado, NEW.estado;
            END IF;
        ELSE
            RAISE EXCEPTION 'Unknown state: %', OLD.estado;
    END CASE;
    
    -- Auto-set fecha_resolucion when transitioning to resuelto or cerrado
    IF NEW.estado IN ('resuelto', 'cerrado') AND OLD.estado NOT IN ('resuelto', 'cerrado') THEN
        NEW.fecha_resolucion := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pqrs_validate_state_transition
    BEFORE UPDATE OF estado ON pqrs
    FOR EACH ROW
    EXECUTE FUNCTION validate_pqrs_state_transition();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE pqrs IS 'Peticiones, Quejas, Reclamos y Sugerencias con SLA automático';
COMMENT ON COLUMN pqrs.sla_fecha_limite IS 'Calculada automáticamente por trigger según tipo/prioridad';
COMMENT ON COLUMN pqrs.estado IS 'Flujo: abierto -> en_proceso -> resuelto -> cerrado. También: rechazado, reabierto';

COMMENT ON TABLE pqrs_seguimientos IS 'Historial de seguimiento/comunicaciones de un PQRS';
COMMENT ON COLUMN pqrs_seguimientos.es_interno IS 'True = nota interna entre admins, False = comunicación visible al residente';

COMMENT ON TABLE zonas_comunes IS 'Zonas comunes reservables (salón social, BBQ, piscina, canchas, etc.)';
COMMENT ON COLUMN zonas_comunes.horario_disponible IS 'JSONB: {"lunes": [{"inicio":"08:00","fin":"22:00"}], "sabado": [...]}';

COMMENT ON TABLE reservas IS 'Reservas de zonas comunes con constraint de no-solapamiento a nivel BD';
COMMENT ON CONSTRAINT reservas_no_solapamiento ON reservas IS 'Exclusion constraint: no dos reservas confirmadas solapadas en misma zona/tenant';
COMMENT ON COLUMN reservas.costo_aplicado IS 'Snapshot del costo al momento de reservar (no referencia dinámica)';
COMMENT ON COLUMN reservas.ts_inicio IS 'Timestamp de inicio generado (fecha + hora_inicio) para exclusion constraint';
COMMENT ON COLUMN reservas.ts_fin IS 'Timestamp de fin generado (fecha + hora_fin) para exclusion constraint';