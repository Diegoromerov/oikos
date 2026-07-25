// backend/scratch/check_startup_migrations.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const lines = content.split('\n');

console.log('🔍 Buscando referencias a migraciones en index.js...');
lines.forEach((line, index) => {
  if (line.includes('migration') || line.includes('migrations') || line.includes('fs.readdirSync') || line.includes('.sql')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
