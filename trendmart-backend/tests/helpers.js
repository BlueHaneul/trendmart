const speakeasy = require('speakeasy');
const db = require('../config/db');
const request = require('supertest');
const app = require('../server');

// Logs in as any user, automatically supplying a valid TOTP code if that
// account has MFA enabled — so tests keep working regardless of MFA status.
async function loginAs(username, password) {
  const [[user]] = await db.execute('SELECT mfa_enabled, mfa_secret FROM Users WHERE username = ?', [username]);
  const mfa_code = user?.mfa_enabled ? speakeasy.totp({ secret: user.mfa_secret, encoding: 'base32' }) : undefined;
  return request(app).post('/api/auth/login').send({ username, password, mfa_code });
}

module.exports = { loginAs };