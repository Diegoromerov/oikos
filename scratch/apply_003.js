// backend/scratch/apply_003.js
const { pool } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

const run = async () => {
  try {
    const migrationPath = path.join(__dirname, '../migrations/003_habeas_data_and_config.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 003 applied successfully to beauty_db');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
};

run();
