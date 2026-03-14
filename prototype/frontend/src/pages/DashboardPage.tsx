import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { fetchMyRobots } from '../utils/robotApi';
import { getTutorialState, TutorialState } from '../utils/onboardingApi';
import Navigation from '../components/Navigation';
import UpcomingMatches from '../components/UpcomingMatches';
import RecentMatches from '../components/RecentMatches';
import FinancialSummary from '../components/FinancialSummary';
import RobotDashboardCard from '../components/RobotDashboardCard';
import StableStatistics from '../components/StableStatistics';
import TagTeamReadinessWarning from '../components/TagTeamReadinessWarning';
import DashboardWelcome from '../components/DashboardWelcome';
import DashboardOnboardingBanner from '../components/DashboardOnboardingBanner';

interface Robot {
  id: number;
  name: string;
  imageUrl?: string | null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mainWeapon?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offhandWeapon?: any;
  loadoutType?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  battlesWon?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  battlesAsRobot1?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const [onboardingState, setOnboardingState] = useState<TutorialState | null>(null);
  // const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRobots();
      getTutorialState()
        .then(setOnboardingState)
        .catch(() => setOnboardingState(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (robots.length > 0) {
      generateNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        action: () => navigate('/robots'),
        actionLabel: 'View Robots'
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
        logout();
        navigate('/login');
        return;
      }
      
      const data = await fetchMyRobots();
      setRobots(data);
    } catch (error) {
      // Handle 401 Unauthorized errors
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 pb-4 border-b border-white/10">
          <h1 className="text-3xl font-bold text-white">Command Center</h1>
          <div className="text-lg text-secondary">
            <span className="font-semibold text-white">{user.stableName || user.username}</span>&apos;s Stable
          </div>
        </div>

        {/* Onboarding Progress Banner - shows for users with incomplete onboarding */}
        <DashboardOnboardingBanner onboardingState={onboardingState} />

        {/* Critical Notifications/Warnings - All alerts above overview blocks */}
        <div className="mb-6 space-y-3">
          {/* Tag Team Readiness Warning */}
          <TagTeamReadinessWarning compact={true} />
          
          {/* Other Notifications */}
          {notifications.length > 0 && notifications.map((notif, idx) => (
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
                    px-4 py-2 rounded font-semibold text-sm transition-colors
                    ${notif.type === 'danger' ? 'bg-error hover:bg-error/90 text-white' : ''}
                    ${notif.type === 'warning' ? 'bg-warning hover:bg-warning/90 text-background' : ''}
                    ${notif.type === 'info' ? 'bg-primary hover:bg-primary/90 text-white' : ''}
                  `}
                >
                  {notif.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Top Row: Stable Statistics and Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Stable Statistics */}
          <StableStatistics />

          {/* Financial Summary */}
          <FinancialSummary />
        </div>

        {/* Matchmaking Section */}
        {robots.length > 0 && (
          <div className="space-y-6 mb-8">
            <RecentMatches />
            <UpcomingMatches />
          </div>
        )}

        {/* My Robots Section */}
        {robots.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">My Robots</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {robots.map((robot) => (
                <RobotDashboardCard key={robot.id} robot={{ ...robot, imageUrl: robot.imageUrl ?? null }} />
              ))}
            </div>
          </div>
        )}

        {/* Stable Info (empty state) */}
        {robots.length === 0 && (
          <DashboardWelcome
            onboardingState={onboardingState}
            currency={user.currency}
          />
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
