import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard for admin pages. Wraps all `/admin/*` routes and enforces
 * authentication + admin role before rendering children.
 *
 * - Loading → spinner
 * - Not authenticated → redirect to `/login`
 * - Not admin → redirect to `/dashboard`
 * - Admin → render children
 */
function AdminRoute({ children }: AdminRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default AdminRoute;
