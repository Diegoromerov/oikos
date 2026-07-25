// backend/scratch/find_api_urls_frontend.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../frontend/lib');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (file.endsWith('.dart')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const dartFiles = walk(dir);
dartFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('http://') || content.includes('https://') || content.includes('/api/')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('http://') || line.includes('https://') || line.includes('/api/')) {
        console.log(`✨ Encontrado en ${path.basename(f)}:${idx + 1} -> ${line.trim()}`);
      }
    });
  }
});
