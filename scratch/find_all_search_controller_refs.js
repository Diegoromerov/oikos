// backend/scratch/find_all_search_controller_refs.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../../frontend/lib/main.dart'), 'utf8');
const lines = content.split('\n');

console.log('🔍 Buscando referencias generales a _searchController...');

lines.forEach((line, index) => {
  if (line.includes('_searchController')) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
