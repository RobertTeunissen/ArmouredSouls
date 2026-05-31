import { useEffect, useState } from 'react';
import { getMatchHistory, BattleHistory, formatDateTime, getLeagueTierColor, getLeagueTierName } from '../utils/matchmakingApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface TeamBattleRecentMatchesProps {
  teamSize: 2 | 3;
}

function TeamBattleRecentMatches({ teamSize }: TeamBattleRecentMatchesProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<BattleHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const battleType = teamSize === 2 ? 'league_2v2' : 'league_3v3';
  const sizeLabel = `${teamSize}v${teamSize}`;

  useEffect(() => {
    fetchMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSize]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        logout();
        navigate('/login');
        return;
      }

      const data = await getMatchHistory(1, 5, battleType);
      setMatches(data.data);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      setError('Failed to load recent matches');
    } finally {
      setLoading(false);
    }
  };

  const getOutcome = (battle: BattleHistory): 'win' | 'loss' | 'draw' => {
    if (!battle.winnerId) return 'draw';
    if (!user) return 'draw';
    // For team battles, check if the winner robot belongs to the user
    if (battle.robot1.userId === user.id) {
      return battle.winnerId === battle.robot1Id ? 'win' : 'loss';
    }
    if (battle.robot2.userId === user.id) {
      return battle.winnerId === battle.robot2Id ? 'win' : 'loss';
    }
    return 'draw';
  };

  const getOutcomeColor = (outcome: 'win' | 'loss' | 'draw'): string => {
    switch (outcome) {
      case 'win': return 'text-[#3fb950]';
      case 'loss': return 'text-[#f85149]';
      case 'draw': return 'text-[#d29922]';
    }
  };

  const getOutcomeLabel = (outcome: 'win' | 'loss' | 'draw'): string => {
    switch (outcome) {
      case 'win': return 'WIN';
      case 'loss': return 'LOSS';
      case 'draw': return 'DRAW';
    }
  };

  const getLpDelta = (battle: BattleHistory): number => {
    // Use team battle LP delta from API if available (R9.7)
    const battleAny = battle as BattleHistory & {
      team1LpDelta?: number;
      team2LpDelta?: number;
    };
    if (battleAny.team1LpDelta !== undefined || battleAny.team2LpDelta !== undefined) {
      const isRobot1Side = user && battle.robot1.userId === user.id;
      return isRobot1Side
        ? (battleAny.team1LpDelta ?? 0)
        : (battleAny.team2LpDelta ?? 0);
    }
    // Fallback: use ELO delta
    const myRobotId = user && battle.robot1.userId === user.id ? battle.robot1Id : battle.robot2Id;
    const eloBefore = myRobotId === battle.robot1Id ? battle.robot1ELOBefore : battle.robot2ELOBefore;
    const eloAfter = myRobotId === battle.robot1Id ? battle.robot1ELOAfter : battle.robot2ELOAfter;
    return eloAfter - eloBefore;
  };

  const getOpponentName = (battle: BattleHistory): string => {
    // Use team battle opponent name from API if available (R9.7)
    const battleAny = battle as BattleHistory & {
      team1TeamName?: string | null;
      team2TeamName?: string | null;
      isByeMatch?: boolean;
    };
    if (battleAny.team1TeamName || battleAny.team2TeamName) {
      if (!user) return 'Unknown';
      const isRobot1Side = battle.robot1.userId === user.id;
      return isRobot1Side
        ? (battleAny.team2TeamName || 'Bye')
        : (battleAny.team1TeamName || 'Unknown');
    }
    // Fallback: use opponent stable name
    if (!user) return 'Unknown';
    if (battle.robot1.userId === user.id) {
      return battle.robot2.user.username;
    }
    return battle.robot1.user.username;
  };

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <span>{teamSize === 2 ? '⚔️' : '🗡️'}</span>
          {sizeLabel} League — Recent
        </h3>
        <p className="text-sm text-secondary">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <span>{teamSize === 2 ? '⚔️' : '🗡️'}</span>
          {sizeLabel} League — Recent
        </h3>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <span>{teamSize === 2 ? '⚔️' : '🗡️'}</span>
          {sizeLabel} League — Recent
        </h3>
        <p className="text-sm text-secondary">No {sizeLabel} League matches yet. Register a team to get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-surface p-4 rounded-lg border border-white/10">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span>{teamSize === 2 ? '⚔️' : '🗡️'}</span>
          {sizeLabel} League — Recent
        </h3>
        <button
          onClick={() => navigate(`/battle-history?battleType=${battleType}`)}
          className="text-primary hover:text-primary-light text-xs font-semibold"
        >
          View All →
        </button>
      </div>

      <div className="space-y-1.5">
        {matches.map((battle) => {
          const outcome = getOutcome(battle);
          const lpDelta = getLpDelta(battle);
          const opponentName = getOpponentName(battle);
          const tierColor = getLeagueTierColor(battle.leagueType || 'bronze');
          const tierName = getLeagueTierName(battle.leagueType || 'bronze');

          return (
            <div
              key={battle.id}
              onClick={() => navigate(`/battle/${battle.id}`)}
              className={`
                bg-[#252b38] border border-white/10 rounded-lg p-2.5
                border-l-4 ${outcome === 'win' ? 'border-l-[#3fb950]' : outcome === 'loss' ? 'border-l-[#f85149]' : 'border-l-[#d29922]'}
                hover:bg-[#1a1f29] cursor-pointer
                transition-all duration-150 ease-out
              `}
            >
              {/* Desktop */}
              <div className="hidden md:flex items-center gap-3">
                <div className={`flex-shrink-0 w-12 text-xs font-bold text-center ${getOutcomeColor(outcome)}`}>
                  {getOutcomeLabel(outcome)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs ${tierColor} mb-0.5`}>{tierName}</div>
                  <div className="text-xs truncate">
                    <span className="text-secondary">vs </span>
                    <span className="text-[#e6edf3] font-medium">{opponentName}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 w-16 text-center">
                  <span className={`text-xs font-semibold ${lpDelta >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                    {lpDelta >= 0 ? '+' : ''}{lpDelta} LP
                  </span>
                </div>
                <div className="flex-shrink-0 w-28 text-xs text-[#8b949e]">
                  {formatDateTime(battle.createdAt)}
                </div>
              </div>

              {/* Mobile */}
              <div className="md:hidden">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${getOutcomeColor(outcome)}`}>
                      {getOutcomeLabel(outcome)}
                    </span>
                    <span className={`text-xs ${tierColor}`}>{tierName}</span>
                  </div>
                  <span className="text-xs text-[#8b949e]">{formatDateTime(battle.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#e6edf3]">vs {opponentName}</span>
                  <span className={`text-xs font-semibold ${lpDelta >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                    {lpDelta >= 0 ? '+' : ''}{lpDelta} LP
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TeamBattleRecentMatches;
