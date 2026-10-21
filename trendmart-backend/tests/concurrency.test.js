const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

jest.setTimeout(30000);

// Fires several sale requests at the same instant against one product and checks that the
// database serialises them: never more sales than stock, and stock never goes negative.
describe('CONCURRENCY: simultaneous sales of limited stock', () => {
  let productId, tokenA, storeA, tokenB, storeB;

  beforeAll(async () => {
    // staff and staff2 come from the seed script; adjust here if your accounts differ
    const [a, b] = await Promise.all([loginAs('staff', 'staff123'), loginAs('staff2', 'staff123')]);
    tokenA = a.body.token; storeA = a.body.user.assigned_store_id;
    tokenB = b.body.token; storeB = b.body.user.assigned_store_id;

    // Dedicated fixture product, so the test never touches real stock
    const [result] = await db.execute(
      'INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES (?,?,?,?,?)',
      [`Concurrency Test Item ${Date.now()}`, 'Test', 100, 1, 0]
    );
    productId = result.insertId;
  });

  afterAll(async () => {
    if (!productId) return;
    // Remove the test sales so they never appear in reports, then the fixture product itself
    const [txs] = await db.execute('SELECT DISTINCT transaction_id FROM SaleItems WHERE product_id = ?', [productId]);
    await db.execute('DELETE FROM SaleItems WHERE product_id = ?', [productId]);
    for (const t of txs) await db.execute('DELETE FROM SaleTransactions WHERE transaction_id = ?', [t.transaction_id]);
    await db.execute('DELETE FROM Products WHERE product_id = ?', [productId]);
  });

  const setStock = (n) => db.execute('UPDATE Products SET stock_level = ? WHERE product_id = ?', [n, productId]);
  const stock = async () => (await db.execute('SELECT stock_level FROM Products WHERE product_id = ?', [productId]))[0][0].stock_level;
  const soldCount = async () => Number((await db.execute('SELECT COUNT(*) AS n FROM SaleItems WHERE product_id = ?', [productId]))[0][0].n);
  const buy = (token, store) =>
    request(app).post('/api/sales').set('Authorization', `Bearer ${token}`)
      .send({ store_id: store, product_id: productId, quantity: 1 });

  test('ST-16: Two staff buying the last unit at the same instant - exactly one succeeds', async () => {
    await setStock(1);
    const before = await soldCount();

    const [resA, resB] = await Promise.all([buy(tokenA, storeA), buy(tokenB, storeB)]);

    expect([resA.statusCode, resB.statusCode].sort()).toEqual([201, 400]); // one winner, one clean rejection
    const loser = resA.statusCode === 400 ? resA : resB;
    expect(loser.body.message).toMatch(/insufficient stock/i);

    expect(await stock()).toBe(0);                    // stock never goes negative
    expect((await soldCount()) - before).toBe(1);     // one sale recorded, not two
  });

  test('ST-17: Five simultaneous buyers, three units in stock - exactly three succeed', async () => {
    await setStock(3);
    const before = await soldCount();

    const results = await Promise.all([
      buy(tokenA, storeA), buy(tokenB, storeB), buy(tokenA, storeA), buy(tokenB, storeB), buy(tokenA, storeA),
    ]);

    expect(results.filter((r) => r.statusCode === 201).length).toBe(3);
    expect(results.filter((r) => r.statusCode === 400).length).toBe(2);
    expect(await stock()).toBe(0);
    expect((await soldCount()) - before).toBe(3);
  });
});