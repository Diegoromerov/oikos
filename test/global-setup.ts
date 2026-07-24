import { DataSource } from 'typeorm';

let dataSource: DataSource;

export default async function globalSetup(): Promise<void> {
  console.log('=== Global Setup Starting ===');
  console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
  console.log('DB_PORT:', process.env.DB_PORT || '5432');
  console.log('DB_USERNAME:', process.env.DB_USERNAME || 'glowapp');
  console.log('DB_NAME:', process.env.DB_NAME || 'glowapp');
  
  try {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'glowapp',
      password: process.env.DB_PASSWORD || 'glowapp_dev_2026',
      database: process.env.DB_NAME || 'glowapp',
      entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../migrations/*{.ts,.js}'],
      synchronize: false,
      logging: true,
    });

    await dataSource.initialize();
    console.log('Test database connection initialized');

    // Run migrations
    await dataSource.runMigrations();
    console.log('Migrations executed');

    // Seed test tenants
    await dataSource.query(`
      INSERT INTO tenants (id, nombre, slug, email_contacto, tipo, estado)
      VALUES 
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tenant A', 'tenant-a', 'admin@tenant-a.com', 'conjunto_residencial', 'activo'),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tenant B', 'tenant-b', 'admin@tenant-b.com', 'conjunto_residencial', 'activo')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Seed default roles
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
    
    console.log('Test database seeded');

    // Make dataSource globally available
    (global as any).testDataSource = dataSource;
    console.log('=== Global Setup Complete ===');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  }
}