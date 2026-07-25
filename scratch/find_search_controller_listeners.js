// backend/scratch/find_search_controller_listeners.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../../frontend/lib/main.dart'), 'utf8');
const lines = content.split('\n');

console.log('🔍 Buscando referencias a _searchController...');

lines.forEach((line, index) => {
  if (line.includes('_searchController') && (line.includes('addListener') || line.includes('initState') || line.includes('dispose'))) {
    console.log(`Línea ${index + 1}: ${line.trim()}`);
  }
});
