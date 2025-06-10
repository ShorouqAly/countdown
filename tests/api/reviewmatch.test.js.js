const request = require('supertest');
const app = require('../app');

describe('ReviewMatch API', () => {
  test('GET /api/reviewmatch/products returns products', async () => {
    const response = await request(app)
      .get('/api/reviewmatch/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(response.body.products).toBeDefined();
  });
});