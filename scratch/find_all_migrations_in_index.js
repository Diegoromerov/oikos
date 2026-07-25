// backend/scratch/find_all_migrations_in_index.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const lines = content.split('\n');

console.log('🔍 Buscando todas las rutas de migraciones ejecutadas en index.js...');
lines.forEach((line, index) => {
  if (line.includes('migrations/')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
