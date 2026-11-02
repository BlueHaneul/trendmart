const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

jest.setTimeout(30000);

describe('FR-07: transaction search and filters', () => {
  const tag = `T${Date.now()}`;
  const category = `Cat${tag}`;
  const txIds = [];
  const productIds = [];
  let managerToken, staffToken, staffUserId, staffStoreId, otherStoreId, widgetId, gadgetId, today, oneAgo, fiveAgo;

  const sales = (query, token = managerToken) =>
    request(app).get(`/api/sales?${query}`).set('Authorization', `Bearer ${token}`);

  const addProduct = async (name, cat) => {
    const [r] = await db.execute(
      'INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES (?,?,?,?,?)',
      [name, cat, 100, 100, 0]
    );
    productIds.push(r.insertId);
    return r.insertId;
  };

  const addSale = async (productId, storeId, daysAgo) => {
    const [tx] = await db.execute(
      `INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status)
       VALUES (?,?,DATE_SUB(NOW(), INTERVAL ${daysAgo} DAY),100,'Completed')`,
      [staffUserId, storeId]
    );
    await db.execute('INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (?,?,1,100)', [tx.insertId, productId]);
    txIds.push(tx.insertId);
  };

  beforeAll(async () => {
    const [manager, staff] = await Promise.all([loginAs('admin', 'admin123'), loginAs('staff', 'staff123')]);
    managerToken = manager.body.token;
    staffToken = staff.body.token;
    staffUserId = staff.body.user.user_id;
    staffStoreId = staff.body.user.assigned_store_id;

    const [[other]] = await db.execute('SELECT store_id FROM Stores WHERE store_id <> ? AND is_active = 1 LIMIT 1', [staffStoreId]);
    otherStoreId = other.store_id;

    // Dates come from MySQL so the test and the filters always agree on what "today" is
    const [[d]] = await db.execute(
      `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
              DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '%Y-%m-%d') AS oneAgo,
              DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 DAY), '%Y-%m-%d') AS fiveAgo`
    );
    ({ today, oneAgo, fiveAgo } = d);

    widgetId = await addProduct(`Filter Widget ${tag}`, category);
    gadgetId = await addProduct(`Other Gadget ${tag}`, `Other${tag}`);

    await addSale(widgetId, staffStoreId, 10);  // old sale, staff's store
    await addSale(widgetId, staffStoreId, 1);   // yesterday, staff's store
    await addSale(widgetId, otherStoreId, 0);   // today, another store
    await addSale(gadgetId, staffStoreId, 0);   // today, other product and category
  });

  afterAll(async () => {
    for (const id of txIds) {
      await db.execute('DELETE FROM SaleItems WHERE transaction_id = ?', [id]);
      await db.execute('DELETE FROM SaleTransactions WHERE transaction_id = ?', [id]);
    }
    for (const id of productIds) await db.execute('DELETE FROM Products WHERE product_id = ?', [id]);
  });

  test('ST-27: Filters combine: category, partial product text, store and date range', async () => {
    expect((await sales(`category=${category}`)).body.length).toBe(3);
    expect((await sales(`product=${encodeURIComponent(`Widget ${tag}`)}`)).body.length).toBe(3);   // partial match
    expect((await sales(`product=${tag}`)).body.length).toBe(4);                                    // matches both products

    expect((await sales(`category=${category}&start_date=${fiveAgo}`)).body.length).toBe(2);        // excludes the 10-day-old sale
    expect((await sales(`category=${category}&start_date=${fiveAgo}&end_date=${oneAgo}`)).body.length).toBe(1);
    expect((await sales(`category=${category}&store_id=${otherStoreId}`)).body.length).toBe(1);
    expect((await sales(`category=${category}&date=${today}`)).body.length).toBe(1);

    // A literal % typed by the user must not behave as a wildcard
    expect((await sales('product=%25')).body.length).toBe(0);
  });

  test('ST-28: Staff stay limited to their own store, whatever filters they send', async () => {
    const res = await sales(`category=${category}&store_id=${otherStoreId}`, staffToken);   // tries to peek at another store
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every((row) => row.store_id === staffStoreId)).toBe(true);
  });

  test('ST-29: Invalid filter values are rejected with a clear error', async () => {
    const reversed = await sales(`start_date=${today}&end_date=${fiveAgo}`);
    expect(reversed.statusCode).toBe(400);
    expect(reversed.body.message).toMatch(/on or before/i);

    const badFormat = await sales('start_date=10-01-2026');
    expect(badFormat.statusCode).toBe(400);
  });
});