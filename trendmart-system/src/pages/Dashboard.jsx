import { useEffect, useState } from 'react';
import API from '../api/axios';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { COLORS, Icon, KpiCard, MiniBarChart, shortDate, fmtCurrency } from '../components/ui';

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true); setError(null);
    API.get('/reports/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div style={{ color: COLORS.muted, padding: 32 }}>Loading dashboard...</div>;
  if (error)   return <ErrorState message={error} onRetry={load} />;
  if (!data || (data.today_transaction_count === 0 && data.all_time_revenue === 0))
    return <EmptyState title="No Transactions Yet" message="The dashboard will populate once sales are recorded." />;

  // The fix: format each day as a short label BEFORE handing it to the chart,
  // instead of letting the raw ISO timestamp from MySQL reach the screen.
  const trendLabels = data.seven_day_trend.map((d) => shortDate(d.day));
  const trendValues = data.seven_day_trend.map((d) => Number(d.revenue));

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KpiCard label="Today's Revenue" value={fmtCurrency(data.today_revenue)} color={COLORS.cyan} icon={<Icon name="sales" size={16} />} />
        <KpiCard label="Today's Transactions" value={data.today_transaction_count} color={COLORS.blue} icon={<Icon name="dashboard" size={16} />} />
        <KpiCard label="All-Time Revenue" value={fmtCurrency(data.all_time_revenue)} color={COLORS.emerald} icon={<Icon name="analytics" size={16} />} />
        <KpiCard label="Top Product" value={data.top_products[0]?.product_name || '—'} color={COLORS.violet} icon={<Icon name="products" size={16} />} />
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ color: COLORS.text, margin: '0 0 16px', fontSize: 15 }}>7-Day Revenue</h3>
        <MiniBarChart data={trendValues} labels={trendLabels} color={COLORS.cyan} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: COLORS.text, margin: '0 0 12px', fontSize: 14 }}>Top 5 Products</h3>
          {data.top_products.map((p) => (
            <div key={p.product_name} style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.muted, padding: '6px 0', fontSize: 13 }}>
              <span>{p.product_name}</span><span style={{ color: COLORS.text }}>{fmtCurrency(p.revenue)}</span>
            </div>
          ))}
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: COLORS.text, margin: '0 0 12px', fontSize: 14 }}>Revenue Per Store</h3>
          {data.per_store_revenue.map((s) => (
            <div key={s.store_name} style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.muted, padding: '6px 0', fontSize: 13 }}>
              <span>{s.store_name}</span><span style={{ color: COLORS.text }}>{fmtCurrency(s.revenue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
