import { useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { COLORS, Btn, Input, fmtCurrency } from '../components/ui';
import { downloadCsv } from '../utils/exportCsv';

// One definition per report, shared by the on-screen table and both exports,
// so what you see and what you download can never drift apart.
const DAILY_COLUMNS = [
  { key: 'store_name', label: 'Store' },
  { key: 'transaction_count', label: 'Transactions', numeric: true },
  { key: 'total_revenue', label: 'Revenue (R)', currency: true },
];
const BEST_SELLER_COLUMNS = [
  { key: 'product_name', label: 'Product' },
  { key: 'category', label: 'Category' },
  { key: 'units_sold', label: 'Units Sold', numeric: true },
  { key: 'total_revenue', label: 'Revenue (R)', currency: true },
];
const STORE_PERFORMANCE_COLUMNS = [
  { key: 'store_name', label: 'Store' },
  { key: 'transaction_count', label: 'Transactions', numeric: true },
  { key: 'total_revenue', label: 'Revenue (R)', currency: true },
  { key: 'avg_transaction_value', label: 'Avg Transaction Value (R)', currency: true },
];

// Daily Sales and Store Performance return one row per active store, zeros included,
// so "has rows" is not the same as "has data". A report has data only if at least one
// row records real activity (its activity column is above zero).
const hasActivity = (rows, activityKey) => rows.some((r) => Number(r[activityKey]) > 0);

export default function Reports() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState('daily');
  return (
    <div>
      <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Reports</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Btn variant={tab === 'daily' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('daily')}>Daily Sales</Btn>
        {isManager && <Btn variant={tab === 'best-sellers' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('best-sellers')}>Best Sellers</Btn>}
        {isManager && <Btn variant={tab === 'store-performance' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('store-performance')}>Store Performance</Btn>}
      </div>
      {tab === 'daily' && <DailyReport />}
      {tab === 'best-sellers' && isManager && (
        <RangeReport endpoint="best-sellers" title="Best Selling Products Report" columns={BEST_SELLER_COLUMNS} activityKey="units_sold" />
      )}
      {tab === 'store-performance' && isManager && (
        <RangeReport endpoint="store-performance" title="Store Performance Report" columns={STORE_PERFORMANCE_COLUMNS} activityKey="transaction_count" />
      )}
    </div>
  );
}

const Table = ({ columns, rows }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead><tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
        {columns.map((c) => <th key={c.key} style={{ padding: '10px 16px' }}>{c.label}</th>)}
      </tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
          {columns.map((c) => (
            <td key={c.key} style={{ padding: '10px 16px' }}>{c.currency ? fmtCurrency(r[c.key]) : r[c.key]}</td>
          ))}
        </tr>
      ))}</tbody>
    </table>
  </div>
);

function DailyReport() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const run = () => {
    setError(null);
    API.get(`/reports/daily?date=${date}`).then((res) => setData(res.data)).catch((err) => setError(err.response?.data?.message));
  };

  const hasData = data && hasActivity(data.stores, 'transaction_count');

  // The PDF library is loaded only when this is clicked, so it never slows down or
  // endangers the rest of the page; any failure shows as a normal error message.
  const exportPdf = async () => {
    try {
      const { downloadPdf } = await import('../utils/exportPdf');
      downloadPdf({
        filename: `daily-sales_${data.date}.pdf`,
        title: 'Daily Sales Report',
        subtitle: `Date: ${data.date}`,
        columns: DAILY_COLUMNS,
        rows: data.stores,
        generatedBy: user,
      });
    } catch (err) {
      console.error(err);
      setError('Could not generate the PDF. Please try again.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Btn onClick={run}>Run Report</Btn>
        {/* Uses data.date (the date that was actually run), not the input, which may have changed since */}
        {hasData && (
          <>
            <Btn variant="ghost" onClick={() => downloadCsv(`daily-sales_${data.date}.csv`, DAILY_COLUMNS, data.stores)}>Export CSV</Btn>
            <Btn variant="ghost" onClick={exportPdf}>Export PDF</Btn>
          </>
        )}
      </div>
      {error && <ErrorState message={error} />}
      {data && (hasData
        ? <Table columns={DAILY_COLUMNS} rows={data.stores} />
        : <EmptyState title="No Data" message="No sales recorded for this date." />)}
    </div>
  );
}

function RangeReport({ endpoint, title, columns, activityKey }) {
  const { user } = useAuth();
  const [start, setStart]   = useState('');
  const [end, setEnd]       = useState('');
  const [result, setResult] = useState(null); // { rows, start, end }, the range that was actually run
  const [error, setError]   = useState(null);

  const run = () => {
    if (!start || !end) { setError('Select a start and end date.'); return; }
    setError(null);
    API.get(`/reports/${endpoint}?start_date=${start}&end_date=${end}`)
      .then((res) => setResult({ rows: res.data, start, end }))
      .catch((err) => setError(err.response?.data?.message));
  };

  const hasData = result && hasActivity(result.rows, activityKey);

  const exportPdf = async () => {
    try {
      const { downloadPdf } = await import('../utils/exportPdf');
      downloadPdf({
        filename: `${endpoint}_${result.start}_to_${result.end}.pdf`,
        title,
        subtitle: `Period: ${result.start} to ${result.end}`,
        columns,
        rows: result.rows,
        generatedBy: user,
      });
    } catch (err) {
      console.error(err);
      setError('Could not generate the PDF. Please try again.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Btn onClick={run}>Run Report</Btn>
        {hasData && (
          <>
            <Btn variant="ghost" onClick={() => downloadCsv(`${endpoint}_${result.start}_to_${result.end}.csv`, columns, result.rows)}>Export CSV</Btn>
            <Btn variant="ghost" onClick={exportPdf}>Export PDF</Btn>
          </>
        )}
      </div>
      {error && <ErrorState message={error} />}
      {result && (hasData
        ? <Table columns={columns} rows={result.rows} />
        : <EmptyState title="No Data" message="No results for the selected date range." />)}
    </div>
  );
}