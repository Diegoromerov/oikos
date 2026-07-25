// backend/scratch/find_build_nav_item.js
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../../frontend/lib/main.dart'), 'utf8');
const lines = content.split('\n');

let startIndex = -1;
let openBrackets = 0;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Widget _buildProminentCenterNavItem') || lines[i].includes('Widget _buildNavItem')) {
    console.log(`Found helper at line ${i + 1}: ${lines[i].trim()}`);
    let brackets = 0;
    for (let j = i; j < lines.length; j++) {
      console.log(`${j + 1}: ${lines[j]}`);
      if (lines[j].includes('{')) brackets += (lines[j].match(/{/g) || []).length;
      if (lines[j].includes('}')) brackets -= (lines[j].match(/}/g) || []).length;
      if (brackets === 0 && j > i) break;
    }
  }
}
