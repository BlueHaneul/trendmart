import { useEffect, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { COLORS, Btn, Input, Select, Field, Modal, Toast, Badge, fmtCurrency } from '../components/ui';

export default function Sales() {
  const { user, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts]         = useState([]);
  const [stores, setStores]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState('');
  const [date, setDate]                 = useState('');
  const [modalOpen, setModalOpen]       = useState(false);
  const [saleForm, setSaleForm]         = useState({ store_id: user.assigned_store_id || '', product_id: '', quantity: 1 });
  const [saleError, setSaleError]       = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [toast, setToast]               = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    Promise.all([API.get(`/sales?${params}`), API.get('/products'), API.get('/stores')])
      .then(([txRes, prodRes, storeRes]) => { setTransactions(txRes.data); setProducts(prodRes.data); setStores(storeRes.data); })
      .catch((err) => setError(err.response?.data?.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [date]);

  const selectedProduct = products.find((p) => p.product_id === Number(saleForm.product_id));
  const liveTotal = selectedProduct ? (selectedProduct.price * (saleForm.quantity || 0)).toFixed(2) : '0.00';

  const recordSale = async (e) => {
    e.preventDefault();
    setSaleError(null);
    if (!saleForm.store_id) { setSaleError('Select a store.'); return; }
    if (selectedProduct && saleForm.quantity > selectedProduct.stock_level) {
      setSaleError(`Insufficient stock. Only ${selectedProduct.stock_level} units currently available.`);
      return;
    }
    try {
      await API.post('/sales', saleForm);
      setModalOpen(false);
      setToast({ msg: 'Sale recorded.', type: 'success' });
      load();
    } catch (err) {
      setSaleError(err.response?.data?.message || 'Transaction failed.');
    }
  };

  const cancelSale = async (id) => {
    await API.put(`/sales/${id}/cancel`);
    setConfirmCancelId(null);
    setToast({ msg: 'Transaction cancelled.', type: 'success' });
    load();
  };

  const filtered = transactions.filter((t) =>
    !search || t.product_name.toLowerCase().includes(search.toLowerCase()) || t.store_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ color: COLORS.muted, padding: 32 }}>Loading transactions...</div>;
  if (error)   return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Sales Transactions</h1>
        <Btn onClick={() => { setSaleForm({ store_id: user.assigned_store_id || '', product_id: '', quantity: 1 }); setSaleError(null); setModalOpen(true); }}>Record Sale</Btn>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Input placeholder="Search by product or store" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {transactions.length === 0 ? (
        <EmptyState title="No Transactions Recorded Yet" message="Click Record Sale to begin." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No Matches" message="No transactions match your filter. Clear the filter or try a different date." />
      ) : (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
                {['ID', 'Date', 'Product', 'Store', 'Staff', 'Qty', 'Total', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isToday = new Date(t.transaction_date).toDateString() === new Date().toDateString();
                const canCancel = t.status === 'Completed' && isToday && (isAdmin || t.user_id === user.user_id);
                return (
                  <tr key={t.transaction_id} style={{ color: COLORS.muted, opacity: t.status === 'Cancelled' ? 0.5 : 1, borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: '10px 16px' }}>{t.transaction_id}</td>
                    <td style={{ padding: '10px 16px' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 16px', color: COLORS.text }}>{t.product_name}</td>
                    <td style={{ padding: '10px 16px' }}>{t.store_name}</td>
                    <td style={{ padding: '10px 16px' }}>{t.staff_name}</td>
                    <td style={{ padding: '10px 16px' }}>{t.quantity}</td>
                    <td style={{ padding: '10px 16px', color: COLORS.text }}>{fmtCurrency(t.subtotal)}</td>
                    <td style={{ padding: '10px 16px' }}><Badge color={t.status === 'Completed' ? COLORS.emerald : COLORS.rose}>{t.status}</Badge></td>
                    <td style={{ padding: '10px 16px' }}>{canCancel && <button onClick={() => setConfirmCancelId(t.transaction_id)} style={{ background: 'none', border: 'none', color: COLORS.rose, cursor: 'pointer', fontSize: 12 }}>Cancel</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <Modal title="Record Sale" onClose={() => setModalOpen(false)}>
          <form onSubmit={recordSale}>
            {saleError && <div style={{ background: COLORS.rose + '18', border: `1px solid ${COLORS.rose}40`, color: COLORS.rose, fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{saleError}</div>}

            <Field label="Store" required>
              {isAdmin ? (
                <Select required value={saleForm.store_id} onChange={(e) => setSaleForm({ ...saleForm, store_id: e.target.value })}>
                  <option value="">Select store</option>
                  {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                </Select>
              ) : (
                // Staff: locked to their assigned store, matching the backend's ownership rule
                <Input disabled value={stores.find((s) => s.store_id === user.assigned_store_id)?.store_name || 'Your assigned store'} />
              )}
            </Field>

            <Field label="Product" required>
              <Select required value={saleForm.product_id} onChange={(e) => setSaleForm({ ...saleForm, product_id: e.target.value })}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.stock_level} in stock)</option>)}
              </Select>
            </Field>

            <Field label="Quantity" required>
              <Input required type="number" min="1" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: parseInt(e.target.value) })} />
            </Field>

            <div style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Total: {fmtCurrency(liveTotal)}</div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn type="submit" variant="success">Confirm Sale</Btn>
              <Btn type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {confirmCancelId && (
        <Modal title="Cancel Transaction?" onClose={() => setConfirmCancelId(null)}>
          <p style={{ color: COLORS.muted, marginBottom: 20 }}>Are you sure you want to cancel this transaction? This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="danger" onClick={() => cancelSale(confirmCancelId)}>Yes, Cancel</Btn>
            <Btn variant="ghost" onClick={() => setConfirmCancelId(null)}>Keep</Btn>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
