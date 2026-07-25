process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const http = require('https');

function post(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const options = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
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
    req.write(postData);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
    console.log('Logging in to staging as provider...');
    const loginRes = await post('https://belleza-app-production.up.railway.app/api/auth/login', {
      email: 'maria@correo.com',
      password: 'password123'
    });
    
    console.log('Login Status Code:', loginRes.statusCode);
    if (loginRes.statusCode !== 200) {
      console.log('Login failed:', loginRes.data);
      return;
    }
    
    const token = loginRes.data.token;
    console.log('Login successful!');
    
    console.log('Fetching staging wallet data...');
    const walletRes = await get('https://belleza-app-production.up.railway.app/api/wallet', token);
    
    console.log('Wallet Status Code:', walletRes.statusCode);
    console.log('Wallet Response Data:', walletRes.data);

    console.log('Fetching staging transactions data...');
    const txRes = await get('https://belleza-app-production.up.railway.app/api/wallet/transactions?page=1&limit=15', token);
    
    console.log('Transactions Status Code:', txRes.statusCode);
    console.log('Transactions Response Data:', txRes.data);
  } catch (err) {
    console.error('Error during staging API test:', err);
  }
}

run();
