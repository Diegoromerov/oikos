-- Migration 032: Comunicados (Cartelera Digital)
-- Depends on: 031_pqrs_reservas_rls.sql
-- ============================================================================

CREATE TABLE comunicados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    cuerpo TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'informativo' CHECK (tipo IN ('informativo', 'urgente', 'evento', 'mantenimiento_programado')),
    prioridad VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (prioridad IN ('baja', 'normal', 'alta', 'urgente')),
    fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion TIMESTAMPTZ,
    adjuntos JSONB,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_comunicados_tenant_id ON comunicados(tenant_id);
CREATE INDEX idx_comunicados_fecha_publicacion ON comunicados(fecha_publicacion DESC);
CREATE INDEX idx_comunicados_fecha_expiracion ON comunicados(fecha_expiracion) WHERE fecha_expiracion IS NOT NULL;
CREATE INDEX idx_comunicados_prioridad ON comunicados(prioridad);
CREATE INDEX idx_comunicados_activo ON comunicados(activo);

-- Updated at trigger
CREATE TRIGGER update_comunicados_updated_at
    BEFORE UPDATE ON comunicados
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on comunicados
ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY comunicados_superadmin_policy ON comunicados
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY comunicados_tenant_isolation_policy ON comunicados
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

ALTER TABLE comunicados FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE comunicados IS 'Comunicados unidireccionales admin -> residentes (cartelera digital). No son PQRS (bidireccional).';
COMMENT ON COLUMN comunicados.prioridad IS 'Prioridad visual en app: baja=gris, normal=azul, alta=naranja, urgente=rojo';
COMMENT ON COLUMN comunicados.fecha_expiracion IS 'Opcional: comunicado deja de mostrarse en cartelera tras esta fecha';
COMMENT ON COLUMN comunicados.adjuntos IS 'JSONB: [{nombre, url, tipo}] para imágenes/documentos adjuntos';
COMMENT ON COLUMN comunicados.activo IS 'Si false, el comunicado está despublicado (soft delete)';