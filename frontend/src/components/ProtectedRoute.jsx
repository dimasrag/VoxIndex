import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { token, user, authReady } = useAuth();

  if (!authReady) {
    return <div className="page-container"><p className="loading-text">Loading...</p></div>;
  }

  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && !user?.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}
