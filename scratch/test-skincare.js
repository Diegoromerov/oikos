// scratch/test-skincare.js
const http = require('http');

console.log('📡 Consultando http://127.0.0.1:3000/api/trends/skincare?periodo=30d...');

http.get('http://127.0.0.1:3000/api/trends/skincare?periodo=30d', (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Respuesta:', data);
  });
}).on('error', (err) => {
  console.error('❌ Error:', err.message);
});
