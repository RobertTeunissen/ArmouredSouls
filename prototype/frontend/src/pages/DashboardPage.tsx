import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Navigation from '../components/Navigation';
import UpcomingMatches from '../components/UpcomingMatches';
import RecentMatches from '../components/RecentMatches';
import FinancialSummary from '../components/FinancialSummary';
import RobotDashboardCard from '../components/RobotDashboardCard';
import StableStatistics from '../components/StableStatistics';

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

interface Notification {
  type: 'warning' | 'danger' | 'info';
  message: string;
  action?: () => void;
  actionLabel?: string;
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [robots, setRobots] = useState<Robot[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRobots();
    }
  }, [user]);

  useEffect(() => {
    if (robots.length > 0) {
      generateNotifications();
    }
  }, [robots, user]);

  const generateNotifications = () => {
    const alerts: Notification[] = [];
    
    // Check for robots not battle ready
    const notReadyRobots = robots.filter(r => 
      r.currentHP < r.maxHP || !r.mainWeapon
    );
    
    if (notReadyRobots.length > 0) {
      const reason = notReadyRobots[0].currentHP < notReadyRobots[0].maxHP 
        ? 'needs repair' 
        : 'has no weapon equipped';
      
      alerts.push({
        type: 'warning',
        message: `${notReadyRobots[0].name} ${reason}${notReadyRobots.length > 1 ? ` (+${notReadyRobots.length - 1} more)` : ''}`,
        action: () => navigate(`/robots/${notReadyRobots[0].id}`),
        actionLabel: 'Fix Now'
      });
    }
    
    // Check for low balance (bankruptcy warning)
    if (user && user.currency < 50000) {
      alerts.push({
        type: 'danger',
        message: `Low balance warning: ₡${user.currency.toLocaleString()} remaining`,
        action: () => navigate('/finances'),
        actionLabel: 'View Finances'
      });
    }
    
    setNotifications(alerts);
  };

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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Dashboard Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-white">Command Center</h1>
          <div className="text-lg text-gray-400">
            <span className="font-semibold text-white">{user.username}</span>'s Stable
          </div>
        </div>

        {/* Critical Notifications/Warnings */}
        {notifications.length > 0 && (
          <div className="mb-6 space-y-3">
            {notifications.map((notif, idx) => (
              <div 
                key={idx}
                className={`
                  p-4 rounded-lg border-l-4 flex items-center justify-between
                  ${notif.type === 'danger' ? 'bg-error/10 border-error' : ''}
                  ${notif.type === 'warning' ? 'bg-warning/10 border-warning' : ''}
                  ${notif.type === 'info' ? 'bg-primary/10 border-primary' : ''}
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {notif.type === 'danger' && '⚠️'}
                    {notif.type === 'warning' && '⚡'}
                    {notif.type === 'info' && 'ℹ️'}
                  </span>
                  <span className={`font-semibold ${
                    notif.type === 'danger' ? 'text-error' : 
                    notif.type === 'warning' ? 'text-warning' : 
                    'text-primary'
                  }`}>
                    {notif.message}
                  </span>
                </div>
                {notif.action && notif.actionLabel && (
                  <button
                    onClick={notif.action}
                    className={`
                      px-4 py-2 rounded font-semibold text-sm
                      ${notif.type === 'danger' ? 'bg-error hover:bg-error/90 text-white' : ''}
                      ${notif.type === 'warning' ? 'bg-warning hover:bg-warning/90 text-gray-900' : ''}
                      ${notif.type === 'info' ? 'bg-primary hover:bg-primary/90 text-white' : ''}
                    `}
                  >
                    {notif.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Top Row: Stable Statistics and Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Stable Statistics */}
          <StableStatistics 
            prestige={user.prestige}
          />

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
      </div>
    </div>
  );
}

export default DashboardPage;
