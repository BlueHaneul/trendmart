import { useEffect, useState } from 'react';
import API from '../api/axios';
import { ErrorState } from '../components/ErrorState';
import { COLORS, Btn, Input, Select, Field, Modal, Toast, Badge } from '../components/ui';

export default function UserManagement() {
  const [users, setUsers]   = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [form, setForm]     = useState(null); // Add User modal
  const [pwUser, setPwUser] = useState(null); // Reset Password modal
  const [newPw, setNewPw]   = useState('');
  const [toast, setToast]   = useState(null);

  const load = () => {
    setLoading(true); setError(null);
    Promise.all([API.get('/auth/users'), API.get('/auth/store-options')])
      .then(([u, s]) => { setUsers(u.data); setStores(s.data); })
      .catch((err) => setError(err.response?.data?.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/register', form);
      setForm(null);
      setToast({ msg: 'User created.', type: 'success' });
      load();
    } catch (err) {
      setToast({ msg: err.response?.data?.message || 'Could not create user.', type: 'error' });
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    try {
      await API.put(`/auth/users/${pwUser.user_id}/password`, { new_password: newPw });
      setPwUser(null); setNewPw('');
      setToast({ msg: 'Password reset.', type: 'success' });
    } catch (err) {
      setToast({ msg: err.response?.data?.message || 'Could not reset password.', type: 'error' });
    }
  };

  const toggleActive = async (u) => {
  try {
    if (u.is_active) {
      if (!confirm(`Deactivate ${u.username}?`)) return;
      await API.delete(`/auth/users/${u.user_id}`);
    } else {
      await API.patch(`/auth/users/${u.user_id}/activate`);
    }
    setToast({ msg: `User ${u.is_active ? 'deactivated' : 'reactivated'}.`, type: 'success' });
    load();
  } catch (err) {
    setToast({ msg: err.response?.data?.message || 'Action failed.', type: 'error' });
  }
};

  if (loading) return <div style={{ color: COLORS.muted, padding: 32 }}>Loading users...</div>;
  if (error)   return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, margin: 0 }}>User Management</h1>
        <Btn onClick={() => setForm({ role: 'Staff' })}>Add User</Btn>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ color: COLORS.dim, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
            <th style={{ padding: '10px 16px' }}>Name</th><th style={{ padding: '10px 16px' }}>Username</th>
            <th style={{ padding: '10px 16px' }}>Role</th><th style={{ padding: '10px 16px' }}>MFA</th>
            <th style={{ padding: '10px 16px' }}>Status</th><th style={{ padding: '10px 16px' }}></th>
          </tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.user_id} style={{ color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, opacity: u.is_active ? 1 : 0.5 }}>
              <td style={{ padding: '10px 16px', color: COLORS.text }}>{u.full_name}</td>
              <td style={{ padding: '10px 16px' }}>{u.username}</td>
              <td style={{ padding: '10px 16px' }}><Badge color={COLORS.violet}>{u.role}</Badge></td>
              <td style={{ padding: '10px 16px' }}>{u.mfa_enabled ? <Badge color={COLORS.emerald}>On</Badge> : <Badge color={COLORS.dim}>Off</Badge>}</td>
              <td style={{ padding: '10px 16px' }}>{!u.is_active ? <Badge color={COLORS.dim}>Inactive</Badge>: u.is_locked ? <Badge color={COLORS.rose}>Locked</Badge>: <Badge color={COLORS.emerald}>Active</Badge>}</td>
              <td style={{ padding: '10px 16px', display: 'flex', gap: 10 }}>
                <button onClick={() => setPwUser(u)} style={{ background: 'none', border: 'none', color: COLORS.cyan, cursor: 'pointer', fontSize: 12 }}>Reset Password</button>
                <button onClick={() => toggleActive(u)} style={{ background: 'none', border: 'none', color: u.is_active ? COLORS.rose : COLORS.emerald, cursor: 'pointer', fontSize: 12 }}>
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {form && (
        <Modal title="Add User" onClose={() => setForm(null)}>
          <form onSubmit={createUser}>
            <Field label="Full Name" required><Input required onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="Username" required><Input required onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Password" required><Input required type="password" onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Role" required>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="Staff">Staff</option>
                <option value="Manager">Manager</option>
                <option value="SystemAdmin">System Admin</option>
              </Select>
            </Field>
            {form.role === 'Staff' && (
              <Field label="Assigned Store" required>
                <Select required onChange={(e) => setForm({ ...form, assigned_store_id: e.target.value })}>
                  <option value="">Select store</option>
                  {stores.map((s) => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                </Select>
              </Field>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Btn type="submit">Create</Btn>
              <Btn type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {pwUser && (
        <Modal title={`Reset Password — ${pwUser.username}`} onClose={() => setPwUser(null)}>
          <form onSubmit={resetPassword}>
            <Field label="New Password" required>
              <Input required type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn type="submit">Reset</Btn>
              <Btn type="button" variant="ghost" onClick={() => setPwUser(null)}>Cancel</Btn>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}