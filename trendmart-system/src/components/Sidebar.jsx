import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon, COLORS } from './ui';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', adminOnly: true },
  { to: '/sales', label: 'Sales Transactions', icon: 'sales' },
  { to: '/products', label: 'Products', icon: 'products' },
  { to: '/stores', label: 'Stores', icon: 'stores', adminOnly: true },
  { to: '/enquiry', label: 'Enquiry', icon: 'search' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/analytics', label: 'Advanced Analytics', icon: 'analytics', adminOnly: true },
  { to: '/security', label: 'Security', icon: 'security', adminOnly: true },
];

export function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  if (!user) return null;
  const items = NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);

  return (
    <aside style={{ width: open ? 240 : 68, background: COLORS.card, borderRight: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', transition: 'width 0.25s ease', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: open ? '24px 20px 16px' : '24px 12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${COLORS.blue},${COLORS.cyan})`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="stores" size={18} />
        </div>
        {open && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, fontFamily: "'Space Grotesk',sans-serif" }}>TrendMart</div>
            <div style={{ fontSize: 10, color: COLORS.dim }}>Analytics System</div>
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} title={n.label}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 12, padding: open ? '10px 14px' : '10px',
              borderRadius: 10, textDecoration: 'none',
              background: isActive ? `linear-gradient(135deg,${COLORS.blue}20,${COLORS.cyan}15)` : 'none',
              border: isActive ? `1px solid ${COLORS.cyan}30` : '1px solid transparent',
              color: isActive ? COLORS.cyan : COLORS.dim,
              fontSize: 13, fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap',
            })}>
            <span style={{ flexShrink: 0 }}><Icon name={n.icon} size={17} /></span>
            {open && n.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '12px 8px 20px', borderTop: `1px solid ${COLORS.border}` }}>
        {open && (
          <div style={{ padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted }}>{user.full_name}</div>
            <div style={{ fontSize: 11, color: COLORS.dim }}>{user.role}</div>
          </div>
        )}
        <button onClick={() => { logout(); navigate('/login'); }} title="Logout"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: open ? '10px 14px' : '10px', borderRadius: 10, background: 'none', border: '1px solid transparent', color: COLORS.rose, cursor: 'pointer', fontSize: 13, width: '100%' }}>
          <Icon name="logout" size={17} />{open && 'Logout'}
        </button>
      </div>

      {/* Sidebar collapse toggle lives here so it's reachable regardless of page content */}
      <button onClick={() => setOpen((o) => !o)} style={{ position: 'absolute', bottom: 12, left: open ? 210 : 40, background: COLORS.border, border: 'none', borderRadius: 6, width: 22, height: 22, color: COLORS.muted, cursor: 'pointer', fontSize: 11 }}>
        {open ? '◀' : '▶'}
      </button>
    </aside>
  );
}
