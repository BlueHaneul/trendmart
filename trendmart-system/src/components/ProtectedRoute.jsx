import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PermissionDenied } from './PermissionDenied';

// requiredRole omitted  → any authenticated user
// requiredRole='Admin'  → Admin only (SC-02, SC-03 add/edit, SC-05, SC-08)
export function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <PermissionDenied />;
  return children;
}
