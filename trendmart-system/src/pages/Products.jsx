import { useEffect, useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { COLORS, Btn, Input, Field, Modal, Toast, Badge, fmtCurrency } from '../components/ui';

export default function Products() {
  const { isManager } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [form, setForm]         = useState(null);
  const [toast, setToast]       = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = () => {
    setLoading(true); setError(null);
    API.get(`/products${showInactive ? '?include_inactive=1' : ''}`)
      .then((res) => setProducts(res.data))
      .catch((err) => setError(err.response?.data?.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [showInactive]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (form.product_id) await API.put(`/products/${form.product_id}`, form);
      else await API.post('/products', form);
      setForm(null); setToast({ msg: 'Product saved.', type: 'success' }); load();
    } catch (err) { setToast({ msg: err.response?.data?.message || 'Save failed.', type: 'error' }); }
  };

  const deactivate = async (id) => {
    if (!confirm('Deactivate this product?')) return;
    await API.delete(`/products/${id}`);
    setToast({ msg: 'Product deactivated.', type: 'success' });
    load();
  };

  const reactivate = async (id) => {
    await API.patch(`/products/${id}/activate`);
    setToast({ msg: 'Product reactivated.', type: 'success' });
    load();
  };

  if (loading) return <div style={{ color: COLORS.muted, padding: 32 }}>Loading products...</div>;
  if (error)   return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Products</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isManager && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.muted, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show Inactive
            </label>
          )}
          {isManager && <Btn onClick={() => setForm({ min_stock_level: 10 })}>Add Product</Btn>}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState title="No Products Yet" message="No products have been added to the catalogue."
          action={isManager && <Btn onClick={() => setForm({ min_stock_level: 10 })}>Add First Product</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {products.map((p) => (
            <div key={p.product_id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18, opacity: p.is_active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>{p.product_name}</div>
                {!p.is_active && <Badge color={COLORS.dim}>Inactive</Badge>}
              </div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 6 }}>{p.category}</div>
              <div style={{ color: COLORS.text, fontSize: 15, marginBottom: 4 }}>{fmtCurrency(p.price)}</div>
              <div style={{ fontSize: 12, color: p.stock_level <= p.min_stock_level ? COLORS.amber : COLORS.muted }}>
                Stock: {p.stock_level} {p.stock_level <= p.min_stock_level && '⚠ Low'}
              </div>
              {isManager && (
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  {p.is_active ? (
                    <>
                      <button onClick={() => setForm(p)} style={{ background: 'none', border: 'none', color: COLORS.cyan, cursor: 'pointer', fontSize: 12, padding: 0 }}>Edit</button>
                      <button onClick={() => deactivate(p.product_id)} style={{ background: 'none', border: 'none', color: COLORS.rose, cursor: 'pointer', fontSize: 12, padding: 0 }}>Deactivate</button>
                    </>
                  ) : (
                    <button onClick={() => reactivate(p.product_id)} style={{ background: 'none', border: 'none', color: COLORS.emerald, cursor: 'pointer', fontSize: 12, padding: 0 }}>Reactivate</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.product_id ? 'Edit Product' : 'Add Product'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Field label="Product Name" required>
              <Input required defaultValue={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
            </Field>
            <Field label="Category" required>
              <Input required defaultValue={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="Price (R)" required>
              <Input required type="number" step="0.01" min="0" defaultValue={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} />
            </Field>
            <Field label="Stock Level">
              <Input type="number" min="0" defaultValue={form.stock_level} onChange={(e) => setForm({ ...form, stock_level: parseInt(e.target.value) })} />
            </Field>
            <Field label="Minimum Stock Level (Low-Stock Threshold)" required>
              <Input required type="number" min="0" defaultValue={form.min_stock_level ?? 10}
                onChange={(e) => setForm({ ...form, min_stock_level: parseInt(e.target.value) })} />
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Btn type="submit">Save</Btn>
              <Btn type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}