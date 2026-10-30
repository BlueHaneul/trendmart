const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

jest.setTimeout(30000);

describe('ANALYTICS: reorder recommendations', () => {
  let managerToken, staffUserId, storeId;
  const fixtureIds = [];
  const ids = {};

  const makeProduct = async (label, stock) => {
    const [r] = await db.execute(
      'INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES (?,?,?,?,?)',
      [`Reorder Test ${label} ${Date.now()}`, 'Test', 100, stock, 0]
    );
    fixtureIds.push(r.insertId);
    return r.insertId;
  };

  // One completed sale 2 days ago of `qty` units: exactly qty/30 units per day over the 30-day window
  const makeSale = async (productId, qty) => {
    const [tx] = await db.execute(
      "INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status) VALUES (?,?,DATE_SUB(NOW(), INTERVAL 2 DAY),?,'Completed')",
      [staffUserId, storeId, qty * 100]
    );
    await db.execute('INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (?,?,?,?)', [tx.insertId, productId, qty, 100]);
  };

  const getRecommendations = (token) =>
    request(app).get('/api/reports/reorder-recommendations').set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const [manager, staff] = await Promise.all([loginAs('admin', 'admin123'), loginAs('staff', 'staff123')]);
    managerToken = manager.body.token;
    staffUserId = staff.body.user.user_id;
    storeId = staff.body.user.assigned_store_id;

    // All sold 30 units => 1 unit/day, so days of stock left equals the stock level
    ids.urgent   = await makeProduct('Urgent', 5);     // 5 days  -> Reorder now,  suggest 30 - 5 = 25
    ids.boundary = await makeProduct('Boundary', 7);   // 7 days  -> Reorder now (7 is inclusive)
    ids.soon     = await makeProduct('Soon', 10);      // 10 days -> Reorder soon, suggest 30 - 10 = 20
    ids.healthy  = await makeProduct('Healthy', 100);  // 100 days -> Healthy, nothing to order
    ids.idle     = await makeProduct('Idle', 20);      // no sales -> No recent sales
    for (const key of ['urgent', 'boundary', 'soon', 'healthy']) await makeSale(ids[key], 30);
  });

  afterAll(async () => {
    for (const id of fixtureIds) {
      const [txs] = await db.execute('SELECT DISTINCT transaction_id FROM SaleItems WHERE product_id = ?', [id]);
      await db.execute('DELETE FROM SaleItems WHERE product_id = ?', [id]);
      for (const t of txs) await db.execute('DELETE FROM SaleTransactions WHERE transaction_id = ?', [t.transaction_id]);
      await db.execute('DELETE FROM Products WHERE product_id = ?', [id]);
    }
  });

  test('ST-18: Status and suggested quantity follow the 7/14/30-day rules', async () => {
    const res = await getRecommendations(managerToken);
    expect(res.statusCode).toBe(200);
    const byId = Object.fromEntries(res.body.items.map((i) => [i.product_id, i]));

    expect(byId[ids.urgent]).toMatchObject({ status: 'Reorder now', days_left: 5, suggested_reorder_qty: 25 });
    expect(byId[ids.boundary].status).toBe('Reorder now');
    expect(byId[ids.soon]).toMatchObject({ status: 'Reorder soon', days_left: 10, suggested_reorder_qty: 20 });
    expect(byId[ids.healthy]).toMatchObject({ status: 'Healthy', suggested_reorder_qty: 0 });
    expect(byId[ids.idle].status).toBe('No recent sales');
  });

  test('ST-19: Recommendations are ordered most urgent first', async () => {
    const res = await getRecommendations(managerToken);
    const order = res.body.items.map((i) => i.product_id);
    expect(order.indexOf(ids.urgent)).toBeLessThan(order.indexOf(ids.soon));
    expect(order.indexOf(ids.soon)).toBeLessThan(order.indexOf(ids.healthy));
    expect(order.indexOf(ids.healthy)).toBeLessThan(order.indexOf(ids.idle));
  });

  test('ST-20: Only a Manager can view reorder recommendations', async () => {
    const [staff, sysadmin] = await Promise.all([loginAs('staff', 'staff123'), loginAs('sysadmin', 'sysadmin123')]);
    for (const login of [staff, sysadmin]) {
      const res = await getRecommendations(login.body.token);
      expect(res.statusCode).toBe(403);
    }
  });
});