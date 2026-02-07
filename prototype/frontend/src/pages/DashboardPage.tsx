import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import UpcomingMatches from '../components/UpcomingMatches';
import RecentMatches from '../components/RecentMatches';
import FinancialSummary from '../components/FinancialSummary';
import RobotDashboardCard from '../components/RobotDashboardCard';

interface Robot {
  id: number;
  name: string;
  elo: number;
  currentHP: number;
  maxHP: number;
  currentShield?: number;
  maxShield?: number;
  currentLeague?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  totalBattles?: number;
  mainWeapon?: any;
  offhandWeapon?: any;
  loadoutType?: string;
  battlesWon?: any[];
  battlesAsRobot1?: any[];
  battlesAsRobot2?: any[];
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [robots, setRobots] = useState<Robot[]>([]);
  // const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRobots();
    }
  }, [user]);

  const fetchRobots = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // If no token, redirect to login
      if (!token) {
        console.error('No authentication token found');
        logout();
        navigate('/login');
        return;
      }
      
      const response = await axios.get('http://localhost:3001/api/robots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      setRobots(response.data);
    } catch (error) {
      // Handle 401 Unauthorized errors
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      console.error('Failed to fetch robots:', error);
    }
    // finally {
    //   setLoading(false);
    // }
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
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Dashboard Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <div className="text-lg text-gray-400">
            <span className="font-semibold text-white">{user.username}</span>'s Stable
          </div>
        </div>

        {/* Top Row: Profile and Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* User Profile */}
          <div className="bg-surface p-6 rounded-lg border border-gray-700">
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

          {/* Financial Summary */}
          <FinancialSummary />
        </div>

        {/* Matchmaking Section */}
        {robots.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <UpcomingMatches />
            <RecentMatches />
          </div>
        )}

        {/* My Robots Section */}
        {robots.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">My Robots</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {robots.map((robot) => (
                <RobotDashboardCard key={robot.id} robot={robot} />
              ))}
            </div>
          </div>
        )}

        {/* Stable Info (empty state) */}
        {robots.length === 0 && (
          <div className="bg-surface-elevated p-8 rounded-lg mb-8 border border-gray-700 text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">Welcome to Your Stable!</h2>
              <p className="text-lg text-gray-300 mb-6">
                You're ready to build your robot fighting empire. Here's how to get started:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-8">
                <div className="bg-surface p-4 rounded-lg border border-gray-600">
                  <div className="text-primary font-bold text-xl mb-2">1. Upgrade Facilities</div>
                  <p className="text-sm text-gray-400">
                    Unlock robot creation and improve your stable's capabilities
                  </p>
                </div>
                <div className="bg-surface p-4 rounded-lg border border-gray-600">
                  <div className="text-primary font-bold text-xl mb-2">2. Create Your Robot</div>
                  <p className="text-sm text-gray-400">
                    Build your first battle robot with unique attributes
                  </p>
                </div>
                <div className="bg-surface p-4 rounded-lg border border-gray-600">
                  <div className="text-primary font-bold text-xl mb-2">3. Equip Weapons</div>
                  <p className="text-sm text-gray-400">
                    Visit the weapon shop and configure loadouts
                  </p>
                </div>
                <div className="bg-surface p-4 rounded-lg border border-gray-600">
                  <div className="text-primary font-bold text-xl mb-2">4. Enter Battles</div>
                  <p className="text-sm text-gray-400">
                    Compete in leagues and climb the rankings!
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => navigate('/facilities')}
                className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors"
              >
                Get Started
              </button>
              
              <p className="text-sm text-gray-400 mt-6">
                You have ₡{user.currency.toLocaleString()} to spend on upgrades and robots.
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/facilities')}
            className="bg-primary hover:bg-primary-dark p-6 rounded-lg transition-colors border border-primary-light"
          >
            <h3 className="text-xl font-semibold mb-2">Upgrade Facilities</h3>
            <p className="text-sm text-gray-300">Improve your stable's capabilities</p>
          </button>
          <button 
            onClick={() => navigate('/robots')}
            className="border-2 border-primary text-primary hover:bg-primary hover:text-white p-6 rounded-lg transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2">
              {robots.length === 0 ? 'Create Robot' : 'Manage Robots'}
            </h3>
            <p className="text-sm">
              {robots.length === 0 ? 'Build your first battle robot' : 'View and upgrade your robots'}
            </p>
          </button>
          <button 
            className="border border-gray-600 text-gray-500 p-6 rounded-lg opacity-50 cursor-not-allowed"
            disabled
          >
            <h3 className="text-xl font-semibold mb-2">Battle Arena</h3>
            <p className="text-sm">Coming soon</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
