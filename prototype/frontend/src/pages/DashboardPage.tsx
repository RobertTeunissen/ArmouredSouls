import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import StableNameModal from '../components/StableNameModal';

interface Robot {
  id: number;
  name: string;
  elo: number;
  battlesWon?: any[];
  battlesAsRobot1?: any[];
  battlesAsRobot2?: any[];
}

function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [showStableNameModal, setShowStableNameModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // Check if user needs to set stable name
      if (!user.stableName) {
        setShowStableNameModal(true);
      }
      fetchRobots();
    }
  }, [user]);

  const fetchRobots = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/robots');
      setRobots(response.data);
    } catch (error) {
      console.error('Failed to fetch robots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStableNameComplete = async () => {
    await refreshUser();
    setShowStableNameModal(false);
  };

  const calculateStats = (robot: Robot) => {
    const wins = robot.battlesWon?.length || 0;
    const totalBattles = (robot.battlesAsRobot1?.length || 0) + (robot.battlesAsRobot2?.length || 0);
    const losses = totalBattles - wins;
    const winRate = totalBattles > 0 ? ((wins / totalBattles) * 100).toFixed(1) : '0.0';
    return { wins, losses, totalBattles, winRate };
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />

      {showStableNameModal && <StableNameModal onComplete={handleStableNameComplete} />}

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
              {user.stableName && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Stable:</span>
                  <span className="font-semibold text-blue-400">{user.stableName}</span>
                </div>
              )}
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

        {/* My Robots Section */}
        {robots.length > 0 && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">My Robots</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-700">
                    <th className="pb-3 font-semibold">Name</th>
                    <th className="pb-3 font-semibold">ELO</th>
                    <th className="pb-3 font-semibold">Wins</th>
                    <th className="pb-3 font-semibold">Losses</th>
                    <th className="pb-3 font-semibold">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {robots.map((robot) => {
                    const stats = calculateStats(robot);
                    return (
                      <tr key={robot.id} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                        <td className="py-3">
                          <button
                            onClick={() => navigate(`/robots/${robot.id}`)}
                            className="text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            {robot.name}
                          </button>
                        </td>
                        <td className="py-3">{robot.elo}</td>
                        <td className="py-3 text-green-400">{stats.wins}</td>
                        <td className="py-3 text-red-400">{stats.losses}</td>
                        <td className="py-3">{stats.winRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stable Info (empty state) */}
        {robots.length === 0 && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Stable</h2>
            <div className="text-center py-8 text-gray-400">
              <p className="mb-4">Your stable is empty. Start by upgrading facilities or creating robots!</p>
              <p className="text-sm">You have ₡{user.currency.toLocaleString()} to spend on upgrades and robots.</p>
            </div>
          </div>
        )}

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
              {robots.length === 0 ? 'Create Robot' : 'Manage Robots'}
            </h3>
            <p className="text-sm text-gray-300">
              {robots.length === 0 ? 'Build your first battle robot' : 'View and upgrade your robots'}
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
