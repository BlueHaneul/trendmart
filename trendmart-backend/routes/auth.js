const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode    = require('qrcode');
const db        = require('../config/db');
const { logAction } = require('../middleware/audit');
const { protect, requireRole }   = require('../middleware/auth');
const router    = express.Router();

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password, mfa_code } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required.' });

  try {
    const [rows] = await db.execute(
      'SELECT * FROM Users WHERE username = ? AND is_active = 1', [username]
    );

    if (rows.length === 0) {
      await logAction(req, { action: 'LOGIN_ATTEMPT', result: 'FAILURE' });
      // Return a generic message — do not reveal whether username exists (security best practice)
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      await logAction(req, { userId: user.user_id, action: 'LOGIN_ATTEMPT', result: 'FAILURE' });
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // ── MFA CHECK ────────────────────────────────────────────────────────────
    if (user.mfa_enabled) {
      if (!mfa_code) {
        // Password correct but MFA required — tell client to prompt for code
        return res.status(200).json({ mfa_required: true, message: 'Enter your MFA code.' });
      }
      const mfaValid = speakeasy.totp.verify({
        secret:   user.mfa_secret,
        encoding: 'base32',
        token:    mfa_code,
        window:   1, // allow 30 seconds of clock drift
      });
      if (!mfaValid) {
        await logAction(req, { userId: user.user_id, action: 'LOGIN_ATTEMPT', result: 'FAILURE' });
        return res.status(401).json({ message: 'Invalid MFA code.' });
      }
    }

    // ── ISSUE TOKEN ──────────────────────────────────────────────────────────
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role,
        full_name: user.full_name, assigned_store_id: user.assigned_store_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    await db.execute('UPDATE Users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
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
router.post('/register', protect, requireRoleInline('Admin'), async (req, res) => {
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

// CORRECT — soft delete
router.delete('/users/:id', protect, requireRole('Admin'), async (req, res) => {
  await db.execute(
    'UPDATE Users SET is_active = 0, mfa_secret = NULL, mfa_enabled = 0 WHERE user_id = ?',
    [req.params.id]
  );
  await db.execute(
    "INSERT INTO AuditLog (user_id, action, target_type, target_id, result) VALUES (?,?,?,?,?)",
    [req.user.user_id, 'DEACTIVATE_USER', 'User', req.params.id, 'SUCCESS']
  );
  res.json({ message: 'User deactivated. Record retained for audit compliance.' });
});


// Inline role check kept local to this file to avoid a circular require with middleware/auth.js
function requireRoleInline(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ message: `${role} access required.` });
    next();
  };
}


module.exports = router;
