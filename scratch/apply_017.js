// backend/scratch/apply_017.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const client = new Client({
    connectionString: `postgresql://admin:admin123@127.0.0.1:5435/beauty_db`
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos PostgreSQL local.');
    const sqlPath = path.join(__dirname, '../migrations/017_beauty_profile_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 017 aplicada exitosamente en la base de datos.');

    // Seed consentimiento biométrico para el usuario demo (id = 1)
    await client.query(`
      INSERT INTO biometric_consents (user_id, consent_type, is_active, ip_address, device_info)
      SELECT 1, 'standard', true, '127.0.0.1', 'Test Device'
      WHERE NOT EXISTS (
        SELECT 1 FROM biometric_consents WHERE user_id = 1 AND is_active = true
      );
    `);
    console.log('✅ Consentimiento biométrico de prueba creado para el usuario demo (ID 1).');
  } catch (err) {
    console.error('❌ Error ejecutando la migración:', err);
  } finally {
    await client.end();
  }
}

run();
