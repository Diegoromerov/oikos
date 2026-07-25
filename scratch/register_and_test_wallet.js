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
      path: u.pathname + (u.search || ''),
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
  const email = `test_provider_${Date.now()}@test.com`;
  const password = 'password123';
  try {
    console.log(`Registering provider: ${email}...`);
    const regRes = await post('https://belleza-app-production.up.railway.app/api/auth/register', {
      full_name: 'Test Provider Auto',
      email,
      password,
      phone: `+573${Math.floor(100000000 + Math.random() * 900000000)}`,
      role: 'PRESTADOR'
    });
    console.log('Register Status:', regRes.statusCode);
    console.log('Register Data:', regRes.data);

    if (regRes.statusCode !== 201 && regRes.statusCode !== 200) {
      console.error('Registration failed.');
      return;
    }

    console.log('Logging in...');
    const loginRes = await post('https://belleza-app-production.up.railway.app/api/auth/login', {
      email,
      password
    });
    console.log('Login Status:', loginRes.statusCode);
    if (loginRes.statusCode !== 200) {
      console.error('Login failed.');
      return;
    }
    const token = loginRes.data.token;

    console.log('Fetching wallet...');
    const walletRes = await get('https://belleza-app-production.up.railway.app/api/wallet', token);
    console.log('Wallet Status:', walletRes.statusCode);
    console.log('Wallet Data:', walletRes.data);

    console.log('Fetching transactions...');
    const txRes = await get('https://belleza-app-production.up.railway.app/api/wallet/transactions?page=1&limit=15', token);
    console.log('Transactions Status:', txRes.statusCode);
    console.log('Transactions Data:', txRes.data);

  } catch (e) {
    console.error('Error during workflow:', e);
  }
}
run();
