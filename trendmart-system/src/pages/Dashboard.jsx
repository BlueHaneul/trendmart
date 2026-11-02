import { useEffect, useState } from 'react';
import API from '../api/axios';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { COLORS, Icon, KpiCard, MiniBarChart, Badge, shortDate, fmtCurrency } from '../components/ui';

const REFRESH_MS = 60000;   // FR-04: a low-stock alert must be visible within 60 seconds
const LOW_STOCK_SHOWN = 6;

export default function Dashboard() {
  const [data, setData]           = useState(null);
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchData = () =>
    API.get('/reports/dashboard').then((res) => { setData(res.data); setUpdatedAt(new Date()); });

  const load = () => {
    setLoading(true); setError(null);
    fetchData().catch((err) => setError(err.response?.data?.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Silent background refresh: no loading state, so the page never flickers, and a
    // failed refresh simply keeps the last good data on screen.
    const timer = setInterval(() => fetchData().catch(() => {}), REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div style={{ color: COLORS.muted, padding: 32 }}>Loading dashboard...</div>;
  if (error)   return <ErrorState message={error} onRetry={load} />;
  if (!data || (data.today_transaction_count === 0 && Number(data.all_time_revenue) === 0))
    return <EmptyState title="No Transactions Yet" message="The dashboard will populate once sales are recorded." />;

  const trendLabels = data.seven_day_trend.map((d) => shortDate(d.day));
  const trendValues = data.seven_day_trend.map((d) => Number(d.revenue));
  const lowStock = data.low_stock;
  const hiddenLowStock = Math.max(0, lowStock.length - LOW_STOCK_SHOWN);

  const panel = { background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 };
  const panelTitle = { color: COLORS.text, margin: 0, fontSize: 14 };
  const line = { display: 'flex', justifyContent: 'space-between', color: COLORS.muted, padding: '6px 0', fontSize: 13 };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Dashboard</h1>
        {updatedAt && (
          <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 4 }}>
            Refreshes every minute · last updated {updatedAt.toLocaleTimeString('en-ZA')}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <KpiCard label="Today's Revenue" value={fmtCurrency(data.today_revenue)} color={COLORS.cyan} icon={<Icon name="sales" size={16} />} />
        <KpiCard label="Today's Transactions" value={data.today_transaction_count} color={COLORS.blue} icon={<Icon name="dashboard" size={16} />} />
        <KpiCard label="All-Time Revenue" value={fmtCurrency(data.all_time_revenue)} color={COLORS.emerald} icon={<Icon name="analytics" size={16} />} />
        <KpiCard label="Top Product" value={data.top_products[0]?.product_name || '—'} color={COLORS.violet} icon={<Icon name="products" size={16} />} />
      </div>

      <div style={{ ...panel, padding: 24 }}>
        <h3 style={{ ...panelTitle, fontSize: 15, marginBottom: 16 }}>7-Day Revenue</h3>
        <MiniBarChart data={trendValues} labels={trendLabels} color={COLORS.cyan} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={panel}>
          <h3 style={{ ...panelTitle, marginBottom: 12 }}>Top 5 Products</h3>
          {data.top_products.map((p) => (
            <div key={p.product_name} style={line}>
              <span>{p.product_name}</span><span style={{ color: COLORS.text }}>{fmtCurrency(p.revenue)}</span>
            </div>
          ))}
        </div>

        <div style={panel}>
          <h3 style={{ ...panelTitle, marginBottom: 12 }}>Today's Revenue per Store</h3>
          {data.per_store_revenue.map((s) => (
            <div key={s.store_name} style={line}>
              <span>{s.store_name}</span><span style={{ color: COLORS.text }}>{fmtCurrency(s.revenue)}</span>
            </div>
          ))}
        </div>

        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={panelTitle}>Low Stock Alerts</h3>
            <Badge color={lowStock.length ? COLORS.amber : COLORS.emerald}>{lowStock.length}</Badge>
          </div>
          <div style={{ color: COLORS.dim, fontSize: 11, marginBottom: 8 }}>In stock / minimum</div>
          {lowStock.length === 0 ? (
            <p style={{ color: COLORS.muted, fontSize: 13, margin: 0 }}>All products are above their minimum stock level.</p>
          ) : (
            <>
              {lowStock.slice(0, LOW_STOCK_SHOWN).map((p) => (
                <div key={p.product_id} style={line}>
                  <span>{p.product_name}</span>
                  <span style={{ color: COLORS.amber }}>{p.stock_level} / {p.min_stock_level}</span>
                </div>
              ))}
              {hiddenLowStock > 0 && (
                <div style={{ color: COLORS.dim, fontSize: 12, paddingTop: 6 }}>+ {hiddenLowStock} more on the Products screen</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}