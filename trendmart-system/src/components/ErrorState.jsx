// src/components/ErrorState.jsx
import { COLORS, Icon, Btn } from './ui';
export const ErrorState = ({ message, onRetry }) => (
  <div style={{ textAlign: 'center', padding: '64px 16px' }}>
    <div style={{ color: COLORS.rose, marginBottom: 8 }}><Icon name="alert" size={40} /></div>
    <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700, margin: '8px 0 4px' }}>Something went wrong</h3>
    <p style={{ color: COLORS.muted }}>{message || 'Unable to load data. Please check your connection.'}</p>
    {onRetry && <div style={{ marginTop: 16 }}><Btn variant="ghost" onClick={onRetry}>Try Again</Btn></div>}
  </div>
);