// backend/scratch/apply_022.js
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
    console.log('✅ Connected to Railway DB for Migration 022');
    const migrationPath = path.join(__dirname, '../migrations/022_fintech_and_compliance_modifications.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migration 022 applied successfully to Railway DB');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration 022 failed:', err);
    process.exit(1);
  }
};

run();
