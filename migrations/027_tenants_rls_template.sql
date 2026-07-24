-- Migration 001: Tenants table with RLS template
-- This migration creates the tenants table and establishes the RLS pattern
-- that ALL business tables must follow.

-- ============================================================================
-- RLS TEMPLATE PATTERN (COPY THIS FOR EVERY BUSINESS TABLE)
-- ============================================================================
-- For each business table, you MUST:
-- 1. Add tenant_id UUID NOT NULL column with FK to tenants(id)
-- 2. Create index on tenant_id
-- 3. Enable RLS: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
-- 4. Create policy: 
--    CREATE POLICY tenant_isolation_policy ON table_name
--    USING (tenant_id = current_setting('app.current_tenant')::uuid)
--    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);
-- 5. FOR SUPERADMIN BYPASS: Add condition to policy:
--    USING (tenant_id = current_setting('app.current_tenant')::uuid 
--           OR current_setting('app.is_superadmin', true) = 'true')
-- ============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    email_contacto VARCHAR(255) UNIQUE NOT NULL,
    telefono_contacto VARCHAR(20),
    direccion TEXT,
    tipo VARCHAR(30) NOT NULL DEFAULT 'conjunto_residencial'
        CHECK (tipo IN ('conjunto_residencial', 'conjunto_comercial', 'mixto')),
    total_unidades INTEGER NOT NULL DEFAULT 0,
    coeficiente_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    siigo_config JSONB, -- Encrypted at application level
    fecha_corte_migracion TIMESTAMPTZ,
    activo BOOLEAN NOT NULL DEFAULT true,
    configuracion JSONB,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_email ON tenants(email_contacto);
CREATE INDEX idx_tenants_activo ON tenants(activo);

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS on tenants table (superadmin can see all)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Superadmin bypass policy
CREATE POLICY tenants_superadmin_policy ON tenants
    USING (current_setting('app.is_superadmin', true) = 'true')
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

-- Regular tenant isolation (users can only see their own tenant record)
-- This is mainly for completeness; in practice tenants are managed by superadmin
CREATE POLICY tenants_isolation_policy ON tenants
    USING (id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (id = current_setting('app.current_tenant')::uuid);

-- 6. RLS Template function for reuse
-- This function generates the standard RLS policy for a table
-- Usage: SELECT create_rls_policies('table_name', 'tenant_id');
CREATE OR REPLACE FUNCTION create_rls_policies(table_name TEXT, tenant_col TEXT DEFAULT 'tenant_id')
RETURNS VOID AS $$
DECLARE
    policy_name TEXT;
    superadmin_policy_name TEXT;
BEGIN
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table_name);
    
    -- Superadmin bypass policy
    superadmin_policy_name := table_name || '_superadmin_policy';
    EXECUTE format(
        'CREATE POLICY %I ON %I USING (current_setting(''app.is_superadmin'', true) = ''true'') WITH CHECK (current_setting(''app.is_superadmin'', true) = ''true'');',
        superadmin_policy_name, table_name
    );
    
    -- Standard tenant isolation policy
    policy_name := table_name || '_tenant_isolation_policy';
    EXECUTE format(
        'CREATE POLICY %I ON %I USING (%I = current_setting(''app.current_tenant'')::uuid) WITH CHECK (%I = current_setting(''app.current_tenant'')::uuid);',
        policy_name, table_name, tenant_col, tenant_col
    );
    
    RAISE NOTICE 'RLS policies created for %', table_name;
END;
$$ LANGUAGE plpgsql;

-- 7. Session variables setup (called by NestJS TenantGuard)
-- These are set per-request by the TenantGuard
-- app.current_tenant = tenant UUID
-- app.is_superadmin = 'true' or 'false'

-- 8. Helper to verify RLS is working
-- Run as superadmin: SELECT * FROM tenants; -- Should see all
-- Run as tenant: SET LOCAL app.current_tenant = '...'; SELECT * FROM tenants; -- Should see only own

COMMENT ON TABLE tenants IS 'Multi-tenant SaaS tenants. RLS enforced via app.current_tenant session variable.';
COMMENT ON COLUMN tenants.siigo_config IS 'SIIGO configuration (apiKey, clientId, clientSecret, etc.) - ENCRYPTED at application level';
COMMENT ON COLUMN tenants.fecha_corte_migracion IS 'Cutover date for migration from legacy system (Excel/manual)';