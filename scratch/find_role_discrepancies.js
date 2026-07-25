// backend/scratch/find_role_discrepancies.js
const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

console.log('🔍 Buscando referencias STRICT a "req.user.rol" en src/ ...');

walkDir(path.join(__dirname, '../src'), (filePath) => {
  if (filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    const matchesRol = [];
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      // Usar regex estricto para evitar emparejar "req.user.role"
      if (/req\.user\.rol\b/.test(line)) {
        matchesRol.push({ lineNum: index + 1, text: line.trim() });
      }
    });

    if (matchesRol.length > 0) {
      console.log(`\n📄 Archivo: ${filePath}`);
      console.log('  ❌ req.user.rol (STRICT) encontrado:');
      matchesRol.forEach(m => console.log(`    Línea ${m.lineNum}: ${m.text}`));
    }
  }
});
