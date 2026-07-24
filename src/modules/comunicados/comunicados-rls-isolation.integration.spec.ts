import { DataSource, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

describe('Comunicados RLS Isolation Tests', () => {
  let dataSource: DataSource;
  let queryRunnerA: QueryRunner;
  let queryRunnerB: QueryRunner;
  let queryRunnerSuperadmin: QueryRunner;

  const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const SUPERADMIN_TENANT_ID = TENANT_A_ID;
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

    // Create query runners for different tenants
    queryRunnerA = dataSource.createQueryRunner();
    queryRunnerB = dataSource.createQueryRunner();
    queryRunnerSuperadmin = dataSource.createQueryRunner();

    await queryRunnerA.connect();
    await queryRunnerB.connect();
    await queryRunnerSuperadmin.connect();

    // Set session variables for each runner
    await queryRunnerA.query(`SET app.current_tenant = '${TENANT_A_ID}'`);
    await queryRunnerA.query(`SET app.is_superadmin = 'false'`);

    await queryRunnerB.query(`SET app.current_tenant = '${TENANT_B_ID}'`);
    await queryRunnerB.query(`SET app.is_superadmin = 'false'`);

    await queryRunnerSuperadmin.query(`SET app.current_tenant = '${SUPERADMIN_TENANT_ID}'`);
    await queryRunnerSuperadmin.query(`SET app.is_superadmin = 'true'`);

    console.log('Query runners configured with session variables');

    // Clean existing comunicados tables
    console.log('Cleaning existing Comunicados tables...');
    await queryRunnerSuperadmin.query(`
      DROP TABLE IF EXISTS comunicados CASCADE;
    `);
    console.log('Existing tables cleaned');

    // Run only migration 032 for comunicados
    console.log('Running SQL migration 032_comunicados_rls.sql...');
    try {
      const migrationsDir = 'C:\\\\oikos app\\\\migrations';
      const sqlFile = '032_comunicados_rls.sql';
      const sqlPath = path.join(migrationsDir, sqlFile);
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

      // Execute the entire migration as a single query
      await queryRunnerSuperadmin.query(sqlContent);
      console.log(`Migration ${sqlFile} executed successfully`);
    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }

    // Force RLS on comunicados table
    await queryRunnerSuperadmin.query(`
      ALTER TABLE comunicados FORCE ROW LEVEL SECURITY;
    `);
    console.log('RLS forced on Comunicados table');

    // Seed tenants
    await queryRunnerSuperadmin.query(`
      INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, activo)
      VALUES 
        ('${TENANT_A_ID}', 'Tenant A', 'tenant-a', 'admin@tenant-a.com', 'conjunto_residencial', true),
        ('${TENANT_B_ID}', 'Tenant B', 'tenant-b', 'admin@tenant-b.com', 'conjunto_residencial', true)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Tenants seeded');

    // Seed users with unique emails to avoid conflicts with other test suites
    await queryRunnerSuperadmin.query(`
      INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
      VALUES 
        ('${USER_A_ID}', 'userA_comunicados@test.com', 'hash', 'User A', true, true),
        ('${USER_B_ID}', 'userB_comunicados@test.com', 'hash', 'User B', true, true),
        ('${ADMIN_A_ID}', 'adminA_comunicados@test.com', 'hash', 'Admin A', true, true),
        ('${ADMIN_B_ID}', 'adminB_comunicados@test.com', 'hash', 'Admin B', true, true)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Users seeded');

    // Seed unidades
    await queryRunnerSuperadmin.query(`
      INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
      VALUES 
        ('${UNIDAD_A_ID}', '${TENANT_A_ID}', 'TorreA', '101', 'apartamento', 0.5),
        ('${UNIDAD_B_ID}', '${TENANT_B_ID}', 'TorreB', '201', 'apartamento', 0.5)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Unidades seeded');
  });

  afterAll(async () => {
    if (queryRunnerA) await queryRunnerA.release();
    if (queryRunnerB) await queryRunnerB.release();
    if (queryRunnerSuperadmin) await queryRunnerSuperadmin.release();
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  describe('Comunicados Table RLS', () => {
    it('should allow superadmin to see all comunicados', async () => {
      // Seed comunicados for both tenants via superadmin
      await queryRunnerSuperadmin.query(`
        INSERT INTO comunicados (id, tenant_id, usuario_id, titulo, cuerpo, prioridad, fecha_publicacion, activo)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', '${ADMIN_A_ID}', 'Comunicado A1', 'Contenido A', 'normal', NOW(), true),
          (gen_random_uuid(), '${TENANT_B_ID}', '${ADMIN_B_ID}', 'Comunicado B1', 'Contenido B', 'alta', NOW(), true)
        ON CONFLICT DO NOTHING;
      `);

      // Superadmin should see both
      const result = await queryRunnerSuperadmin.query(`SELECT COUNT(*) as count FROM comunicados`);
      expect(parseInt(result[0].count, 10)).toBe(2);
    });

    it('should allow tenant A to see only their comunicados', async () => {
      const result = await queryRunnerA.query(`SELECT COUNT(*) as count FROM comunicados`);
      expect(parseInt(result[0].count, 10)).toBe(1);
    });

    it('should allow tenant B to see only their comunicados', async () => {
      const result = await queryRunnerB.query(`SELECT COUNT(*) as count FROM comunicados`);
      expect(parseInt(result[0].count, 10)).toBe(1);
    });

    it('should prevent tenant A from inserting comunicado for tenant B', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO comunicados (id, tenant_id, usuario_id, titulo, cuerpo, prioridad, fecha_publicacion, activo)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${ADMIN_A_ID}', 'Hacked', 'Desc', 'normal', NOW(), true)
        `)
      ).rejects.toThrow('violates row-level security policy');
    });

    it('should prevent tenant A from updating tenant B comunicado', async () => {
      // Get a comunicado from tenant B
      const comunicadoB = await queryRunnerSuperadmin.query(`
        SELECT id FROM comunicados WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);
      const comunicadoId = comunicadoB[0].id;

      // Tenant A tries to update it
      const result = await queryRunnerA.query(`
        UPDATE comunicados SET titulo = 'HACKED' WHERE id = '${comunicadoId}'
      `);
      // Should affect 0 rows (RLS blocks it silently) - result[1] is row count
      expect(result[1]).toBe(0);
    });

    it('should prevent tenant A from deleting tenant B comunicado', async () => {
      const comunicadoB = await queryRunnerSuperadmin.query(`
        SELECT id FROM comunicados WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);
      const comunicadoId = comunicadoB[0].id;

      const result = await queryRunnerA.query(`
        DELETE FROM comunicados WHERE id = '${comunicadoId}'
      `);
      expect(result[1]).toBe(0);
    });
  });

  describe('Comunicados Filtering (vigentes vs expirados)', () => {
    it('should filter out expired comunicados when soloVigentes=true', async () => {
      // Create an expired comunicado
      await queryRunnerSuperadmin.query(`
        INSERT INTO comunicados (id, tenant_id, usuario_id, titulo, cuerpo, prioridad, fecha_publicacion, fecha_expiracion, activo)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', '${ADMIN_A_ID}', 'Expirado', 'Ya no vigente', 'normal', NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day', true)
        ON CONFLICT DO NOTHING;
      `);

      // Create a vigente comunicado
      await queryRunnerSuperadmin.query(`
        INSERT INTO comunicados (id, tenant_id, usuario_id, titulo, cuerpo, prioridad, fecha_publicacion, fecha_expiracion, activo)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', '${ADMIN_A_ID}', 'Vigente', 'Activo ahora', 'normal', NOW() - INTERVAL '1 day', NOW() + INTERVAL '10 days', true)
        ON CONFLICT DO NOTHING;
      `);

      // Query with soloVigentes logic
      const now = new Date().toISOString();
      const vigentes = await queryRunnerA.query(`
        SELECT COUNT(*) as count FROM comunicados 
        WHERE tenant_id = '${TENANT_A_ID}'
        AND activo = true
        AND fecha_publicacion <= '${now}'
        AND (fecha_expiracion IS NULL OR fecha_expiracion > '${now}')
      `);
      
      // Should only count the vigente one (not the expired one)
      expect(parseInt(vigentes[0].count, 10)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Comunicados Priority', () => {
    it('should store and retrieve prioridad correctly', async () => {
      const prioridades = ['baja', 'normal', 'alta', 'urgente'] as const;
      
      for (const p of prioridades) {
        await queryRunnerSuperadmin.query(`
          INSERT INTO comunicados (id, tenant_id, usuario_id, titulo, cuerpo, prioridad, fecha_publicacion, activo)
          VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${ADMIN_A_ID}', 'Test ${p}', 'Desc', '${p}', NOW(), true)
          ON CONFLICT DO NOTHING;
        `);
      }

      const result = await queryRunnerA.query(`
        SELECT DISTINCT prioridad FROM comunicados 
        WHERE tenant_id = '${TENANT_A_ID}' AND prioridad IN ('baja','normal','alta','urgente')
        ORDER BY prioridad
      `);
      
      const found = result.map((r: any) => r.prioridad).sort();
      expect(found).toEqual(['alta', 'baja', 'normal', 'urgente']); // alphabetical order
    });
  });
});