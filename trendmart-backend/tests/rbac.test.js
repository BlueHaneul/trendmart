const request = require('supertest');
const app     = require('../server');
const { loginAs } = require('./helpers');

describe('RBAC: Ownership rules on cancellation', () => {

  test("ST-15: Staff cannot cancel another user's transaction", async () => {
    const adminLogin = await loginAs('admin', 'admin123');
    const sale = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ store_id: 1, product_id: 2, quantity: 1 });

    const staffLogin = await request(app).post('/api/auth/login').send({ username: 'staff', password: 'staff123' });
    const res = await request(app).put(`/api/sales/${sale.body.transaction_id}/cancel`)
      .set('Authorization', `Bearer ${staffLogin.body.token}`);

    expect(res.statusCode).toBe(403);
  });
});
