process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const http = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

async function run() {
  try {
    const res = await get('https://belleza-app-production.up.railway.app/api/providers');
    console.log('Status Code:', res.statusCode);
    console.log('Providers:', res.data);
  } catch (e) {
    console.error(e);
  }
}
run();
