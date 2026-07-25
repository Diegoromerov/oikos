const { pool } = require('../src/config/db');

async function migrate() {
  try {
    console.log('🔄 Iniciando migración para Ítem 1...');
    await pool.query(`
      ALTER TABLE ai_diagnostics ADD COLUMN IF NOT EXISTS comparison_photo_url TEXT;
      ALTER TABLE ai_diagnostics ADD COLUMN IF NOT EXISTS comparison_delta JSONB;
    `);
    console.log('✅ Columnas agregadas con éxito a ai_diagnostics');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err);
    process.exit(1);
  }
}

migrate();
