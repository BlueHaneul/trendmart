const jwt = require('jsonwebtoken');
const { logAction } = require('./audit');
require('dotenv').config();

// Verifies the JWT and attaches req.user. Every protected route uses this.
async function protect(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token. Access denied.' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // POPIA audit trail: log every authenticated access, not just logins
    await logAction(req, {
      userId: req.user.user_id,
      action: `ACCESS:${req.method}:${req.path}`,
      result: 'SUCCESS',
    });
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
}

// Role guard factory — usage: requireRole('Admin') or requireRole('Admin', 'Staff')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ message: `Access restricted to: ${allowedRoles.join(', ')}.` });
    }
    next();
  };
}

// Kept for backward compatibility with v2 route code
const adminOnly = requireRole('Admin');

module.exports = { protect, requireRole, adminOnly };
