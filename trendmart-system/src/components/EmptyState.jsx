// src/components/EmptyState.jsx
import { COLORS } from './ui';
export const EmptyState = ({ title, message, action }) => (
  <div style={{ textAlign: 'center', padding: '64px 16px' }}>
    <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
    <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, margin: '8px 0 4px' }}>{title}</h3>
    <p style={{ color: COLORS.muted }}>{message}</p>
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);