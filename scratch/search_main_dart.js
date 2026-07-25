// backend/scratch/search_main_dart.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../../frontend/lib/main.dart'), 'utf8');
const lines = content.split('\n');

console.log('🔍 Buscando referencias interesantes en main.dart...');

lines.forEach((line, index) => {
  if (line.includes('academy') || line.includes('school') || line.includes('support') || line.includes('NavigationRail') || line.includes('Positioned') || line.includes('Row') || line.includes('Icon(')) {
    if (line.includes('/support') || line.includes('academy') || line.includes('Icons.')) {
      console.log(`Línea ${index + 1}: ${line.trim()}`);
    }
  }
});
