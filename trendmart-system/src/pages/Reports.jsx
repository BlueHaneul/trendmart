import { useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { COLORS, Btn, Input, fmtCurrency } from '../components/ui';

export default function Reports() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('daily');
  return (
    <div>
      <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Reports</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Btn variant={tab === 'daily' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('daily')}>Daily Sales</Btn>
        {isAdmin && <Btn variant={tab === 'best-sellers' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('best-sellers')}>Best Sellers</Btn>}
        {isAdmin && <Btn variant={tab === 'store-performance' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('store-performance')}>Store Performance</Btn>}
      </div>
      {tab === 'daily' && <DailyReport />}
      {tab === 'best-sellers' && isAdmin && <RangeReport endpoint="best-sellers" columns={['product_name', 'category', 'units_sold', 'total_revenue']} />}
      {tab === 'store-performance' && isAdmin && <RangeReport endpoint="store-performance" columns={['store_name', 'transaction_count', 'total_revenue', 'avg_transaction_value']} />}
    </div>
  );
}

const Table = ({ columns, rows }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead><tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
        {columns.map((c) => <th key={c} style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</th>)}
      </tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
          {columns.map((c) => <td key={c} style={{ padding: '10px 16px' }}>{typeof r[c] === 'number' ? (c.includes('revenue') || c.includes('value') ? fmtCurrency(r[c]) : r[c]) : r[c]}</td>)}
        </tr>
      ))}</tbody>
    </table>
  </div>
);

function DailyReport() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const run = () => {
    setError(null);
    API.get(`/reports/daily?date=${date}`).then((res) => setData(res.data)).catch((err) => setError(err.response?.data?.message));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Btn onClick={run}>Run Report</Btn>
      </div>
      {error && <ErrorState message={error} />}
      {data && (data.stores.length === 0
        ? <EmptyState title="No Data" message="No sales recorded for this date." />
        : <Table columns={['store_name', 'transaction_count', 'total_revenue']} rows={data.stores} />)}
    </div>
  );
}

function RangeReport({ endpoint, columns }) {
  const [start, setStart] = useState('');
  const [end, setEnd]     = useState('');
  const [rows, setRows]   = useState(null);
  const [error, setError] = useState(null);

  const run = () => {
    if (!start || !end) { setError('Select a start and end date.'); return; }
    setError(null);
    API.get(`/reports/${endpoint}?start_date=${start}&end_date=${end}`).then((res) => setRows(res.data)).catch((err) => setError(err.response?.data?.message));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Btn onClick={run}>Run Report</Btn>
      </div>
      {error && <ErrorState message={error} />}
      {rows && (rows.length === 0
        ? <EmptyState title="No Data" message="No results for the selected date range." />
        : <Table columns={columns} rows={rows} />)}
    </div>
  );
}
