import { useEffect, useState } from 'react';
import { getMatchHistory, BattleHistory, getBattleOutcome, getELOChange, getBattleReward } from '../utils/matchmakingApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import CompactBattleCard from './CompactBattleCard';

function RecentMatches() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<BattleHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('[RecentMatches] No authentication token found');
        logout();
        navigate('/login');
        return;
      }
      
      console.log('[RecentMatches] Fetching recent matches...');
      const data = await getMatchHistory(1, 5); // Get last 5 matches
      console.log('[RecentMatches] Received data:', data);
      
      setMatches(data.data);
      setError(null);
    } catch (err: any) {
      // Handle 401 Unauthorized errors
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.error('[RecentMatches] Authentication error:', err);
        logout();
        navigate('/login');
        return;
      }
      console.error('[RecentMatches] Failed to fetch recent matches:', err);
      console.error('[RecentMatches] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setError(err.response?.data?.message || 'Failed to load recent matches');
    } finally {
      setLoading(false);
    }
  };

  const isMyRobot = (robotUserId: number) => {
    return user && robotUserId === user.id;
  };

  const getMatchData = (battle: BattleHistory) => {
    const myRobot = isMyRobot(battle.robot1.userId) ? battle.robot1 : battle.robot2;
    const opponent = isMyRobot(battle.robot1.userId) ? battle.robot2 : battle.robot1;
    const myRobotId = myRobot.id;
    const outcome = getBattleOutcome(battle, myRobotId);
    const eloChange = getELOChange(battle, myRobotId);
    
    return { myRobot, opponent, outcome, eloChange, myRobotId };
  };

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Recent Matches</h2>
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Recent Matches</h2>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Recent Matches</h2>
        <p className="text-sm text-gray-400">No recent matches</p>
      </div>
    );
  }

  return (
    <div className="bg-surface p-4 rounded-lg border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">Recent Matches</h2>
        <button
          onClick={() => navigate('/battle-history')}
          className="text-primary hover:text-primary-light text-xs font-semibold"
        >
          View All →
        </button>
      </div>
      
      <div className="space-y-0 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {matches.map((battle) => {
          const { myRobot, opponent, outcome, eloChange, myRobotId } = getMatchData(battle);
          const reward = getBattleReward(battle, myRobotId);

          return (
            <CompactBattleCard
              key={battle.id}
              battle={battle}
              myRobot={myRobot}
              opponent={opponent}
              outcome={outcome}
              eloChange={eloChange}
              myRobotId={myRobotId}
              reward={reward}
              onClick={() => navigate(`/battle/${battle.id}`)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default RecentMatches;
