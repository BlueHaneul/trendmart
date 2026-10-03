import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { COLORS } from './components/ui';
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Products    from './pages/Products';
import Sales       from './pages/Sales';
import Stores      from './pages/Stores';
import Enquiry     from './pages/Enquiry';
import Reports     from './pages/Reports';
import Analytics   from './pages/Analytics';
import Security from './pages/Security';

function Shell() {
  const { user } = useAuth();
  if (!user) {
    // Not logged in — no sidebar, Login screen renders full-bleed
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.bg, position: 'relative' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute requiredRole="Admin"><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/stores" element={<ProtectedRoute requiredRole="Admin"><Stores /></ProtectedRoute>} />
          <Route path="/enquiry" element={<ProtectedRoute><Enquiry /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute requiredRole="Admin"><Analytics /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute requiredRole="Admin"><Security /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to={user.role === 'Admin' ? '/dashboard' : '/sales'} replace />} />
          <Route path="*" element={<Navigate to={user.role === 'Admin' ? '/dashboard' : '/sales'} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}
