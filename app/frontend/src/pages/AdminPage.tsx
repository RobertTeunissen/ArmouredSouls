/**
 * AdminPage — Legacy redirect.
 *
 * The admin portal has been redesigned with route-based navigation (Spec #28).
 * This component redirects to the new admin dashboard for backward compatibility.
 */
import { Navigate } from 'react-router-dom';

function AdminPage() {
  return <Navigate to="/admin/dashboard" replace />;
}

export default AdminPage;
