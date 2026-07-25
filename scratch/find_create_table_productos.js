// backend/scratch/find_create_table_productos.js
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../../');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.dart_tool') {
        results = results.concat(walk(filePath));
      }
    } else {
      if (file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.dart')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

console.log('🔍 Buscando referencias de CREATE TABLE o inserciones de productos...');
const allFiles = walk(rootDir);

allFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.toLowerCase().includes('create table') && content.toLowerCase().includes('productos')) {
    console.log(`✨ Encontrado CREATE TABLE en: ${filePath}`);
  }
});
