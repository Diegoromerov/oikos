// api.upload_image.test.js
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../index');

describe('POST /api/upload', () => {
  const endpoint = '/api/upload';

  test('should upload a valid PNG image and return URL', async () => {
    const pngPath = path.join(__dirname, 'test_image.png');
    // create a tiny PNG file if not exists
    if (!fs.existsSync(pngPath)) {
      // simple 1x1 pixel PNG base64
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/5+BFwAJgwP/9i0wWQAAAABJRU5ErkJggg==';
      fs.writeFileSync(pngPath, Buffer.from(pngBase64, 'base64'));
    }
    const response = await request(app)
      .post(endpoint)
      .set('Authorization', 'Bearer dummy-token') // token may be required, but middleware will accept any
      .attach('image', pngPath);
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('url');
    expect(typeof response.body.url).toBe('string');
  });

  test('should reject unsupported file type', async () => {
    const txtPath = path.join(__dirname, 'test.txt');
    fs.writeFileSync(txtPath, 'just a text file');
    const response = await request(app)
      .post(endpoint)
      .set('Authorization', 'Bearer dummy-token')
      .attach('image', txtPath);
    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    // Clean up
    fs.unlinkSync(txtPath);
  });
});
