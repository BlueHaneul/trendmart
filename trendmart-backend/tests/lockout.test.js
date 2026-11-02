const request = require('supertest');
const bcrypt  = require('bcryptjs');
const app     = require('../server');
const db      = require('../config/db');

jest.setTimeout(30000);

describe('FR-01: account lockout', () => {
  const username = `lockout_test_${Date.now()}`;
  const password = 'Correct@123';
  let userId;

  beforeAll(async () => {
    const hash = await bcrypt.hash(password, 12);
    const [r] = await db.execute(
      "INSERT INTO Users (username, password_hash, full_name, role) VALUES (?,?,?,'Staff')",
      [username, hash, 'Lockout Test']
    );
    userId = r.insertId;
  });

  afterAll(async () => {
    if (userId) await db.execute('DELETE FROM Users WHERE user_id = ?', [userId]);
  });

  const login = (pw) => request(app).post('/api/auth/login').send({ username, password: pw });

  test('ST-21: Five consecutive failures lock the account, even for the correct password', async () => {
    for (let i = 0; i < 4; i++) expect((await login('wrong')).statusCode).toBe(401);
    expect((await login('wrong')).statusCode).toBe(423);   // the 5th failure triggers the lock

    const locked = await login(password);                   // correct password, but still locked
    expect(locked.statusCode).toBe(423);
    expect(locked.body.message).toMatch(/locked/i);
  });

  test('ST-22: The account works again once the lock expires, and the counter resets', async () => {
    await db.execute('UPDATE Users SET locked_until = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?', [userId]);
    const res = await login(password);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();

    const [[row]] = await db.execute('SELECT failed_login_attempts, locked_until FROM Users WHERE user_id = ?', [userId]);
    expect(row.failed_login_attempts).toBe(0);
    expect(row.locked_until).toBeNull();
  });

  test('ST-23: A successful login resets the failure counter', async () => {
    await login('wrong'); await login('wrong');               // 2 failures
    expect((await login(password)).statusCode).toBe(200);     // success clears them
    for (let i = 0; i < 4; i++) expect((await login('wrong')).statusCode).toBe(401); // 4 more: still not locked
  });
});