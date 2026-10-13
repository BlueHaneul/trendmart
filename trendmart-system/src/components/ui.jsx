   /* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react';

export const COLORS = {
  bg: '#0f172a', card: '#1e293b', border: '#334155',
  text: '#f1f5f9', muted: '#94a3b8', dim: '#64748b',
  cyan: '#22d3ee', blue: '#0ea5e9', emerald: '#10b981', green: '#34d399',
  amber: '#f59e0b', rose: '#f43f5e', pink: '#fb7185', violet: '#a78bfa',
};

export const Icon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    products: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
    sales: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    stores: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    reports: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    analytics: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    security: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    plus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    alert: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    menu: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  };
  return icons[name] || null;
};

export const Field = ({ label, children, required }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', color: COLORS.muted, fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}{required && <span style={{ color: COLORS.rose }}> *</span>}
    </label>
    {children}
  </div>
);

const fieldStyle = { width: '100%', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 14px', color: COLORS.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

export const Input = ({ ...props }) => <input {...props} style={{ ...fieldStyle, ...props.style }} />;
export const Select = ({ children, ...props }) => <select {...props} style={{ ...fieldStyle, ...props.style }}>{children}</select>;

export const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => {
  const styles = {
    primary: { background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.cyan})`, color: COLORS.bg, fontWeight: 700 },
    danger:  { background: `linear-gradient(135deg, ${COLORS.rose}, ${COLORS.pink})`, color: '#fff', fontWeight: 700 },
    ghost:   { background: 'transparent', color: COLORS.muted, border: `1px solid ${COLORS.border}`, fontWeight: 500 },
    success: { background: `linear-gradient(135deg, ${COLORS.emerald}, ${COLORS.green})`, color: COLORS.bg, fontWeight: 700 },
  };
  return (
    <button {...props}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '6px 14px' : '10px 20px',
        borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: size === 'sm' ? 13 : 14, fontFamily: 'inherit',
        transition: 'opacity 0.15s', ...styles[variant], ...props.style }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
      {children}
    </button>
  );
};

export const Badge = ({ children, color = COLORS.cyan }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: color + '20', color, border: `1px solid ${color}40` }}>
    {children}
  </span>
);

export const KpiCard = ({ label, value, sub, color = COLORS.cyan, icon }) => (
  <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: color, opacity: 0.07, borderRadius: '0 16px 0 80px' }} />
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: COLORS.dim, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      {icon && <span style={{ color, background: color + '18', padding: '6px 8px', borderRadius: 8 }}>{icon}</span>}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
    {sub && <span style={{ fontSize: 12, color: COLORS.dim }}>{sub}</span>}
  </div>
);

// Bar chart that takes plain arrays — dates must be pre-formatted as short labels
// BEFORE being passed in here (this is what fixes the raw-ISO-string bug).
export const MiniBarChart = ({ data, labels, color = COLORS.cyan }) => {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end', height: '100%' }}>
          <span style={{ fontSize: 10, color: COLORS.muted }}>{v > 0 ? Math.round(v) : ''}</span>
          <div style={{ width: '100%', background: color, height: `${(v / max) * 120}px`, borderRadius: '4px 4px 0 0', opacity: 0.85, transition: 'height 0.5s' }} />
          {labels && <span style={{ fontSize: 9, color: COLORS.muted, whiteSpace: 'nowrap' }}>{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
};

export const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}` }}>
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: 18 }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', padding: 4 }}><Icon name="close" /></button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

// Replaces alert() calls from v3 — same notify(msg, type) pattern as the approved prototype.
export const Toast = ({ msg, type, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  const c = type === 'error' ? COLORS.rose : COLORS.emerald;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: COLORS.card, border: `1px solid ${c}`, borderRadius: 12, padding: '14px 20px', color: COLORS.text, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', minWidth: 240, animation: 'slideUp 0.3s ease' }}>
      <span style={{ color: c }}>{type === 'error' ? <Icon name="alert" size={16} /> : <Icon name="check" size={16} />}</span>
      {msg}
    </div>
  );
};

// Small helper used throughout to fix the raw-ISO-date bug in chart labels.
export const shortDate = (isoOrDateStr) =>
  new Date(isoOrDateStr).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

export const fmtCurrency = (n) => 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 });
