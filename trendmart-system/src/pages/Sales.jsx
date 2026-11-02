import { useEffect, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { COLORS, Btn, Input, Select, Field, Modal, Toast, Badge, fmtCurrency } from '../components/ui';

const EMPTY_FILTERS = { product: '', category: '', store_id: '', start_date: '', end_date: '' };

const FilterField = ({ label, children }) => (
  <div>
    <div style={{ color: COLORS.dim, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
      {label}
    </div>
    {children}
  </div>
);

export default function Sales() {
  const { user, isManager } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts]         = useState([]);
  const [stores, setStores]             = useState([]);
  const [filters, setFilters]           = useState(EMPTY_FILTERS); // what the inputs show
  const [applied, setApplied]           = useState(EMPTY_FILTERS); // what the last request used (debounced)
  const [firstLoad, setFirstLoad]       = useState(true);
  const [fetching, setFetching]         = useState(false);
  const [error, setError]               = useState(null);
  const [reloadKey, setReloadKey]       = useState(0);
  const [modalOpen, setModalOpen]       = useState(false);
  const [saleForm, setSaleForm]         = useState({ store_id: user.assigned_store_id || '', product_id: '', quantity: 1 });
  const [saleError, setSaleError]       = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [toast, setToast]               = useState(null);

  const refresh = () => setReloadKey((k) => k + 1);

  // Reference data for the Record Sale form and the filter dropdowns
  useEffect(() => {
    Promise.all([API.get('/products'), API.get('/stores')])
      .then(([p, s]) => { setProducts(p.data); setStores(s.data); })
      .catch((err) => setError(err.response?.data?.message));
  }, [reloadKey]);

  // Debounce typing: one request per pause, not one per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setApplied(filters), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Fetch transactions whenever the applied filters change (or after a sale/cancel)
  useEffect(() => {
    if (applied.start_date && applied.end_date && applied.start_date > applied.end_date) return; // invalid range: keep current results
    let cancelled = false; // ignore a slow response that arrives after a newer request
    const params = new URLSearchParams();
    Object.entries(applied).forEach(([key, value]) => { if (value) params.append(key, value); });
    setFetching(true);
    API.get(`/sales?${params}`)
      .then((res) => { if (!cancelled) { setTransactions(res.data); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load transactions.'); })
      .finally(() => { if (!cancelled) { setFetching(false); setFirstLoad(false); } });
    return () => { cancelled = true; };
  }, [applied, reloadKey]);

  const rangeInvalid = filters.start_date && filters.end_date && filters.start_date > filters.end_date;
  const categories = [...new Set(products.map((p) => p.category))].sort();
  const storeName = (id) => stores.find((s) => String(s.store_id) === String(id))?.store_name || id;

  const chips = [];
  if (filters.product)    chips.push(`Product: "${filters.product}"`);
  if (filters.category)   chips.push(`Category: ${filters.category}`);
  if (filters.store_id)   chips.push(`Store: ${storeName(filters.store_id)}`);
  if (filters.start_date) chips.push(`From: ${filters.start_date}`);
  if (filters.end_date)   chips.push(`To: ${filters.end_date}`);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); };
  const active = (key) => (filters[key] ? { borderColor: COLORS.cyan } : {});

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
      refresh();
    } catch (err) {
      setSaleError(err.response?.data?.message || 'Transaction failed.');
    }
  };

  const cancelSale = async (id) => {
    try {
      await API.put(`/sales/${id}/cancel`);
      setToast({ msg: 'Transaction cancelled.', type: 'success' });
    } catch (err) {
      setToast({ msg: err.response?.data?.message || 'Cancellation failed.', type: 'error' });
    }
    setConfirmCancelId(null);
    refresh();
  };

  let body;
  if (firstLoad && !error) {
    body = <div style={{ color: COLORS.muted, padding: 32 }}>Loading transactions...</div>;
  } else if (error) {
    body = <ErrorState message={error} onRetry={refresh} />;
  } else if (transactions.length === 0) {
    body = chips.length > 0 ? (
      <EmptyState title="No Matches" message="No transactions match these filters."
        action={<Btn variant="ghost" onClick={clearFilters}>Clear filters</Btn>} />
    ) : (
      <EmptyState title="No Transactions Recorded Yet" message="Click Record Sale to begin." />
    );
  } else {
    body = (
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
              {['ID', 'Date', 'Product', 'Category', 'Store', 'Staff', 'Qty', 'Total', 'Status', ''].map((h) => (
                <th key={h} style={{ padding: '12px 16px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const isToday = new Date(t.transaction_date).toDateString() === new Date().toDateString();
              const canCancel = t.status === 'Completed' && isToday && (isManager || t.user_id === user.user_id);
              return (
                <tr key={t.transaction_id} style={{ color: COLORS.muted, opacity: t.status === 'Cancelled' ? 0.5 : 1, borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '10px 16px' }}>{t.transaction_id}</td>
                  <td style={{ padding: '10px 16px' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 16px', color: COLORS.text }}>{t.product_name}</td>
                  <td style={{ padding: '10px 16px' }}>{t.category}</td>
                  <td style={{ padding: '10px 16px' }}>{t.store_name}</td>
                  <td style={{ padding: '10px 16px' }}>{t.staff_name}</td>
                  <td style={{ padding: '10px 16px' }}>{t.quantity}</td>
                  <td style={{ padding: '10px 16px', color: COLORS.text }}>{fmtCurrency(t.subtotal)}</td>
                  <td style={{ padding: '10px 16px' }}><Badge color={t.status === 'Completed' ? COLORS.emerald : COLORS.rose}>{t.status}</Badge></td>
                  <td style={{ padding: '10px 16px' }}>
                    {canCancel && (
                      <button onClick={() => setConfirmCancelId(t.transaction_id)} style={{ background: 'none', border: 'none', color: COLORS.rose, cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Sales Transactions</h1>
        <Btn onClick={() => { setSaleForm({ store_id: user.assigned_store_id || '', product_id: '', quantity: 1 }); setSaleError(null); setModalOpen(true); }}>
          Record Sale
        </Btn>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <FilterField label="Product">
            <Input placeholder="Search product" value={filters.product} onChange={(e) => setFilter('product', e.target.value)} style={active('product')} />
          </FilterField>
          <FilterField label="Category">
            <Select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} style={active('category')}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </FilterField>
          {isManager && (
            <FilterField label="Store">
              <Select value={filters.store_id} onChange={(e) => setFilter('store_id', e.target.value)} style={active('store_id')}>
                <option value="">All stores</option>
                {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
              </Select>
            </FilterField>
          )}
          <FilterField label="From">
            <Input type="date" value={filters.start_date} onChange={(e) => setFilter('start_date', e.target.value)} style={active('start_date')} />
          </FilterField>
          <FilterField label="To">
            <Input type="date" value={filters.end_date} onChange={(e) => setFilter('end_date', e.target.value)} style={active('end_date')} />
          </FilterField>
        </div>
        {rangeInvalid && (
          <div style={{ color: COLORS.rose, fontSize: 12, marginTop: 8 }}>The start date must be on or before the end date.</div>
        )}
      </div>

      {chips.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ color: COLORS.dim, fontSize: 12 }}>Filters active:</span>
          {chips.map((c) => <Badge key={c} color={COLORS.cyan}>{c}</Badge>)}
          <Btn variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Btn>
        </div>
      )}

      {!firstLoad && !error && (
        <div style={{ color: COLORS.dim, fontSize: 12, marginBottom: 8 }}>
          {fetching ? 'Updating…' : `${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`}
        </div>
      )}

      <div style={{ opacity: fetching && !firstLoad ? 0.55 : 1, transition: 'opacity 0.15s' }}>{body}</div>

      {modalOpen && (
        <Modal title="Record Sale" onClose={() => setModalOpen(false)}>
          <form onSubmit={recordSale}>
            {saleError && (
              <div style={{ background: COLORS.rose + '18', border: `1px solid ${COLORS.rose}40`, color: COLORS.rose, fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                {saleError}
              </div>
            )}

            <Field label="Store" required>
              {isManager ? (
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