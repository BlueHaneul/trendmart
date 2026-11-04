const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

jest.setTimeout(30000);

describe('FR-09: cancellation is limited to the day of the sale', () => {
  const tag = `T${Date.now()}`;
  let managerToken, staffUserId, storeId, productId, txId;

  beforeAll(async () => {
    const [manager, staff] = await Promise.all([loginAs('admin', 'admin123'), loginAs('staff', 'staff123')]);
    managerToken = manager.body.token;
    staffUserId = staff.body.user.user_id;
    storeId = staff.body.user.assigned_store_id;

    const [p] = await db.execute(
      'INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES (?,?,?,?,?)',
      [`Cancel Rule Fixture ${tag}`, 'Test', 100, 5, 0]
    );
    productId = p.insertId;

    // A completed sale made yesterday
    const [tx] = await db.execute(
      "INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status) VALUES (?,?,DATE_SUB(NOW(), INTERVAL 1 DAY),100,'Completed')",
      [staffUserId, storeId]
    );
    txId = tx.insertId;
    await db.execute('INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (?,?,1,100)', [txId, productId]);
  });

  afterAll(async () => {
    if (txId) {
      await db.execute('DELETE FROM SaleItems WHERE transaction_id = ?', [txId]);
      await db.execute('DELETE FROM SaleTransactions WHERE transaction_id = ?', [txId]);
    }
    if (productId) await db.execute('DELETE FROM Products WHERE product_id = ?', [productId]);
  });

  test('ST-33: A transaction from a previous day cannot be cancelled, even by a Manager', async () => {
    const res = await request(app).put(`/api/sales/${txId}/cancel`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/today/i);

    const [[row]] = await db.execute('SELECT status FROM SaleTransactions WHERE transaction_id = ?', [txId]);
    expect(row.status).toBe('Completed');                 // unchanged

    const [[stock]] = await db.execute('SELECT stock_level FROM Products WHERE product_id = ?', [productId]);
    expect(stock.stock_level).toBe(5);                    // stock untouched
  });
});