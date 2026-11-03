const express = require('express');
const db      = require('../config/db');
const { protect, requireRole } = require('../middleware/auth');
const { logAction }            = require('../middleware/audit');
const router  = express.Router();

// ── LIST (both roles) ───────────────────────────────────────────────────────
router.get('/', protect, requireRole('Manager', 'Staff'), async (req, res) => {
  try {
    let query = 'SELECT * FROM Stores WHERE 1=1';
    if (req.query.include_inactive !== '1') query += ' AND is_active = 1';
    query += ' ORDER BY store_name ASC';
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Could not load stores.' });
  }
});

router.get('/:id', protect, requireRole('Manager', 'Staff'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM Stores WHERE store_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Store not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── CREATE (Manager only) ─────────────────────────────────────────────────────
router.post('/', protect, requireRole('Manager'), async (req, res) => {
  const { store_name, location, manager_name, phone, email, opened_date } = req.body;
  if (!store_name || !location || !manager_name || !opened_date)
    return res.status(400).json({ message: 'store_name, location, manager_name, and opened_date are required.' });

  try {
    const [result] = await db.execute(
      `INSERT INTO Stores (store_name, location, manager_name, phone, email, opened_date)
       VALUES (?,?,?,?,?,?)`,
      [store_name, location, manager_name, phone || null, email || null, opened_date]
    );
    await logAction(req, { userId: req.user.user_id, action: 'CREATE_STORE',
                            targetType: 'Store', targetId: result.insertId, result: 'SUCCESS' });
    res.status(201).json({ message: 'Store created.', store_id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Could not create store.' });
  }
});

// ── UPDATE (Manager only) ─────────────────────────────────────────────────────
router.put('/:id', protect, requireRole('Manager'), async (req, res) => {
  const { store_name, location, manager_name, phone, email } = req.body;
  try {
    const [result] = await db.execute(
      `UPDATE Stores SET
         store_name   = COALESCE(?, store_name),
         location     = COALESCE(?, location),
         manager_name = COALESCE(?, manager_name),
         phone        = COALESCE(?, phone),
         email        = COALESCE(?, email)
       WHERE store_id = ?`,
      [store_name, location, manager_name, phone, email, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Store not found.' });

    await logAction(req, { userId: req.user.user_id, action: 'UPDATE_STORE',
                            targetType: 'Store', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Store updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update store.' });
  }
});

// ── DEACTIVATE (Manager only — soft delete) ──────────────────────────────────
// SaleTransactions has ON DELETE RESTRICT against store_id — a hard delete on
// a store with sales history would fail anyway, so deactivation is correct here.
router.delete('/:id', protect, requireRole('Manager'), async (req, res) => {
  try {
    const [result] = await db.execute('UPDATE Stores SET is_active = 0 WHERE store_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Store not found.' });

    await logAction(req, { userId: req.user.user_id, action: 'DEACTIVATE_STORE',
                            targetType: 'Store', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Store deactivated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not deactivate store.' });
  }
});

// ── REACTIVATE (Manager only) — the counterpart to the soft delete above ──────
router.patch('/:id/activate', protect, requireRole('Manager'), async (req, res) => {
  try {
    const [result] = await db.execute('UPDATE Stores SET is_active = 1 WHERE store_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Store not found.' });

    await logAction(req, { userId: req.user.user_id, action: 'REACTIVATE_STORE',
                            targetType: 'Store', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Store reactivated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not reactivate store.' });
  }
});

module.exports = router;
