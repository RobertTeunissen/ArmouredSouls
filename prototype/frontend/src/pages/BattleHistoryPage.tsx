import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import BattleHistorySummary from '../components/BattleHistorySummary';
import CompactBattleCard from '../components/CompactBattleCard';
import {
  getMatchHistory,
  BattleHistory,
  PaginatedResponse,
  getBattleOutcome,
  getELOChange,
  formatDateTime,
  formatDuration,
  getTournamentRoundName,
} from '../utils/matchmakingApi';

function BattleHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [battles, setBattles] = useState<BattleHistory[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBattles(1);
  }, []);

  const fetchBattles = async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('[BattleHistory] No authentication token found');
        setError('Authentication required');
        setLoading(false);
        return;
      }
      
      console.log('[BattleHistory] Fetching battle history, page:', page);
      const data: PaginatedResponse<BattleHistory> = await getMatchHistory(page, 20);
      console.log('[BattleHistory] Received data:', data);
      
      setBattles(data.data);
      setPagination(data.pagination);
      setError(null);
    } catch (err: any) {
      console.error('[BattleHistory] Failed to fetch battle history:', err);
      console.error('[BattleHistory] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      setError(err.response?.data?.message || 'Failed to load battle history');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchBattles(newPage);
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

  const getReward = (battle: BattleHistory, robotId: number) => {
    return battle.winnerId === robotId ? battle.winnerReward : battle.loserReward;
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (battles.length === 0) {
      return {
        totalBattles: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        avgELOChange: 0,
        totalCreditsEarned: 0,
      };
    }

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalELOChange = 0;
    let totalCredits = 0;
    let lastOutcome: string | null = null;
    let streakCount = 0;
    let streakType: 'win' | 'loss' | null = null;

    // League vs Tournament breakdown
    let leagueWins = 0, leagueLosses = 0, leagueDraws = 0, leagueELOChange = 0, leagueBattles = 0;
    let tournamentWins = 0, tournamentLosses = 0, tournamentDraws = 0, tournamentELOChange = 0, tournamentBattles = 0;

    battles.forEach((battle) => {
      const { outcome, eloChange, myRobotId } = getMatchData(battle);
      const reward = getReward(battle, myRobotId);
      const isTournament = battle.battleType === 'tournament';

      if (outcome === 'win') {
        wins++;
        if (isTournament) tournamentWins++;
        else leagueWins++;
      } else if (outcome === 'loss') {
        losses++;
        if (isTournament) tournamentLosses++;
        else leagueLosses++;
      } else if (outcome === 'draw') {
        draws++;
        if (isTournament) tournamentDraws++;
        else leagueDraws++;
      }

      totalELOChange += eloChange;
      totalCredits += reward;

      if (isTournament) {
        tournamentBattles++;
        tournamentELOChange += eloChange;
      } else {
        leagueBattles++;
        leagueELOChange += eloChange;
      }

      // Track streak (only for first page)
      if (lastOutcome === null || lastOutcome === outcome) {
        if (outcome === 'win' || outcome === 'loss') {
          streakCount++;
          streakType = outcome as 'win' | 'loss';
        }
      }
      lastOutcome = outcome;
    });

    const totalBattles = wins + losses + draws;
    const winRate = totalBattles > 0 ? wins / totalBattles : 0;
    const avgELOChange = totalBattles > 0 ? totalELOChange / totalBattles : 0;

    const leagueWinRate = leagueBattles > 0 ? leagueWins / leagueBattles : 0;
    const leagueAvgELO = leagueBattles > 0 ? leagueELOChange / leagueBattles : 0;

    const tournamentWinRate = tournamentBattles > 0 ? tournamentWins / tournamentBattles : 0;
    const tournamentAvgELO = tournamentBattles > 0 ? tournamentELOChange / tournamentBattles : 0;

    return {
      totalBattles,
      wins,
      losses,
      draws,
      winRate,
      avgELOChange,
      totalCreditsEarned: totalCredits,
      currentStreak: streakCount >= 3 ? { type: streakType!, count: streakCount } : undefined,
      leagueStats: leagueBattles > 0 ? {
        battles: leagueBattles,
        wins: leagueWins,
        losses: leagueLosses,
        draws: leagueDraws,
        winRate: leagueWinRate,
        avgELOChange: leagueAvgELO,
      } : undefined,
      tournamentStats: tournamentBattles > 0 ? {
        battles: tournamentBattles,
        wins: tournamentWins,
        losses: tournamentLosses,
        draws: tournamentDraws,
        winRate: tournamentWinRate,
        avgELOChange: tournamentAvgELO,
      } : undefined,
    };
  }, [battles]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-[#e6edf3]">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-6">Battle History</h1>

        {loading && (
          <div className="bg-[#252b38] p-6 rounded-lg">
            <p className="text-[#8b949e]">Loading battles...</p>
          </div>
        )}

        {error && (
          <div className="bg-[#f85149]/20 border border-[#f85149] p-6 rounded-lg">
            <p className="text-[#f85149]">{error}</p>
          </div>
        )}

        {!loading && !error && battles.length === 0 && (
          <div className="bg-[#252b38] p-6 rounded-lg">
            <p className="text-[#8b949e]">No battles yet. Your first match is coming soon!</p>
          </div>
        )}

        {!loading && !error && battles.length > 0 && (
          <>
            {/* Summary Statistics */}
            <BattleHistorySummary stats={summaryStats} />

            {/* Battle List */}
            <div className="mb-6">
              {battles.map((battle) => {
                const { myRobot, opponent, outcome, eloChange, myRobotId } = getMatchData(battle);
                const reward = getReward(battle, myRobotId);

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

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-[#252b38] rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1a1f29] transition-colors"
                >
                  Previous
                </button>

                <div className="px-4 py-2 bg-[#252b38] rounded">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-[#252b38] rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1a1f29] transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BattleHistoryPage;
