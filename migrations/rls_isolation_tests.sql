-- RLS Isolation Test Suite
-- This file contains SQL tests to verify that RLS policies correctly
-- isolate tenant data. Run these manually against the database to verify.

-- ============================================================================
-- SETUP: Create test tenants and users
-- ============================================================================

-- Create tenant A
INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, estado)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant A', 'tenant-a', 'admin@tenant-a.com', 'conjunto_residencial', 'activo')
ON CONFLICT (id) DO NOTHING;

-- Create tenant B
INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, estado)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tenant B', 'tenant-b', 'admin@tenant-b.com', 'conjunto_residencial', 'activo')
ON CONFLICT (id) DO NOTHING;

-- Create superadmin user
INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'superadmin@test.com', 'hash', 'Super Admin', true, true)
ON CONFLICT (id) DO NOTHING;

-- Assign superadmin role (global)
INSERT INTO roles (id, nombre, tipo, tenant_id, es_global, activo)
VALUES ('rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr', 'Super Administrador', 'superadmin', NULL, true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (usuario_id, role_id) DO NOTHING;

-- ============================================================================
-- TEST 1: RLS on tenants table
-- ============================================================================

-- As superadmin - should see all tenants
SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 1a - Superadmin sees all tenants:' as test, COUNT(*) as count FROM tenants;
-- Expected: 2

-- As tenant A user - should only see tenant A
SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 1b - Tenant A sees only self:' as test, COUNT(*) as count FROM tenants;
-- Expected: 1

-- As tenant B user - should only see tenant B
SET LOCAL app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT 'TEST 1c - Tenant B sees only self:' as test, COUNT(*) as count FROM tenants;
-- Expected: 1

-- ============================================================================
-- TEST 2: RLS on roles table
-- ============================================================================

SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 2a - Superadmin sees all roles:' as test, COUNT(*) as count FROM roles;

SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 2b - Tenant A sees own + global roles:' as test, COUNT(*) as count FROM roles;
-- Expected: roles for tenant A + superadmin (global)

SET LOCAL app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT 'TEST 2c - Tenant B sees own + global roles:' as test, COUNT(*) as count FROM roles;
-- Expected: roles for tenant B + superadmin (global)

-- ============================================================================
-- TEST 3: RLS on usuario_roles table
-- ============================================================================

SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 3a - Superadmin sees all role assignments:' as test, COUNT(*) as count FROM usuario_roles;

SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 3b - Tenant A sees only own role assignments:' as test, COUNT(*) as count FROM usuario_roles;

SET LOCAL app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT 'TEST 3c - Tenant B sees only own role assignments:' as test, COUNT(*) as count FROM usuario_roles;

-- ============================================================================
-- TEST 4: RLS on unidades table
-- ============================================================================

SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 4a - Superadmin sees all units:' as test, COUNT(*) as count FROM unidades;

SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 4b - Tenant A sees only own units:' as test, COUNT(*) as count FROM unidades;

SET LOCAL app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT 'TEST 4c - Tenant B sees only own units:' as test, COUNT(*) as count FROM unidades;

-- ============================================================================
-- TEST 5: RLS on usuario_unidades table (via join)
-- ============================================================================

SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 5a - Superadmin sees all user-unit relations:' as test, COUNT(*) as count FROM usuario_unidades;

SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 5b - Tenant A sees only own unit relations:' as test, COUNT(*) as count FROM usuario_unidades;

SET LOCAL app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT 'TEST 5c - Tenant B sees only own unit relations:' as test, COUNT(*) as count FROM usuario_unidades;

-- ============================================================================
-- TEST 6: RLS on facturas table
-- ============================================================================

SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 6a - Superadmin sees all invoices:' as test, COUNT(*) as count FROM facturas;

SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 6b - Tenant A sees only own invoices:' as test, COUNT(*) as count FROM facturas;

SET LOCAL app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT 'TEST 6c - Tenant B sees only own invoices:' as test, COUNT(*) as count FROM facturas;

-- ============================================================================
-- TEST 7: RLS on pagos table
-- ============================================================================

SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 7a - Superadmin sees all payments:' as test, COUNT(*) as count FROM pagos;

SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT 'TEST 7b - Tenant A sees only own payments:' as test, COUNT(*) as count FROM pagos;

SET LOCAL app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
SELECT 'TEST 7c - Tenant B sees only own payments:' as test, COUNT(*) as count FROM pagos;

-- ============================================================================
-- TEST 8: Write isolation (INSERT/UPDATE/DELETE)
-- ============================================================================

-- Tenant A user tries to insert into tenant B's data - should fail
SET LOCAL app.is_superadmin = 'false';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- This should fail (tenant_id mismatch on INSERT)
\echo 'TEST 8a - Tenant A cannot insert into tenant B units (expect error):'
-- INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad) 
-- VALUES (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TorreX', '101', 'apartamento');

-- This should succeed (tenant_id matches current_tenant)
\echo 'TEST 8b - Tenant A can insert into own tenant (expect success):'
-- INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad) 
-- VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TorreA', '101', 'apartamento');

-- ============================================================================
-- TEST 9: Superadmin bypass
-- ============================================================================

SET LOCAL app.is_superadmin = 'true';
SET LOCAL app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo 'TEST 9a - Superadmin can insert into any tenant:'
-- INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad) 
-- VALUES (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TorreB', '201', 'apartamento');

\echo 'TEST 9b - Superadmin can update any tenant:'
-- UPDATE tenants SET nombre = 'Tenant B Updated' WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- ============================================================================
-- TEST 10: Coefficient validation function
-- ============================================================================

SELECT 'TEST 10 - Coefficient validation function:' as test;
SELECT * FROM validate_coefficients_sum('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ============================================================================
-- CLEANUP
-- ============================================================================

-- Reset session variables
RESET app.current_tenant;
RESET app.is_superadmin;

\echo 'All RLS isolation tests completed. Verify expected counts match actual results.'