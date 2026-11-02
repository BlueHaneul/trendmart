const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

jest.setTimeout(30000);

describe('FR-04 / FR-05 / FR-08: low-stock alerts and historical store data', () => {
  const tag = `T${Date.now()}`;
  const txIds = [];
  let managerToken, staffUserId, productId, inactiveStoreId, today, weekAgo;

  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${managerToken}`);

  // One completed sale of 1 unit (R100) in the deactivated store, `daysAgo` days back
  const addSale = async (daysAgo) => {
    const [tx] = await db.execute(
      `INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
       VALUES (?,?,DATE_SUB(NOW(), INTERVAL ${daysAgo} DAY),100,'Completed')`,
      [staffUserId, inactiveStoreId]
    );
    await db.execute('INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (?,?,1,100)', [tx.insertId, productId]);
    txIds.push(tx.insertId);
  };

  beforeAll(async () => {
    const [manager, staff] = await Promise.all([loginAs('admin', 'admin123'), loginAs('staff', 'staff123')]);
    managerToken = manager.body.token;
    staffUserId = staff.body.user.user_id;

    // Dates come from MySQL so the test and the reports always agree on what "today" is
    const [[dates]] = await db.execute(
      "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today, DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 7 DAY), '%Y-%m-%d') AS weekAgo"
    );
    today = dates.today;
    weekAgo = dates.weekAgo;

    const [p] = await db.execute(
      'INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES (?,?,?,?,?)',
      [`Alert Fixture ${tag}`, 'Test', 100, 2, 5]   // stock 2 is below its minimum of 5
    );
    productId = p.insertId;

    const [s] = await db.execute(
      'INSERT INTO Stores (store_name, location, manager_name, opened_date, is_active) VALUES (?,?,?,CURDATE(),0)',
      [`Inactive Store ${tag}`, 'Test', 'Test']
    );
    inactiveStoreId = s.insertId;

    await addSale(0);   // today
    await addSale(3);   // three days ago
  });

  afterAll(async () => {
    for (const id of txIds) {
      await db.execute('DELETE FROM SaleItems WHERE transaction_id = ?', [id]);
      await db.execute('DELETE FROM SaleTransactions WHERE transaction_id = ?', [id]);
    }
    if (inactiveStoreId) await db.execute('DELETE FROM Stores WHERE store_id = ?', [inactiveStoreId]);
    if (productId) await db.execute('DELETE FROM Products WHERE product_id = ?', [productId]);
  });

  test('ST-24: Products at or below their minimum stock appear in the Dashboard low-stock alerts', async () => {
    const res = await get('/api/reports/dashboard');
    expect(res.statusCode).toBe(200);
    expect(res.body.low_stock.map((p) => p.product_id)).toContain(productId);

    await db.execute('UPDATE Products SET stock_level = 50 WHERE product_id = ?', [productId]);
    const after = await get('/api/reports/dashboard');
    expect(after.body.low_stock.map((p) => p.product_id)).not.toContain(productId);
  });

  test('ST-25: A deactivated store with sales stays in the historical reports', async () => {
    const daily = await get(`/api/reports/daily?date=${today}`);
    const dailyRow = daily.body.stores.find((s) => s.store_id === inactiveStoreId);
    expect(dailyRow).toBeDefined();
    expect(dailyRow.store_name).toMatch(/\(inactive\)/);
    expect(Number(dailyRow.transaction_count)).toBe(1);

    const perf = await get(`/api/reports/store-performance?start_date=${weekAgo}&end_date=${today}`);
    const perfRow = perf.body.find((s) => s.store_id === inactiveStoreId);
    expect(Number(perfRow.transaction_count)).toBe(2);   // today's sale plus the one from 3 days ago
  });

  test('ST-26: Dashboard per-store revenue covers today only', async () => {
    const res = await get('/api/reports/dashboard');
    const row = res.body.per_store_revenue.find((s) => s.store_name.includes(tag));
    expect(row).toBeDefined();
    expect(Number(row.revenue)).toBe(100);   // today's R100, not R200 including the older sale
  });
});