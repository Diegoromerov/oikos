// backend/scratch/check_chat_schema.js
const { pool } = require('../src/config/db');

async function check() {
  try {
    console.log('Querying table names containing "chat" or "message"...');
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%chat%' OR table_name LIKE '%message%' OR table_name LIKE '%mensaje%')
    `);
    console.table(tablesRes.rows);

    // Let's also inspect all table columns of any found tables
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      console.log(`\nColumns of table: ${tableName}`);
      const columnsRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
      `);
      console.table(columnsRes.rows);
    }

  } catch (err) {
    console.error('Error querying chat schema:', err);
  } finally {
    pool.end();
  }
}

check();
