// backend/scratch/find_user_refs_sql.js
const fs = require('fs');
const path = require('path');

const initSql = fs.readFileSync(path.join(__dirname, '../init.sql'), 'utf8');
const lines = initSql.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes('usuarios')) {
    console.log(`init.sql line ${i + 1}: ${lines[i]}`);
  }
}
