const express = require('express');
const db      = require('../config/db');
const { protect, requireRole } = require('../middleware/auth');
const { logAction }            = require('../middleware/audit');
const router  = express.Router();

// ── LIST (Admin: full, Staff: read-only — both roles allowed here) ────────────
router.get('/', protect, async (req, res) => {
  try {
    let query = 'SELECT * FROM Products WHERE 1=1';
    const params = [];

    // Staff and Admin both see only active products by default; ?include_inactive=1
    // (Admin-only in the UI) reveals deactivated stock for re-activation.
    if (req.query.include_inactive !== '1') { query += ' AND is_active = 1'; }
    if (req.query.category) { query += ' AND category = ?'; params.push(req.query.category); }
    if (req.query.low_stock === '1') { query += ' AND stock_level <= min_stock_level'; }

    query += ' ORDER BY product_name ASC';
    const [rows] = await db.execute(query, params);
    res.json(rows); // empty array (not an error) if no products match — frontend renders EmptyState
  } catch (err) {
    res.status(500).json({ message: 'Could not load products. Please try again.' });
  }
});

// ── GET ONE ─────────────────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM Products WHERE product_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── CREATE (Admin only) ────────────────────────────────────────────────────
router.post('/', protect, requireRole('Admin'), async (req, res) => {
  const { product_name, category, price, stock_level, min_stock_level } = req.body;

  // Testable requirement (mirrors NFR validation style used in sales.js):
  // name required, price must be non-negative, stock must be a non-negative integer
  if (!product_name || !category || price == null || price < 0)
    return res.status(400).json({ message: 'product_name, category, and a non-negative price are required.' });
  if (stock_level != null && stock_level < 0)
    return res.status(400).json({ message: 'stock_level cannot be negative.' });

  try {
    const [result] = await db.execute(
      `INSERT INTO Products (product_name, category, price, stock_level, min_stock_level)
       VALUES (?,?,?,?,?)`,
      [product_name, category, price, stock_level || 0, min_stock_level || 10]
    );
    await logAction(req, { userId: req.user.user_id, action: 'CREATE_PRODUCT',
                            targetType: 'Product', targetId: result.insertId, result: 'SUCCESS' });
    res.status(201).json({ message: 'Product created.', product_id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Could not create product.' });
  }
});

// ── UPDATE (Admin only) ────────────────────────────────────────────────────
router.put('/:id', protect, requireRole('Admin'), async (req, res) => {
  const { product_name, category, price, stock_level, min_stock_level } = req.body;
  if (price != null && price < 0)
    return res.status(400).json({ message: 'price cannot be negative.' });
  if (stock_level != null && stock_level < 0)
    return res.status(400).json({ message: 'stock_level cannot be negative.' });

  try {
    const [result] = await db.execute(
      `UPDATE Products SET
         product_name    = COALESCE(?, product_name),
         category        = COALESCE(?, category),
         price           = COALESCE(?, price),
         stock_level     = COALESCE(?, stock_level),
         min_stock_level = COALESCE(?, min_stock_level)
       WHERE product_id = ?`,
      [product_name, category, price, stock_level, min_stock_level, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found.' });

    await logAction(req, { userId: req.user.user_id, action: 'UPDATE_PRODUCT',
                            targetType: 'Product', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Product updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not update product.' });
  }
});

// ── DEACTIVATE (Admin only — soft delete, never a hard DELETE) ────────────────
// Products are never hard-deleted: SaleItems has ON DELETE RESTRICT against
// product_id, so a hard delete would be blocked anyway once a sale exists.
// Soft delete also preserves historical report accuracy (Part 12 — Data Lifecycle).
router.delete('/:id', protect, requireRole('Admin'), async (req, res) => {
  try {
    const [result] = await db.execute('UPDATE Products SET is_active = 0 WHERE product_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found.' });

    await logAction(req, { userId: req.user.user_id, action: 'DEACTIVATE_PRODUCT',
                            targetType: 'Product', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Product deactivated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not deactivate product.' });
  }
});

// ── REACTIVATE (Admin only) — the counterpart to the soft-delete above ────────
router.patch('/:id/activate', protect, requireRole('Admin'), async (req, res) => {
  try {
    const [result] = await db.execute('UPDATE Products SET is_active = 1 WHERE product_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found.' });

    await logAction(req, { userId: req.user.user_id, action: 'REACTIVATE_PRODUCT',
                            targetType: 'Product', targetId: req.params.id, result: 'SUCCESS' });
    res.json({ message: 'Product reactivated.' });
  } catch (err) {
    res.status(500).json({ message: 'Could not reactivate product.' });
  }
});

module.exports = router;
