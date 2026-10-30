import { useEffect, useState } from 'react';
import API from '../api/axios';
import { ErrorState } from './ErrorState';
import { EmptyState } from './EmptyState';
import { COLORS, Badge, Btn } from './ui';

const STATUS_COLOR = {
  'Reorder now': COLORS.rose,
  'Reorder soon': COLORS.amber,
  'Healthy': COLORS.emerald,
  'No recent sales': COLORS.dim,
};

export default function ReorderPanel() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    API.get('/reports/reorder-recommendations')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div style={{ color: COLORS.muted }}>Loading reorder recommendations...</div>;
  if (error)   return <ErrorState message={error} onRetry={load} />;
  if (data.items.length === 0)
    return <EmptyState title="No Products to Analyse" message="Add active products to see reorder recommendations." />;

  const count = (status) => data.items.filter((i) => i.status === status).length;
  const needsAction = data.items.filter((i) => i.status === 'Reorder now' || i.status === 'Reorder soon');
  const visible = showAll ? data.items : needsAction;
  const t = data.thresholds;
  const cell = { padding: '10px 16px' };

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div>
          <h3 style={{ color: COLORS.text, margin: '0 0 4px', fontSize: 15 }}>Reorder Recommendations</h3>
          <p style={{ color: COLORS.dim, fontSize: 12, margin: 0 }}>What to restock, and how urgently.</p>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show only products needing action' : `Show all products (${data.items.length})`}
        </Btn>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.keys(STATUS_COLOR).map((s) => (
          <Badge key={s} color={STATUS_COLOR[s]}>{count(s)} {s}</Badge>
        ))}
      </div>

      {visible.length === 0 ? (
        <p style={{ color: COLORS.muted, fontSize: 13, margin: '0 0 8px' }}>No products need reordering right now.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
              {['Product', 'Category', 'In Stock', 'Sold (30d)', 'Avg / Day', 'Days Left', 'Status', 'Suggested Reorder'].map((h) => (
                <th key={h} style={{ ...cell, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((i) => (
              <tr key={i.product_id} style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
                <td style={{ ...cell, color: COLORS.text }}>{i.product_name}</td>
                <td style={cell}>{i.category}</td>
                <td style={cell}>{i.stock_level}</td>
                <td style={cell}>{i.units_sold}</td>
                <td style={cell}>{i.avg_daily_sales.toFixed(2)}</td>
                <td style={cell}>{i.days_left === null ? '—' : i.days_left.toFixed(1)}</td>
                <td style={cell}><Badge color={STATUS_COLOR[i.status]}>{i.status}</Badge></td>
                <td style={{ ...cell, color: COLORS.text }}>{i.suggested_reorder_qty > 0 ? `${i.suggested_reorder_qty} units` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ color: COLORS.dim, fontSize: 11, margin: '12px 0 0' }}>
        Estimates from the last {data.lookback_days} days of sales. Reorder now: {t.reorder_now_days} days of stock or less.
        Reorder soon: {t.reorder_soon_days} days or less. Suggested quantity restores {t.cover_days} days of cover.
      </p>
    </div>
  );
}