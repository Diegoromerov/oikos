// backend/scratch/find_productos_table.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../');
const files = ['backend/schema.sql', 'backend/init.sql', 'backend/seed.sql', 'backend/railway_seed.sql'];

files.forEach(f => {
  const p = path.join(dir, f);
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    if (content.toLowerCase().includes('productos')) {
      console.log(`🔍 Encontrado 'productos' en ${f}`);
    }
  }
});
