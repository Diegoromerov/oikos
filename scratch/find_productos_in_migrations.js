// backend/scratch/find_productos_in_migrations.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../backend/migrations');
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  files.forEach(f => {
    const p = path.join(dir, f);
    const content = fs.readFileSync(p, 'utf8');
    if (content.toLowerCase().includes('productos')) {
      console.log(`🔍 Encontrado 'productos' en migración: ${f}`);
    }
  });
} else {
  console.log('No existe la carpeta migrations.');
}
