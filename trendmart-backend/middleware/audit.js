const db = require('../config/db');

/**
 * Records one row in AuditLog. Never throws — a failed audit write must
 * never block or fail the business operation it is logging (e.g. a sale
 * must still complete even if the audit insert has a transient error).
 */
async function logAction(req, { userId = null, action, targetType = null, targetId = null, result }) {
  try {
    await db.execute(
      `INSERT INTO AuditLog (user_id, action, target_type, target_id, ip_address, user_agent, result)
       VALUES (?,?,?,?,?,?,?)`,
      [userId, action, targetType, targetId, req.ip, req.headers['user-agent'] || null, result]
    );
  } catch (err) {
    console.error('Audit log write failed (non-fatal):', err.message);
  }
}

module.exports = { logAction };
