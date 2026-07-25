// backend/scratch/apply_006.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:3d3aB6gecf1dcCdB653CGD2dee23dG4A@caboose.proxy.rlwy.net:18931/railway';

const run = async () => {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Railway DB for Migration 006');
    const migrationPath = path.join(__dirname, '../migrations/006_legal_architecture_pila_consignacion.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migration 006 (Legal & PILA) applied successfully to Railway DB');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration 006 failed:', err);
    process.exit(1);
  }
};

run();
