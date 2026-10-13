const request = require('supertest');
const app     = require('../server');
const db      = require('../config/db');
const { loginAs } = require('./helpers');

describe('SECURITY: Authentication', () => {

  test('ST-01: Login fails with wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
    // Must NOT reveal whether username exists
    expect(res.body.message).toBe('Invalid username or password.');
  });

  test('ST-02: Protected route rejects request with no token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(401);
  });

  test('ST-03: Protected route rejects request with an invalid/malformed token', async () => {
    const res = await request(app).get('/api/products')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.statusCode).toBe(403);
  });

  test('ST-05: Password hash is never returned in any API response', async () => {
    const login = await loginAs('admin', 'admin123');
    expect(JSON.stringify(login.body)).not.toContain('password_hash');
  });

  test('ST-09: Registering with a weak password is rejected', async () => {
  const login = await loginAs('sysadmin', 'sysadmin123');
  const res = await request(app).post('/api/auth/register')
    .set('Authorization', `Bearer ${login.body.token}`)
    .send({ username: 'newstaff', password: 'weak', full_name: 'New Staff', role: 'Staff' });
  expect(res.statusCode).toBe(400);
});
});

describe('RBAC: Role-Permission Mapping (Phase 2 §7.2)', () => {

  test('ST-04: Staff cannot create a Store (Admin-only route)', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'staff', password: 'staff123' });
    const res = await request(app).post('/api/stores')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ store_name: 'Unauthorised Store', location: 'Nowhere', manager_name: 'X', opened_date: '2026-01-01' });
    expect(res.statusCode).toBe(403);
  });

  test('ST-10: Staff cannot create a Product (Admin-only route)', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'staff', password: 'staff123' });
    const res = await request(app).post('/api/products')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ product_name: 'Unauthorised Item', category: 'Test', price: 10 });
    expect(res.statusCode).toBe(403);
  });

  test('ST-11: Staff sales list is scoped to their assigned store only', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'staff', password: 'staff123' });
    const res = await request(app).get('/api/sales')
      .set('Authorization', `Bearer ${login.body.token}`);
    const staffStoreId = login.body.user.assigned_store_id;
    expect(res.statusCode).toBe(200);
    expect(res.body.every(row => row.store_id === staffStoreId)).toBe(true);
  });

  test('ST-12: Staff cannot access the best-sellers report (Admin-only report type)', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ username: 'staff', password: 'staff123' });
    const res = await request(app).get('/api/reports/best-sellers?start_date=2026-01-01&end_date=2026-12-31')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.statusCode).toBe(403);
  });
});

describe('POPIA: Audit Trail', () => {

  test('ST-08: Failed login attempt is recorded in AuditLog', async () => {
    await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: 'wrongpassword' });
    const [logs] = await db.execute(
      "SELECT * FROM AuditLog WHERE action='LOGIN_ATTEMPT' AND result='FAILURE' ORDER BY logged_at DESC LIMIT 1"
    );
    expect(logs.length).toBeGreaterThan(0);
  });
});
