import { useEffect, useState } from 'react';
import { getMatchHistory, BattleHistory, getBattleOutcome, getELOChange, formatDateTime, getTournamentRoundName } from '../utils/matchmakingApi';
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
      
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {matches.map((battle) => {
          const { myRobot, opponent, outcome, eloChange } = getMatchData(battle);
          const outcomeColor = getOutcomeColor(outcome);
          const isTournament = battle.battleType === 'tournament';
          
          const getBorderColor = () => {
            if (isTournament) return 'border-l-warning';
            switch (outcome) {
              case 'win': return 'border-l-success';
              case 'loss': return 'border-l-error';
              case 'draw': return 'border-l-gray-500';
              default: return 'border-l-gray-700';
            }
          };
          
          return (
            <div 
              key={battle.id} 
              className={`
                bg-surface-elevated border border-gray-700 rounded-lg p-2
                border-l-4 ${getBorderColor()}
                hover:bg-surface hover:border-primary/50 cursor-pointer 
                transition-all duration-150
              `}
              onClick={() => navigate(`/battle/${battle.id}`)}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {isTournament && <span className="text-sm">🏆</span>}
                  <span className={`text-xs font-bold ${outcomeColor}`}>
                    {getOutcomeText(outcome)}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatDateTime(battle.createdAt)}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 items-center text-xs mb-1">
                <div className="text-right font-semibold text-primary truncate">
                  {myRobot.name}
                </div>
                <div className="text-center text-gray-500">vs</div>
                <div className="text-left font-semibold text-white truncate">
                  {opponent.name}
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-gray-400">
                <span className={eloChange >= 0 ? 'text-success' : 'text-error'}>
                  ELO: {eloChange > 0 ? '+' : ''}{eloChange}
                </span>
                {isTournament && battle.tournamentRound && battle.tournamentMaxRounds && (
                  <span className="text-warning text-xs">
                    {getTournamentRoundName(battle.tournamentRound, battle.tournamentMaxRounds)}
                  </span>
                )}
                <span>{battle.durationSeconds}s</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RecentMatches;
