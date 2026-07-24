-- Migration 028: Users and Roles with RLS
-- Depends on: 027_tenants_rls_template.sql

-- ============================================================================
-- RLS TEMPLATE APPLIED:
-- 1. Add tenant_id UUID NOT NULL column with FK to tenants(id)
-- 2. Create index on tenant_id
-- 3. Enable RLS
-- 4. Create policy with superadmin bypass
-- ============================================================================

-- 1. Roles table (roles can be tenant-specific or global)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL,
    tipo VARCHAR(30) NOT NULL 
        CHECK (tipo IN ('propietario', 'residente', 'portero', 'admin', 'junta', 'revisor_fiscal', 'superadmin')),
    descripcion VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global role (superadmin)
    es_global BOOLEAN NOT NULL DEFAULT false, -- true for superadmin
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: role name unique per tenant (or globally for superadmin)
CREATE UNIQUE INDEX idx_roles_nombre_tenant ON roles(nombre, tenant_id);

-- Indexes
CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_tipo ON roles(tipo);
CREATE INDEX idx_roles_es_global ON roles(es_global);

-- Updated at trigger
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY roles_superadmin_policy ON roles
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

-- Tenant isolation: users see roles for their tenant + global roles
CREATE POLICY roles_tenant_isolation_policy ON roles
    USING (
        tenant_id = current_setting('app.current_tenant')::uuid 
        OR tenant_id IS NULL 
        OR es_global = true
        OR current_setting('app.is_superadmin', true) = 'true'
    )
    WITH CHECK (
        tenant_id = current_setting('app.current_tenant')::uuid 
        OR current_setting('app.is_superadmin', true) = 'true'
    );

-- 2. Users table (NO tenant_id directly - multi-tenant via roles)
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    telefono VARCHAR(20),
    foto_url VARCHAR(500),
    activo BOOLEAN NOT NULL DEFAULT true,
    email_verificado BOOLEAN NOT NULL DEFAULT false,
    ultimo_acceso TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- Updated at trigger
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- NOTE: usuarios table does NOT have tenant_id directly
-- Multi-tenancy is via usuario_roles.tenant_id (role determines tenant access)
-- RLS on usuarios is not applied directly; access controlled via roles

-- 3. User-Roles junction table (N:M) - THIS TABLE has tenant_id for RLS
CREATE TABLE usuario_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asignado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id, role_id)
);

-- Indexes
CREATE INDEX idx_usuario_roles_usuario_id ON usuario_roles(usuario_id);
CREATE INDEX idx_usuario_roles_role_id ON usuario_roles(role_id);
CREATE INDEX idx_usuario_roles_tenant_id ON usuario_roles(tenant_id);

-- RLS on usuario_roles
ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY usuario_roles_superadmin_policy ON usuario_roles
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

-- Tenant isolation
CREATE POLICY usuario_roles_tenant_isolation_policy ON usuario_roles
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- 4. Unidades table (from unidades module)
CREATE TABLE unidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    torre VARCHAR(50) NOT NULL,
    bloque VARCHAR(50),
    numero VARCHAR(50) NOT NULL,
    tipo_unidad VARCHAR(20) NOT NULL DEFAULT 'apartamento'
        CHECK (tipo_unidad IN ('apartamento', 'parqueadero', 'deposito', 'local')),
    area_privada NUMERIC(10,2) NOT NULL DEFAULT 0,
    coeficiente_copropiedad NUMERIC(10,8) NOT NULL DEFAULT 0,
    cuota_base NUMERIC(12,2) NOT NULL DEFAULT 0,
    piso INTEGER,
    es_estudio BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint per tenant
CREATE UNIQUE INDEX idx_unidades_tenant_torre_bloque_numero ON unidades(tenant_id, torre, bloque, numero);

-- Indexes
CREATE INDEX idx_unidades_tenant_id ON unidades(tenant_id);
CREATE INDEX idx_unidades_activo ON unidades(activo);
CREATE INDEX idx_unidades_tipo ON unidades(tipo_unidad);

-- Updated at trigger
CREATE TRIGGER update_unidades_updated_at
    BEFORE UPDATE ON unidades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on unidades
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY unidades_superadmin_policy ON unidades
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

-- Tenant isolation
CREATE POLICY unidades_tenant_isolation_policy ON unidades
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- 5. User-Units relationship table
CREATE TABLE usuario_unidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
    tipo_relacion VARCHAR(30) NOT NULL DEFAULT 'residente_autorizado'
        CHECK (tipo_relacion IN ('propietario', 'arrendatario', 'residente_autorizado')),
    es_principal BOOLEAN NOT NULL DEFAULT false,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id, unidad_id, tipo_relacion)
);

-- Indexes
CREATE INDEX idx_usuario_unidades_usuario_id ON usuario_unidades(usuario_id);
CREATE INDEX idx_usuario_unidades_unidad_id ON usuario_unidades(unidad_id);
CREATE INDEX idx_usuario_unidades_tipo ON usuario_unidades(tipo_relacion);
CREATE INDEX idx_usuario_unidades_es_principal ON usuario_unidades(es_principal);

-- Updated at trigger
CREATE TRIGGER update_usuario_unidades_updated_at
    BEFORE UPDATE ON usuario_unidades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS on usuario_unidades (through tenant_id from unidades join)
ALTER TABLE usuario_unidades ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY usuario_unidades_superadmin_policy ON usuario_unidades
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

-- Tenant isolation via join with unidades
CREATE POLICY usuario_unidades_tenant_isolation_policy ON usuario_unidades
    USING (
        EXISTS (
            SELECT 1 FROM unidades u 
            WHERE u.id = usuario_unidades.unidad_id 
            AND u.tenant_id = current_setting('app.current_tenant')::uuid
        )
        OR current_setting('app.is_superadmin', true) = 'true'
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM unidades u 
            WHERE u.id = usuario_unidades.unidad_id 
            AND u.tenant_id = current_setting('app.current_tenant')::uuid
        )
        OR current_setting('app.is_superadmin', true) = 'true'
    );

-- 6. Coefficient validation function
CREATE OR REPLACE FUNCTION validate_coefficients_sum(tenant_uuid UUID)
RETURNS TABLE(total NUMERIC(12,8), expected NUMERIC(12,8), is_valid BOOLEAN, difference NUMERIC(12,8)) AS $$
DECLARE
    total_coeff NUMERIC(12,8);
BEGIN
    SELECT COALESCE(SUM(coeficiente_copropiedad), 0)
    INTO total_coeff
    FROM unidades
    WHERE tenant_id = tenant_uuid AND activo = true;
    
    RETURN QUERY SELECT total_coeff, 100.00000000, 
           ABS(total_coeff - 100.00000000) < 0.01,
           ABS(total_coeff - 100.00000000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger to auto-validate coefficients after bulk operations
CREATE OR REPLACE FUNCTION notify_coefficient_validation()
RETURNS TRIGGER AS $$
BEGIN
    -- In production, this would queue a background job
    -- For now, just log
    RAISE NOTICE 'Coefficient validation needed for tenant %', NEW.tenant_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_coefficient_validation
    AFTER INSERT OR UPDATE OR DELETE ON unidades
    FOR EACH ROW
    EXECUTE FUNCTION notify_coefficient_validation();

COMMENT ON TABLE roles IS 'System roles. tenant_id=NULL for global roles (superadmin). RLS enforced via tenant_id.';
COMMENT ON TABLE usuarios IS 'Users. Multi-tenancy via roles (usuario_roles), not direct tenant_id.';
COMMENT ON TABLE usuario_roles IS 'User-role assignments with tenant context. RLS enforced.';
COMMENT ON TABLE unidades IS 'Census units. RLS enforced via tenant_id. Coeficiente sum must = 100%.';
COMMENT ON TABLE usuario_unidades IS 'User-unit relationships (propietario/arrendatario/residente_autorizado). RLS via unidades join.';