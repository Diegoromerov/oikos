// backend/src/startup/dbInit.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

let lastDbInitError = null;

const initDatabase = async () => {
  try {
    console.log('🔄 Inicializando base de datos y esquemas...');
    
    // Crear extensiones requeridas
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // Tabla de auditoría básica
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        session_id VARCHAR(100),
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Índices de auditoría
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON user_activity_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_event ON user_activity_logs(event_type);
    `);

    // Tabla de bitácora admin_actions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_actions (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        accion VARCHAR(100) NOT NULL,
        descripcion TEXT,
        fecha_creacion TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Crear índices de rendimiento para bookings, reviews y services si no existen
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON bookings(scheduled_at DESC);
      CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
      CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id);
    `);

    // Ejecutar migración de lealtad y fraude (loyalty_migration.sql)
    const loyaltyMigrationPath = path.join(__dirname, '../config/loyalty_migration.sql');
    if (fs.existsSync(loyaltyMigrationPath)) {
      const loyaltySql = fs.readFileSync(loyaltyMigrationPath, 'utf8');
      await pool.query(loyaltySql);
      console.log('✅ Base de datos: Migración de lealtad y fraude ejecutada.');
    } else {
      console.warn('⚠️ No se encontró loyalty_migration.sql. Se omitió la migración de lealtad.');
    }

    // Ejecutar migración de disputas y schedule (disputas table, triggers, indexes y weekly_schedule)
    try {
      // 1. Crear tabla disputas
      await pool.query(`
        CREATE TABLE IF NOT EXISTS disputas (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
          iniciado_por    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
          tipo_actor      VARCHAR(20) NOT NULL CHECK (tipo_actor IN ('CLIENTE','PRESTADOR','SISTEMA')),
          tipo            VARCHAR(50) NOT NULL,
          descripcion     TEXT,
          evidencia_urls  TEXT[] DEFAULT '{}',
          monto_disputado NUMERIC(12,2) NOT NULL,
          estado          VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
          resuelto_por    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          resolucion      VARCHAR(50),
          porcentaje_prestador NUMERIC(5,2),
          nota_resolucion TEXT,
          creado_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          actualizado_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resuelto_at     TIMESTAMPTZ,
          sla_limite_at   TIMESTAMPTZ
        );
      `);

      // 2. Crear índices
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_disputas_booking ON disputas(booking_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_disputas_estado ON disputas(estado, creado_at DESC);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_disputas_sla ON disputas(sla_limite_at) WHERE estado IN ('ABIERTA','EN_REVISION');`);

      // 3. Crear función de trigger SLA
      await pool.query(`
        CREATE OR REPLACE FUNCTION set_disputa_sla()
        RETURNS TRIGGER AS $$
        BEGIN
          IF NEW.sla_limite_at IS NULL THEN
            NEW.sla_limite_at = NEW.creado_at + INTERVAL '48 hours';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // 4. Vincular triggers
      await pool.query(`DROP TRIGGER IF EXISTS trg_disputa_sla ON disputas;`);
      await pool.query(`
        CREATE TRIGGER trg_disputa_sla
        BEFORE INSERT ON disputas
        FOR EACH ROW EXECUTE FUNCTION set_disputa_sla();
      `);

      await pool.query(`DROP TRIGGER IF EXISTS trg_disputa_updated_at ON disputas;`);
      await pool.query(`
        CREATE TRIGGER trg_disputa_updated_at
        BEFORE UPDATE ON disputas
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);

      // 5. Agregar weekly_schedule y active_start_hour / active_end_hour a perfiles_prestador
      const defaultSchedule = JSON.stringify({
        lunes: { activo: true, inicio: 6, fin: 20 },
        martes: { activo: true, inicio: 6, fin: 20 },
        miercoles: { activo: true, inicio: 6, fin: 20 },
        jueves: { activo: true, inicio: 6, fin: 20 },
        viernes: { activo: true, inicio: 6, fin: 20 },
        sabado: { activo: true, inicio: 8, fin: 18 },
        domingo: { activo: false, inicio: 8, fin: 18 }
      });
      await pool.query(`
        ALTER TABLE perfiles_prestador 
        ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT '${defaultSchedule}'::jsonb,
        ADD COLUMN IF NOT EXISTS active_start_hour INTEGER DEFAULT 6,
        ADD COLUMN IF NOT EXISTS active_end_hour INTEGER DEFAULT 20;
      `);

      console.log('✅ Base de datos: Migración de disputas y horarios de disponibilidad listos.');
    } catch (migErr) {
      console.warn('⚠️ Error al aplicar migración de disputas/weekly_schedule/horarios:', migErr.message);
    }

    // Inserción de asistente virtual con ID 0
    const aiUserQuery = `
      INSERT INTO usuarios (id, email, nombre, auth_provider, provider_id, rol, onboarding_completo)
      VALUES (
        0,
        'assistant@beautyapp.com',
        'Asistente Virtual de Belleza',
        'LOCAL',
        'assistant-local',
        'PRESTADOR',
        true
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    await pool.query(aiUserQuery);
    console.log('🤖 Usuario Asistente de IA verificado/creado con ID 0.');

    // Ejecutar migraciones automáticas desde carpeta migrations
    const migrationsDir = path.join(__dirname, '../../migrations');
    if (fs.existsSync(migrationsDir)) {
      try {
        const files = fs.readdirSync(migrationsDir)
          .filter(file => file.endsWith('.sql'))
          .sort();
        
        console.log(`🔍 Encontradas ${files.length} migraciones en la carpeta migrations.`);
        for (const file of files) {
          const filePath = path.join(migrationsDir, file);
          try {
            const sql = fs.readFileSync(filePath, 'utf8');
            await pool.query(sql);
            console.log(`✅ Base de datos: Migración ${file} aplicada exitosamente.`);
          } catch (err) {
            if (!err.message.includes('already exists') && !err.message.includes('ya existe') && !err.message.includes('duplicate key value') && !err.message.includes('already a column')) {
              console.warn(`⚠️ Advertencia en migración ${file}:`, err.message);
            } else {
              console.log(`ℹ️ Migración ${file} ya aplicada anteriormente o con elementos existentes.`);
            }
          }
        }
      } catch (dirErr) {
        console.error('❌ Error leyendo la carpeta de migraciones:', dirErr.message);
      }
    }

    // Cargar semilla de datos si es necesario (seed.sql)
    const checkUser = await pool.query("SELECT id FROM usuarios WHERE email = 'provider@beautyapp.com';");
    const needsSeed = checkUser.rows.length === 0;

    if (needsSeed) {
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Omitiendo siembra de base de datos: la siembra automática está prohibida en producción.');
      } else if (process.env.SEED_DATABASE === 'true') {
        const seedPath = path.join(__dirname, '../../seed.sql');
        if (fs.existsSync(seedPath)) {
          try {
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            await pool.query(seedSql);
            console.log('🌱 Datos de prueba (seed.sql) sembrados exitosamente.');
          } catch (seedErr) {
            console.warn('⚠️ Advertencia al sembrar datos de prueba:', seedErr.message);
          }
        }
      }
    }

    // Auto aprobación en desarrollo
    if (process.env.AUTO_APPROVE_PROVIDERS === 'true') {
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Omitiendo aprobación automática de prestadores: prohibida en entornos de producción.');
      } else {
        await pool.query("UPDATE perfiles_prestador SET estatus_verificacion = 'APROBADO';");
        console.log('✅ Base de datos: Todos los perfiles de prestador han sido aprobados automáticamente.');
      }
    }

  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    lastDbInitError = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
  }
};

const getDbInitError = () => lastDbInitError;

module.exports = { initDatabase, getDbInitError };
