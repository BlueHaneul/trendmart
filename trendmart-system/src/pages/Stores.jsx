import { useEffect, useState } from 'react';
import API from '../api/axios';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { COLORS, Btn, Input, Field, Modal, Toast } from '../components/ui';

export default function Stores() {
  const [stores, setStores]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [form, setForm]       = useState(null);
  const [toast, setToast]     = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    API.get('/stores').then((res) => setStores(res.data))
      .catch((err) => setError(err.response?.data?.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (form.store_id) await API.put(`/stores/${form.store_id}`, form);
      else await API.post('/stores', form);
      setForm(null); setToast({ msg: 'Store saved.', type: 'success' }); load();
    } catch (err) { setToast({ msg: err.response?.data?.message || 'Save failed.', type: 'error' }); }
  };

  const deactivate = async (id) => {
    if (!confirm('Deactivate this store?')) return;
    await API.delete(`/stores/${id}`);
    setToast({ msg: 'Store deactivated.', type: 'success' });
    load();
  };

  if (loading) return <div style={{ color: COLORS.muted, padding: 32 }}>Loading stores...</div>;
  if (error)   return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Stores</h1>
        <Btn onClick={() => setForm({})}>Add Store</Btn>
      </div>

      {stores.length === 0 ? (
        <EmptyState title="No Stores Yet" message="Add your first store to begin recording sales." action={<Btn onClick={() => setForm({})}>Add Store</Btn>} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {stores.map((s) => (
            <div key={s.store_id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18 }}>
              <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>{s.store_name}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>{s.location}</div>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>Manager: {s.manager_name}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button onClick={() => setForm(s)} style={{ background: 'none', border: 'none', color: COLORS.cyan, cursor: 'pointer', fontSize: 12, padding: 0 }}>Edit</button>
                <button onClick={() => deactivate(s.store_id)} style={{ background: 'none', border: 'none', color: COLORS.rose, cursor: 'pointer', fontSize: 12, padding: 0 }}>Deactivate</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.store_id ? 'Edit Store' : 'Add Store'} onClose={() => setForm(null)}>
          <form onSubmit={save}>
            <Field label="Store Name" required><Input required defaultValue={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} /></Field>
            <Field label="Location" required><Input required defaultValue={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="Manager Name" required><Input required defaultValue={form.manager_name} onChange={(e) => setForm({ ...form, manager_name: e.target.value })} /></Field>
            {!form.store_id && (
              <Field label="Opened Date" required><Input required type="date" onChange={(e) => setForm({ ...form, opened_date: e.target.value })} /></Field>
            )}
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
