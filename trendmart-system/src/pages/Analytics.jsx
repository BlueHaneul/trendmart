import { useEffect, useState } from 'react';
import API from '../api/axios';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import ReorderPanel from '../components/ReorderPanel';
import { COLORS, KpiCard, MiniBarChart, shortDate, fmtCurrency } from '../components/ui';

export default function Analytics() {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true); setError(null);
    API.get('/reports/analytics').then((res) => setData(res.data)).catch((err) => setError(err.response?.data?.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // The KPI row needs the trend data, which only exists once there are 7+ days of sales history.
  const trendsReady = data && !data.insufficient_data;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Advanced Analytics</h1>

      {trendsReady && <KpiRow data={data} />}

      {/* Decision support works from stock and recent sales, so it never waits for the trend history */}
      <ReorderPanel />

      {loading ? (
        <div style={{ color: COLORS.muted, padding: 32 }}>Loading analytics...</div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data.insufficient_data ? (
        <EmptyState title="Not Enough Data" message={data.message} />
      ) : (
        <TrendSections data={data} />
      )}
    </div>
  );
}

function KpiRow({ data }) {
  const wowPositive = data.week_on_week_change_percent >= 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      <KpiCard label="30-Day Revenue" value={fmtCurrency(data.thirty_day_revenue)} color={COLORS.cyan} />
      <KpiCard label="Daily Average" value={fmtCurrency(data.daily_average_revenue)} color={COLORS.blue} />
      <KpiCard label="Week-on-Week" value={data.week_on_week_change_percent === null ? 'N/A' : `${data.week_on_week_change_percent.toFixed(1)}%`} color={wowPositive ? COLORS.emerald : COLORS.rose} />
      <KpiCard label="Avg Profit Margin" value={`${(data.profit_margins.reduce((s, p) => s + p.margin_percent, 0) / data.profit_margins.length).toFixed(1)}%`} color={COLORS.violet} />
    </div>
  );
}

function TrendSections({ data }) {
  const trendLabels = data.thirty_day_trend.map((d) => shortDate(d.day));
  const trendValues = data.thirty_day_trend.map((d) => Number(d.revenue));

  return (
    <>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ color: COLORS.text, margin: '0 0 16px', fontSize: 15 }}>30-Day Trend</h3>
        <MiniBarChart data={trendValues} labels={trendLabels} color={COLORS.cyan} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: COLORS.text, margin: '0 0 14px', fontSize: 14 }}>Revenue by Category</h3>
          {data.category_breakdown.map((c) => (
            <div key={c.category} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>
                <span>{c.category}</span><span>{c.percentage.toFixed(1)}%</span>
              </div>
              <div style={{ width: '100%', background: COLORS.border, borderRadius: 6, height: 6 }}>
                <div style={{ width: `${c.percentage}%`, background: COLORS.cyan, height: 6, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: COLORS.text, margin: '0 0 14px', fontSize: 14 }}>Sales Trend Prediction</h3>
          <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 6 }}>Next 7 days: <span style={{ color: COLORS.text }}>{fmtCurrency(data.forecast.next_7_days)}</span></div>
          <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 6 }}>Next 14 days: <span style={{ color: COLORS.text }}>{fmtCurrency(data.forecast.next_14_days)}</span></div>
          <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10 }}>Next 30 days: <span style={{ color: COLORS.text }}>{fmtCurrency(data.forecast.next_30_days)}</span></div>
          <p style={{ color: COLORS.dim, fontSize: 11 }}>Based on the 30-day moving average. An estimate, not a statistical forecast.</p>
        </div>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, overflowX: 'auto' }}>
        <h3 style={{ color: COLORS.text, margin: '0 0 14px', fontSize: 14 }}>Profit Margin Analysis (55% estimated COGS)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
            <th style={{ padding: '8px 0' }}>Product</th><th>Revenue</th><th>Est. Cost</th><th>Est. Profit</th><th>Margin %</th>
          </tr></thead>
          <tbody>{data.profit_margins.map((p) => (
            <tr key={p.product_name} style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
              <td style={{ padding: '8px 0', color: COLORS.text }}>{p.product_name}</td>
              <td>{fmtCurrency(p.revenue)}</td><td>{fmtCurrency(p.estimated_cost)}</td><td>{fmtCurrency(p.estimated_profit)}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60, background: COLORS.border, borderRadius: 6, height: 6 }}>
                    <div style={{ width: `${p.margin_percent}%`, background: COLORS.emerald, height: 6, borderRadius: 6 }} />
                  </div>
                  {p.margin_percent.toFixed(1)}%
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}