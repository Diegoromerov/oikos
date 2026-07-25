// backend/scratch/apply_005.js
const { pool } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

const run = async () => {
  try {
    const migrationPath = path.join(__dirname, '../migrations/005_add_terminos_acceptance.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
    console.log('✅ Migration 005 applied successfully to beauty_db');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

run();

