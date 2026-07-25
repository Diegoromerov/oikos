// backend/scratch/check_users.js
const { pool } = require('../src/config/db');

async function check() {
  try {
    console.log('Querying schema of usuarios table...');
    const schemaRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'usuarios'
    `);
    console.table(schemaRes.rows);

    console.log('Querying all users...');
    const res = await pool.query('SELECT * FROM usuarios LIMIT 30');
    console.log('--- USUARIOS EN BASE DE DATOS ---');
    console.table(res.rows);
  } catch (err) {
    console.error('Error querying users:', err);
  } finally {
    pool.end();
  }
}

check();
