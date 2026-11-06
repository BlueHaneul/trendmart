const request = require('supertest');
const app     = require('../server');
const { loginAs } = require('./helpers');

jest.setTimeout(30000);

describe('FR-11 / BR-11 / BR-13: the System Administrator has no business-data access, and only they manage users', () => {
  let sysadminToken, managerToken, staffToken;

  beforeAll(async () => {
    const [sysadmin, manager, staff] = await Promise.all([
      loginAs('sysadmin', 'sysadmin123'), loginAs('admin', 'admin123'), loginAs('staff', 'staff123'),
    ]);
    sysadminToken = sysadmin.body.token;
    managerToken  = manager.body.token;
    staffToken    = staff.body.token;
  });

  const call = (method, url, token) => request(app)[method](url).set('Authorization', `Bearer ${token}`);

  test('ST-35: The System Administrator is refused every business route', async () => {
    const routes = [
      ['get',  '/api/products'],
      ['get',  '/api/stores'],
      ['get',  '/api/sales'],
      ['post', '/api/sales'],
      ['get',  '/api/reports/daily'],
      ['get',  '/api/reports/best-sellers?start_date=2026-01-01&end_date=2026-12-31'],
      ['get',  '/api/reports/store-performance?start_date=2026-01-01&end_date=2026-12-31'],
      ['get',  '/api/reports/dashboard'],
      ['get',  '/api/reports/analytics'],
      ['get',  '/api/reports/reorder-recommendations'],
    ];
    for (const [method, url] of routes) {
      const res = await call(method, url, sysadminToken);
      expect([url, res.statusCode]).toEqual([url, 403]);
    }
  });

  test('ST-36: Managers and Sales Staff are refused user management', async () => {
    for (const token of [managerToken, staffToken]) {
      expect((await call('get', '/api/auth/users', token)).statusCode).toBe(403);
      expect((await call('post', '/api/auth/register', token)).statusCode).toBe(403);
      expect((await call('put', '/api/auth/users/1/password', token)).statusCode).toBe(403);
      expect((await call('delete', '/api/auth/users/1', token)).statusCode).toBe(403);
    }
  });
});