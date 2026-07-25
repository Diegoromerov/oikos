// scratch/test-trigger.js
const http = require('http');

console.log('📡 Enviando POST a http://localhost:3000/api/trends/trigger...');

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/trends/trigger',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Respuesta:', data);
  });
});

req.on('error', (err) => {
  console.error('❌ Error de conexión:', err.message);
});

req.end();
