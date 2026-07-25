// backend/scratch/fix_packed_refs.js
const fs = require('fs');
const path = require('path');

const packedRefsPath = path.join(__dirname, '../../.git/packed-refs');

if (fs.existsSync(packedRefsPath)) {
  console.log('📖 Leyendo .git/packed-refs...');
  const content = fs.readFileSync(packedRefsPath, 'utf8');
  const lines = content.split('\n');
  const filteredLines = [];
  let removedCount = 0;

  lines.forEach(line => {
    if (line.includes('refs/remotes/origin/HEAD')) {
      console.log(`❌ Encontrada y removida referencia corrupta: ${line}`);
      removedCount++;
    } else {
      filteredLines.push(line);
    }
  });

  if (removedCount > 0) {
    fs.writeFileSync(packedRefsPath, filteredLines.join('\n'), 'utf8');
    console.log('✅ .git/packed-refs actualizado correctamente.');
  } else {
    console.log('ℹ️ No se encontró refs/remotes/origin/HEAD en packed-refs.');
  }
} else {
  console.log('ℹ️ No existe el archivo .git/packed-refs.');
}
