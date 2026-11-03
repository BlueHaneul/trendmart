const express = require('express');
const db      = require('../config/db');
const { protect, requireRole } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const router  = express.Router();

// ── LIST / FILTER (FR-07) ──────────────────────────────────────────────────
// Optional, combinable filters: start_date, end_date, date, product (partial text), category,
// store_id (Manager only; Staff are always limited to their own store), status.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', protect, requireRole('Manager', 'Staff'), async (req, res) => {
  const { date, start_date, end_date, product, category, store_id, status } = req.query;

  for (const [name, value] of Object.entries({ date, start_date, end_date })) {
    if (value && !DATE_RE.test(value))
      return res.status(400).json({ message: `${name} must be a date in YYYY-MM-DD format.` });
  }
  if (start_date && end_date && start_date > end_date)
    return res.status(400).json({ message: 'start_date must be on or before end_date.' });

  try {
    let query = `
      SELECT t.transaction_id, t.transaction_date, t.total_amount, t.status,
             t.user_id, t.store_id, u.full_name AS staff_name, s.store_name,
             p.product_name, p.category, i.quantity, i.unit_price, i.subtotal
      FROM SaleTransactions t
      JOIN Users u ON t.user_id = u.user_id
      JOIN Stores s ON t.store_id = s.store_id
      JOIN SaleItems i ON i.transaction_id = t.transaction_id
      JOIN Products p ON i.product_id = p.product_id
      WHERE 1=1
    `;
    const params = [];

    // Role restriction: Staff only ever see their own store, whatever store_id they send
    if (req.user.role === 'Staff') {
      if (!req.user.assigned_store_id)
        return res.status(403).json({ message: 'Your account has no assigned store. Contact a System Administrator.' });
      query += ' AND t.store_id = ?';
      params.push(req.user.assigned_store_id);
    } else if (store_id) {
      query += ' AND t.store_id = ?';
      params.push(store_id);
    }

    if (date)       { query += ' AND DATE(t.transaction_date) = ?'; params.push(date); }
    // Range filters compare the raw column (no DATE() wrapper) so MySQL can use the date index
    if (start_date) { query += ' AND t.transaction_date >= ?'; params.push(start_date); }
    if (end_date)   { query += ' AND t.transaction_date < DATE_ADD(CAST(? AS DATE), INTERVAL 1 DAY)'; params.push(end_date); }
    // Partial, case-insensitive product match; % and _ typed by the user are matched literally
    if (product)    { query += ' AND p.product_name LIKE ?'; params.push(`%${String(product).replace(/[\\%_]/g, '\\$&')}%`); }
    if (category)   { query += ' AND p.category = ?'; params.push(category); }
    if (status)     { query += ' AND t.status = ?'; params.push(status); }

    query += ' ORDER BY t.transaction_date DESC';
    const [rows] = await db.execute(query, params);
    res.json(rows); // an empty array is a valid result: the frontend shows an empty state, not an error
  } catch (err) {
    res.status(500).json({ message: 'Could not load transactions.' });
  }
});

// ── RECORD SALE (FR-03) — ACID transaction ─────────────────────────────────
router.post('/', protect , requireRole('Manager', 'Staff'), async (req, res) => {
  const { store_id, product_id, quantity } = req.body;

  // Input validation — testable requirement: quantity must be a positive integer
  if (!store_id || !product_id || !quantity || quantity < 1)
    return res.status(400).json({ message: 'store_id, product_id, and quantity (≥1) are required.' });

  // Staff may only record sales against their own assigned store
  if (req.user.role === 'Staff' && Number(store_id) !== Number(req.user.assigned_store_id))
    return res.status(403).json({ message: 'You can only record sales for your assigned store.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction(); // ACID: Atomicity begins
  
  // A deactivated (or unknown) store cannot take new sales, whoever is selling
  const [[store]] = await conn.execute('SELECT is_active FROM Stores WHERE store_id = ?', [store_id]);
  if (!store) throw { status: 404, message: 'Store not found.' };
  if (!store.is_active) throw { status: 409, message: 'This store is deactivated. New sales cannot be recorded for it.' };


    // Acquire row-level lock — prevents double-deduction (TI-02: concurrency control)
    const [[product]] = await conn.execute(
      'SELECT * FROM Products WHERE product_id = ? AND is_active = 1 FOR UPDATE', [product_id]
    );
    if (!product)
      throw { status: 404, message: 'Product not found or is inactive.' };
    if (product.stock_level < quantity)
      throw { status: 400, message: `Insufficient stock. Only ${product.stock_level} units available.` };

    const total = product.price * quantity;

    // All three writes must succeed together or none persist
    const [txResult] = await conn.execute(
      'INSERT INTO SaleTransactions (user_id, store_id, total_amount) VALUES (?,?,?)',
      [req.user.user_id, store_id, total]
    );
    await conn.execute(
      'INSERT INTO SaleItems (transaction_id, product_id, quantity, unit_price) VALUES (?,?,?,?)',
      [txResult.insertId, product_id, quantity, product.price]
    );
    await conn.execute(
      'UPDATE Products SET stock_level = stock_level - ? WHERE product_id = ?',
      [quantity, product_id]
    );

    await conn.commit(); // ACID: Durability — changes are permanent
    await logAction(req, { userId: req.user.user_id, action: 'RECORD_SALE',
                            targetType: 'SaleTransaction', targetId: txResult.insertId, result: 'SUCCESS' });
    res.status(201).json({
      message: 'Sale recorded successfully.',
      transaction_id: txResult.insertId,
      total_amount: total
    });
  } catch (err) {
    await conn.rollback(); // ACID: Atomicity — all changes undone on failure
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Transaction failed. Please try again.' });
  } finally {
    conn.release();
  }
});

// ── CANCEL TODAY'S TRANSACTION — ACID transaction (restores stock) ─────────
router.put('/:id/cancel', protect, requireRole('Manager', 'Staff'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[tx]] = await conn.execute(
      'SELECT * FROM SaleTransactions WHERE transaction_id = ? FOR UPDATE', [req.params.id]
    );
    if (!tx) throw { status: 404, message: 'Transaction not found.' };
    if (tx.status === 'Cancelled') throw { status: 400, message: 'Transaction is already cancelled.' };

    // Ownership rule: Staff may cancel only their own transactions
    if (req.user.role === 'Staff' && tx.user_id !== req.user.user_id)
      throw { status: 403, message: 'You can only cancel your own transactions.' };

    // "Today's" rule: cancellation is only permitted on the day the sale was made
    const txDate = new Date(tx.transaction_date).toDateString();
    const today   = new Date().toDateString();
    if (req.user.role === 'Staff' && txDate !== today)
      throw { status: 403, message: 'Only transactions from today can be cancelled.' };

    // Restore stock for every item in the transaction, then mark it cancelled —
    // both must succeed together (ACID) or neither does.
    const [items] = await conn.execute('SELECT * FROM SaleItems WHERE transaction_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.execute(
        'UPDATE Products SET stock_level = stock_level + ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
    }
    await conn.execute("UPDATE SaleTransactions SET status = 'Cancelled' WHERE transaction_id = ?", [req.params.id]);

    await conn.commit();
    await logAction(req, { userId: req.user.user_id, action: 'CANCEL_SALE',
                            targetType: 'SaleTransaction', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Transaction cancelled and stock restored.' });
  } catch (err) {
    await conn.rollback();
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Cancellation failed. Please try again.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
