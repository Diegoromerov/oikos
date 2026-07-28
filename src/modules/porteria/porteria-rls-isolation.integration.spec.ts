import { DataSource, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

describe('Porteria RLS Isolation Tests', () => {
  let dataSource: DataSource;
  let queryRunnerA: QueryRunner;
  let queryRunnerB: QueryRunner;
  let queryRunnerSuperadmin: QueryRunner;

  // Test tenant IDs
  const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const SUPERADMIN_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  // Test portero IDs
  const PORTERO_A_ID = '11111111-1111-1111-1111-111111111111';
  const PORTERO_B_ID = '22222222-2222-2222-2222-222222222222';

  // Test unidad IDs
  const UNIDAD_A_ID = '33333333-3333-3333-3333-333333333333';
  const UNIDAD_B_ID = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    // Initialize data source with non-owner user
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'oikos_app',  // Non-owner user for RLS to apply
      password: process.env.DB_PASSWORD || 'oikos_app_dev_2026',
      database: process.env.DB_NAME || 'oikos',
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
    console.log('Cleaning existing porteria tables...');
    try {
      await dataSource.query(`
        DROP TABLE IF EXISTS incidentes, minutas_turno, correspondencia, registros_acceso, visitantes_preautorizados CASCADE;
      `);
      console.log('Existing porteria tables cleaned');
    } catch (err) {
      console.error('Cleanup failed:', err);
    }

    // Run SQL migrations manually - only 030 for porteria
    console.log('Running SQL migration 030_porteria_rls.sql...');
    try {
      const migrationsDir = 'C:\\oikos app\\migrations';
      const sqlFiles = fs.readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort()
        .filter((f: string) => f.startsWith('030'));
      
      for (const file of sqlFiles) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');
        console.log(`Running migration: ${file}`);
        
        // Execute entire file as single query - PostgreSQL handles multiple statements
        await dataSource.query(sql);
      }
      console.log('Porteria migration executed');

      // Force RLS on all porteria tables (owner bypasses ENABLE RLS, needs FORCE)
      console.log('Forcing RLS on porteria tables...');
      await dataSource.query(`
        ALTER TABLE visitantes_preautorizados FORCE ROW LEVEL SECURITY;
        ALTER TABLE registros_acceso FORCE ROW LEVEL SECURITY;
        ALTER TABLE correspondencia FORCE ROW LEVEL SECURITY;
        ALTER TABLE minutas_turno FORCE ROW LEVEL SECURITY;
        ALTER TABLE incidentes FORCE ROW LEVEL SECURITY;
      `);
      console.log('RLS forced on porteria tables');
    } catch (err) {
      console.error('Migration failed:', err);
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

    // Seed test units
    try {
      await dataSource.query(`
        INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
        VALUES 
          ('${UNIDAD_A_ID}', '${TENANT_A_ID}', 'TorreA', '101', 'apartamento', 50.00000000),
          ('${UNIDAD_B_ID}', '${TENANT_B_ID}', 'TorreB', '201', 'apartamento', 50.00000000)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Unidades seeded');
    } catch (err) {
      console.error('Unidades seeding failed:', err);
      throw err;
    }

    // Seed porteros (usuarios con rol portero)
    try {
      await dataSource.query(`
        INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
        VALUES 
          ('${PORTERO_A_ID}', 'porteroA@test.com', 'hash', 'Portero A', true, true),
          ('${PORTERO_B_ID}', 'porteroB@test.com', 'hash', 'Portero B', true, true)
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Porteros seeded');
    } catch (err) {
      console.error('Porteros seeding failed:', err);
      throw err;
    }

    // Seed portero role
    try {
      await dataSource.query(`
        INSERT INTO roles (id, nombre, tipo, tenant_id, es_global, activo)
        VALUES (gen_random_uuid(), 'Portero', 'portero', NULL, true, true)
        ON CONFLICT DO NOTHING;
      `);
      console.log('Portero role seeded');
    } catch (err) {
      console.error('Portero role seeding failed:', err);
      throw err;
    }

    // Assign portero role to porteros
    try {
      await dataSource.query(`
        INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
        SELECT '${PORTERO_A_ID}', id, '${TENANT_A_ID}' FROM roles WHERE tipo = 'portero' AND es_global = true
        ON CONFLICT DO NOTHING;
        
        INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
        SELECT '${PORTERO_B_ID}', id, '${TENANT_B_ID}' FROM roles WHERE tipo = 'portero' AND es_global = true
        ON CONFLICT DO NOTHING;
      `);
      console.log('Portero roles assigned');
    } catch (err) {
      console.error('Portero role assignment failed:', err);
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

  describe('Visitantes Preautorizados Table RLS', () => {
    it('should allow superadmin to see all visitantes', async () => {
      // Seed visitantes for both tenants via superadmin
      await queryRunnerSuperadmin.query(`
        INSERT INTO visitantes_preautorizados (id, tenant_id, local_uuid, unidad_id, autorizado_por_id, nombre_visitante, documento_visitante, tipo_visitante, qr_code, valido_desde, valido_hasta)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', 'visitante-a-seed-1', '${UNIDAD_A_ID}', '${PORTERO_A_ID}', 'Visitante A1', '12345', 'visitante', 'qr-a1', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours'),
          (gen_random_uuid(), '${TENANT_B_ID}', 'visitante-b-seed-1', '${UNIDAD_B_ID}', '${PORTERO_B_ID}', 'Visitante B1', '67890', 'visitante', 'qr-b1', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours')
        ON CONFLICT DO NOTHING;
      `);

      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM visitantes_preautorizados');
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(2);
    });

    it('should allow tenant A to see only their visitantes', async () => {
      const result = await queryRunnerA.query('SELECT COUNT(*) as count FROM visitantes_preautorizados');
      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should allow tenant B to see only their visitantes', async () => {
      const result = await queryRunnerB.query('SELECT COUNT(*) as count FROM visitantes_preautorizados');
      expect(parseInt(result[0].count)).toBe(1);
    });

    it('should prevent tenant A from inserting visitante for tenant B', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO visitantes_preautorizados (id, tenant_id, unidad_id, autorizado_por_id, nombre_visitante, documento_visitante, tipo_visitante, qr_code, valido_desde, valido_hasta)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', '${UNIDAD_B_ID}', '${PORTERO_B_ID}', 'Hacked', '00000', 'visitante', 'qr-hack', NOW(), NOW() + INTERVAL '1 hour')
        `)
      ).rejects.toThrow();
    });

    it('should prevent tenant A from updating tenant B visitante', async () => {
      // Get a visitante from tenant B
      const visitanteB = await queryRunnerSuperadmin.query(`
        SELECT id FROM visitantes_preautorizados WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      // Tenant A tries to update tenant B's visitante - RLS filters silently (0 rows affected)
      const result = await queryRunnerA.query(`
        UPDATE visitantes_preautorizados SET nombre_visitante = 'HACKED' WHERE id = '${visitanteB[0].id}'
      `);
      
      // PostgreSQL RLS returns 0 rows affected instead of throwing
      expect(result[1]).toBe(0);

      // Verify data wasn't changed
      const verify = await queryRunnerSuperadmin.query(`
        SELECT nombre_visitante FROM visitantes_preautorizados WHERE id = '${visitanteB[0].id}'
      `);
      expect(verify[0].nombre_visitante).not.toBe('HACKED');
    });

    it('should prevent tenant A from deleting tenant B visitante', async () => {
      const visitanteB = await queryRunnerSuperadmin.query(`
        SELECT id FROM visitantes_preautorizados WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      const deleteResult = await queryRunnerA.query(`
        DELETE FROM visitantes_preautorizados WHERE id = '${visitanteB[0].id}'
      `);
      
      expect(deleteResult[1]).toBe(0);

      const verifyResult = await queryRunnerSuperadmin.query(`
        SELECT COUNT(*) as count FROM visitantes_preautorizados WHERE id = '${visitanteB[0].id}'
      `);
      expect(parseInt(verifyResult[0].count)).toBe(1);
    });
  });

  describe('Registros Acceso Table RLS', () => {
    it('should allow superadmin to see all registros', async () => {
      await queryRunnerSuperadmin.query(`
        INSERT INTO registros_acceso (id, tenant_id, local_uuid, unidad_id, visitante_preautorizado_id, tipo_acceso, direccion, portero_id, timestamp_local)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', 'local-a-1', '${UNIDAD_A_ID}', NULL, 'peatonal', 'entrada', '${PORTERO_A_ID}', NOW()),
          (gen_random_uuid(), '${TENANT_B_ID}', 'local-b-1', '${UNIDAD_B_ID}', NULL, 'peatonal', 'entrada', '${PORTERO_B_ID}', NOW())
        ON CONFLICT DO NOTHING;
      `);

      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM registros_acceso');
      expect(parseInt(result[0].count)).toBeGreaterThanOrEqual(2);
    });

    it('should isolate registros by tenant', async () => {
      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM registros_acceso');
      expect(parseInt(resultA[0].count)).toBe(1);

      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM registros_acceso');
      expect(parseInt(resultB[0].count)).toBe(1);
    });

    it('should prevent tenant A from inserting registro for tenant B', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO registros_acceso (id, tenant_id, local_uuid, unidad_id, tipo_acceso, direccion, portero_id, timestamp_local)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'local-hack', '${UNIDAD_B_ID}', 'peatonal', 'entrada', '${PORTERO_B_ID}', NOW())
        `)
      ).rejects.toThrow();
    });

    it('should prevent cross-tenant UPDATE via RLS (0 rows affected)', async () => {
      const registroB = await queryRunnerSuperadmin.query(`
        SELECT id FROM registros_acceso WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      const result = await queryRunnerA.query(`
        UPDATE registros_acceso SET direccion = 'HACKED' WHERE id = '${registroB[0].id}'
      `);
      
      expect(result[1]).toBe(0);

      const verify = await queryRunnerSuperadmin.query(`
        SELECT direccion FROM registros_acceso WHERE id = '${registroB[0].id}'
      `);
      expect(verify[0].direccion).not.toBe('HACKED');
    });

    it('should prevent cross-tenant DELETE via RLS (0 rows affected)', async () => {
      const registroB = await queryRunnerSuperadmin.query(`
        SELECT id FROM registros_acceso WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      const deleteResult = await queryRunnerA.query(`
        DELETE FROM registros_acceso WHERE id = '${registroB[0].id}'
      `);
      
      expect(deleteResult[1]).toBe(0);

      const verifyResult = await queryRunnerSuperadmin.query(`
        SELECT COUNT(*) as count FROM registros_acceso WHERE id = '${registroB[0].id}'
      `);
      expect(parseInt(verifyResult[0].count)).toBe(1);
    });
  });

  describe('Correspondencia Table RLS', () => {
    it('should isolate correspondencia by tenant', async () => {
      await queryRunnerSuperadmin.query(`
        INSERT INTO correspondencia (id, tenant_id, local_uuid, unidad_id, tipo, portero_receptor_id, recibido_en)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', 'corr-a-1', '${UNIDAD_A_ID}', 'paquete', '${PORTERO_A_ID}', NOW()),
          (gen_random_uuid(), '${TENANT_B_ID}', 'corr-b-1', '${UNIDAD_B_ID}', 'carta', '${PORTERO_B_ID}', NOW())
        ON CONFLICT DO NOTHING;
      `);

      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM correspondencia');
      expect(parseInt(resultA[0].count)).toBe(1);

      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM correspondencia');
      expect(parseInt(resultB[0].count)).toBe(1);
    });

    it('should prevent cross-tenant INSERT', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO correspondencia (id, tenant_id, local_uuid, unidad_id, tipo, portero_receptor_id, recibido_en)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'corr-hack', '${UNIDAD_B_ID}', 'paquete', '${PORTERO_B_ID}', NOW())
        `)
      ).rejects.toThrow();
    });

    it('should prevent cross-tenant SELECT', async () => {
      const result = await queryRunnerA.query(`
        SELECT * FROM correspondencia WHERE tenant_id = '${TENANT_B_ID}'
      `);
      expect(result.length).toBe(0);
    });
  });

  describe('Minutas Turno Table RLS', () => {
    it('should isolate minutas by tenant', async () => {
      await queryRunnerSuperadmin.query(`
        INSERT INTO minutas_turno (id, tenant_id, local_uuid, portero_id, turno_inicio, turno_fin, novedades)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', 'minuta-a-1', '${PORTERO_A_ID}', NOW() - INTERVAL '8 hours', NOW(), 'Todo tranquilo'),
          (gen_random_uuid(), '${TENANT_B_ID}', 'minuta-b-1', '${PORTERO_B_ID}', NOW() - INTERVAL '8 hours', NOW(), 'Sin novedades')
        ON CONFLICT DO NOTHING;
      `);

      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM minutas_turno');
      expect(parseInt(resultA[0].count)).toBe(1);

      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM minutas_turno');
      expect(parseInt(resultB[0].count)).toBe(1);

      const resultSuper = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM minutas_turno');
      expect(parseInt(resultSuper[0].count)).toBe(2);
    });

    it('should prevent cross-tenant INSERT', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO minutas_turno (id, tenant_id, local_uuid, portero_id, turno_inicio, turno_fin, novedades)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'minuta-hack', '${PORTERO_B_ID}', NOW() - INTERVAL '8 hours', NOW(), 'Hacked')
        `)
      ).rejects.toThrow();
    });

    it('should allow superadmin to see all minutas', async () => {
      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM minutas_turno');
      expect(parseInt(result[0].count)).toBe(2);
    });
  });

  describe('Incidentes Table RLS', () => {
    it('should isolate incidentes by tenant', async () => {
      await queryRunnerSuperadmin.query(`
        INSERT INTO incidentes (id, tenant_id, local_uuid, portero_id, tipo_incidente, descripcion, prioridad_envio, creado_en)
        VALUES 
          (gen_random_uuid(), '${TENANT_A_ID}', 'inc-a-1-' || gen_random_uuid(), '${PORTERO_A_ID}', 'incidente', 'Ruido excesivo', false, NOW()),
          (gen_random_uuid(), '${TENANT_B_ID}', 'inc-b-1-' || gen_random_uuid(), '${PORTERO_B_ID}', 'panico', 'Emergencia médica', true, NOW())
        ON CONFLICT DO NOTHING;
      `);

      const resultA = await queryRunnerA.query('SELECT COUNT(*) as count FROM incidentes');
      expect(parseInt(resultA[0].count)).toBe(1);

      const resultB = await queryRunnerB.query('SELECT COUNT(*) as count FROM incidentes');
      expect(parseInt(resultB[0].count)).toBe(1);
    });

    it('should prevent cross-tenant INSERT', async () => {
      await expect(
        queryRunnerA.query(`
          INSERT INTO incidentes (id, tenant_id, local_uuid, portero_id, tipo_incidente, descripcion, prioridad_envio, creado_en)
          VALUES (gen_random_uuid(), '${TENANT_B_ID}', 'inc-hack', '${PORTERO_B_ID}', 'panico', 'Fake panic', true, NOW())
        `)
      ).rejects.toThrow();
    });

    it('should prevent cross-tenant UPDATE (0 rows affected)', async () => {
      const incidenteB = await queryRunnerSuperadmin.query(`
        SELECT id FROM incidentes WHERE tenant_id = '${TENANT_B_ID}' LIMIT 1
      `);

      const result = await queryRunnerA.query(`
        UPDATE incidentes SET descripcion = 'HACKED' WHERE id = '${incidenteB[0].id}'
      `);
      
      expect(result[1]).toBe(0);

      const verify = await queryRunnerSuperadmin.query(`
        SELECT descripcion FROM incidentes WHERE id = '${incidenteB[0].id}'
      `);
      expect(verify[0].descripcion).not.toBe('HACKED');
    });

    it('should allow superadmin to see all incidentes', async () => {
      const result = await queryRunnerSuperadmin.query('SELECT COUNT(*) as count FROM incidentes');
      expect(parseInt(result[0].count)).toBe(2);
    });
  });

  describe('Idempotency via local_uuid', () => {
    it('should reject duplicate local_uuid in visitantes_preautorizados', async () => {
      const localUuid = 'test-duplicate-visitante-' + Date.now();
      
      // First insert
      await queryRunnerSuperadmin.query(`
        INSERT INTO visitantes_preautorizados (id, tenant_id, local_uuid, unidad_id, autorizado_por_id, nombre_visitante, documento_visitante, tipo_visitante, qr_code, valido_desde, valido_hasta)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${UNIDAD_A_ID}', '${PORTERO_A_ID}', 'Test', '111', 'visitante', 'qr-test', NOW(), NOW() + INTERVAL '1 hour')
      `);

      // Second insert with same local_uuid should fail (unique constraint)
      await expect(
        queryRunnerSuperadmin.query(`
          INSERT INTO visitantes_preautorizados (id, tenant_id, local_uuid, unidad_id, autorizado_por_id, nombre_visitante, documento_visitante, tipo_visitante, qr_code, valido_desde, valido_hasta)
          VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${UNIDAD_A_ID}', '${PORTERO_A_ID}', 'Test2', '222', 'visitante', 'qr-test2', NOW(), NOW() + INTERVAL '1 hour')
        `)
      ).rejects.toThrow();
    });

    it('should reject duplicate local_uuid in registros_acceso', async () => {
      const localUuid = 'test-duplicate-acceso-' + Date.now();
      
      await queryRunnerSuperadmin.query(`
        INSERT INTO registros_acceso (id, tenant_id, local_uuid, unidad_id, tipo_acceso, direccion, portero_id, timestamp_local)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${UNIDAD_A_ID}', 'peatonal', 'entrada', '${PORTERO_A_ID}', NOW())
      `);

      await expect(
        queryRunnerSuperadmin.query(`
          INSERT INTO registros_acceso (id, tenant_id, local_uuid, unidad_id, tipo_acceso, direccion, portero_id, timestamp_local)
          VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${UNIDAD_A_ID}', 'vehicular', 'salida', '${PORTERO_A_ID}', NOW())
        `)
      ).rejects.toThrow();
    });

    it('should reject duplicate local_uuid in correspondencia', async () => {
      const localUuid = 'test-duplicate-corr-' + Date.now();
      
      await queryRunnerSuperadmin.query(`
        INSERT INTO correspondencia (id, tenant_id, local_uuid, unidad_id, tipo, portero_receptor_id, recibido_en)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${UNIDAD_A_ID}', 'paquete', '${PORTERO_A_ID}', NOW())
      `);

      await expect(
        queryRunnerSuperadmin.query(`
          INSERT INTO correspondencia (id, tenant_id, local_uuid, unidad_id, tipo, portero_receptor_id, recibido_en)
          VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${UNIDAD_A_ID}', 'carta', '${PORTERO_A_ID}', NOW())
        `)
      ).rejects.toThrow();
    });

    it('should reject duplicate local_uuid in minutas_turno', async () => {
      const localUuid = 'test-duplicate-minuta-' + Date.now();
      
      await queryRunnerSuperadmin.query(`
        INSERT INTO minutas_turno (id, tenant_id, local_uuid, portero_id, turno_inicio, turno_fin, novedades)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${PORTERO_A_ID}', NOW() - INTERVAL '8 hours', NOW(), 'Test')
      `);

      await expect(
        queryRunnerSuperadmin.query(`
          INSERT INTO minutas_turno (id, tenant_id, local_uuid, portero_id, turno_inicio, turno_fin, novedades)
          VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${PORTERO_A_ID}', NOW() - INTERVAL '8 hours', NOW(), 'Test2')
        `)
      ).rejects.toThrow();
    });

    it('should reject duplicate local_uuid in incidentes', async () => {
      const localUuid = 'test-duplicate-inc-' + Date.now();
      
      await queryRunnerSuperadmin.query(`
        INSERT INTO incidentes (id, tenant_id, local_uuid, portero_id, tipo_incidente, descripcion, prioridad_envio, creado_en)
        VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${PORTERO_A_ID}', 'incidente', 'Test', false, NOW())
      `);

      await expect(
        queryRunnerSuperadmin.query(`
          INSERT INTO incidentes (id, tenant_id, local_uuid, portero_id, tipo_incidente, descripcion, prioridad_envio, creado_en)
          VALUES (gen_random_uuid(), '${TENANT_A_ID}', '${localUuid}', '${PORTERO_A_ID}', 'panico', 'Test2', true, NOW())
        `)
      ).rejects.toThrow();
    });
  });
});