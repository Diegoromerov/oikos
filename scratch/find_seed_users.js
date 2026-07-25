// backend/scratch/find_seed_users.js
const fs = require('fs');
const path = require('path');

const initSql = fs.readFileSync(path.join(__dirname, '../init.sql'), 'utf8');
const lines = initSql.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().includes('insert into usuarios')) {
    console.log(`init.sql line ${i + 1}: ${lines[i]}`);
  }
}

const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
const schemaLines = schemaSql.split('\n');
for (let i = 0; i < schemaLines.length; i++) {
  if (schemaLines[i].toLowerCase().includes('insert into usuarios')) {
    console.log(`schema.sql line ${i + 1}: ${schemaLines[i]}`);
  }
}
