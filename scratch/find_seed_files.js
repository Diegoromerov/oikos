// backend/scratch/find_seed_files.js
const fs = require('fs');
const path = require('path');

const runSeedPath = path.join(__dirname, '../run_seed.js');
if (fs.existsSync(runSeedPath)) {
  const content = fs.readFileSync(runSeedPath, 'utf8');
  console.log('--- run_seed.js contents ---');
  console.log(content.substring(0, 1000));
}

const railwaySeedPath = path.join(__dirname, '../railway_seed.sql');
if (fs.existsSync(railwaySeedPath)) {
  const content = fs.readFileSync(railwaySeedPath, 'utf8');
  console.log('--- railway_seed.sql contents ---');
  console.log(content.substring(0, 1000));
}
