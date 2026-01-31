import { useEffect, useState } from 'react';
import { getMatchHistory, BattleHistory, getBattleOutcome, getELOChange, formatDateTime } from '../utils/matchmakingApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
      const data = await getMatchHistory(1, 5); // Get last 5 matches
      setMatches(data.data);
      setError(null);
    } catch (err: any) {
      // Handle 401 Unauthorized errors
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      console.error('Failed to fetch recent matches:', err);
      setError('Failed to load recent matches');
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
    
    return { myRobot, opponent, outcome, eloChange };
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'win': return 'text-green-400';
      case 'loss': return 'text-red-400';
      case 'draw': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getOutcomeText = (outcome: string) => {
    switch (outcome) {
      case 'win': return 'VICTORY';
      case 'loss': return 'DEFEAT';
      case 'draw': return 'DRAW';
      default: return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Recent Matches</h2>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Recent Matches</h2>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-semibold mb-4">Recent Matches</h2>
        <p className="text-gray-400">No recent matches</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">Recent Matches</h2>
        <button
          onClick={() => navigate('/battle-history')}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          View All →
        </button>
      </div>
      
      <div className="space-y-3">
        {matches.map((battle) => {
          const { myRobot, opponent, outcome, eloChange } = getMatchData(battle);
          const outcomeColor = getOutcomeColor(outcome);
          
          return (
            <div key={battle.id} className="bg-gray-700 p-3 rounded border border-gray-600">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-bold ${outcomeColor}`}>
                  {getOutcomeText(outcome)}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDateTime(battle.createdAt)}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 items-center text-sm">
                <div className="text-right">
                  <div className="font-semibold text-blue-400 truncate">{myRobot.name}</div>
                </div>
                
                <div className="text-center text-gray-500 text-xs">vs</div>
                
                <div className="text-left">
                  <div className="font-semibold truncate">{opponent.name}</div>
                </div>
              </div>
              
              <div className="mt-2 pt-2 border-t border-gray-600 flex justify-between text-xs">
                <span className={eloChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                  ELO: {eloChange > 0 ? '+' : ''}{eloChange}
                </span>
                <span className="text-gray-400">
                  {battle.durationSeconds}s
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RecentMatches;
