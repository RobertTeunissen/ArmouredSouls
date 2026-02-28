import { useEffect, useState } from 'react';
import { getUpcomingMatches, ScheduledMatch, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../utils/matchmakingApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface BattleReadiness {
  isReady: boolean;
  warnings: string[];
}

interface UpcomingMatchesProps {
  robotId?: number; // Optional: filter matches for specific robot
  battleReadiness?: BattleReadiness; // Optional: show battle readiness warnings
}

function UpcomingMatches({ robotId, battleReadiness }: UpcomingMatchesProps = {}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  useEffect(() => {
    fetchMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      console.log('[UpcomingMatches] Received matches:', {
        total: data.length,
        leagueMatches: data.filter(m => m.matchType === 'league').length,
        tournamentMatches: data.filter(m => m.matchType === 'tournament').length,
        matches: data,
      });
      
      // Filter by robotId if provided
      let filteredMatches = data;
      if (robotId) {
        filteredMatches = data.filter((match) => {
          if (match.matchType === 'tag_team') {
            return (
              match.team1?.activeRobot?.id === robotId ||
              match.team1?.reserveRobot?.id === robotId ||
              match.team2?.activeRobot?.id === robotId ||
              match.team2?.reserveRobot?.id === robotId
            );
          } else {
            return match.robot1?.id === robotId || match.robot2?.id === robotId;
          }
        });
      }
      
      setMatches(filteredMatches);
      setError(null);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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
      console.warn('[UpcomingMatches] Null match encountered');
      return null;
    }
    
    // Handle tag team matches
    if (match.matchType === 'tag_team') {
      if (!match.team1 || !match.team2) {
        console.error('[UpcomingMatches] Invalid tag team match data:', match);
        return null;
      }
      
      // Validate team robots exist
      if (!match.team1.activeRobot || !match.team2.activeRobot || 
          !match.team1.reserveRobot || !match.team2.reserveRobot) {
        console.error('[UpcomingMatches] Missing robots in tag team match:', match);
        return null;
      }
      
      // Validate user IDs exist
      if (!match.team1.activeRobot.userId || !match.team2.activeRobot.userId) {
        console.error('[UpcomingMatches] Missing userId in tag team robots:', match);
        return null;
      }
      
      const myTeam = isMyRobot(match.team1.activeRobot.userId) ? match.team1 : match.team2;
      const opponentTeam = isMyRobot(match.team1.activeRobot.userId) ? match.team2 : match.team1;
      
      return { 
        myTeam, 
        opponentTeam,
        isTagTeam: true,
      };
    }
    
    // For tournament matches, robot1 or robot2 might be null (placeholder matches)
    if (match.matchType === 'tournament' && (!match.robot1 || !match.robot2)) {
      console.log('[UpcomingMatches] Skipping incomplete tournament match:', match.id);
      return null; // Don't display incomplete tournament matches
    }
    
    // For league matches, both robots should be present
    if (!match.robot1 || !match.robot2) {
      console.error('[UpcomingMatches] Invalid match data - missing robots:', {
        matchId: match.id,
        matchType: match.matchType,
        robot1: match.robot1,
        robot2: match.robot2,
      });
      return null;
    }
    
    // Validate that we have the minimum required data
    if (!match.robot1.userId || !match.robot2.userId) {
      console.error('[UpcomingMatches] Invalid match data - missing userId:', {
        matchId: match.id,
        robot1UserId: match.robot1.userId,
        robot2UserId: match.robot2.userId,
      });
      return null;
    }
    
    const myRobot = isMyRobot(match.robot1.userId) ? match.robot1 : match.robot2;
    const opponent = isMyRobot(match.robot1.userId) ? match.robot2 : match.robot1;
    return { myRobot, opponent, isTagTeam: false };
  };

  const getRoundName = (round: number, maxRounds: number) => {
    const remainingRounds = maxRounds - round + 1;
    if (remainingRounds === 1) return 'Finals';
    if (remainingRounds === 2) return 'Semi-finals';
    if (remainingRounds === 3) return 'Quarter-finals';
    return `Round ${round}/${maxRounds}`;
  };

  const getReadinessWarningColor = () => {
    if (battleReadiness && !battleReadiness.isReady) {
      const hasLowHP = battleReadiness.warnings.some(w => w.includes('HP'));
      const hasNoWeapons = battleReadiness.warnings.some(w => w.includes('weapons'));
      
      if (hasLowHP) return 'text-[#f85149]';
      if (hasNoWeapons) return 'text-[#d29922]';
      return 'text-[#d29922]';
    }
    return 'text-[#3fb950]';
  };

  const getReadinessIcon = () => {
    if (battleReadiness && !battleReadiness.isReady) {
      const hasLowHP = battleReadiness.warnings.some(w => w.includes('HP'));
      if (hasLowHP) return '🔴';
      return '🟡';
    }
    return '🟢';
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Upcoming Matches</h2>
        {battleReadiness && !battleReadiness.isReady && (
          <div className={`flex items-center gap-2 ${getReadinessWarningColor()}`}>
            <span>{getReadinessIcon()}</span>
            <span className="text-sm font-medium">Not Battle Ready</span>
          </div>
        )}
      </div>
      {battleReadiness && !battleReadiness.isReady && battleReadiness.warnings.length > 0 && (
        <div className="mb-3 text-sm">
          {battleReadiness.warnings.map((warning, index) => (
            <div key={index} className={getReadinessWarningColor()}>
              ⚠️ {warning}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-0 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {matches.map((match) => {
          const matchResult = getMatchResult(match);
          
          // Skip invalid matches safely
          if (!matchResult) {
            console.log('[UpcomingMatches] Filtering out match:', {
              id: match.id,
              matchType: match.matchType,
              hasRobot1: !!match.robot1,
              hasRobot2: !!match.robot2,
            });
            return null;
          }
          
          const isTagTeam = matchResult.isTagTeam;
          const isTournament = match.matchType === 'tournament';
          
          // Handle tag team matches
          if (isTagTeam && matchResult.myTeam && matchResult.opponentTeam) {
            const tierColor = getLeagueTierColor(match.tagTeamLeague || 'bronze');
            const tierName = getLeagueTierName(match.tagTeamLeague || 'bronze');
            
            return (
              <div 
                key={match.id} 
                className={`
                  bg-[#252b38] border border-gray-700 rounded-lg p-2 mb-1.5
                  border-l-4 border-l-cyan-400
                  hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
                  transition-all duration-150 ease-out
                  hover:-translate-y-0.5
                `}
              >
                {/* Desktop Layout */}
                <div className="hidden md:flex items-center gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-6 text-center text-base">
                    🤝
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex-shrink-0 w-16">
                    <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-blue-500/20 text-blue-400">
                      PENDING
                    </div>
                  </div>
                  
                  {/* Match Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-1.5 py-0.5 bg-cyan-400/20 rounded text-cyan-400 font-semibold">
                        2v2
                      </span>
                      <div className={`text-xs ${tierColor}`}>
                        {tierName} Tag Team
                      </div>
                    </div>
                    <div className="font-medium text-xs truncate">
                      <span className="text-[#58a6ff]">
                        {matchResult.myTeam.activeRobot.name} & {matchResult.myTeam.reserveRobot.name}
                      </span>
                      <span className="text-[#57606a] mx-1.5">vs</span>
                      <span className="text-[#e6edf3]">
                        {matchResult.opponentTeam.activeRobot.name} & {matchResult.opponentTeam.reserveRobot.name}
                      </span>
                    </div>
                  </div>
                  
                  {/* Date */}
                  <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
                    {formatDateTime(match.scheduledFor)}
                  </div>
                  
                  {/* ELO */}
                  <div className="flex-shrink-0 w-20 text-center">
                    <div className="text-xs text-[#8b949e]">
                      {matchResult.myTeam.combinedELO} vs {matchResult.opponentTeam.combinedELO}
                    </div>
                  </div>
                  
                  {/* Arrow Icon */}
                  <div className="flex-shrink-0 w-6 text-center text-[#58a6ff] text-sm">
                    →
                  </div>
                </div>
                
                {/* Mobile Layout */}
                <div className="md:hidden">
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🤝</span>
                      <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                        PENDING
                      </div>
                      <span className="text-xs px-1.5 py-0.5 bg-cyan-400/20 rounded text-cyan-400 font-semibold">
                        2v2
                      </span>
                    </div>
                    <div className="text-xs text-[#8b949e]">
                      {formatDateTime(match.scheduledFor)}
                    </div>
                  </div>
                  
                  {/* Battle Type */}
                  <div className={`text-xs ${tierColor} mb-1.5`}>
                    {tierName} Tag Team
                  </div>
                  
                  {/* Matchup Row */}
                  <div className="mb-1.5">
                    <div className="text-sm font-medium">
                      <span className="text-[#58a6ff]">
                        {matchResult.myTeam.activeRobot.name} & {matchResult.myTeam.reserveRobot.name}
                      </span>
                      <span className="text-[#57606a] mx-1.5">vs</span>
                      <span className="text-[#e6edf3]">
                        {matchResult.opponentTeam.activeRobot.name} & {matchResult.opponentTeam.reserveRobot.name}
                      </span>
                    </div>
                  </div>
                  
                  {/* Stats Row */}
                  <div className="flex justify-between text-xs">
                    <div>
                      <span className="text-[#57606a]">ELO: </span>
                      <span className="text-[#e6edf3]">{matchResult.myTeam.combinedELO}</span>
                    </div>
                    <div>
                      <span className="text-[#57606a]">vs </span>
                      <span className="text-[#e6edf3]">{matchResult.opponentTeam.combinedELO}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          
          // Handle 1v1 matches (league and tournament)
          const { myRobot, opponent } = matchResult;
          if (!myRobot || !opponent) return null;
          const tierColor = isTournament ? 'text-[#d29922]' : getLeagueTierColor(match.leagueType);
          const tierName = isTournament 
            ? (match.tournamentRound && match.maxRounds 
                ? `${match.tournamentName || 'Tournament'} • ${getRoundName(match.tournamentRound, match.maxRounds)}`
                : match.tournamentName || 'Tournament')
            : `${getLeagueTierName(match.leagueType)} League`;
          
          const getBorderColor = () => {
            return isTournament ? 'border-l-[#d29922]' : 'border-l-[#58a6ff]';
          };
          
          return (
            <div 
              key={match.id} 
              className={`
                bg-[#252b38] border border-gray-700 rounded-lg p-2 mb-1.5
                border-l-4 ${getBorderColor()}
                hover:bg-[#1a1f29] hover:border-[#58a6ff]/50
                transition-all duration-150 ease-out
                hover:-translate-y-0.5
              `}
            >
              {/* Desktop Layout */}
              <div className="hidden md:flex items-center gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-6 text-center text-base">
                  {isTournament ? '🏆' : '⚔️'}
                </div>
                
                {/* Status Badge */}
                <div className="flex-shrink-0 w-16">
                  <div className="text-xs font-bold px-1.5 py-0.5 rounded text-center bg-blue-500/20 text-blue-400">
                    PENDING
                  </div>
                </div>
                
                {/* Match Info */}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${tierColor} mb-0.5`}>
                    {tierName}
                  </div>
                  <div className="font-medium text-xs truncate">
                    <span className="text-[#58a6ff]">{myRobot.name}</span>
                    <span className="text-[#57606a] mx-1.5">vs</span>
                    <span className="text-[#e6edf3]">{opponent.name}</span>
                  </div>
                </div>
                
                {/* Date */}
                <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
                  {isTournament ? 'TBD' : formatDateTime(match.scheduledFor)}
                </div>
                
                {/* ELO */}
                <div className="flex-shrink-0 w-20 text-center">
                  <div className="text-xs text-[#8b949e]">
                    {myRobot.elo} vs {opponent.elo}
                  </div>
                </div>
                
                {/* Arrow Icon */}
                <div className="flex-shrink-0 w-6 text-center text-[#58a6ff] text-sm">
                  →
                </div>
              </div>
              
              {/* Mobile Layout */}
              <div className="md:hidden">
                {/* Header Row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{isTournament ? '🏆' : '⚔️'}</span>
                    <div className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      PENDING
                    </div>
                  </div>
                  <div className="text-xs text-[#8b949e]">
                    {isTournament ? 'TBD' : formatDateTime(match.scheduledFor)}
                  </div>
                </div>
                
                {/* Battle Type */}
                <div className={`text-xs ${tierColor} mb-1.5`}>
                  {tierName}
                </div>
                
                {/* Matchup Row */}
                <div className="mb-1.5">
                  <div className="text-sm font-medium">
                    <span className="text-[#58a6ff]">{myRobot.name}</span>
                    <span className="text-[#57606a] mx-1.5">vs</span>
                    <span className="text-[#e6edf3]">{opponent.name}</span>
                  </div>
                </div>
                
                {/* Stats Row */}
                <div className="flex justify-between text-xs">
                  <div>
                    <span className="text-[#57606a]">ELO: </span>
                    <span className="text-[#e6edf3]">{myRobot.elo}</span>
                  </div>
                  <div>
                    <span className="text-[#57606a]">vs </span>
                    <span className="text-[#e6edf3]">{opponent.elo}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UpcomingMatches;
