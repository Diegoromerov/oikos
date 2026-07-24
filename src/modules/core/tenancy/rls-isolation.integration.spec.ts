import { DataSource, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

describe('RLS Isolation Tests', () => {
  let dataSource: DataSource;
  let queryRunnerA: QueryRunner;
  let queryRunnerB: QueryRunner;
  let queryRunnerSuperadmin: QueryRunner;

  // Test tenant IDs
  const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const SUPERADMIN_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  beforeAll(async () => {
    // Initialize data source
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'oikos_app',  // Non-owner user for RLS to apply
      password: process.env.DB_PASSWORD || 'oikos_app_dev_2026',
      database: process.env.DB_NAME || 'oikos',
      entities: [__dirname + '/../../../**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: true,
    });

    console.log('Initializing data source...');
    try {
      await dataSource.initialize();
      console.log('Data source initialized successfully');
    } catch (err) {
      console.error('Data source initialization failed:', err);
      throw err;
    }

    // Set session variables for migrations/seed (must be set before any RLS policies trigger)
    await dataSource.query(`SET app.current_tenant = '00000000-0000-0000-0000-000000000000';`);
    await dataSource.query(`SET app.is_superadmin = 'true';`);

    // Clean up existing tables first (for re-runs)
    console.log('Cleaning existing tables...');
    try {
      await dataSource.query(`
        DROP TABLE IF EXISTS sync_jobs, pagos, facturas, usuario_unidades, usuario_roles, usuarios, unidades, roles, tenants CASCADE;
      `);
      console.log('Existing tables cleaned');
    } catch (err) {
      console.error('Cleanup failed:', err);
    }

    // Run SQL migrations manually
    console.log('Running SQL migrations...');
    try {
      const migrationsDir = path.join(__dirname, '../../../../migrations');
      const sqlFiles = fs.readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort()
        .filter((f: string) => f.startsWith('027') || f.startsWith('028_usuarios') || f.startsWith('029'));
      
      for (const file of sqlFiles) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        console.log(`Running migration: ${file}`);
        
        // Execute entire file as single query - PostgreSQL handles multiple statements
        await dataSource.query(sql);
      }
      console.log('Migrations executed');

    // Force RLS on all tables (owner bypasses ENABLE RLS, needs FORCE)
    console.log('Forcing RLS on all tables...');
    await dataSource.query(`
      ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
      ALTER TABLE roles FORCE ROW LEVEL SECURITY;
      ALTER TABLE usuario_roles FORCE ROW LEVEL SECURITY;
      ALTER TABLE usuarios FORCE ROW LEVEL SECURITY;
      ALTER TABLE unidades FORCE ROW LEVEL SECURITY;
      ALTER TABLE usuario_unidades FORCE ROW LEVEL SECURITY;
      ALTER TABLE facturas FORCE ROW LEVEL SECURITY;
      ALTER TABLE pagos FORCE ROW LEVEL SECURITY;
      ALTER TABLE sync_jobs FORCE ROW LEVEL SECURITY;
    `);
    console.log('RLS forced on all tables');
    } catch (err) {
      console.error('Migrations failed:', err);
      throw err;
    }

    // Seed test tenants
    try {
      await dataSource.query(`
        INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, activo)
        VALUES 
          ('${TENANT_A_ID}', 'Tenant A', 'tenant-a', 'admin@tenant-a.com', 'conjunto_residencial', true),
          ('${TENANT_B_ID}', 'Tenant B', 'tenant-b', 'admin@tenant-b.com', 'conjunto_residencial', true)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Tenants seeded');
    } catch (err) {
      console.error('Tenants seeding failed:', err);
      throw err;
    }

    // Seed default roles
    try {
      await dataSource.query(`
        INSERT INTO roles (id, nombre, tipo, tenant_id, es_global, activo)
        VALUES 
          (gen_random_uuid(), 'Super Administrador', 'superadmin', NULL, true, true),
          (gen_random_uuid(), 'Administrador', 'admin', NULL, false, true),
          (gen_random_uuid(), 'Propietario', 'propietario', NULL, false, true),
          (gen_random_uuid(), 'Residente', 'residente', NULL, false, true),
          (gen_random_uuid(), 'Portero', 'portero', NULL, false, true),
          (gen_random_uuid(), 'Junta Directiva', 'junta', NULL, false, true),
          (gen_random_uuid(), 'Revisor Fiscal', 'revisor_fiscal', NULL, false, true)
        ON CONFLICT DO NOTHING;
      `);
      console.log('Roles seeded');
    } catch (err) {
      console.error('Roles seeding failed:', err);
      throw err;
    }

    // Seed tenant-specific admin roles for RLS testing
    try {
      await dataSource.query(`
        INSERT INTO roles (id, nombre, tipo, tenant_id, es_global, activo)
        VALUES 
          (gen_random_uuid(), 'Administrador', 'admin', '${TENANT_A_ID}', false, true),
          (gen_random_uuid(), 'Administrador', 'admin', '${TENANT_B_ID}', false, true)
        ON CONFLICT DO NOTHING;
      `);
      console.log('Tenant-specific roles seeded');
    } catch (err) {
      console.error('Tenant-specific roles seeding failed:', err);
      throw err;
    }

    // Create query runners for different contexts
    queryRunnerA = dataSource.createQueryRunner();
    queryRunnerB = dataSource.createQueryRunner();
    queryRunnerSuperadmin = dataSource.createQueryRunner();

    await queryRunnerA.connect();
    await queryRunnerB.connect();
    await queryRunnerSuperadmin.connect();

    // Set up tenant contexts (SET session-level, not LOCAL transaction-level)
    await queryRunnerA.query(`SET app.current_tenant = '${TENANT_A_ID}'`);
    await queryRunnerA.query(`SET app.is_superadmin = 'false'`);

    await queryRunnerB.query(`SET app.current_tenant = '${TENANT_B_ID}'`);
    await queryRunnerB.query(`SET app.is_superadmin = 'false'`);

    await queryRunnerSuperadmin.query(`SET app.current_tenant = '${TENANT_A_ID}'`);
    await queryRunnerSuperadmin.query(`SET app.is_superadmin = 'true'`);

    // DEBUG: Verify session variables are set correctly
    const debugA = await queryRunnerA.query(`SELECT current_setting('app.current_tenant') as tenant, current_setting('app.is_superadmin') as superadmin`);
    console.log('DEBUG queryRunnerA session vars:', debugA);
    const debugB = await queryRunnerB.query(`SELECT current_setting('app.current_tenant') as tenant, current_setting('app.is_superadmin') as superadmin`);
    console.log('DEBUG queryRunnerB session vars:', debugB);
    const debugS = await queryRunnerSuperadmin.query(`SELECT current_setting('app.current_tenant') as tenant, current_setting('app.is_superadmin') as superadmin`);
    console.log('DEBUG queryRunnerSuperadmin session vars:', debugS);
  }, 60000);

  afterAll(async () => {
    if (queryRunnerA && queryRunnerA.isReleased === false) await queryRunnerA.release();
    if (queryRunnerB && queryRunnerB.isReleased === false) await queryRunnerB.release();
    if (queryRunnerSuperadmin && queryRunnerSuperadmin.isReleased === false) await queryRunnerSuperadmin.release();
    if (dataSource && dataSource.isInitialized) await dataSource.destroy();
  });

  describe('Tenants Table RLS', () => {
    it('should allow superadmin to see all tenants', async () => {
      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM tenants');
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(2);
    });

    it('should allow tenant A to see only their tenant', async () => {
      const result = await queryRunnerA.query('SELECT COUNT(*) as count FROM tenants');
      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should allow tenant B to see only their tenant', async () => {
      const result = await queryRunnerB.query('SELECT COUNT(*) as count FROM tenants');
      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should prevent tenant A from inserting into tenant B', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, activo)
          VALUES (gen_random_uuid(), 'Test', 'test-tenant', 'test@test.com', 'conjunto_residencial', true)
        `)
      ).rejects.toThrow();
    });

    it('should allow superadmin to insert into any tenant', async () => {
      await expect(
        queryRunnerSuperadmin.query(`
          INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, activo)
          VALUES (gen_random_uuid(), 'Test', 'test-tenant', 'test@test.com', 'conjunto_residencial', true)
        `)
      ).resolves.toBeDefined();
    });
  });

  describe('Roles Table RLS', () => {
    it('should allow superadmin to see all roles', async () => {
      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM roles');
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(7); // Default roles
    });

    it('should allow tenant A to see their roles + global roles', async () => {
      const result = await queryRunnerA.query('SELECT COUNT(*) as count FROM roles');
      // Should see tenant-specific roles + global superadmin role
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(1);
    });

    it('should prevent tenant A from seeing tenant B specific roles', async () => {
      // First insert a role for tenant B
      await queryRunnerSuperadmin.query(`
        INSERT INTO roles (id, nombre, tipo, tenant_id, es_global, activo)
        VALUES (gen_random_uuid(), 'Test Role B', 'admin', '${TENANT_B_ID}', false, true)
      `);

      // Tenant A should not see it
      const result = await queryRunnerA.query(`
        SELECT COUNT(*) as count FROM roles WHERE tipo = 'admin' AND tenant_id = '${TENANT_B_ID}'
      `);
      expect(parseInt(result[0].count)).toBe(0);
    });
  });

  describe('UserRoles Table RLS', () => {
    it('should isolate role assignments by tenant', async () => {
      // Create test users
      const userA = await queryRunnerA.query(`
        INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
        VALUES (gen_random_uuid(), 'userA@test.com', 'hash', 'User A', true, true)
        RETURNING id
      `);

      const userB = await queryRunnerB.query(`
        INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
        VALUES (gen_random_uuid(), 'userB@test.com', 'hash', 'User B', true, true)
        RETURNING id
      `);

      // Get admin role for each tenant
      const roleA = await queryRunnerA.query(`
        SELECT id FROM roles WHERE tipo = 'admin' AND tenant_id = '${TENANT_A_ID}' LIMIT 1
      `);

      const roleB = await queryRunnerB.query(`
        SELECT id FROM roles WHERE tipo = 'admin' AND tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      // Assign role to user A
      await queryRunnerA.query(`
        INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
        VALUES ('${userA[0].id}', '${roleA[0].id}', '${TENANT_A_ID}')
      `);

      // Assign role to user B
      await queryRunnerB.query(`
        INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
        VALUES ('${userB[0].id}', '${roleB[0].id}', '${TENANT_B_ID}')
      `);

      // Tenant A should only see their role assignment
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM usuario_roles');
      expect(parseInt(resultA[0].count)).toBe(1);

      // Tenant B should only see their role assignment
      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM usuario_roles');
      expect(parseInt(resultB[0].count)).toBe(1);

      // Superadmin should see both
      const resultSuper = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM usuario_roles');
      expect(parseInt(resultSuper[0].count)).toBe(2);
    });
  });

  describe('Unidades Table RLS', () => {
    it('should isolate units by tenant', async () => {
      // Create unit for tenant A
      await queryRunnerA.query(`
        INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', 'TorreA', '101', 'apartamento', 0.5)
      `);

      // Create unit for tenant B
      await queryRunnerB.query(`
        INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
        VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'TorreB', '201', 'apartamento', 0.5)
      `);

      // Tenant A sees only their unit
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM unidades');
      expect(parseInt(resultA[0].count)).toBe(1);

      // Tenant B sees only their unit
      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM unidades');
      expect(parseInt(resultB[0].count)).toBe(1);

      // Superadmin sees both
      const resultSuper = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM unidades');
      expect(parseInt(resultSuper[0].count)).toBe(2);
    });

    it('should prevent tenant A from inserting unit for tenant B', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'TorreX', '999', 'apartamento')
        `)
      ).rejects.toThrow();
    });
  });

  describe('UsuarioUnidades Table RLS', () => {
    it('should isolate user-unit relations by tenant via join', async () => {
      // Get user and unit for tenant A
      const userA = await queryRunnerA.query(`
        SELECT id FROM usuarios WHERE email = 'userA@test.com'
      `);
      const unitA = await queryRunnerA.query(`
        SELECT id FROM unidades WHERE tenant_id = '${TENANT_A_ID}' LIMIT 1
      `);

      // Create relation for tenant A
      await queryRunnerA.query(`
        INSERT INTO usuario_unidades (usuario_id, unidad_id, tipo_relacion, es_principal)
        VALUES ('${userA[0].id}', '${unitA[0].id}', 'propietario', true)
      `);

      // Tenant A sees their relation
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM usuario_unidades');
      expect(parseInt(resultA[0].count)).toBe(1);

      // Tenant B sees none (no units in their tenant)
      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM usuario_unidades');
      expect(parseInt(resultB[0].count)).toBe(0);
    });
  });

  describe('Facturas Table RLS', () => {
    it('should isolate invoices by tenant', async () => {
      // Create unit for tenant A
      const unitA = await queryRunnerA.query(`
        SELECT id FROM unidades WHERE tenant_id = '${TENANT_A_ID}' LIMIT 1
      `);

      // Create invoice for tenant A
      await queryRunnerA.query(`
        INSERT INTO facturas (id, tenant_id, unidad_id, tipo, periodo, monto, fecha_emision, fecha_vencimiento)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${unitA[0].id}', 'ordinaria', '2024-01', 100000, '2024-01-01', '2024-01-31')
      `);

      // Create unit and invoice for tenant B
      const unitB = await queryRunnerB.query(`
        SELECT id FROM unidades WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      await queryRunnerB.query(`
        INSERT INTO facturas (id, tenant_id, unidad_id, tipo, periodo, monto, fecha_emision, fecha_vencimiento)
        VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${unitB[0].id}', 'ordinaria', '2024-01', 200000, '2024-01-01', '2024-01-31')
      `);

      // Tenant A sees only their invoice
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM facturas');
      expect(parseInt(resultA[0].count)).toBe(1);

      // Tenant B sees only their invoice
      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM facturas');
      expect(parseInt(resultB[0].count)).toBe(1);

      // Superadmin sees both
      const resultSuper = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM facturas');
      expect(parseInt(resultSuper[0].count)).toBe(2);
    });
  });

  describe('Pagos Table RLS', () => {
    it('should isolate payments by tenant', async () => {
      // Get invoice for tenant A
      const invoiceA = await queryRunnerA.query(`
        SELECT id, unidad_id FROM facturas WHERE tenant_id = '${TENANT_A_ID}' LIMIT 1
      `);

      // Create payment for tenant A
      await queryRunnerA.query(`
        INSERT INTO pagos (id, tenant_id, factura_id, unidad_id, monto, metodo_pago, fecha_pago)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${invoiceA[0].id}', '${invoiceA[0].unidad_id}', 100000, 'wompi', NOW())
      `);

      // Get invoice for tenant B
      const invoiceB = await queryRunnerB.query(`
        SELECT id, unidad_id FROM facturas WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      // Create payment for tenant B
      await queryRunnerB.query(`
        INSERT INTO pagos (id, tenant_id, factura_id, unidad_id, monto, metodo_pago, fecha_pago)
        VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${invoiceB[0].id}', '${invoiceB[0].unidad_id}', 200000, 'wompi', NOW())
      `);

      // Tenant A sees only their payment
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM pagos');
      expect(parseInt(resultA[0].count)).toBe(1);

      // Tenant B sees only their payment
      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM pagos');
      expect(parseInt(resultB[0].count)).toBe(1);

      // Superadmin sees both
      const resultSuper = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM pagos');
      expect(parseInt(resultSuper[0].count)).toBe(2);
    });
  });

  describe('Cross-tenant attack prevention', () => {
    it('should prevent tenant A from updating tenant B data via raw SQL', async () => {
      // Get a unit from tenant B
      const unitB = await queryRunnerSuperadmin.query(`
        SELECT id FROM unidades WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      // Tenant A tries to update tenant B's unit - RLS filters silently (0 rows affected)
      const result = await queryRunnerA.query(`
        UPDATE unidades SET torre = 'HACKED' WHERE id = '${unitB[0].id}'
      `);
      
      // PostgreSQL RLS returns 0 rows affected instead of throwing
      expect(result[1]).toBe(0);

      // Verify data wasn't changed
      const verify = await queryRunnerSuperadmin.query(`
        SELECT torre FROM unidades WHERE id = '${unitB[0].id}'
      `);
      expect(verify[0].torre).not.toBe('HACKED');
    });

    it('should prevent tenant A from deleting tenant B data', async () => {
      const unitB = await queryRunnerSuperadmin.query(`
        SELECT id FROM unidades WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      // Tenant A tries to delete tenant B's unit - RLS filters silently (0 rows affected)
      const deleteResult = await queryRunnerA.query(`
        DELETE FROM unidades WHERE id = '${unitB[0].id}'
      `);
      
      // PostgreSQL RLS returns 0 rows affected instead of throwing
      expect(deleteResult[1]).toBe(0);

      // Verify still exists
      const verifyResult = await queryRunnerSuperadmin.query(`
        SELECT COUNT(*) as count FROM unidades WHERE id = '${unitB[0].id}'
      `);
      expect(parseInt(verifyResult[0].count)).toBe(1);
    });

    it('should prevent tenant A from selecting tenant B data with explicit WHERE', async () => {
      const result = await queryRunnerA.query(`
        SELECT * FROM unidades WHERE tenant_id = '${TENANT_B_ID}'
      `);
      expect(result.length).toBe(0);
    });
  });

  describe('Coefficient validation', () => {
    it('should validate coefficient sum equals 100%', async () => {
      // Create multiple units for tenant A with known coefficients
      await queryRunnerA.query(`
        DELETE FROM unidades WHERE tenant_id = '${TENANT_A_ID}'
      `);

      await queryRunnerA.query(`
        INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', 'Torre', '101', 'apartamento', 50.00000000),
          (gen_random_uuid(), '${TENANT_A_ID}', 'Torre', '102', 'apartamento', 50.00000000)
      `);

      const result = await queryRunnerA.query(`
        SELECT * FROM validate_coefficients_sum('${TENANT_A_ID}')
      `);

      expect(parseFloat(result[0].total)).toBe(100);
      expect(result[0].is_valid).toBe(true);
    });

    it('should detect coefficient sum not equal to 100%', async () => {
      await queryRunnerA.query(`
        DELETE FROM unidades WHERE tenant_id = '${TENANT_A_ID}'
      `);

      await queryRunnerA.query(`
        INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', 'Torre', '101', 'apartamento', 30.00000000),
          (gen_random_uuid(), '${TENANT_A_ID}', 'Torre', '102', 'apartamento', 40.00000000)
      `);

      const result = await queryRunnerA.query(`
        SELECT * FROM validate_coefficients_sum('${TENANT_A_ID}')
      `);

      expect(parseFloat(result[0].total)).toBe(70);
      expect(result[0].is_valid).toBe(false);
      expect(parseFloat(result[0].difference)).toBe(30);
    });
  });
});