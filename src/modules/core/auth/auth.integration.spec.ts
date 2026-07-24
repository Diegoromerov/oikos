import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

describe('Auth Login Integration Tests', () => {
  let dataSource: DataSource;

  const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const USER_A_ID = '11111111-1111-1111-1111-111111111111';
  const USER_B_ID = '22222222-2222-2222-2222-222222222222';
  const ADMIN_A_ID = '33333333-3333-3333-3333-333333333333';
  const ADMIN_B_ID = '44444444-4444-4444-4444-444444444444';
  const UNIDAD_A_ID = '55555555-5555-5555-5555-555555555555';
  const UNIDAD_B_ID = '66666666-6666-6666-6666-666666666666';

  beforeAll(async () => {
    // Initialize data source with non-owner user
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'oikos_app',
      password: process.env.DB_PASSWORD || 'oikos_app_dev_2026',
      database: process.env.DB_NAME || 'oikos',
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    console.log('Data source initialized successfully');

    // Set session variables for superadmin
    await dataSource.query(`SET app.current_tenant = '00000000-0000-0000-0000-000000000000'`);
    await dataSource.query(`SET app.is_superadmin = 'true'`);
    console.log('Session variables configured for superadmin');

    // Clean ALL tables completely
    console.log('Cleaning all tables...');
    await dataSource.query(`
      DROP TABLE IF EXISTS 
        auth_sessions,
        comunicados,
        reservas,
        zonas_comunes,
        pqrs_seguimientos,
        pqrs,
        incidentes,
        minutas_turno,
        correspondencia,
        registros_acceso,
        visitantes_preautorizados,
        sync_jobs,
        pagos,
        facturas,
        usuario_unidades,
        unidades,
        usuario_roles,
        roles,
        usuarios,
        tenants
      CASCADE;
    `);
    console.log('All tables cleaned');

    // Run SQL migrations in order
    console.log('Running SQL migrations...');
    try {
      const migrationsDir = path.join(__dirname, '../../../../migrations');
      const sqlFiles = fs.readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort()
        .filter((f: string) => ['027_tenants_rls_template.sql', '028_usuarios_unidades_rls.sql', '029_financiero_facturas_pagos_rls.sql', '030_porteria_rls.sql', '031_pqrs_reservas_rls.sql', '032_comunicados_rls.sql'].includes(f));
      
      for (const sqlFile of sqlFiles) {
        console.log(`Running migration: ${sqlFile}`);
        const sqlPath = path.join(migrationsDir, sqlFile);
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        
        // Execute entire file as single query - PostgreSQL handles multiple statements
        await dataSource.query(sqlContent);
        console.log(`Migration ${sqlFile} executed successfully`);
      }
    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }

    // Force RLS on all tables
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
      ALTER TABLE visitantes_preautorizados FORCE ROW LEVEL SECURITY;
      ALTER TABLE registros_acceso FORCE ROW LEVEL SECURITY;
      ALTER TABLE correspondencia FORCE ROW LEVEL SECURITY;
      ALTER TABLE minutas_turno FORCE ROW LEVEL SECURITY;
      ALTER TABLE incidentes FORCE ROW LEVEL SECURITY;
      ALTER TABLE pqrs FORCE ROW LEVEL SECURITY;
      ALTER TABLE pqrs_seguimientos FORCE ROW LEVEL SECURITY;
      ALTER TABLE zonas_comunes FORCE ROW LEVEL SECURITY;
      ALTER TABLE reservas FORCE ROW LEVEL SECURITY;
      ALTER TABLE comunicados FORCE ROW LEVEL SECURITY;
    `);
    console.log('RLS forced on all tables');

    // Seed tenants
    await dataSource.query(`
      INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, activo)
      VALUES 
        ('${TENANT_A_ID}', 'Tenant A', 'tenant-a', 'admin@tenant-a.com', 'conjunto_residencial', true),
        ('${TENANT_B_ID}', 'Tenant B', 'tenant-b', 'admin@tenant-b.com', 'conjunto_residencial', true)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Tenants seeded');

    // Seed users with bcrypt password hash for "password123"
    // bcrypt hash of "password123" with cost 10
    const passwordHash = '$2b$10$6WhL5mylxVRiZ6jUU.4.LuJ7DOZhVuukPiTJX3P4kXChETZU1GNhK';
    await dataSource.query(`
      INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
      VALUES 
        ('${USER_A_ID}', 'userA@test.com', '${passwordHash}', 'User A', true, true),
        ('${USER_B_ID}', 'userB@test.com', '${passwordHash}', 'User B', true, true),
        ('${ADMIN_A_ID}', 'adminA@test.com', '${passwordHash}', 'Admin A', true, true),
        ('${ADMIN_B_ID}', 'adminB@test.com', '${passwordHash}', 'Admin B', true, true)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Users seeded');

    // Seed roles
    await dataSource.query(`
      INSERT INTO roles (id, nombre, tipo, tenant_id, es_global, activo)
      VALUES 
        (gen_random_uuid(), 'admin', 'admin', NULL, true, true),
        (gen_random_uuid(), 'superadmin', 'superadmin', NULL, true, true),
        (gen_random_uuid(), 'junta', 'junta', NULL, true, true)
      ON CONFLICT DO NOTHING;
    `);
    console.log('Roles seeded');

    // Assign admin role to admin users
    await dataSource.query(`
      INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
      SELECT '${ADMIN_A_ID}', id, '${TENANT_A_ID}' FROM roles WHERE tipo = 'admin' AND es_global = true
      ON CONFLICT DO NOTHING;
      
      INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
      SELECT '${ADMIN_B_ID}', id, '${TENANT_B_ID}' FROM roles WHERE tipo = 'admin' AND es_global = true
      ON CONFLICT DO NOTHING;
    `);
    console.log('Admin roles assigned');

    // Seed unidades
    await dataSource.query(`
      INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
      VALUES 
        ('${UNIDAD_A_ID}', '${TENANT_A_ID}', 'TorreA', '101', 'apartamento', 0.5),
        ('${UNIDAD_B_ID}', '${TENANT_B_ID}', 'TorreB', '201', 'apartamento', 0.5)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Unidades seeded');

    console.log('All test data seeded successfully');
  }, 60000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  describe('Auth Login Integration Tests', () => {
    it('should have users seeded with correct password hash', async () => {
      const bcrypt = require('bcryptjs');
      const user = await dataSource.query(
        `SELECT id, email, password_hash FROM usuarios WHERE email = $1`,
        ['adminA@test.com']
      );
      expect(user.length).toBe(1);
      
      const isValid = await bcrypt.compare('password123', user[0].password_hash);
      expect(isValid).toBe(true);
    });

    it('should reject invalid password', async () => {
      const bcrypt = require('bcryptjs');
      const user = await dataSource.query(
        `SELECT password_hash FROM usuarios WHERE email = $1`,
        ['adminA@test.com']
      );
      
      const isValid = await bcrypt.compare('wrongpassword', user[0].password_hash);
      expect(isValid).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const user = await dataSource.query(
        `SELECT id FROM usuarios WHERE email = $1`,
        ['nonexistent@test.com']
      );
      expect(user.length).toBe(0);
    });

    it('should verify user roles are assigned correctly', async () => {
      const roles = await dataSource.query(`
        SELECT ur.usuario_id, r.tipo, r.es_global, ur.tenant_id
        FROM usuario_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.usuario_id IN ($1, $2)
      `, ['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']);
      
      expect(roles.length).toBeGreaterThan(0);
      const adminARoles = roles.filter((r: any) => r.usuario_id === '33333333-3333-3333-3333-333333333333');
      expect(adminARoles.some((r: any) => r.tipo === 'admin' && r.tenant_id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toBe(true);
    });
  });
});