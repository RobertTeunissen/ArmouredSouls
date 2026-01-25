import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Armoured Souls</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* User Profile */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Profile</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Username:</span>
                <span className="font-semibold">{user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Role:</span>
                <span className="font-semibold capitalize">{user.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ELO Rating:</span>
                <span className="font-semibold">{user.elo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fame:</span>
                <span className="font-semibold">{user.fame}</span>
              </div>
            </div>
          </div>

          {/* Credits Balance */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Credits Balance</h2>
            <div className="text-center py-6">
              <div className="text-5xl font-bold text-green-400 mb-2">
                ₡{user.currency.toLocaleString()}
              </div>
              <p className="text-gray-400">Available Credits</p>
            </div>
          </div>
        </div>

        {/* Stable Info */}
        <div className="bg-gray-800 p-6 rounded-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your Stable</h2>
          <div className="text-center py-8 text-gray-400">
            <p className="mb-4">Your stable is empty. Start by upgrading facilities or creating robots!</p>
            <p className="text-sm">You have ₡{user.currency.toLocaleString()} to spend on upgrades and robots.</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-blue-600 hover:bg-blue-700 p-6 rounded-lg transition-colors">
            <h3 className="text-xl font-semibold mb-2">Upgrade Facilities</h3>
            <p className="text-sm text-gray-300">Improve your stable's capabilities</p>
          </button>
          <button className="bg-green-600 hover:bg-green-700 p-6 rounded-lg transition-colors">
            <h3 className="text-xl font-semibold mb-2">Create Robot</h3>
            <p className="text-sm text-gray-300">Build your first battle robot</p>
          </button>
          <button className="bg-purple-600 hover:bg-purple-700 p-6 rounded-lg transition-colors opacity-50 cursor-not-allowed">
            <h3 className="text-xl font-semibold mb-2">Battle Arena</h3>
            <p className="text-sm text-gray-300">Coming soon</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
