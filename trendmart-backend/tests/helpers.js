const speakeasy = require('speakeasy');
const db = require('../config/db');
const request = require('supertest');
const app = require('../server');

// Logs in as any user, supplying a valid TOTP code when the account has MFA enabled.
// Clears any failed-attempt lock first (see FR-01 lockout tests).
async function loginAs(username, password) {
  await db.execute('UPDATE Users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?', [username]);
  const [[user]] = await db.execute('SELECT mfa_enabled, mfa_secret FROM Users WHERE username = ?', [username]);
  const mfa_code = user?.mfa_enabled ? speakeasy.totp({ secret: user.mfa_secret, encoding: 'base32' }) : undefined;
  return request(app).post('/api/auth/login').send({ username, password, mfa_code });
}

module.exports = { loginAs };