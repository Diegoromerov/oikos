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

-- 2. Unique constraint: role name unique per tenant (or globally for superadmin)
CREATE UNIQUE INDEX idx_roles_nombre_tenant ON roles(nombre, tenant_id);

-- 3. Indexes
CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_tipo ON roles(tipo);
CREATE INDEX idx_roles_es_global ON roles(es_global);

-- 4. Updated at trigger
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS on roles table
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

-- 6. Users table
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
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Indexes
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_tenant_id ON usuarios(tenant_id);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);

-- 8. Updated at trigger
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. RLS on usuarios
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass
CREATE POLICY usuarios_superadmin_policy ON usuarios
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

-- Tenant isolation
CREATE POLICY usuarios_tenant_isolation_policy ON usuarios
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- 10. User-Roles junction table (N:N)
CREATE TABLE usuario_roles (
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    asignado_por UUID REFERENCES usuarios(id),
    PRIMARY KEY (usuario_id, role_id)
);

-- 11. Indexes
CREATE INDEX idx_usuario_roles_usuario_id ON usuario_roles(usuario_id);
CREATE INDEX idx_usuario_roles_role_id ON usuario_roles(role_id);
CREATE INDEX idx_usuario_roles_tenant_id ON usuario_roles(tenant_id);

-- 12. RLS on usuario_roles
ALTER TABLE usuario_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuario_roles_superadmin_policy ON usuario_roles
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY usuario_roles_tenant_isolation_policy ON usuario_roles
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- 13. User-Units relationship table (N:N with relationship type)
CREATE TABLE usuario_unidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    unidad_id UUID NOT NULL, -- FK will be added after unidades table exists
    tipo_relacion VARCHAR(30) NOT NULL
        CHECK (tipo_relacion IN ('propietario', 'arrendatario', 'residente_autorizado')),
    es_principal BOOLEAN NOT NULL DEFAULT false,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Unique constraint: one relationship of each type per user-unit
CREATE UNIQUE INDEX idx_usuario_unidades_unique 
    ON usuario_unidades(usuario_id, unidad_id, tipo_relacion);

-- 15. Indexes
CREATE INDEX idx_usuario_unidades_usuario_id ON usuario_unidades(usuario_id);
CREATE INDEX idx_usuario_unidades_unidad_id ON usuario_unidades(unidad_id);
CREATE INDEX idx_usuario_unidades_tenant_id ON usuario_unidades(tenant_id);
CREATE INDEX idx_usuario_unidades_es_principal ON usuario_unidades(es_principal);

-- 16. Updated at trigger
CREATE TRIGGER update_usuario_unidades_updated_at
    BEFORE UPDATE ON usuario_unidades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 17. RLS on usuario_unidades
ALTER TABLE usuario_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuario_unidades_superadmin_policy ON usuario_unidades
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

CREATE POLICY usuario_unidades_tenant_isolation_policy ON usuario_unidades
    USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.is_superadmin', true) = 'true');

-- 18. Default roles seed (global roles for superadmin)
INSERT INTO roles (nombre, tipo, descripcion, tenant_id, es_global, activo) VALUES
    ('Super Administrador', 'superadmin', 'Acceso total a todos los tenants', NULL, true, true),
    ('Administrador', 'admin', 'Administrador del conjunto', NULL, false, true),
    ('Propietario', 'propietario', 'Propietario de unidad', NULL, false, true),
    ('Residente', 'residente', 'Residente de unidad', NULL, false, true),
    ('Portero', 'portero', 'Personal de portería', NULL, false, true),
    ('Junta Directiva', 'junta', 'Miembro de junta directiva', NULL, false, true),
    ('Revisor Fiscal', 'revisor_fiscal', 'Revisor fiscal del conjunto', NULL, false, true)
ON CONFLICT (nombre, tenant_id) DO NOTHING;

COMMENT ON TABLE roles IS 'Roles del sistema. tenant_id NULL = global role (e.g., superadmin). RLS enforced.';
COMMENT ON TABLE usuarios IS 'Usuarios del sistema. Cada usuario pertenece a un tenant. RLS enforced.';
COMMENT ON TABLE usuario_roles IS 'Relación N:N entre usuarios y roles, siempre en contexto de un tenant.';
COMMENT ON TABLE usuario_unidades IS 'Relación N:N usuarios-unidades con tipo (propietario/arrendatario/residente_autorizado) y flag es_principal.';