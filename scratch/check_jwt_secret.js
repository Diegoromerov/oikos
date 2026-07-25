// backend/scratch/check_jwt_secret.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getJwtSecret } = require('../src/config/jwt');

const secret = getJwtSecret();
console.log('Secret length:', secret.length);
console.log('Secret (escaped):', JSON.stringify(secret));
console.log('Secret (raw):', secret);
