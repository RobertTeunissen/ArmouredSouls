import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [robotCount, setRobotCount] = useState(0);

  useEffect(() => {
    const fetchRobots = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/robots');
        setRobotCount(response.data.length);
      } catch (error) {
        console.error('Failed to fetch robots:', error);
      }
    };
    fetchRobots();
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

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
                <span className="text-gray-400">Prestige:</span>
                <span className="font-semibold">{user.prestige}</span>
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
            {robotCount === 0 ? (
              <>
                <p className="mb-4">Your stable is empty. Start by upgrading facilities or creating robots!</p>
                <p className="text-sm">You have ₡{user.currency.toLocaleString()} to spend on upgrades and robots.</p>
              </>
            ) : (
              <>
                <p className="mb-4 text-2xl font-bold text-white">{robotCount} Robot{robotCount !== 1 ? 's' : ''}</p>
                <p className="text-sm">You have {robotCount} robot{robotCount !== 1 ? 's' : ''} in your stable.</p>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/facilities')}
            className="bg-blue-600 hover:bg-blue-700 p-6 rounded-lg transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">Upgrade Facilities</h3>
            <p className="text-sm text-gray-300">Improve your stable's capabilities</p>
          </button>
          <button 
            onClick={() => navigate('/robots')}
            className="bg-green-600 hover:bg-green-700 p-6 rounded-lg transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">
              {robotCount === 0 ? 'Create Robot' : 'Manage Robots'}
            </h3>
            <p className="text-sm text-gray-300">
              {robotCount === 0 ? 'Build your first battle robot' : 'View and upgrade your robots'}
            </p>
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
