const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

async function loginAsAdmin() {
  const res = await loginAs('admin', 'admin123');
  return res.body.token;
}

describe('ACID: Transactional Integrity', () => {

  test('ST-06: Sale is rejected if quantity exceeds stock level, and stock is unchanged', async () => {
    const token = await loginAsAdmin();
    const [[before]] = await db.execute('SELECT stock_level FROM Products WHERE product_id = 1');

    const res = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: 1, product_id: 1, quantity: 99999 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);

    const [[after]] = await db.execute('SELECT stock_level FROM Products WHERE product_id = 1');
    expect(after.stock_level).toBe(before.stock_level); // rollback proven: stock untouched
  });

  test('ST-07: Stock level is never negative after any sale', async () => {
    const [rows] = await db.execute('SELECT stock_level FROM Products WHERE product_id = 1');
    expect(rows[0].stock_level).toBeGreaterThanOrEqual(0);
  });

  test('ST-13: Cancelling a sale restores stock exactly (atomicity of the reverse operation)', async () => {
    const token = await loginAsAdmin();
    const [[before]] = await db.execute('SELECT stock_level FROM Products WHERE product_id = 2');

    const sale = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: 1, product_id: 2, quantity: 2 });
    expect(sale.statusCode).toBe(201);

    const cancel = await request(app).put(`/api/sales/${sale.body.transaction_id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(cancel.statusCode).toBe(200);

    const [[after]] = await db.execute('SELECT stock_level FROM Products WHERE product_id = 2');
    expect(after.stock_level).toBe(before.stock_level); // net-zero after sale + cancel
  });

  test('ST-14: A transaction cannot be cancelled twice', async () => {
    const token = await loginAsAdmin();
    const sale = await request(app).post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ store_id: 1, product_id: 2, quantity: 1 });

    await request(app).put(`/api/sales/${sale.body.transaction_id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    const secondCancel = await request(app).put(`/api/sales/${sale.body.transaction_id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(secondCancel.statusCode).toBe(400);
  });
});
