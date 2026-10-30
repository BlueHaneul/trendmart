const express = require('express');
const db      = require('../config/db');
const { protect, requireRole } = require('../middleware/auth');
const router  = express.Router();

// ── (a) DAILY SALES REPORT — Manager: any store; Staff: own store only ─────────
router.get('/daily', protect, requireRole('Manager', 'Staff'), async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    let query = `
      SELECT s.store_id, s.store_name, COUNT(DISTINCT t.transaction_id) AS transaction_count,
             COALESCE(SUM(t.total_amount), 0) AS total_revenue
      FROM Stores s
      LEFT JOIN SaleTransactions t
        ON t.store_id = s.store_id AND DATE(t.transaction_date) = ? AND t.status = 'Completed'
      WHERE s.is_active = 1
    `;
    const params = [date];

    if (req.user.role === 'Staff') {
      if (!req.user.assigned_store_id)
        return res.status(403).json({ message: 'Your account has no assigned store. Contact an Admin.' });
      query += ' AND s.store_id = ?';
      params.push(req.user.assigned_store_id);
    }

    query += ' GROUP BY s.store_id, s.store_name ORDER BY s.store_name';
    const [rows] = await db.execute(query, params);
    res.json({ date, stores: rows });
  } catch (err) {
    res.status(500).json({ message: 'Could not generate daily report.' });
  }
});

// ── (b) BEST-SELLING PRODUCTS REPORT (Manager only) ────────────────────────────
router.get('/best-sellers', protect, requireRole('Manager'), async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date)
    return res.status(400).json({ message: 'start_date and end_date are required.' });

  try {
    const [rows] = await db.execute(
      `SELECT p.product_id, p.product_name, p.category,
              SUM(i.quantity) AS units_sold, SUM(i.subtotal) AS total_revenue
       FROM SaleItems i
       JOIN SaleTransactions t ON i.transaction_id = t.transaction_id
       JOIN Products p ON i.product_id = p.product_id
       WHERE t.status = 'Completed' AND DATE(t.transaction_date) BETWEEN ? AND ?
       GROUP BY p.product_id, p.product_name, p.category
       ORDER BY total_revenue DESC
       LIMIT 20`,
      [start_date, end_date]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Could not generate best-sellers report.' });
  }
});

// ── (c) STORE PERFORMANCE REPORT (Manager only) ────────────────────────────────
// Uses the composite index idx_st_store_date from Part 3 — this is the query
// that index was purpose-built for.
router.get('/store-performance', protect, requireRole('Manager'), async (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date)
    return res.status(400).json({ message: 'start_date and end_date are required.' });

  try {
    const [rows] = await db.execute(
      `SELECT s.store_id, s.store_name,
              COUNT(t.transaction_id) AS transaction_count,
              COALESCE(SUM(t.total_amount), 0) AS total_revenue,
              COALESCE(AVG(t.total_amount), 0) AS avg_transaction_value
       FROM Stores s
       LEFT JOIN SaleTransactions t
         ON t.store_id = s.store_id AND t.status = 'Completed'
         AND DATE(t.transaction_date) BETWEEN ? AND ?
       WHERE s.is_active = 1
       GROUP BY s.store_id, s.store_name
       ORDER BY total_revenue DESC`,
      [start_date, end_date]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Could not generate store performance report.' });
  }
});

// ── DASHBOARD (FR-08) — Manager only ────────────────────────────────────────────
router.get('/dashboard', protect, requireRole('Manager'), async (req, res) => {
  try {
    const [[todayRevenue]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS tx_count
       FROM SaleTransactions WHERE DATE(transaction_date) = CURDATE() AND status='Completed'`
    );
    const [[allTimeRevenue]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) AS revenue
       FROM SaleTransactions WHERE status='Completed'`
    );
    const [sevenDayTrend] = await db.execute(
      `SELECT DATE(transaction_date) AS day, COALESCE(SUM(total_amount),0) AS revenue
       FROM SaleTransactions
       WHERE status='Completed' AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(transaction_date) ORDER BY day ASC`
    );
    const [topProducts] = await db.execute(
      `SELECT p.product_name, SUM(i.subtotal) AS revenue
       FROM SaleItems i
       JOIN SaleTransactions t ON i.transaction_id = t.transaction_id
       JOIN Products p ON i.product_id = p.product_id
       WHERE t.status = 'Completed'
       GROUP BY p.product_id, p.product_name
       ORDER BY revenue DESC LIMIT 5`
    );
    const [perStoreRevenue] = await db.execute(
      `SELECT s.store_name, COALESCE(SUM(t.total_amount),0) AS revenue
       FROM Stores s
       LEFT JOIN SaleTransactions t ON t.store_id = s.store_id AND t.status='Completed'
       WHERE s.is_active = 1
       GROUP BY s.store_id, s.store_name ORDER BY revenue DESC`
    );

    res.json({
      today_revenue: todayRevenue.revenue,
      today_transaction_count: todayRevenue.tx_count,
      all_time_revenue: allTimeRevenue.revenue,
      seven_day_trend: sevenDayTrend,     // → bar chart (SC-02)
      top_products: topProducts,
      per_store_revenue: perStoreRevenue,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not load dashboard data.' });
  }
});

// ── ADVANCED ANALYTICS (FR-08 / SC-08) — Manager only ──────────────────────────
// Powers: 30-day trend, week-on-week %, category breakdown, a simple moving-
// average forecast, and a profit-margin table using an estimated 55% COGS
// (Phase 2 does not track real cost price, so this is documented as an
// estimate, not an accounting figure — call this out in your final report).
router.get('/analytics', protect, requireRole('Manager'), async (req, res) => {
  try {
    const [thirtyDayTrend] = await db.execute(
      `SELECT DATE(transaction_date) AS day, COALESCE(SUM(total_amount),0) AS revenue
       FROM SaleTransactions
       WHERE status='Completed' AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY DATE(transaction_date) ORDER BY day ASC`
    );

    if (thirtyDayTrend.length < 7) {
      return res.json({ insufficient_data: true,
        message: '30-day trend requires more transaction data. Check back after recording more sales.' });
    }

    const totalRevenue30d = thirtyDayTrend.reduce((sum, d) => sum + Number(d.revenue), 0);
    const dailyAverage     = totalRevenue30d / thirtyDayTrend.length;

    // Week-on-week: last 7 days vs the 7 days before that
    const last7 = thirtyDayTrend.slice(-7).reduce((s, d) => s + Number(d.revenue), 0);
    const prev7 = thirtyDayTrend.slice(-14, -7).reduce((s, d) => s + Number(d.revenue), 0);
    const weekOnWeekChange = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;

    // Simple moving-average forecast — a documented estimate, not a statistical model
    const forecast = { next_7_days: dailyAverage * 7, next_14_days: dailyAverage * 14, next_30_days: dailyAverage * 30 };

    const [categoryBreakdown] = await db.execute(
      `SELECT p.category, SUM(i.subtotal) AS revenue
       FROM SaleItems i
       JOIN SaleTransactions t ON i.transaction_id = t.transaction_id
       JOIN Products p ON i.product_id = p.product_id
       WHERE t.status='Completed' AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
       GROUP BY p.category`
    );
    const categoryTotal = categoryBreakdown.reduce((s, c) => s + Number(c.revenue), 0);
    const categoryPercentages = categoryBreakdown.map(c => ({
      category: c.category,
      revenue: c.revenue,
      percentage: categoryTotal > 0 ? (Number(c.revenue) / categoryTotal) * 100 : 0,
    }));

    // Profit margin analysis — 55% estimated COGS per product (documented estimate)
    const COGS_RATE = 0.55;
    const [productRevenue] = await db.execute(
      `SELECT p.product_id, p.product_name, SUM(i.subtotal) AS revenue
       FROM SaleItems i
       JOIN SaleTransactions t ON i.transaction_id = t.transaction_id
       JOIN Products p ON i.product_id = p.product_id
       WHERE t.status='Completed'
       GROUP BY p.product_id, p.product_name
       ORDER BY revenue DESC LIMIT 20`
    );
    const profitMargins = productRevenue.map(p => {
      const revenue         = Number(p.revenue);
      const estimatedCost   = revenue * COGS_RATE;
      const estimatedProfit = revenue - estimatedCost;
      return {
        product_name: p.product_name, revenue,
        estimated_cost: estimatedCost, estimated_profit: estimatedProfit,
        margin_percent: revenue > 0 ? (estimatedProfit / revenue) * 100 : 0,
      };
    });

    res.json({
      thirty_day_revenue: totalRevenue30d,
      daily_average_revenue: dailyAverage,
      week_on_week_change_percent: weekOnWeekChange,
      thirty_day_trend: thirtyDayTrend,
      category_breakdown: categoryPercentages,
      forecast,
      profit_margins: profitMargins,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not generate analytics.' });
  }
});

// ── REORDER RECOMMENDATIONS (FR-08 decision support) — Manager only ───────────
// Business rules, named so they can be tuned in one place and cited in the report:
const LOOKBACK_DAYS     = 30; // window used to measure how fast each product sells
const REORDER_NOW_DAYS  = 7;  // stock covers this many days of sales, or fewer -> "Reorder now"
const REORDER_SOON_DAYS = 14; // ...or fewer -> "Reorder soon"; anything above is "Healthy"
const COVER_DAYS        = 30; // the suggested quantity restores this many days of cover

const STATUS_RANK = { 'Reorder now': 0, 'Reorder soon': 1, 'Healthy': 2, 'No recent sales': 3 };

router.get('/reorder-recommendations', protect, requireRole('Manager'), async (req, res) => {
  try {
    // LOOKBACK_DAYS is a constant defined above, not user input, so it is safe inside the SQL text.
    const [rows] = await db.execute(
      `SELECT p.product_id, p.product_name, p.category, p.stock_level,
              COALESCE(s.units_sold, 0) AS units_sold
       FROM Products p
       LEFT JOIN (
         SELECT i.product_id, SUM(i.quantity) AS units_sold
         FROM SaleItems i
         JOIN SaleTransactions t ON t.transaction_id = i.transaction_id
         WHERE t.status = 'Completed'
           AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL ${LOOKBACK_DAYS - 1} DAY)
         GROUP BY i.product_id
       ) s ON s.product_id = p.product_id
       WHERE p.is_active = 1`
    );

    const items = rows
      .map((r) => {
        const stock = Number(r.stock_level);
        const unitsSold = Number(r.units_sold);

        let status, daysLeft = null, suggested = 0;
        if (unitsSold === 0) {
          status = 'No recent sales'; // no sales velocity, so days-until-stockout cannot be estimated
        } else {
          daysLeft = (stock * LOOKBACK_DAYS) / unitsSold; // stock / (units per day)
          status = daysLeft <= REORDER_NOW_DAYS ? 'Reorder now'
                 : daysLeft <= REORDER_SOON_DAYS ? 'Reorder soon' : 'Healthy';
          if (status !== 'Healthy') {
            suggested = Math.max(0, Math.ceil((unitsSold * COVER_DAYS) / LOOKBACK_DAYS) - stock);
          }
        }

        return {
          product_id: r.product_id, product_name: r.product_name, category: r.category,
          stock_level: stock, units_sold: unitsSold,
          avg_daily_sales: Math.round((unitsSold / LOOKBACK_DAYS) * 100) / 100,
          days_left: daysLeft === null ? null : Math.round(daysLeft * 10) / 10,
          status, suggested_reorder_qty: suggested,
          _sort: daysLeft ?? 0,
        };
      })
      // Most urgent first: by status, then fewest days of stock left
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a._sort - b._sort)
      .map(({ _sort, ...item }) => item);

    res.json({
      lookback_days: LOOKBACK_DAYS,
      thresholds: { reorder_now_days: REORDER_NOW_DAYS, reorder_soon_days: REORDER_SOON_DAYS, cover_days: COVER_DAYS },
      items,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not generate reorder recommendations.' });
  }
});

module.exports = router;
