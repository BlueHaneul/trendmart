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
import UserManagement from './pages/UserManagement';

function Shell() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const defaultRoute = user.role === 'Manager' ? '/dashboard' : user.role === 'SystemAdmin' ? '/users' : '/sales';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.bg, position: 'relative' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <Routes>
          <Route path="/dashboard" element={<ProtectedRoute requiredRole="Manager"><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute allowedRoles={['Manager', 'Staff']}><Products /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute allowedRoles={['Manager', 'Staff']}><Sales /></ProtectedRoute>} />
          <Route path="/stores" element={<ProtectedRoute requiredRole="Manager"><Stores /></ProtectedRoute>} />
          <Route path="/enquiry" element={<ProtectedRoute allowedRoles={['Manager', 'Staff']}><Enquiry /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={['Manager', 'Staff']}><Reports /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute requiredRole="Manager"><Analytics /></ProtectedRoute>} />
          <Route path="/security" element={<ProtectedRoute allowedRoles={['Manager', 'SystemAdmin']}><Security /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute requiredRole="SystemAdmin"><UserManagement /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
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
