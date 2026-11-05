/**
 * Performance verification for NFR-04 (and the 2-second search target in FR-07).
 *
 * The backend must be running (npm run dev). Usage:
 *   npm run perf                      measure against the data already in the database
 *   npm run perf -- --seed 5000       first add 5000 synthetic transactions spread over the last 180 days,
 *                                     measure, then remove them again
 *   npm run perf -- --cleanup         remove synthetic data left behind by an interrupted run
 * Options: --users 10 (concurrent virtual users)   --rounds 10 (times each user repeats its tasks)
 *
 * Every figure is the 95th percentile (p95) of server response times: 95% of requests were at least this fast.
 * Browser rendering time is not included. Run it when nobody else is using the system.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const speakeasy = require('speakeasy');
const db = require('../config/db');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] !== undefined ? Number(args[i + 1]) : fallback;
};

const USERS  = option('users', 10);
const ROUNDS = option('rounds', 10);
const SEED   = option('seed', 0);
const BASE   = process.env.PERF_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const SEED_USERNAME = 'perf_seed_user'; // owner of all synthetic transactions, so they can always be found and removed
const WINDOW_DAYS = 180;                // "6 months of transaction data" in NFR-04

// NFR-04 targets, in milliseconds, compared with the 95th percentile
const TARGETS = { 'Normal requests': 3000, 'Filtered searches': 2000, 'Reports': 10000, 'Dashboard': 2000, 'All requests': 3000 };

// ── Statistics ────────────────────────────────────────────────────────────────
const percentile = (sorted, p) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

function summarise(samples) {
  const good = samples.filter((s) => s.ok).map((s) => s.ms).sort((a, b) => a - b);
  return {
    count: samples.length,
    errors: samples.filter((s) => !s.ok).length,
    p50: percentile(good, 50),
    p95: percentile(good, 95),
    max: good.length ? good[good.length - 1] : 0,
  };
}

// ── Synthetic data (optional) ─────────────────────────────────────────────────
async function seedData(count) {
  const [existing] = await db.execute('SELECT user_id FROM Users WHERE username = ?', [SEED_USERNAME]);
  let seedUserId;
  if (existing.length) {
    seedUserId = existing[0].user_id;
  } else {
    // Inactive, so it can never log in
    const [r] = await db.execute(
      "INSERT INTO Users (username, password_hash, full_name, role, is_active) VALUES (?, 'not-a-real-hash', 'Performance Test Data', 'Staff', 0)",
      [SEED_USERNAME]
    );
    seedUserId = r.insertId;
  }

  const [stores]   = await db.execute('SELECT store_id FROM Stores WHERE is_active = 1');
  const [products] = await db.execute('SELECT product_id, price FROM Products WHERE is_active = 1');
  if (!stores.length || !products.length) throw new Error('Seeding needs at least one active store and one active product.');

  const BATCH = 500;
  for (let done = 0; done < count; done += BATCH) {
    const n = Math.min(BATCH, count - done);
    const transactions = [];
    const lines = [];
    for (let i = 0; i < n; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const store = stores[Math.floor(Math.random() * stores.length)];
      const qty = 1 + Math.floor(Math.random() * 3);
      const when = new Date(Date.now() - Math.floor(Math.random() * WINDOW_DAYS * 86400000));
      transactions.push([seedUserId, store.store_id, when, Number(product.price) * qty, 'Completed']);
      lines.push({ product, qty });
    }
    // One multi-row INSERT per batch: MySQL gives its rows consecutive ids starting at insertId
    const [res] = await db.query(
      'INSERT INTO SaleTransactions (user_id, store_id, transaction_date, total_amount, status) VALUES ?', [transactions]
    );
    const items = lines.map((l, i) => [res.insertId + i, l.product.product_id, l.qty, l.product.price]);
    await db.query('INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES ?', [items]);
  }
}

async function removeSeedData() {
  const [rows] = await db.execute('SELECT user_id FROM Users WHERE username = ?', [SEED_USERNAME]);
  if (!rows.length) return 0;
  const id = rows[0].user_id;
  await db.execute(
    'DELETE i FROM SaleItems i JOIN SaleTransactions t ON t.transaction_id = i.transaction_id WHERE t.user_id = ?', [id]
  );
  const [res] = await db.execute('DELETE FROM SaleTransactions WHERE user_id = ?', [id]);
  await db.execute('DELETE FROM Users WHERE user_id = ?', [id]);
  return res.affectedRows;
}

// ── Talking to the running backend ────────────────────────────────────────────
async function assertServerUp() {
  try {
    const res = await fetch(`${BASE}/api/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(`Cannot reach the backend at ${BASE} (${err.message}). Start it first with: npm run dev`);
  }
}

// Same approach as tests/helpers.js: clear any lock, and supply a valid MFA code when the account has MFA on
async function login(username, password) {
  await db.execute('UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?', [username]);
  const [[user]] = await db.execute('SELECT mfa_enabled, mfa_secret FROM Users WHERE username = ?', [username]);
  const mfa_code = user?.mfa_enabled ? speakeasy.totp({ secret: user.mfa_secret, encoding: 'base32' }) : undefined;
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, mfa_code }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`Login failed for ${username}: ${body.message || res.status}`);
  return body.token;
}

async function timed(token, request) {
  const start = performance.now();
  let status = 0;
  let ok = false;
  try {
    const res = await fetch(BASE + request.path, { headers: { Authorization: `Bearer ${token}` } });
    await res.arrayBuffer(); // include the time taken to receive the whole response
    status = res.status;
    ok = res.ok;
  } catch (err) {
    status = 0;
  }
  return { group: request.group, name: request.name, ms: performance.now() - start, ok, status };
}

async function virtualUser(token, tasks, samples) {
  for (let round = 0; round < ROUNDS; round++) {
    for (const request of tasks) samples.push(await timed(token, request));
  }
}

// ── What each kind of user does ───────────────────────────────────────────────
async function loadContext() {
  const [[dates]] = await db.execute(
    `SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today,
            DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ${WINDOW_DAYS} DAY), '%Y-%m-%d') AS sixMonthsAgo,
            DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 30 DAY), '%Y-%m-%d') AS monthAgo`
  );
  const [[sample]] = await db.execute('SELECT product_name, category FROM Products WHERE is_active = 1 ORDER BY product_id LIMIT 1');
  const [[volume]] = await db.execute('SELECT COUNT(*) AS n FROM SaleTransactions WHERE transaction_date >= ?', [dates.sixMonthsAgo]);
  return {
    today: dates.today, from: dates.sixMonthsAgo, monthAgo: dates.monthAgo,
    category: sample.category, fragment: sample.product_name.slice(0, 4), transactions: Number(volume.n),
  };
}

function buildTasks({ today, from, monthAgo, category, fragment }) {
  const searches = [
    { group: 'Filtered searches', name: 'Sales: category + 6-month range', path: `/api/sales?category=${encodeURIComponent(category)}&start_date=${from}&end_date=${today}` },
    { group: 'Filtered searches', name: 'Sales: product text + 30 days', path: `/api/sales?product=${encodeURIComponent(fragment)}&start_date=${monthAgo}` },
    { group: 'Filtered searches', name: 'Sales: 6-month date range', path: `/api/sales?start_date=${from}&end_date=${today}` },
  ];
  const products = { group: 'Normal requests', name: 'Products list', path: '/api/products' };
  const sales    = { group: 'Normal requests', name: 'Sales list (unfiltered)', path: '/api/sales' };
  const daily    = { group: 'Reports', name: 'Daily sales report', path: `/api/reports/daily?date=${today}` };

  return {
    manager: [
      { group: 'Dashboard', name: 'Dashboard', path: '/api/reports/dashboard' },
      { group: 'Reports', name: 'Best sellers (6 months)', path: `/api/reports/best-sellers?start_date=${from}&end_date=${today}` },
      { group: 'Reports', name: 'Store performance (6 months)', path: `/api/reports/store-performance?start_date=${from}&end_date=${today}` },
      daily,
      { group: 'Normal requests', name: 'Advanced analytics', path: '/api/reports/analytics' },
      { group: 'Normal requests', name: 'Reorder recommendations', path: '/api/reports/reorder-recommendations' },
      products, sales, ...searches,
    ],
    staff: [
      products,
      { group: 'Normal requests', name: 'Stores list', path: '/api/stores' },
      sales, daily, searches[0], searches[1],
    ],
  };
}

// ── Report ────────────────────────────────────────────────────────────────────
const pad = (value, width) => String(value).padStart(width);
function row(label, s, target) {
  const pass = s.count > 0 && s.errors === 0 && s.p95 <= target;
  const result = s.errors ? `ERRORS (${s.errors})` : pass ? 'PASS' : 'FAIL';
  return { pass, text: `${label.padEnd(20)}${pad(s.count, 9)}${pad(Math.round(s.p50), 9)}${pad(Math.round(s.p95), 9)}${pad(Math.round(s.max), 9)}${pad(target, 10)}   ${result}` };
}
const HEADER = `${'Group'.padEnd(20)}${pad('Requests', 9)}${pad('p50 ms', 9)}${pad('p95 ms', 9)}${pad('max ms', 9)}${pad('Target', 10)}   Result`;

async function main() {
  if (flag('cleanup')) {
    console.log(`Removed ${await removeSeedData()} synthetic transactions.`);
    return 0;
  }
  if (flag('seed') && !(SEED > 0)) throw new Error('--seed needs a positive number, for example: --seed 5000');

  await assertServerUp();
  let seeded = false;
  try {
    if (SEED > 0) {
      console.log(`Adding ${SEED} synthetic transactions over the last ${WINDOW_DAYS} days...`);
      seeded = true;
      await seedData(SEED);
    }

    const context = await loadContext();
    const tasks = buildTasks(context);
    const managerToken = await login('admin', 'admin123');
    const staffToken   = await login('staff', 'staff123');

    // Warm-up pass (not measured). It also stops the run early if any endpoint is broken.
    for (const [token, list] of [[managerToken, tasks.manager], [staffToken, tasks.staff]]) {
      for (const request of list) {
        const sample = await timed(token, request);
        if (!sample.ok) throw new Error(`Warm-up failed: ${request.name} returned ${sample.status || 'no response'}`);
      }
    }

    const managers = Math.max(1, Math.round(USERS * 0.3)); // about 30% managers, the rest sales staff
    console.log(`Measuring ${USERS} concurrent users (${managers} managers, ${USERS - managers} staff), ${ROUNDS} rounds each...`);
    const samples = [];
    const started = performance.now();
    await Promise.all(Array.from({ length: USERS }, (_, u) =>
      u < managers ? virtualUser(managerToken, tasks.manager, samples) : virtualUser(staffToken, tasks.staff, samples)
    ));
    const seconds = (performance.now() - started) / 1000;

    const lines = [];
    let allPass = true;
    const groups = ['Normal requests', 'Filtered searches', 'Reports', 'Dashboard'];
    for (const g of groups) {
      const r = row(g, summarise(samples.filter((s) => s.group === g)), TARGETS[g]);
      allPass = allPass && r.pass; lines.push(r.text);
    }
    const overall = row('All requests', summarise(samples), TARGETS['All requests']);
    allPass = allPass && overall.pass; lines.push(overall.text);

    const names = [...new Set(samples.map((s) => s.name))];
    const detail = names.map((n) => {
      const s = summarise(samples.filter((x) => x.name === n));
      return `${n.padEnd(34)}${pad(s.count, 9)}${pad(Math.round(s.p50), 9)}${pad(Math.round(s.p95), 9)}${pad(Math.round(s.max), 9)}`;
    });

    const out = [
      'TrendMart performance check (NFR-04, FR-07)',
      `Run: ${new Date().toLocaleString('en-ZA')}`,
      `Backend: ${BASE}`,
      `Load: ${USERS} concurrent users x ${ROUNDS} rounds = ${samples.length} requests in ${seconds.toFixed(1)} s`,
      `Data: ${context.transactions} transactions in the last ${WINDOW_DAYS} days${SEED > 0 ? ` (including ${SEED} synthetic)` : ''}`,
      '',
      HEADER, ...lines, '',
      `${'Request'.padEnd(34)}${pad('Count', 9)}${pad('p50 ms', 9)}${pad('p95 ms', 9)}${pad('max ms', 9)}`, ...detail, '',
      `Overall: ${allPass ? 'ALL TARGETS MET' : 'ONE OR MORE TARGETS NOT MET'}`,
    ].join('\n');

    console.log(`\n${out}`);
    fs.writeFileSync(path.join(__dirname, 'performance-results.txt'), `${out}\n`);
    console.log('\nSaved to scripts/performance-results.txt');
    return allPass ? 0 : 1;
  } finally {
    if (seeded) console.log(`\nRemoved ${await removeSeedData()} synthetic transactions.`);
  }
}

main()
  .then(async (code) => { await db.end(); process.exit(code); })
  .catch((err) => { console.error(`\nPerformance check stopped: ${err.message}`); process.exit(1); });