const cron = require('node-cron');
const db = require('../config/db');

// POPIA data lifecycle: how long audit records are kept
const AUDIT_RETENTION_YEARS       = 3;   // all audit entries
const FAILED_LOGIN_RETENTION_DAYS = 90;  // failed and blocked login attempts are kept for a shorter time

// Deletes audit records that have passed their retention period.
// Returns how many rows of each kind were removed.
async function purgeExpiredAuditLogs() {
  // The retention periods are fixed constants above, not user input, so they are safe inside the SQL text
  const [failedLogins] = await db.execute(
    `DELETE FROM AuditLog
     WHERE action = 'LOGIN_ATTEMPT' AND result IN ('FAILURE', 'BLOCKED')
       AND logged_at < DATE_SUB(NOW(), INTERVAL ${FAILED_LOGIN_RETENTION_DAYS} DAY)`
  );
  const [oldEntries] = await db.execute(
    `DELETE FROM AuditLog WHERE logged_at < DATE_SUB(NOW(), INTERVAL ${AUDIT_RETENTION_YEARS} YEAR)`
  );
  return { failedLogins: failedLogins.affectedRows, oldEntries: oldEntries.affectedRows };
}

// Runs at 02:00 on the 1st of every month, but only while the server is running
function startRetentionJob() {
  cron.schedule('0 2 1 * *', async () => {
    try {
      console.log('Audit log purge completed:', await purgeExpiredAuditLogs());
    } catch (err) {
      console.error('Audit log purge failed:', err.message);
    }
  });
}

module.exports = { purgeExpiredAuditLogs, startRetentionJob };