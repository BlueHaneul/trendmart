/**
 * Builds the TrendMart database from scratch with one command (NFR-05).
 *
 *   npm run db:setup                         create the database, tables and demo data
 *   npm run db:setup -- --reset --yes        drop the database first, then rebuild it (destroys everything in it)
 *   npm run db:setup -- --no-sample-sales    skip the sample transactions
 *
 * Uses DB_HOST, DB_USER, DB_PASSWORD and DB_NAME from .env. Setting DB_NAME to another name builds a separate copy,
 * for example to run the automated tests against a brand-new database.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const flag = (name) => process.argv.includes(`--${name}`);

// ── Demo data ─────────────────────────────────────────────────────────────────
const STORES = [
  ['TrendMart Kimberley',    'Kimberley, Northern Cape', 'Thabo Molefe',       '0531234567', 'kimberley@trendmart.co.za',    '2024-01-15'],
  ['TrendMart Upington',     'Upington, Northern Cape',  'Naledi Mokoena',     '0541234567', 'upington@trendmart.co.za',     '2024-03-10'],
  ['TrendMart Bloemfontein', 'Bloemfontein, Free State', 'Pieter Botha',       '0511234567', 'bloemfontein@trendmart.co.za', '2024-05-22'],
  ['TrendMart Polokwane',    'Polokwane, Limpopo',       'Rethabile Mahlangu', '0151234567', 'polokwane@trendmart.co.za',    '2024-07-08'],
  ['TrendMart Sandton',      'Sandton, Gauteng',         'Lerato Dlamini',     '0111234567', 'sandton@trendmart.co.za',      '2024-09-02'],
];

// username, demo password, full name, role, email, index into STORES (null = not tied to a store)
const USERS = [
  ['sysadmin', 'sysadmin123', 'System Administrator', 'SystemAdmin', 'sysadmin@trendmart.co.za', null],
  ['admin',    'admin123',    'Store Manager',        'Manager',     'admin@trendmart.co.za',    null],
  ['staff',    'staff123',    'Jane Staff',           'Staff',       'staff@trendmart.co.za',    0],
  ['staff2',   'staff123',    'Naledi Staff',         'Staff',       'staff2@trendmart.co.za',   1],
  ['staff3',   'staff123',    'Pieter Staff',         'Staff',       'staff3@trendmart.co.za',   2],
];

// name, category, price, stock, minimum stock. Two products start below their minimum so the Dashboard alert is visible.
const PRODUCTS = [
  ['Wireless Mouse',              'Electronics',     249.99,   60, 10],
  ['Cotton T-Shirt',              'Clothing',        149.99,  200, 20],
  ['Samsung Galaxy A35',          'Electronics',    6999.00,   70, 10],
  ['Sony WH-1000XM5 Headphones',  'Electronics',    7499.00,   40,  8],
  ['Nike Air Max 270',            'Footwear',       2499.00,   80, 15],
  ['Adidas Ultraboost 23',        'Footwear',       3299.00,   60, 15],
  ['Dyson V12 Vacuum',            'Home Appliances', 12999.00, 25,  5],
  ['Kenwood Chef Stand Mixer',    'Home Appliances', 8499.00,  30,  5],
  ['Levis Jeans',                 'Clothing',       2599.00,   50, 10],
  ['Nike Air Max 97',             'Footwear',       2800.00,   90, 10],
  ['Gucci Bucket Hat',            'Clothing',       5000.00,    4, 10],
  ['Oraimo Watch',                'Electronics',    1200.00,    6, 10],
];

// Small repeatable random generator, so every setup produces the same sample sales pattern
function seededRandom(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedSampleSales(conn, storeIds, sellerByStore, managerId, products) {
  const random = seededRandom(42);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const transactions = [];
  const lines = [];
  for (let i = 0; i < 240; i++) {
    const storeId = pick(storeIds);
    const sellerId = sellerByStore.get(storeId) ?? managerId;   // the store's staff member, or the Manager if it has none
    const product = pick(products);
    const qty = 1 + Math.floor(random() * 3);
    const when = new Date();
    when.setDate(when.getDate() - Math.floor(random() * 45));          // spread over the last 45 days
    when.setHours(9 + Math.floor(random() * 9), Math.floor(random() * 60), 0, 0);
    if (when > new Date()) when.setTime(Date.now() - 60000);           // never in the future
    const status = random() < 0.05 ? 'Cancelled' : 'Completed';
    transactions.push([sellerId, storeId, when, Math.round(product.price * qty * 100) / 100, status]);
    lines.push({ product, qty });
  }
  // One multi-row INSERT gives its rows consecutive ids starting at insertId
  const [res] = await conn.query(
    'INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status) VALUES ?', [transactions]
  );
  const items = lines.map((l, i) => [res.insertId + i, l.product.id, l.qty, l.product.price]);
  await conn.query('INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES ?', [items]);
  return transactions.length;
}

async function seedDemoData(conn, withSales) {
  const storeIds = [];
  for (const store of STORES) {
    const [r] = await conn.execute(
      'INSERT INTO Stores (store_name, location, manager_name, phone, email, opened_date) VALUES (?,?,?,?,?,?)', store
    );
    storeIds.push(r.insertId);
  }

  const sellerByStore = new Map();   // store id -> its Sales Staff user id
  let managerId = null;
  for (const [username, password, fullName, role, email, storeIndex] of USERS) {
    const hash = await bcrypt.hash(password, 12);
    const storeId = storeIndex === null ? null : storeIds[storeIndex];
    const [r] = await conn.execute(
      'INSERT INTO Users (username, password_hash, full_name, role, email, assigned_store_id) VALUES (?,?,?,?,?,?)',
      [username, hash, fullName, role, email, storeId]
    );
    if (role === 'Staff') sellerByStore.set(storeId, r.insertId);
    if (role === 'Manager') managerId = r.insertId;
  }

  const products = [];
  for (const [name, category, price, stock, minStock] of PRODUCTS) {
    const [r] = await conn.execute(
      'INSERT INTO Products (product_name, category, price, stock_level, min_stock_level) VALUES (?,?,?,?,?)',
      [name, category, price, stock, minStock]
    );
    products.push({ id: r.insertId, price });
  }

  const sales = withSales ? await seedSampleSales(conn, storeIds, sellerByStore, managerId, products) : 0;
  console.log(`Loaded demo data: ${STORES.length} stores, ${USERS.length} users, ${PRODUCTS.length} products, ${sales} sample sales.`);
}

async function main() {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_NAME || !/^[A-Za-z0-9_]+$/.test(DB_NAME))
    throw new Error('DB_NAME in .env must contain only letters, numbers and underscores.');
  if (flag('reset') && !flag('yes'))
    throw new Error(`--reset deletes the whole "${DB_NAME}" database. Add --yes to confirm.`);

  const conn = await mysql.createConnection({ host: DB_HOST, user: DB_USER, password: DB_PASSWORD, multipleStatements: true });
  try {
    if (flag('reset')) {
      await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
      console.log(`Dropped database ${DB_NAME}.`);
    }
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${DB_NAME}\``);

    const [tables] = await conn.query('SHOW TABLES');
    if (tables.length > 0)
      throw new Error(`Database "${DB_NAME}" already has tables. Use --reset --yes to rebuild it, or set a different DB_NAME.`);

    await conn.query(fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8'));
    console.log(`Created tables and indexes in ${DB_NAME}.`);

    await seedDemoData(conn, !flag('no-sample-sales'));

    console.log('\nDemo accounts (change these passwords before any real use):');
    for (const [username, password, , role] of USERS) console.log(`  ${username.padEnd(10)} ${password.padEnd(12)} ${role}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => { console.error(`\nDatabase setup stopped: ${err.message}`); process.exit(1); });