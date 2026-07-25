// backend/scratch/find_payment_flow.js
const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'build' && file !== '.dart_tool') {
        searchDir(fullPath, query);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.dart') || file.endsWith('.sql')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.toLowerCase().includes(query.toLowerCase())) {
          console.log(`Found "${query}" in: ${fullPath}`);
        }
      }
    }
  }
}

console.log('Searching for payment / pago refs in backend...');
searchDir(path.join(__dirname, '../'), 'pago');
searchDir(path.join(__dirname, '../'), 'payment');

console.log('\nSearching for payment / pago refs in frontend...');
searchDir(path.join(__dirname, '../../frontend/lib'), 'pago');
searchDir(path.join(__dirname, '../../frontend/lib'), 'payment');
