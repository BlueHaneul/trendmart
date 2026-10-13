import { useEffect, useState } from 'react';
import API from '../api/axios';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { COLORS, Btn, Input, KpiCard, fmtCurrency } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export default function Enquiry() {
  const [tab, setTab] = useState('product');
  return (
    <div>
      <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Enquiry</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Btn variant={tab === 'product' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('product')}>Search Product Sales</Btn>
        <Btn variant={tab === 'store' ? 'primary' : 'ghost'} size="sm" onClick={() => setTab('store')}>View Store Performance</Btn>
      </div>
      {tab === 'product' ? <ProductSalesSearch /> : <StorePerformanceView />}
    </div>
  );
}

function ProductSalesSearch() {
  const [term, setTerm]   = useState('');
  const [sales, setSales] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (term.length < 2) { setSales(null); setError(null); return; }
    API.get('/sales').then((res) => {
      const matches = res.data.filter((t) => t.product_name.toLowerCase().includes(term.toLowerCase()));
      setSales(matches);
    }).catch((err) => setError(err.response?.data?.message));
  }, [term]);

  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <Input placeholder="Type a product name to search sales history." value={term} onChange={(e) => setTerm(e.target.value)} style={{ marginBottom: 20, maxWidth: 420 }} />
      {term.length < 2 ? (
        <p style={{ color: COLORS.dim }}>Type a product name to search sales history.</p>
      ) : sales === null ? (
        <p style={{ color: COLORS.dim }}>Searching...</p>
      ) : sales.length === 0 ? (
        <EmptyState title="No Results" message={`No sales found for "${term}". Check the product name and try again.`} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <KpiCard label="Total Revenue" value={fmtCurrency(sales.reduce((s, t) => s + Number(t.subtotal), 0))} color={COLORS.cyan} />
            <KpiCard label="Units Sold" value={sales.reduce((s, t) => s + t.quantity, 0)} color={COLORS.blue} />
            <KpiCard label="Stores" value={new Set(sales.map((t) => t.store_name)).size} color={COLORS.violet} />
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
                <th style={{ padding: '10px 16px' }}>Date</th><th style={{ padding: '10px 16px' }}>Store</th><th style={{ padding: '10px 16px' }}>Qty</th><th style={{ padding: '10px 16px' }}>Total</th>
              </tr></thead>
              <tbody>{sales.map((t) => (
                <tr key={t.transaction_id} style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '10px 16px' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 16px' }}>{t.store_name}</td>
                  <td style={{ padding: '10px 16px' }}>{t.quantity}</td>
                  <td style={{ padding: '10px 16px', color: COLORS.text }}>{fmtCurrency(t.subtotal)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StorePerformanceView() {
  const { user, isManager } = useAuth();
  const [stores, setStores]     = useState(null); // null = loading, not "no stores"
  const [selected, setSelected] = useState(null);
  const [data, setData]         = useState(null);

  useEffect(() => { API.get('/stores').then((res) => setStores(res.data)); }, []);

  const selectStore = async (store) => {
    setSelected(store);
    setData(null); // clear stale data immediately so old figures don't flash for the new store
    const [salesRes, dailyRes] = await Promise.all([API.get(`/sales?store_id=${store.store_id}`), API.get('/reports/daily')]);
    setData({ sales: salesRes.data, daily: dailyRes.data.stores.find((s) => s.store_id === store.store_id) });
  };

  const visibleStores = stores === null ? [] : (isManager ? stores : stores.filter((s) => s.store_id === user.assigned_store_id));

  useEffect(() => {
    if (!isManager && stores !== null && visibleStores.length > 0 && !selected) {
      selectStore(visibleStores[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  if (stores === null) return <p style={{ color: COLORS.dim }}>Loading stores...</p>;
  if (stores.length === 0) return <EmptyState title="No Active Stores" message="No active stores available. Contact your Administrator." />;
  if (!isManager && visibleStores.length === 0) return <EmptyState title="No Assigned Store" message="Your account has no assigned store. Contact your Administrator." />;

  return (
    <div>
      {isManager && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {visibleStores.map((s) => (
            <Btn key={s.store_id} variant={selected?.store_id === s.store_id ? 'primary' : 'ghost'} size="sm" onClick={() => selectStore(s)}>{s.store_name}</Btn>
          ))}
        </div>
      )}
      {selected && !data ? (
        <p style={{ color: COLORS.dim }}>Loading store performance...</p>
      ) : selected && data && (data.sales.length === 0 ? (
        <EmptyState title="No Transactions" message="No transactions recorded for this store yet." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <KpiCard label="Total Revenue" value={fmtCurrency(data.sales.reduce((s, t) => s + Number(t.subtotal), 0))} color={COLORS.cyan} />
            <KpiCard label="Today's Revenue" value={fmtCurrency(data.daily?.total_revenue || 0)} color={COLORS.emerald} />
            <KpiCard label="Transactions" value={data.sales.length} color={COLORS.blue} />
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
                <th style={{ padding: '10px 16px' }}>Date</th><th style={{ padding: '10px 16px' }}>Product</th><th style={{ padding: '10px 16px' }}>Qty</th><th style={{ padding: '10px 16px' }}>Total</th>
              </tr></thead>
              <tbody>{data.sales.slice(0, 10).map((t) => (
                <tr key={t.transaction_id} style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '10px 16px' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 16px' }}>{t.product_name}</td>
                  <td style={{ padding: '10px 16px' }}>{t.quantity}</td>
                  <td style={{ padding: '10px 16px', color: COLORS.text }}>{fmtCurrency(t.subtotal)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      ))}
    </div>
  );
}
