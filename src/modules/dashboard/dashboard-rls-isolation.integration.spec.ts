import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

describe('Dashboard RLS Integration Tests', () => {
  let dataSource: DataSource;

  // Test tenant IDs
  const TENANT_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const SUPERADMIN_TENANT_ID = TENANT_A_ID;

  // User IDs
  const USER_A_ID = '11111111-1111-1111-1111-111111111111';
  const USER_B_ID = '22222222-2222-2222-2222-222222222222';
  const ADMIN_A_ID = '33333333-3333-3333-3333-333333333333';
  const ADMIN_B_ID = '44444444-4444-4444-4444-444444444444';
  
  // Unit IDs
  const UNIDAD_A_ID = '55555555-5555-5555-5555-555555555555';
  const UNIDAD_B_ID = '66666666-6666-6666-6666-666666666666';
  
  // Zona común IDs
  const ZONA_A_ID = '77777777-7777-7777-7777-777777777777';
  const ZONA_B_ID = '88888888-8888-8888-8888-888888888888';

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
    await dataSource.query(`SET app.current_tenant = '00000000-0000-0000-0000-000000000000';`);
    await dataSource.query(`SET app.is_superadmin = 'true';`);

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
      const migrationsDir = 'C:\\\\oikos app\\\\migrations';
      const sqlFiles = fs.readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort()
        .filter((f: string) => [
          '027_tenants_rls_template.sql',
          '028_usuarios_unidades_rls.sql',
          '029_financiero_facturas_pagos_rls.sql',
          '030_porteria_rls.sql',
          '031_pqrs_reservas_rls.sql',
          '032_comunicados_rls.sql'
        ].includes(f));
      
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

    // Seed everything as superadmin (RLS bypass)
    console.log('Seeding all test data as superadmin...');
    
    // Seed tenants
    await dataSource.query(`
      INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, activo)
      VALUES 
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant A', 'tenant-a', 'admin@tenant-a.com', 'conjunto_residencial', true),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tenant B', 'tenant-b', 'admin@tenant-b.com', 'conjunto_residencial', true)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Tenants seeded');

    // Seed users
    const passwordHash = '$2b$10$6WhL5mylxVRiZ6jUU.4.LuJ7DOZhVuukPiTJX3P4kXChETZU1GNhK';
    await dataSource.query(`
      INSERT INTO usuarios (id, email, password_hash, nombre, activo, email_verificado)
      VALUES 
        ('11111111-1111-1111-1111-111111111111', 'userA_dashboard@test.com', '${passwordHash}', 'User A', true, true),
        ('22222222-2222-2222-2222-222222222222', 'userB_dashboard@test.com', '${passwordHash}', 'User B', true, true),
        ('33333333-3333-3333-3333-333333333333', 'adminA_dashboard@test.com', '${passwordHash}', 'Admin A', true, true),
        ('44444444-4444-4444-4444-444444444444', 'adminB_dashboard@test.com', '${passwordHash}', 'Admin B', true, true)
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

    // Assign admin roles
    await dataSource.query(`
      INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
      SELECT '33333333-3333-3333-3333-333333333333', id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' FROM roles WHERE tipo = 'admin' AND es_global = true
      ON CONFLICT DO NOTHING;
      
      INSERT INTO usuario_roles (usuario_id, role_id, tenant_id)
      SELECT '44444444-4444-4444-4444-444444444444', id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' FROM roles WHERE tipo = 'admin' AND es_global = true
      ON CONFLICT DO NOTHING;
    `);
    console.log('Admin roles assigned');

    // Seed unidades
    await dataSource.query(`
      INSERT INTO unidades (id, tenant_id, torre, numero, tipo_unidad, coeficiente_copropiedad)
      VALUES 
        ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TorreA', '101', 'apartamento', 0.5),
        ('66666666-6666-6666-6666-666666666666', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TorreB', '201', 'apartamento', 0.5)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Unidades seeded');

    // Seed zonas comunes
    await dataSource.query(`
      INSERT INTO zonas_comunes (id, tenant_id, nombre, descripcion, capacidad_maxima, costo, requiere_aprobacion, horario_disponible, activo)
      VALUES 
        ('77777777-7777-7777-7777-777777777777', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Salón Social A', 'Salón principal', 50, 100000, true, '{"lunes": [{"inicio": "08:00", "fin": "22:00"}]}', true),
        ('88888888-8888-8888-8888-888888888888', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Salón Social B', 'Salón principal', 50, 100000, true, '{"lunes": [{"inicio": "08:00", "fin": "22:00"}]}', true)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Zonas comunes seeded');

    // Seed ALL dashboard-relevant data for Tenant A
    // Use current month for payment date
    await dataSource.query(`
      INSERT INTO facturas (id, tenant_id, unidad_id, tipo, periodo, monto, fecha_emision, fecha_vencimiento, estado_sync)
      VALUES 
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'ordinaria', to_char(CURRENT_DATE, 'YYYY-MM'), 50000, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 'pendiente'),
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'extraordinaria', to_char(CURRENT_DATE, 'YYYY-MM'), 30000, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 'pendiente')
      ON CONFLICT DO NOTHING;
    `);

    // Get factura IDs for tenant A and insert pagos
    const facturasA = await dataSource.query(`SELECT id FROM facturas WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`);
    
    if (facturasA.length > 0) {
      await dataSource.query(`
        INSERT INTO pagos (id, tenant_id, factura_id, unidad_id, monto, metodo_pago, fecha_pago, estado_sync, wompi_transaction_id)
        SELECT gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, '55555555-5555-5555-5555-555555555555', 45000, 'wompi', (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '15 days')::timestamptz, 'sincronizado', 'txn_tenant_a_1'
        FROM facturas WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' LIMIT 1
        ON CONFLICT DO NOTHING;
      `);
    }

    await dataSource.query(`
      INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, estado, prioridad, sla_fecha_limite, fecha_resolucion, creado_en)
      VALUES 
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'peticion', 'PQRS A1', 'Desc A1', 'abierto', 'media', NOW() + INTERVAL '5 days', NULL, NOW()),
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'queja', 'PQRS A2', 'Desc A2', 'abierto', 'urgente', NOW() - INTERVAL '1 day', NULL, NOW() - INTERVAL '2 days'),  -- VENCIDO: creado hace 2 dias, SLA 1 dia = vencido hace 1 dia
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'reclamo', 'PQRS A3', 'Desc A3', 'en_proceso', 'alta', NOW() + INTERVAL '3 days', NULL, NOW()),
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'sugerencia', 'PQRS A4', 'Desc A4', 'resuelto', 'baja', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '15 days')
      ON CONFLICT DO NOTHING;
    `);

    await dataSource.query(`
      INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, costo_aplicado, estado)
      VALUES 
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + INTERVAL '1 day', '10:00', '12:00', 50000, 'confirmada'),
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', CURRENT_DATE + INTERVAL '2 days', '14:00', '16:00', 50000, 'confirmada'),
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - INTERVAL '1 day', '10:00', '12:00', 50000, 'confirmada')  -- Pasada
      ON CONFLICT DO NOTHING;
    `);

    await dataSource.query(`
      INSERT INTO comunicados (id, tenant_id, usuario_id, titulo, cuerpo, tipo, prioridad, fecha_publicacion, fecha_expiracion, activo)
      VALUES 
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Comunicado A1', 'Contenido A1', 'informativo', 'normal', NOW(), NOW() + INTERVAL '10 days', true),
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Comunicado A2', 'Contenido A2', 'urgente', 'alta', NOW() - INTERVAL '1 day', NOW() + INTERVAL '5 days', true),
        (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Comunicado A3 Expirado', 'Contenido A3', 'evento', 'normal', NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 day', true)  -- Expirado
      ON CONFLICT DO NOTHING;
    `);

    // Seed ALL dashboard-relevant data for Tenant B
    await dataSource.query(`
      INSERT INTO facturas (id, tenant_id, unidad_id, tipo, periodo, monto, fecha_emision, fecha_vencimiento, estado_sync)
      VALUES 
        (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'ordinaria', to_char(CURRENT_DATE, 'YYYY-MM'), 999999, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 'pendiente')
      ON CONFLICT DO NOTHING;
    `);

    const facturasB = await dataSource.query(`SELECT id FROM facturas WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'`);
    
    if (facturasB.length > 0) {
      await dataSource.query(`
        INSERT INTO pagos (id, tenant_id, factura_id, unidad_id, monto, metodo_pago, fecha_pago, estado_sync, wompi_transaction_id)
        SELECT gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, '66666666-6666-6666-6666-666666666666', 888888, 'wompi', (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '15 days')::timestamptz, 'sincronizado', 'txn_tenant_b_1'
        FROM facturas WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' LIMIT 1
        ON CONFLICT DO NOTHING;
      `);
    }

    await dataSource.query(`
      INSERT INTO pqrs (id, tenant_id, unidad_id, usuario_id, tipo, asunto, descripcion, estado, prioridad, sla_fecha_limite, fecha_resolucion, creado_en)
      VALUES 
        (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'peticion', 'PQRS B1', 'Desc B1', 'abierto', 'media', NOW() + INTERVAL '5 days', NULL, NOW())
      ON CONFLICT DO NOTHING;
    `);

    await dataSource.query(`
      INSERT INTO reservas (id, tenant_id, zona_comun_id, unidad_id, usuario_id, fecha, hora_inicio, hora_fin, costo_aplicado, estado)
      VALUES 
        (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888888', '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', CURRENT_DATE + INTERVAL '1 day', '10:00', '12:00', 50000, 'confirmada')
      ON CONFLICT DO NOTHING;
    `);

    await dataSource.query(`
      INSERT INTO comunicados (id, tenant_id, usuario_id, titulo, cuerpo, tipo, prioridad, fecha_publicacion, fecha_expiracion, activo)
      VALUES 
        (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'Comunicado B1', 'Contenido B1', 'informativo', 'normal', NOW(), NOW() + INTERVAL '10 days', true)
      ON CONFLICT DO NOTHING;
    `);

    console.log('All test data seeded successfully');
  }, 120000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  describe('Dashboard Stats RLS', () => {
    it('should return stats only for tenant A when queried as tenant A', async () => {
      // Set session to tenant A
      await dataSource.query(`SET app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`);
      await dataSource.query(`SET app.is_superadmin = 'false'`);

      // Test cartera pendiente
      const carteraPendiente = await dataSource.query(`
        SELECT SUM(monto) as total FROM facturas 
        WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND estado_sync IN ('pendiente', 'parcial', 'vencida')
      `);
      console.log('Cartera pendiente:', carteraPendiente);
      expect(parseFloat(carteraPendiente[0]?.total || 0)).toBe(80000); // 50000 + 30000

      // Test cartera recaudada
      const carteraRecaudada = await dataSource.query(`
        SELECT SUM(monto) as total FROM pagos 
        WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' 
        AND fecha_pago >= DATE_TRUNC('month', CURRENT_DATE) 
        AND fecha_pago < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND estado_sync = 'sincronizado'
      `);
      console.log('Cartera recaudada:', carteraRecaudada);
      expect(parseFloat(carteraRecaudada[0]?.total || 0)).toBe(45000);

      // Test PQRS abiertos
      const pqrsAbiertos = await dataSource.query(`
        SELECT COUNT(*) as count FROM pqrs 
        WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND estado IN ('abierto', 'en_proceso')
      `);
      console.log('PQRS abiertos:', pqrsAbiertos);
      expect(parseInt(pqrsAbiertos[0]?.count || 0)).toBe(3); // 2 abierto + 1 en_proceso

      // Test PQRS vencidos
      const pqrsVencidos = await dataSource.query(`
        SELECT COUNT(*) as count FROM pqrs 
        WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' 
        AND sla_fecha_limite < NOW() 
        AND fecha_resolucion IS NULL 
        AND estado NOT IN ('resuelto', 'cerrado', 'rechazado')
      `);
      console.log('PQRS vencidos:', pqrsVencidos);
      expect(parseInt(pqrsVencidos[0]?.count || 0)).toBe(1); // Solo el 'urgente' con SLA en pasado

      // Test reservas próximas (confirmadas, fecha >= hoy)
      const reservasProximas = await dataSource.query(`
        SELECT id, zona_comun_id, fecha, hora_inicio, unidad_id FROM reservas 
        WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' 
        AND estado = 'confirmada' 
        AND fecha >= CURRENT_DATE
        ORDER BY fecha ASC, hora_inicio ASC
        LIMIT 5
      `);
      console.log('Reservas próximas:', reservasProximas);
      expect(reservasProximas.length).toBe(2);
      const currentYear = new Date().getFullYear();
      const fechaStr = reservasProximas[0].fecha instanceof Date ? reservasProximas[0].fecha.toISOString() : String(reservasProximas[0].fecha);
      expect(fechaStr).toContain(currentYear.toString()); // fecha futura

      // Test comunicados recientes (activos, no expirados)
      const comunicadosRecientes = await dataSource.query(`
        SELECT id, titulo, tipo, fecha_publicacion FROM comunicados 
        WHERE tenant_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' 
        AND activo = true 
        AND (fecha_expiracion IS NULL OR fecha_expiracion >= NOW())
        ORDER BY fecha_publicacion DESC
        LIMIT 3
      `);
      console.log('Comunicados recientes:', comunicadosRecientes);
      expect(comunicadosRecientes.length).toBe(2); // Solo los no expirados
    });

    it('should return stats only for tenant B when queried as tenant B', async () => {
      // Set session to tenant B
      await dataSource.query(`SET app.current_tenant = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'`);
      await dataSource.query(`SET app.is_superadmin = 'false'`);

      // Tenant B should see ONLY their data with THEIR distinctive amounts
      const carteraPendiente = await dataSource.query(`
        SELECT SUM(monto) as total FROM facturas 
        WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND estado_sync IN ('pendiente', 'parcial', 'vencida')
      `);
      expect(parseFloat(carteraPendiente[0]?.total || 0)).toBe(999999);

      const carteraRecaudada = await dataSource.query(`
        SELECT SUM(monto) as total FROM pagos 
        WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' 
        AND fecha_pago >= DATE_TRUNC('month', CURRENT_DATE) 
        AND fecha_pago < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
        AND estado_sync = 'sincronizado'
      `);
      expect(parseFloat(carteraRecaudada[0]?.total || 0)).toBe(888888);

      const pqrsAbiertos = await dataSource.query(`
        SELECT COUNT(*) as count FROM pqrs 
        WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' AND estado IN ('abierto', 'en_proceso')
      `);
      expect(parseInt(pqrsAbiertos[0]?.count || 0)).toBe(1);

      const reservasProximas = await dataSource.query(`
        SELECT id FROM reservas 
        WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' 
        AND estado = 'confirmada' 
        AND fecha >= CURRENT_DATE
        ORDER BY fecha ASC, hora_inicio ASC
        LIMIT 5
      `);
      expect(reservasProximas.length).toBe(1);

      const comunicadosRecientes = await dataSource.query(`
        SELECT id FROM comunicados 
        WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' 
        AND activo = true 
        AND (fecha_expiracion IS NULL OR fecha_expiracion >= NOW())
        ORDER BY fecha_publicacion DESC
        LIMIT 3
      `);
      expect(comunicadosRecientes.length).toBe(1);
    });

    it('should prevent tenant A from seeing tenant B data when querying dashboard stats', async () => {
      // Set session to tenant A
      await dataSource.query(`SET app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`);
      await dataSource.query(`SET app.is_superadmin = 'false'`);

      // Try to query tenant B's tables directly - RLS should filter to 0 rows
      const facturasB = await dataSource.query(`
        SELECT COUNT(*) as count FROM facturas WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      `);
      expect(parseInt(facturasB[0]?.count || 0)).toBe(0);

      const pagosB = await dataSource.query(`
        SELECT COUNT(*) as count FROM pagos WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      `);
      expect(parseInt(pagosB[0]?.count || 0)).toBe(0);

      const pqrsB = await dataSource.query(`
        SELECT COUNT(*) as count FROM pqrs WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      `);
      expect(parseInt(pqrsB[0]?.count || 0)).toBe(0);

      const reservasB = await dataSource.query(`
        SELECT COUNT(*) as count FROM reservas WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      `);
      expect(parseInt(reservasB[0]?.count || 0)).toBe(0);

      const comunicadosB = await dataSource.query(`
        SELECT COUNT(*) as count FROM comunicados WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      `);
      expect(parseInt(comunicadosB[0]?.count || 0)).toBe(0);

      const zonasB = await dataSource.query(`
        SELECT COUNT(*) as count FROM zonas_comunes WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      `);
      expect(parseInt(zonasB[0]?.count || 0)).toBe(0);

      const unidadesB = await dataSource.query(`
        SELECT COUNT(*) as count FROM unidades WHERE tenant_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      `);
      expect(parseInt(unidadesB[0]?.count || 0)).toBe(0);
    });

    it('should allow superadmin to see all tenants data', async () => {
      // Set session to superadmin
      await dataSource.query(`SET app.current_tenant = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`);
      await dataSource.query(`SET app.is_superadmin = 'true'`);

      const facturasAll = await dataSource.query(`
        SELECT COUNT(*) as count FROM facturas
      `);
      // Should see facturas from both tenants: 3 total (2 from A, 1 from B)
      expect(parseInt(facturasAll[0]?.count || 0)).toBeGreaterThanOrEqual(3);

      const pqrsAll = await dataSource.query(`
        SELECT COUNT(*) as count FROM pqrs
      `);
      expect(parseInt(pqrsAll[0]?.count || 0)).toBeGreaterThanOrEqual(4);

      const reservasAll = await dataSource.query(`
        SELECT COUNT(*) as count FROM reservas
      `);
      expect(parseInt(reservasAll[0]?.count || 0)).toBeGreaterThanOrEqual(3);

      const comunicadosAll = await dataSource.query(`
        SELECT COUNT(*) as count FROM comunicados
      `);
      expect(parseInt(comunicadosAll[0]?.count || 0)).toBeGreaterThanOrEqual(3);
    });
  });
});