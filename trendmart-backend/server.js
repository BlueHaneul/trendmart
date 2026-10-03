const express = require('express');
const cors    = require('cors');
const db = require('./config/db');
require('dotenv').config();

const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10kb' })); // Prevent oversized payloads

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/stores',   require('./routes/stores'));
app.use('/api/sales',    require('./routes/sales'));
app.use('/api/reports',  require('./routes/reports'));

// Health check — useful for confirming the server is up before wiring the frontend
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// 404 handler — must come after all routes
app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));

// Global error handler — never expose stack traces to the client
app.use((err, req, res, next) => {
  console.error(err.stack); // log internally
  res.status(500).json({ message: 'An internal server error occurred.' });
});

// Run this as a scheduled task (e.g. node-cron) — purges old audit logs
const cron = require('node-cron');
cron.schedule('0 2 1 * *', async () => { // 2am on the 1st of each month
  await db.execute(
    "DELETE FROM AuditLog WHERE logged_at < DATE_SUB(NOW(), INTERVAL 3 YEAR)"
  );
  console.log('Audit log purge completed.');
});

if (require.main === module) {
  app.listen(process.env.PORT, () =>
    console.log(`Server running on port ${process.env.PORT}`)
  );
}

module.exports = app; // exported (not just listened on) so tests/sales.test.js can import it with supertest
