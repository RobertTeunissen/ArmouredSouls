import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navigation() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold">Armoured Souls</h1>
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/')}
                className="hover:text-blue-400 transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/facilities')}
                className="hover:text-blue-400 transition-colors"
              >
                Facilities
              </button>
              <button
                onClick={() => navigate('/robots')}
                className="hover:text-blue-400 transition-colors"
              >
                My Robots
              </button>
              <button
                onClick={() => navigate('/all-robots')}
                className="hover:text-blue-400 transition-colors"
              >
                All Robots
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-green-400 font-semibold">
              ₡{user.currency.toLocaleString()}
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
