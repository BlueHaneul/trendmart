const db = require('../config/db');
const { purgeExpiredAuditLogs } = require('../jobs/retention');

jest.setTimeout(30000);

describe('Data lifecycle: audit log retention (POPIA)', () => {
  const marker = `RETENTION_TEST_${Date.now()}`;   // stored in target_type so the test can find its own rows

  const addLog = (action, result, daysOld) => db.execute(
    `INSERT INTO AuditLog (user_id, action, target_type, result, logged_at)
     VALUES (NULL, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ${daysOld} DAY))`,
    [action, marker, result]
  );
  const remaining = async () => (await db.execute('SELECT action, result FROM AuditLog WHERE target_type = ?', [marker]))[0];

  afterAll(async () => {
    await db.execute('DELETE FROM AuditLog WHERE target_type = ?', [marker]);
  });

  test('ST-34: Failed logins older than 90 days and entries older than 3 years are purged; newer records are kept', async () => {
    await addLog('LOGIN_ATTEMPT', 'FAILURE', 100);    // failed login past 90 days  -> purged
    await addLog('LOGIN_ATTEMPT', 'BLOCKED', 100);    // blocked login past 90 days -> purged
    await addLog('LOGIN_ATTEMPT', 'FAILURE', 10);     // recent failed login        -> kept
    await addLog('LOGIN_ATTEMPT', 'SUCCESS', 100);    // successful login, 100 days -> kept (3-year rule applies)
    await addLog('CREATE_PRODUCT', 'SUCCESS', 1200);  // older than 3 years         -> purged
    await addLog('CREATE_PRODUCT', 'SUCCESS', 30);    // recent                     -> kept

    const result = await purgeExpiredAuditLogs();
    expect(result.failedLogins).toBeGreaterThanOrEqual(2);
    expect(result.oldEntries).toBeGreaterThanOrEqual(1);

    const kept = (await remaining()).map((r) => `${r.action}:${r.result}`).sort();
    expect(kept).toEqual(['CREATE_PRODUCT:SUCCESS', 'LOGIN_ATTEMPT:FAILURE', 'LOGIN_ATTEMPT:SUCCESS']);
  });
});