// api.cors.test.js
const request = require('supertest');
const app = require('../index');

describe('CORS configuration', () => {
  const endpoint = '/api/health';
  test('should allow origin from production Railway URL', async () => {
    const response = await request(app)
      .get(endpoint)
      .set('Origin', 'https://belleza-app-production.up.railway.app')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://belleza-app-production.up.railway.app');
  });

  test('should allow request with no Origin (curl/Postman)', async () => {
    const response = await request(app)
      .get(endpoint)
      .expect(200);
    // When no origin, CORS middleware should pass without error
    expect(response.body).toHaveProperty('status');
  });
});
