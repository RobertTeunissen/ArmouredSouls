import { useEffect, useState } from 'react';
import { getUpcomingMatches, ScheduledMatch } from '../utils/matchmakingApi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { KothMatchCard, TagTeamMatchCard, ByeMatchCard, StandardMatchCard } from './match-cards';

interface BattleReadiness {
  isReady: boolean;
  warnings: string[];
}

interface UpcomingMatchesProps {
  robotId?: number;
  battleReadiness?: BattleReadiness;
}

function UpcomingMatches({ robotId, battleReadiness }: UpcomingMatchesProps = {}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robotId]);

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
      const data = await getUpcomingMatches(robotId);
      console.log('[UpcomingMatches] Received matches:', {
        total: data.length,
        leagueMatches: data.filter(m => m.matchType === 'league').length,
        tournamentMatches: data.filter(m => m.matchType === 'tournament').length,
        matches: data,
      });

      setMatches(data);
      setError(null);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
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

  const isMyRobot = (robotUserId: number): boolean => {
    return user != null && robotUserId === user.id;
  };

  const getMatchResult = (match: ScheduledMatch) => {
    if (!match) return null;

    if (match.matchType === 'tag_team') {
      if (!match.team1 || !match.team2) return null;
      if (!match.team1.activeRobot || !match.team2.activeRobot ||
          !match.team1.reserveRobot || !match.team2.reserveRobot) return null;
      if (!match.team1.activeRobot.userId || !match.team2.activeRobot.userId) return null;

      const myTeam = isMyRobot(match.team1.activeRobot.userId) ? match.team1 : match.team2;
      const opponentTeam = isMyRobot(match.team1.activeRobot.userId) ? match.team2 : match.team1;
      return { myTeam, opponentTeam, isTagTeam: true as const };
    }

    if (match.matchType === 'tournament' && !match.isByeMatch && (!match.robot1 || !match.robot2)) {
      return null;
    }

    if (match.isByeMatch && match.robot1) {
      return { myRobot: match.robot1, opponent: null, isTagTeam: false as const, isByeMatch: true as const };
    }

    if (!match.robot1 || !match.robot2) return null;
    if (!match.robot1.userId || !match.robot2.userId) return null;

    const myRobot = isMyRobot(match.robot1.userId) ? match.robot1 : match.robot2;
    const opponent = isMyRobot(match.robot1.userId) ? match.robot2 : match.robot1;
    return { myRobot, opponent, isTagTeam: false as const };
  };

  const getRoundName = (round: number, maxRounds: number): string => {
    const remainingRounds = maxRounds - round + 1;
    if (remainingRounds === 1) return 'Finals';
    if (remainingRounds === 2) return 'Semi-finals';
    if (remainingRounds === 3) return 'Quarter-finals';
    return `Round ${round}/${maxRounds}`;
  };

  const getReadinessWarningColor = (): string => {
    if (battleReadiness && !battleReadiness.isReady) {
      const hasLowHP = battleReadiness.warnings.some(w => w.includes('HP'));
      if (hasLowHP) return 'text-[#f85149]';
      return 'text-[#d29922]';
    }
    return 'text-[#3fb950]';
  };

  const getReadinessIcon = (): string => {
    if (battleReadiness && !battleReadiness.isReady) {
      const hasLowHP = battleReadiness.warnings.some(w => w.includes('HP'));
      if (hasLowHP) return '🔴';
      return '🟡';
    }
    return '🟢';
  };

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-3">Upcoming Matches</h2>
        <p className="text-sm text-secondary">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-3">Upcoming Matches</h2>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-3">Upcoming Matches</h2>
        <p className="text-sm text-secondary">No upcoming matches scheduled</p>
      </div>
    );
  }

  const renderMatchCard = (match: ScheduledMatch) => {
    // KotH matches
    if (match.matchType === 'koth') {
      return <KothMatchCard key={match.id} match={match} />;
    }

    const matchResult = getMatchResult(match);
    if (!matchResult) {
      console.log('[UpcomingMatches] Filtering out match:', {
        id: match.id,
        matchType: match.matchType,
        hasRobot1: !!match.robot1,
        hasRobot2: !!match.robot2,
      });
      return null;
    }

    // Tag team matches
    if (matchResult.isTagTeam && matchResult.myTeam && matchResult.opponentTeam) {
      return (
        <TagTeamMatchCard
          key={match.id}
          match={match}
          myTeam={matchResult.myTeam}
          opponentTeam={matchResult.opponentTeam}
        />
      );
    }

    const { myRobot, opponent } = matchResult as { myRobot: any; opponent: any; isTagTeam: false; isByeMatch?: boolean }; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!myRobot) return null;

    // Bye matches
    if (matchResult.isByeMatch) {
      return (
        <ByeMatchCard
          key={match.id}
          match={match}
          myRobot={myRobot}
          getRoundName={getRoundName}
        />
      );
    }

    if (!opponent) return null;

    // Standard 1v1 matches (league / tournament)
    return (
      <StandardMatchCard
        key={match.id}
        match={match}
        myRobot={myRobot}
        opponent={opponent}
        getRoundName={getRoundName}
      />
    );
  };

  return (
    <div className="bg-surface p-4 rounded-lg border border-white/10">
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
        {matches.map(renderMatchCard)}
      </div>
    </div>
  );
}

export default UpcomingMatches;
