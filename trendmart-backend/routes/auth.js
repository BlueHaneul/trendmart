const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const db        = require('../config/db');
const { logAction } = require('../middleware/audit');
const { protect, requireRole }   = require('../middleware/auth');
const router    = express.Router();

// ── FR-01: account lockout ────────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;   // consecutive failures allowed
const LOCK_MINUTES        = 15;  // how long the account stays locked

// Records one failed attempt and locks the account when the limit is reached.
// Returns true if this failure triggered the lock. Lock times come from MySQL's NOW(),
// the same clock that checks them later, so the two can never disagree.
async function recordFailedAttempt(user) {
  const attempts = user.failed_login_attempts + 1;
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await db.execute(
      `UPDATE Users SET failed_login_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL ${LOCK_MINUTES} MINUTE)
       WHERE user_id = ?`, [user.user_id]
    );
    return true;
  }
  await db.execute('UPDATE Users SET failed_login_attempts = ? WHERE user_id = ?', [attempts, user.user_id]);
  return false;
}

const lockedMessage = (minutes) => `Account locked after too many failed attempts. Try again in ${minutes} minute(s).`;


// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password, mfa_code } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const [rows] = await db.execute(
      `SELECT *,
              (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked,
              CEIL(TIMESTAMPDIFF(SECOND, NOW(), locked_until) / 60) AS minutes_left
       FROM Users WHERE username = ? AND is_active = 1`, [username]
    );

    if (rows.length === 0) {
      await logAction(req, { action: 'LOGIN_ATTEMPT', result: 'FAILURE' });
      // Generic message: do not reveal whether the username exists
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = rows[0];

    // A locked account is refused even when the credentials are correct
    if (user.is_locked) {
      await logAction(req, { userId: user.user_id, action: 'LOGIN_ATTEMPT', result: 'BLOCKED' });
      return res.status(423).json({ message: lockedMessage(Number(user.minutes_left)) });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const nowLocked = await recordFailedAttempt(user);
      await logAction(req, { userId: user.user_id, action: 'LOGIN_ATTEMPT', result: 'FAILURE' });
      return nowLocked
        ? res.status(423).json({ message: lockedMessage(LOCK_MINUTES) })
        : res.status(401).json({ message: 'Invalid username or password.' });
    }

    // ── MFA CHECK ────────────────────────────────────────────────────────────
    if (user.mfa_enabled) {
      if (!mfa_code) {
        // Password correct but MFA required: not a failure, so the counter is untouched
        return res.status(200).json({ mfa_required: true, message: 'Enter your MFA code.' });
      }
      const mfaValid = speakeasy.totp.verify({
        secret: user.mfa_secret, encoding: 'base32', token: mfa_code, window: 1,
      });
      if (!mfaValid) {
        // A wrong MFA code is also a failed attempt, otherwise the 6-digit code could be brute-forced
        const nowLocked = await recordFailedAttempt(user);
        await logAction(req, { userId: user.user_id, action: 'LOGIN_ATTEMPT', result: 'FAILURE' });
        return nowLocked
          ? res.status(423).json({ message: lockedMessage(LOCK_MINUTES) })
          : res.status(401).json({ message: 'Invalid MFA code.' });
      }
    }

    // ── ISSUE TOKEN ──────────────────────────────────────────────────────────
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role,
        full_name: user.full_name, assigned_store_id: user.assigned_store_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // A full, successful login clears the failure counter and any lock
    await db.execute(
      'UPDATE Users SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?',
      [user.user_id]
    );
    await logAction(req, { userId: user.user_id, action: 'LOGIN_ATTEMPT', result: 'SUCCESS' });

    res.json({
      token,
      user: { user_id: user.user_id, username: user.username, full_name: user.full_name,
              role: user.role, mfa_enabled: !!user.mfa_enabled,
              assigned_store_id: user.assigned_store_id }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── MFA SETUP (any authenticated user enables MFA for their own account) ──────
router.post('/mfa/setup', protect, async (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `${process.env.MFA_ISSUER} (${req.user.username})`,
  });

  // Store the secret temporarily — user must verify before it's activated
  await db.execute('UPDATE Users SET mfa_secret = ? WHERE user_id = ?', [secret.base32, req.user.user_id]);

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ qr_code: qrDataUrl, secret: secret.base32,
             message: 'Scan this QR code with Google Authenticator, then verify.' });
});

// ── MFA VERIFY (confirm setup) ────────────────────────────────────────────────
router.post('/mfa/verify', protect, async (req, res) => {
  const { mfa_code } = req.body;
  const [rows] = await db.execute('SELECT mfa_secret FROM Users WHERE user_id=?', [req.user.user_id]);
  const valid = speakeasy.totp.verify({
    secret: rows[0].mfa_secret, encoding: 'base32', token: mfa_code, window: 1
  });
  if (!valid) return res.status(400).json({ message: 'Invalid code. MFA not activated.' });

  await db.execute('UPDATE Users SET mfa_enabled = 1 WHERE user_id = ?', [req.user.user_id]);
  res.json({ message: 'MFA activated successfully.' });
});

// ── REGISTER (Admin creates accounts — FR-01 extension) ───────────────────────
router.post('/register', protect, requireRoleInline('SystemAdmin'), async (req, res) => {
  const { username, password, full_name, role, email, phone, assigned_store_id } = req.body;
  if (!username || !password || !full_name)
    return res.status(400).json({ message: 'Username, password, and full name are required.' });

  // Validate password strength
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPassword.test(password))
    return res.status(400).json({
      message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
    });

  try {
    const password_hash = await bcrypt.hash(password, 12); // cost factor 12
    const [result] = await db.execute(
      'INSERT INTO Users (username, password_hash, full_name, role, email, phone, assigned_store_id) VALUES (?,?,?,?,?,?,?)',
      [username, password_hash, full_name, role || 'Staff', email || null, phone || null, assigned_store_id || null]
    );
    await logAction(req, { userId: req.user.user_id, action: 'CREATE_USER', targetType: 'User', targetId: result.insertId, result: 'SUCCESS' });
    res.status(201).json({ message: 'User created.', user_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ message: 'Username or email already exists.' });
    res.status(500).json({ message: 'Server error.' });
  }
});

// Inline role check kept local to this file to avoid a circular require with middleware/auth.js
function requireRoleInline(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ message: `${role} access required.` });
    next();
  };
}

// ── LIST USERS (SystemAdmin only) — powers the User Management screen ────────
router.get('/users', protect, requireRoleInline('SystemAdmin'), async (req, res) => {
  const [rows] = await db.execute(
    `SELECT user_id, username, full_name, role, email, assigned_store_id, is_active, mfa_enabled, last_login,
        (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
    FROM Users ORDER BY full_name`
  );
  res.json(rows);
});

// ── RESET PASSWORD (SystemAdmin only) ─────────────────────────────────────────
router.put('/users/:id/password', protect, requireRoleInline('SystemAdmin'), async (req, res) => {
  const { new_password } = req.body;
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPassword.test(new_password))
    return res.status(400).json({ message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.' });

  try {
    const password_hash = await bcrypt.hash(new_password, 12);
    const [result] = await db.execute(
  'UPDATE Users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE user_id = ?',
  [password_hash, req.params.id]
);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });

    await logAction(req, { userId: req.user.user_id, action: 'RESET_PASSWORD', targetType: 'User', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not reset password.' });
  }
});

// ── DEACTIVATE / REACTIVATE USER (SystemAdmin only) ───────────────────────────
router.delete('/users/:id', protect, requireRoleInline('SystemAdmin'), async (req, res) => {
  // Guard: prevent a SystemAdmin from locking themselves out
  if (Number(req.params.id) === req.user.user_id)
    return res.status(400).json({ message: 'You cannot deactivate your own account.' });

  const [result] = await db.execute('UPDATE Users SET is_active = 0, mfa_secret = NULL, mfa_enabled = 0 WHERE user_id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
  await logAction(req, { userId: req.user.user_id, action: 'DEACTIVATE_USER', targetType: 'User', targetId: req.params.id, result: 'SUCCESS' });
  res.json({ message: 'User deactivated.' });
});

router.patch('/users/:id/activate', protect, requireRoleInline('SystemAdmin'), async (req, res) => {
  const [result] = await db.execute('UPDATE Users SET is_active = 1 WHERE user_id = ?', [req.params.id]);
  if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
  await logAction(req, { userId: req.user.user_id, action: 'REACTIVATE_USER', targetType: 'User', targetId: req.params.id, result: 'SUCCESS' });
  res.json({ message: 'User reactivated.' });
});

// ── STORE LOOKUP FOR USER PROVISIONING (SystemAdmin only) ─────────────────────
// Minimal reference data (id + name only) so a SystemAdmin can assign Staff to a
// store without being granted access to the full Stores business route.
router.get('/store-options', protect, requireRoleInline('SystemAdmin'), async (req, res) => {
  const [rows] = await db.execute('SELECT store_id, store_name FROM Stores WHERE is_active = 1 ORDER BY store_name');
  res.json(rows);
});

module.exports = router;
