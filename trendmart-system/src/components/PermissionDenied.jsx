// src/components/PermissionDenied.jsx
import { COLORS } from './ui';
export const PermissionDenied = () => (
  <div style={{ textAlign: 'center', padding: '64px 16px' }}>
    <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
    <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, margin: '8px 0 4px' }}>Access Denied</h3>
    <p style={{ color: COLORS.muted }}>You do not have permission to view this page. Contact your Administrator.</p>
  </div>
);