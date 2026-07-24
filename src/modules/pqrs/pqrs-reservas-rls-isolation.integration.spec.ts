import { DataSource, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

describe('PQRS + Reservas RLS Isolation Tests', () => {
  let dataSource: DataSource;
  let queryRunnerA: QueryRunner;
  let queryRunnerB: QueryRunner;
  let queryRunnerSuperadmin: QueryRunner;

  // Test tenant IDs
  const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const SUPERADMIN_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  // Test user IDs
  const USER_A_ID = '11111111-1111-1111-1111-111111111111';
  const USER_B_ID = '22222222-2222-2222-2222-222222222222';
  const ADMIN_A_ID = '33333333-3333-3333-3333-333333333333';
  const ADMIN_B_ID = '44444444-4444-4444-4444-444444444444';

  // Test unidad IDs
  const UNIDAD_A_ID = '55555555-5555-5555-5555-555555555555';
  const UNIDAD_B_ID = '66666666-6666-6666-6666-666666666666';

  let ZONA_A_ID: string;
  let ZONA_B_ID: string;

  beforeAll(async () => {
    // Initialize data source with non-owner user - NO TypeORM entities loaded
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'oikos_app',
      password: process.env.DB_PASSWORD || 'oikos_app_dev_2026',
      database: process.env.DB_NAME || 'oikos',
      // entities: [], // Don't load TypeORM entities - use raw SQL only
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

    // Set session variables for migrations/seed
    await dataSource.query(`SET app.current_tenant = '00000000-0000-0000-0000-000000000000';`);
    await dataSource.query(`SET app.is_superadmin = 'true';`);

    // Clean up existing tables
    console.log('Cleaning existing PQRS/Reservas tables...');
    try {
      await dataSource.query(`
        DROP TABLE IF EXISTS reservas, zonas_comunes, pqrs_seguimientos, pqrs CASCADE;
      `);
      console.log('Existing tables cleaned');
    } catch (err) {
      console.error('Cleanup failed:', err);
    }

    // Run SQL migration 031
    console.log('Running SQL migration 031_pqrs_reservas_rls.sql...');
    try {
      const migrationsDir = 'C:\\\\oikos app\\\\migrations';
      const sqlFiles = fs.readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort()
        .filter((f: string) => f.startsWith('031'));
      
      for (const file of sqlFiles) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        console.log(`Running migration: ${file}`);
        await dataSource.query(sql);
      }
      console.log('PQRS/Reservas migration executed');
    } catch (err) {
      console.error('Migration failed:', err);
      throw err;
    }

    // Force RLS on new tables
    console.log('Forcing RLS on PQRS/Reservas tables...');
    await dataSource.query(`
      ALTER TABLE pqrs FORCE ROW LEVEL SECURITY;
      ALTER TABLE pqrs_seguimientos FORCE ROW LEVEL SECURITY;
      ALTER TABLE zonas_comunes FORCE ROW LEVEL SECURITY;
      ALTER TABLE reservas FORCE ROW LEVEL SECURITY;
    `);
    console.log('RLS forced on PQRS/Reservas tables');

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

    // Seed test users
    try {
      await dataSource.query(`
        INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
        VALUES 
          ('${USER_A_ID}', 'userA@test.com', 'hash', 'User A', true, true),
          ('${USER_B_ID}', 'userB@test.com', 'hash', 'User B', true, true),
          ('${ADMIN_A_ID}', 'adminA@test.com', 'hash', 'Admin A', true, true),
          ('${ADMIN_B_ID}', 'adminB@test.com', 'hash', 'Admin B', true, true)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Users seeded');
    } catch (err) {
      console.error('Users seeding failed:', err);
      throw err;
    }

    // Seed test unidades
    try {
      await dataSource.query(`
        INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
        VALUES 
          ('${UNIDAD_A_ID}', '${TENANT_A_ID}', 'TorreA', '101', 'apartamento', 0.5),
          ('${UNIDAD_B_ID}', '${TENANT_B_ID}', 'TorreB', '201', 'apartamento', 0.5)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Unidades seeded');
    } catch (err) {
      console.error('Unidades seeding failed:', err);
      throw err;
    }

    // Create zonas comunes for both tenants
    try {
      const zonaA = await dataSource.query(`
        INSERT INTO zonas_comunes (id, tenant_id, nombre, capacidad_maxima, costo, requiere_aprobacion, horario_disponible)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', 'Salón Social A', 50, 100000, true, '{"lunes": [{"inicio":"08:00","fin":"22:00"}]}')
        RETURNING id
      `);
      ZONA_A_ID = zonaA[0].id;

      const zonaB = await dataSource.query(`
        INSERT INTO zonas_comunes (id, tenant_id, nombre, capacidad_maxima, costo, requiere_aprobacion, horario_disponible)
        VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'Salón Social B', 30, 50000, false, '{"sabado": [{"inicio":"10:00","fin":"20:00"}]}')
        RETURNING id
      `);
      ZONA_B_ID = zonaB[0].id;
      console.log('Zonas comunes seeded');
    } catch (err) {
      console.error('Zonas comunes seeding failed:', err);
      throw err;
    }

    // Create query runners for different contexts
    queryRunnerA = dataSource.createQueryRunner();
    queryRunnerB = dataSource.createQueryRunner();
    queryRunnerSuperadmin = dataSource.createQueryRunner();

    await queryRunnerA.connect();
    await queryRunnerB.connect();
    await queryRunnerSuperadmin.connect();

    // Set up tenant contexts
    await queryRunnerA.query(`SET app.current_tenant = '${TENANT_A_ID}'`);
    await queryRunnerA.query(`SET app.is_superadmin = 'false'`);

    await queryRunnerB.query(`SET app.current_tenant = '${TENANT_B_ID}'`);
    await queryRunnerB.query(`SET app.is_superadmin = 'false'`);

    await queryRunnerSuperadmin.query(`SET app.current_tenant = '${TENANT_A_ID}'`);
    await queryRunnerSuperadmin.query(`SET app.is_superadmin = 'true'`);

    // DEBUG: Verify session variables
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

  // ==========================================
  // PQRS TABLE RLS TESTS
  // ==========================================
  describe('PQRS Table RLS', () => {
    it('should allow superadmin to see all PQRS', async () => {
      // Seed PQRS for both tenants via superadmin
      await queryRunnerSuperadmin.query(`
        INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, prioridad, sla_fecha_limite, estado)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', 'peticion', 'PQRS A1', 'Desc A', 'media', NOW() + INTERVAL '5 days', 'abierto'),
          (gen_random_uuid(), '${TENANT_B_ID}', '${UNIDAD_B_ID}', '${USER_B_ID}', 'queja', 'PQRS B1', 'Desc B', 'alta', NOW() + INTERVAL '3 days', 'abierto')
        ON CONFLICT DO NOTHING;
      `);

      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM pqrs');
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(2);
    });

    it('should allow tenant A to see only their PQRS', async () => {
      const result = await queryRunnerA.query('SELECT COUNT(*) as count FROM pqrs');
      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should allow tenant B to see only their PQRS', async () => {
      const result = await queryRunnerB.query('SELECT COUNT(*) as count FROM pqrs');
      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should prevent tenant A from inserting PQRS for tenant B', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, prioridad, sla_fecha_limite, estado)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${UNIDAD_B_ID}', '${USER_B_ID}', 'reclamo', 'Hacked', 'Desc', 'urgente', NOW() + INTERVAL '1 day', 'abierto')
        `)
      ).rejects.toThrow();
    });

    it('should prevent tenant A from updating tenant B PQRS (0 rows affected)', async () => {
      // Get a PQRS from tenant B
      const pqrsB = await queryRunnerSuperadmin.query(`
        SELECT id FROM pqrs WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      // Tenant A tries to update tenant B's PQRS - RLS filters silently (0 rows affected)
      const result = await queryRunnerA.query(`
        UPDATE pqrs SET asunto = 'HACKED' WHERE id = '${pqrsB[0].id}'
      `);
      
      expect(result[1]).toBe(0);

      // Verify data wasn't changed
      const verify = await queryRunnerSuperadmin.query(`
        SELECT asunto FROM pqrs WHERE id = '${pqrsB[0].id}'
      `);
      expect(verify[0].asunto).not.toBe('HACKED');
    });

    it('should prevent tenant A from deleting tenant B PQRS (0 rows affected)', async () => {
      const pqrsB = await queryRunnerSuperadmin.query(`
        SELECT id FROM pqrs WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      const deleteResult = await queryRunnerA.query(`
        DELETE FROM pqrs WHERE id = '${pqrsB[0].id}'
      `);
      
      expect(deleteResult[1]).toBe(0);

      const verifyResult = await queryRunnerSuperadmin.query(`
        SELECT COUNT(*) as count FROM pqrs WHERE id = '${pqrsB[0].id}'
      `);
      expect(parseInt(verifyResult[0].count)).toBe(1);
    });
  });

  // ==========================================
  // PQRS SEGUIMIENTOS TABLE RLS TESTS
  // ==========================================
  describe('PQRS Seguimientos Table RLS', () => {
    it('should isolate seguimientos by tenant via pqrs_id join', async () => {
      // Get PQRS IDs for each tenant
      const pqrsA = await queryRunnerA.query(`SELECT id FROM pqrs WHERE tenant_id = '${TENANT_A_ID}' LIMIT 1`);
      const pqrsB = await queryRunnerB.query(`SELECT id FROM pqrs WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1`);

      // Add seguimiento for tenant A's PQRS
      await queryRunnerA.query(`
        INSERT INTO pqrs_seguimientos (id, tenant_id, pqrs_id, usuario_id, comentario)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${pqrsA[0].id}', '${USER_A_ID}', 'Seguimiento A')
      `);

      // Add seguimiento for tenant B's PQRS
      await queryRunnerB.query(`
        INSERT INTO pqrs_seguimientos (id, tenant_id, pqrs_id, usuario_id, comentario)
        VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${pqrsB[0].id}', '${USER_B_ID}', 'Seguimiento B')
      `);

      // Tenant A sees only their seguimientos
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM pqrs_seguimientos');
      expect(parseInt(resultA[0].count)).toBe(1);

      // Tenant B sees only their seguimientos
      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM pqrs_seguimientos');
      expect(parseInt(resultB[0].count)).toBe(1);

      // Superadmin sees both
      const resultSuper = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM pqrs_seguimientos');
      expect(parseInt(resultSuper[0].count)).toBe(2);
    });

    it('should prevent cross-tenant seguimiento INSERT', async () => {
      const pqrsB = await queryRunnerSuperadmin.query(`
        SELECT id FROM pqrs WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      await expect(
        queryRunnerA.query(`
          INSERT INTO pqrs_seguimientos (id, tenant_id, pqrs_id, usuario_id, comentario)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${pqrsB[0].id}', '${USER_A_ID}', 'Hack attempt')
        `)
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // ZONAS COMUNES TABLE RLS TESTS
  // ==========================================
  describe('Zonas Comunes Table RLS', () => {
    it('should allow superadmin to see all zonas', async () => {
      // Zonas already seeded in beforeAll
      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM zonas_comunes');
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(2);
    });

    it('should isolate zonas by tenant', async () => {
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM zonas_comunes');
      expect(parseInt(resultA[0].count)).toBe(1);

      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM zonas_comunes');
      expect(parseInt(resultB[0].count)).toBe(1);
    });

    it('should prevent cross-tenant INSERT', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO zonas_comunes (id, tenant_id, nombre, capacidad_maxima, costo, requiere_aprobacion, horario_disponible)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'Hacked', 10, 0, false, '{}')
        `)
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // RESERVAS TABLE RLS TESTS
  // ==========================================
  describe('Reservas Table RLS', () => {
    it('should allow superadmin to see all reservas', async () => {
      // Create reservas for both tenants via superadmin
      await queryRunnerSuperadmin.query(`
        INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, estado)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', '${ZONA_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', CURRENT_DATE + 1, '14:00', '18:00', 'confirmada'),
          (gen_random_uuid(), '${TENANT_B_ID}', '${ZONA_B_ID}', '${UNIDAD_B_ID}', '${USER_B_ID}', CURRENT_DATE + 1, '14:00', '18:00', 'confirmada')
        ON CONFLICT DO NOTHING;
      `);

      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM reservas');
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(2);
    });

    it('should isolate reservas by tenant', async () => {
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM reservas');
      expect(parseInt(resultA[0].count)).toBe(1);

      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM reservas');
      expect(parseInt(resultB[0].count)).toBe(1);
    });

    it('should prevent cross-tenant INSERT', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, estado)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${ZONA_B_ID}', '${UNIDAD_B_ID}', '${USER_A_ID}', CURRENT_DATE + 2, '10:00', '12:00', 'confirmada')
        `)
      ).rejects.toThrow();
    });

    it('should enforce no-overlap constraint at DB level (concurrency test)', async () => {
      const fecha = '2025-12-25';
      const inicio = '10:00';
      const fin = '12:00';

      // First reservation - should succeed
      await queryRunnerA.query(`
        INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, estado)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${ZONA_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', '${fecha}', '${inicio}', '${fin}', 'confirmada')
      `);

      // Second concurrent reservation for same zone/date/time - should fail due to exclusion constraint
      await expect(
        queryRunnerA.query(`
          INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, estado)
          VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${ZONA_A_ID}', '${UNIDAD_A_ID}', '${ADMIN_A_ID}', '${fecha}', '${inicio}', '${fin}', 'confirmada')
        `)
      ).rejects.toThrow(); // PostgreSQL exclusion constraint violation
    });

    it('should allow non-overlapping reservations for same zone', async () => {
      const fecha = '2025-12-26';

      // First reservation 10:00-12:00
      await queryRunnerA.query(`
        INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, estado)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${ZONA_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', '${fecha}', '10:00', '12:00', 'confirmada')
      `);

      // Second reservation 14:00-16:00 (no overlap) - should succeed
      await queryRunnerA.query(`
        INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, estado)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${ZONA_A_ID}', '${UNIDAD_A_ID}', '${ADMIN_A_ID}', '${fecha}', '14:00', '16:00', 'confirmada')
      `);

      const result = await queryRunnerA.query(`
        SELECT COUNT(*) as count FROM reservas WHERE fecha = '${fecha}' AND zona_comun_id = '${ZONA_A_ID}'
      `);
      expect(parseInt(result[0].count)).toBe(2);
    });
  });

  // ==========================================
  // PQRS STATE TRANSITION TESTS
  // ==========================================
  describe('PQRS State Transitions', () => {
    it('should allow valid transitions: abierto -> en_proceso -> resuelto -> cerrado', async () => {
      const pqrs = await queryRunnerSuperadmin.query(`
        INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, prioridad, sla_fecha_limite, estado)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', 'peticion', 'Test Transition', 'Desc', 'media', NOW() + INTERVAL '5 days', 'abierto')
        RETURNING id
      `);
      const pqrsId = pqrs[0].id;

      // abierto -> en_proceso
      await queryRunnerSuperadmin.query(`UPDATE pqrs SET estado = 'en_proceso' WHERE id = '${pqrsId}'`);
      
      // en_proceso -> resuelto
      await queryRunnerSuperadmin.query(`UPDATE pqrs SET estado = 'resuelto' WHERE id = '${pqrsId}'`);
      
      // resuelto -> cerrado
      await queryRunnerSuperadmin.query(`UPDATE pqrs SET estado = 'cerrado' WHERE id = '${pqrsId}'`);

      const verify = await queryRunnerSuperadmin.query(`SELECT estado FROM pqrs WHERE id = '${pqrsId}'`);
      expect(verify[0].estado).toBe('cerrado');
    });

    it('should reject invalid transition: abierto -> cerrado (must go through resuelto)', async () => {
      const pqrs = await queryRunnerSuperadmin.query(`
        INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, prioridad, sla_fecha_limite, estado)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', 'peticion', 'Test Invalid', 'Desc', 'media', NOW() + INTERVAL '5 days', 'abierto')
        RETURNING id
      `);
      const pqrsId = pqrs[0].id;

      await expect(
        queryRunnerSuperadmin.query(`UPDATE pqrs SET estado = 'cerrado' WHERE id = '${pqrsId}'`)
      ).rejects.toThrow('Invalid state transition');
    });

    it('should reject transition from final state (cerrado)', async () => {
      const pqrs = await queryRunnerSuperadmin.query(`
        INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, prioridad, sla_fecha_limite, estado)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', 'peticion', 'Test Final', 'Desc', 'media', NOW() + INTERVAL '5 days', 'cerrado')
        RETURNING id
      `);
      const pqrsId = pqrs[0].id;

      await expect(
        queryRunnerSuperadmin.query(`UPDATE pqrs SET estado = 'en_proceso' WHERE id = '${pqrsId}'`)
      ).rejects.toThrow('Cannot transition from final state');
    });
  });

  // ==========================================
  // SLA CALCULATION TESTS
  // ==========================================
  describe('PQRS SLA Auto-calculation', () => {
    it('should auto-calculate SLA deadline on INSERT based on tipo/prioridad', async () => {
      const pqrs = await queryRunnerSuperadmin.query(`
        INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, prioridad, estado)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${UNIDAD_A_ID}', '${USER_A_ID}', 'reclamo', 'Test SLA', 'Desc', 'urgente', 'abierto')
        RETURNING id, sla_fecha_limite
      `);

      const pqrsId = pqrs[0].id;
      const deadline = new Date(pqrs[0].sla_fecha_limite);
      const now = new Date();
      const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      // reclamo urgente = 24 hours
      expect(diffHours).toBeGreaterThanOrEqual(23);
      expect(diffHours).toBeLessThanOrEqual(25);
    });
  });
});