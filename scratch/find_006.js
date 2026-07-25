// backend/scratch/find_006.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const lines = content.split('\n');

console.log('🔍 Buscando 006 en index.js...');
lines.forEach((line, index) => {
  if (line.includes('006')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
