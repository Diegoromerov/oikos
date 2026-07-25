// backend/scratch/find_filter_providers.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../../frontend/lib/main.dart'), 'utf8');
const lines = content.split('\n');

let startIndex = -1;
let openBrackets = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('void _filterProviders(')) {
    startIndex = i;
    break;
  }
}

if (startIndex !== -1) {
  console.log(`Found _filterProviders at line ${startIndex + 1}:`);
  for (let i = startIndex; i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
    if (lines[i].includes('{')) {
      openBrackets += (lines[i].match(/{/g) || []).length;
    }
    if (lines[i].includes('}')) {
      openBrackets -= (lines[i].match(/}/g) || []).length;
      if (openBrackets === 0) {
        break;
      }
    }
  }
} else {
  console.log('_filterProviders not found');
}
