const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

jest.setTimeout(30000);

describe('FR-05: deactivated stores', () => {
  const tag = `T${Date.now()}`;
  let managerToken, storeId, productId;

  beforeAll(async () => {
    managerToken = (await loginAs('admin', 'admin123')).body.token;
    const [s] = await db.execute(
      'INSERT INTO Stores (store_name, location, manager_name, opened_date, is_active) VALUES (?,?,?,CURDATE(),0)',
      [`Closed Store ${tag}`, 'Test', 'Test']
    );
    storeId = s.insertId;
    const [p] = await db.execute(
      'INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES (?,?,?,?,?)',
      [`Store Rule Fixture ${tag}`, 'Test', 100, 10, 0]
    );
    productId = p.insertId;
  });

  afterAll(async () => {
    if (storeId) await db.execute('DELETE FROM Stores WHERE store_id = ?', [storeId]);
    if (productId) await db.execute('DELETE FROM Products WHERE product_id = ?', [productId]);
  });

  const sell = (store_id) =>
    request(app).post('/api/sales').set('Authorization', `Bearer ${managerToken}`)
      .send({ store_id, product_id: productId, quantity: 1 });

  test('ST-30: A deactivated store cannot record new sales, and stock is untouched', async () => {
    const res = await sell(storeId);
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch(/deactivated/i);

    const [[row]] = await db.execute('SELECT stock_level FROM Products WHERE product_id = ?', [productId]);
    expect(row.stock_level).toBe(10);
  });

  test('ST-31: A reactivated store can record sales again', async () => {
    const reactivate = await request(app).patch(`/api/stores/${storeId}/activate`).set('Authorization', `Bearer ${managerToken}`);
    expect(reactivate.statusCode).toBe(200);

    const res = await sell(storeId);
    expect(res.statusCode).toBe(201);

    // Remove the test sale so it never appears in reports
    await db.execute('DELETE FROM SaleItems WHERE transaction_id = ?', [res.body.transaction_id]);
    await db.execute('DELETE FROM SaleTransactions WHERE transaction_id = ?', [res.body.transaction_id]);
  });

  test('ST-32: Selling to a store that does not exist returns a clean error', async () => {
    const res = await sell(99999999);
    expect(res.statusCode).toBe(404);
  });
});