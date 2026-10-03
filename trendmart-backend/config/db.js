const mysql = require('mysql2/promise');
require('dotenv').config();

// A pool (not a single connection) is required so that concurrent requests
// — e.g. two staff members recording a sale at the same time (TI-02) —
// each get their own connection and don't block on a single shared socket.
const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

// Fail fast and loudly if the database is unreachable, instead of every
// route silently timing out one at a time.
pool.getConnection()
  .then(conn => { console.log('MySQL pool connected.'); conn.release(); })
  .catch(err  => { console.error('MySQL connection failed:', err.message); });

module.exports = pool;
