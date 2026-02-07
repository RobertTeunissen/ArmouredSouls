import { useEffect, useState } from 'react';
import { getUpcomingMatches, ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../utils/matchmakingApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Constants
const UNKNOWN_USER = 'Unknown';

function UpcomingMatches() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
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
        console.error('[UpcomingMatches] No authentication token found');
        logout();
        navigate('/login');
        return;
      }
      
      console.log('[UpcomingMatches] Fetching upcoming matches...');
      const data = await getUpcomingMatches();
      console.log('[UpcomingMatches] Received data:', data);
      
      setMatches(data);
      setError(null);
    } catch (err: any) {
      // Handle 401 Unauthorized errors
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        console.error('[UpcomingMatches] Authentication error:', err);
        logout();
        navigate('/login');
        return;
      }
      console.error('[UpcomingMatches] Failed to fetch upcoming matches:', err);
      console.error('[UpcomingMatches] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setError(err.response?.data?.message || 'Failed to load upcoming matches');
    } finally {
      setLoading(false);
    }
  };

  const isMyRobot = (robotUserId: number) => {
    return user && robotUserId === user.id;
  };

  const getMatchResult = (match: ScheduledMatch) => {
    // Basic validation
    if (!match) {
      return null;
    }
    
    // For tournament matches, robot1 or robot2 might be null (placeholder matches)
    if (match.matchType === 'tournament' && (!match.robot1 || !match.robot2)) {
      return null; // Don't display incomplete tournament matches
    }
    
    // For league matches, both robots should be present
    if (!match.robot1 || !match.robot2) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Invalid match data - missing robots:', match);
      }
      return null;
    }
    
    // Check if user data exists
    if (!match.robot1.user || !match.robot2.user) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Invalid match user data:', match);
      }
      return null;
    }
    
    const myRobot = isMyRobot(match.robot1.userId) ? match.robot1 : match.robot2;
    const opponent = isMyRobot(match.robot1.userId) ? match.robot2 : match.robot1;
    return { myRobot, opponent };
  };

  const getRoundName = (round: number, maxRounds: number) => {
    const remainingRounds = maxRounds - round + 1;
    if (remainingRounds === 1) return 'Finals';
    if (remainingRounds === 2) return 'Semi-finals';
    if (remainingRounds === 3) return 'Quarter-finals';
    return `Round ${round}/${maxRounds}`;
  };

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Upcoming Matches</h2>
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Upcoming Matches</h2>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Upcoming Matches</h2>
        <p className="text-sm text-gray-400">No upcoming matches scheduled</p>
      </div>
    );
  }

  return (
    <div className="bg-surface p-4 rounded-lg border border-gray-700">
      <h2 className="text-lg font-semibold mb-3">Upcoming Matches</h2>
      <div className="space-y-1.5">
        {matches.map((match) => {
          const matchResult = getMatchResult(match);
          
          // Skip invalid matches safely
          if (!matchResult) {
            return null;
          }
          
          const { myRobot, opponent } = matchResult;
          const isTournament = match.matchType === 'tournament';
          const tierColor = isTournament ? 'text-warning' : getLeagueTierColor(match.leagueType);
          const tierName = isTournament ? 'Tournament' : getLeagueTierName(match.leagueType);
          
          const getBorderColor = () => {
            return isTournament ? 'border-l-warning' : 'border-l-primary';
          };
          
          return (
            <div 
              key={match.id} 
              className={`
                bg-surface-elevated border border-gray-700 rounded-lg p-2
                border-l-4 ${getBorderColor()}
                hover:bg-surface hover:border-primary/50
                transition-all duration-150
              `}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  {isTournament && <span className="text-sm">🏆</span>}
                  <span className={`text-xs font-semibold ${tierColor}`}>
                    {tierName}
                    {!isTournament && ' League'}
                  </span>
                  {isTournament && match.tournamentRound && match.maxRounds && (
                    <span className="text-xs px-1.5 py-0.5 bg-warning/20 rounded text-warning">
                      {getRoundName(match.tournamentRound, match.maxRounds)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {isTournament ? 'Pending' : formatDateTime(match.scheduledFor)}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 items-center text-xs mb-1">
                {/* Your Robot */}
                <div className="text-right">
                  <div className="font-semibold text-primary truncate">{myRobot.name}</div>
                  <div className="text-xs text-gray-400">
                    ELO: {myRobot.elo}
                  </div>
                </div>
                
                {/* VS */}
                <div className="text-center">
                  <span className="text-gray-500 font-bold text-xs">VS</span>
                </div>
                
                {/* Opponent */}
                <div className="text-left">
                  <div className="font-semibold text-white truncate">{opponent.name}</div>
                  <div className="text-xs text-gray-400">
                    ELO: {opponent.elo}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between text-xs text-gray-400">
                <span>HP: {myRobot.currentHP}/{myRobot.maxHP}</span>
                <span>{opponent.user?.username || UNKNOWN_USER}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UpcomingMatches;
