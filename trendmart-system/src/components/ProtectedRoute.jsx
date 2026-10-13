import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PermissionDenied } from './PermissionDenied';

// requiredRole omitted  → any authenticated user
// requiredRole='Manager'  → Manager only (SC-02, SC-03 add/edit, SC-05, SC-08)
export function ProtectedRoute({ children, requiredRole, allowedRoles }) {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles) return allowedRoles.includes(user.role) ? children : <PermissionDenied />;
  if (requiredRole && user.role !== requiredRole) return <PermissionDenied />;
  return children;
}
