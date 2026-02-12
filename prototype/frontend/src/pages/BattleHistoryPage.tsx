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
  const [battleFilter, setBattleFilter] = useState<'overall' | 'league' | 'tournament' | 'tag_team'>('overall');
  
  // Filter and sort state
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'elo-desc' | 'elo-asc' | 'reward-desc' | 'reward-asc'>('date-desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [resultsPerPage, setResultsPerPage] = useState(20);

  useEffect(() => {
    fetchBattles(1);
  }, []);

  useEffect(() => {
    // Refetch when results per page changes
    fetchBattles(1);
  }, [resultsPerPage]);

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
      const data: PaginatedResponse<BattleHistory> = await getMatchHistory(page, resultsPerPage);
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
    // For tag team battles, determine reward based on team winner
    if (battle.battleType === 'tag_team' && battle.team1Id && battle.team2Id) {
      const isTeam1Robot = battle.robot1Id === robotId;
      const isTeam2Robot = battle.robot2Id === robotId;
      
      if (isTeam1Robot) {
        return battle.winnerId === battle.team1Id ? battle.winnerReward : battle.loserReward;
      } else if (isTeam2Robot) {
        return battle.winnerId === battle.team2Id ? battle.winnerReward : battle.loserReward;
      }
    }
    
    // For 1v1 battles, winnerId is the robot ID
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
    
    // For streak calculation: count consecutive outcomes from most recent battle
    let streakCount = 0;
    let streakType: 'win' | 'loss' | null = null;
    let firstBattleOutcome: 'win' | 'loss' | 'draw' | null = null;
    let streakBroken = false; // Flag to stop counting once streak is broken

    // League vs Tournament vs Tag Team breakdown
    let leagueWins = 0, leagueLosses = 0, leagueDraws = 0, leagueELOChange = 0, leagueBattles = 0;
    let tournamentWins = 0, tournamentLosses = 0, tournamentDraws = 0, tournamentELOChange = 0, tournamentBattles = 0;
    let tagTeamWins = 0, tagTeamLosses = 0, tagTeamDraws = 0, tagTeamELOChange = 0, tagTeamBattles = 0;

    battles.forEach((battle, index) => {
      const { outcome, eloChange, myRobotId } = getMatchData(battle);
      const reward = getReward(battle, myRobotId);
      const isTournament = battle.battleType === 'tournament';
      const isTagTeam = battle.battleType === 'tag_team';

      if (outcome === 'win') {
        wins++;
        if (isTournament) tournamentWins++;
        else if (isTagTeam) tagTeamWins++;
        else leagueWins++;
      } else if (outcome === 'loss') {
        losses++;
        if (isTournament) tournamentLosses++;
        else if (isTagTeam) tagTeamLosses++;
        else leagueLosses++;
      } else if (outcome === 'draw') {
        draws++;
        if (isTournament) tournamentDraws++;
        else if (isTagTeam) tagTeamDraws++;
        else leagueDraws++;
      }

      totalELOChange += eloChange;
      totalCredits += reward;

      if (isTournament) {
        tournamentBattles++;
        tournamentELOChange += eloChange;
      } else if (isTagTeam) {
        tagTeamBattles++;
        tagTeamELOChange += eloChange;
      } else {
        leagueBattles++;
        leagueELOChange += eloChange;
      }

      // Track streak: count consecutive outcomes starting from most recent (index 0)
      // Stop counting once the streak is broken
      if (!streakBroken) {
        if (index === 0) {
          // First battle (most recent) - establish the streak type
          if (outcome === 'win' || outcome === 'loss') {
            streakCount = 1;
            streakType = outcome as 'win' | 'loss';
            firstBattleOutcome = outcome;
          } else {
            // First battle is a draw - no streak
            firstBattleOutcome = 'draw';
            streakCount = 0;
            streakType = null;
            streakBroken = true; // Draw breaks the streak
          }
        } else if (firstBattleOutcome === 'win' || firstBattleOutcome === 'loss') {
          // We have an established streak type, check if this battle continues it
          if (outcome === firstBattleOutcome) {
            streakCount++;
          } else {
            // Outcome doesn't match or is a draw - streak is broken, stop counting
            streakBroken = true;
          }
        }
      }
    });

    const totalBattles = wins + losses + draws;
    const winRate = totalBattles > 0 ? wins / totalBattles : 0;
    const avgELOChange = totalBattles > 0 ? totalELOChange / totalBattles : 0;

    const leagueWinRate = leagueBattles > 0 ? leagueWins / leagueBattles : 0;
    const leagueAvgELO = leagueBattles > 0 ? leagueELOChange / leagueBattles : 0;

    const tournamentWinRate = tournamentBattles > 0 ? tournamentWins / tournamentBattles : 0;
    const tournamentAvgELO = tournamentBattles > 0 ? tournamentELOChange / tournamentBattles : 0;

    const tagTeamWinRate = tagTeamBattles > 0 ? tagTeamWins / tagTeamBattles : 0;
    const tagTeamAvgELO = tagTeamBattles > 0 ? tagTeamELOChange / tagTeamBattles : 0;

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
      tagTeamStats: tagTeamBattles > 0 ? {
        battles: tagTeamBattles,
        wins: tagTeamWins,
        losses: tagTeamLosses,
        draws: tagTeamDraws,
        winRate: tagTeamWinRate,
        avgELOChange: tagTeamAvgELO,
      } : undefined,
    };
  }, [battles]);

  // Filter and sort battles
  const filteredAndSortedBattles = useMemo(() => {
    let filtered = battles;

    // Apply battle type filter (league/tournament/tag_team)
    if (battleFilter === 'league') {
      filtered = filtered.filter(b => b.battleType !== 'tournament' && b.battleType !== 'tag_team');
    } else if (battleFilter === 'tournament') {
      filtered = filtered.filter(b => b.battleType === 'tournament');
    } else if (battleFilter === 'tag_team') {
      filtered = filtered.filter(b => b.battleType === 'tag_team');
    }

    // Apply outcome filter
    if (outcomeFilter !== 'all') {
      filtered = filtered.filter(b => {
        const { outcome } = getMatchData(b);
        return outcome === outcomeFilter;
      });
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(b => {
        const { myRobot, opponent } = getMatchData(b);
        return (
          myRobot.name.toLowerCase().includes(search) ||
          opponent.name.toLowerCase().includes(search) ||
          opponent.user.username.toLowerCase().includes(search)
        );
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const aData = getMatchData(a);
      const bData = getMatchData(b);
      
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'elo-desc':
          return bData.eloChange - aData.eloChange;
        case 'elo-asc':
          return aData.eloChange - bData.eloChange;
        case 'reward-desc':
          return getReward(b, bData.myRobotId) - getReward(a, aData.myRobotId);
        case 'reward-asc':
          return getReward(a, aData.myRobotId) - getReward(b, bData.myRobotId);
        default:
          return 0;
      }
    });

    return sorted;
  }, [battles, battleFilter, outcomeFilter, searchTerm, sortBy]);

  const clearFilters = () => {
    setOutcomeFilter('all');
    setBattleFilter('overall');
    setSearchTerm('');
    setSortBy('date-desc');
  };

  const hasActiveFilters = outcomeFilter !== 'all' || battleFilter !== 'overall' || searchTerm.trim() !== '' || sortBy !== 'date-desc';

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
            <BattleHistorySummary 
              stats={summaryStats} 
              view={battleFilter} 
              onViewChange={setBattleFilter}
            />

            {/* Filter and Sort Controls */}
            <div className="bg-[#252b38] border border-gray-700 rounded-lg p-4 mb-4">
              <div className="flex flex-wrap gap-3">
                {/* Outcome Filter */}
                <select 
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value as any)}
                  className="bg-[#1a1f29] border border-gray-700 rounded px-3 py-2 text-sm text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
                >
                  <option value="all">All Outcomes</option>
                  <option value="win">Wins Only</option>
                  <option value="loss">Losses Only</option>
                  <option value="draw">Draws Only</option>
                </select>

                {/* Sort Control */}
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#1a1f29] border border-gray-700 rounded px-3 py-2 text-sm text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
                >
                  <option value="date-desc">Sort: Newest First</option>
                  <option value="date-asc">Sort: Oldest First</option>
                  <option value="elo-desc">Sort: Highest ELO Gain</option>
                  <option value="elo-asc">Sort: Biggest ELO Loss</option>
                  <option value="reward-desc">Sort: Highest Reward</option>
                  <option value="reward-asc">Sort: Lowest Reward</option>
                </select>

                {/* Search Input */}
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search robot or opponent..."
                  className="bg-[#1a1f29] border border-gray-700 rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#57606a] flex-1 min-w-[200px] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:outline-none transition-colors"
                />

                {/* Results Per Page */}
                <select 
                  value={resultsPerPage}
                  onChange={(e) => setResultsPerPage(Number(e.target.value))}
                  className="bg-[#1a1f29] border border-gray-700 rounded px-3 py-2 text-sm text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
                >
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-[#1a1f29] border border-gray-700 rounded text-sm text-[#8b949e] hover:bg-[#252b38] hover:text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Filter Results Count */}
              {(hasActiveFilters || filteredAndSortedBattles.length !== battles.length) && (
                <div className="mt-3 text-sm text-[#8b949e]">
                  Showing {filteredAndSortedBattles.length} of {battles.length} battles
                  {battleFilter !== 'overall' && ` (${battleFilter} only)`}
                </div>
              )}
            </div>

            {/* Battle List */}
            <div className="mb-6">
              {filteredAndSortedBattles.length === 0 ? (
                <div className="bg-[#252b38] border border-gray-700 rounded-lg p-12 text-center">
                  <div className="text-6xl mb-4 opacity-30">⚔️</div>
                  <h3 className="text-xl font-bold mb-2">No Battles Found</h3>
                  <p className="text-[#8b949e] mb-4">
                    {hasActiveFilters 
                      ? "Try adjusting your filters to see more results."
                      : "Your first match is coming soon!"}
                  </p>
                  {hasActiveFilters && (
                    <button 
                      onClick={clearFilters}
                      className="px-4 py-2 bg-[#58a6ff] hover:bg-[#58a6ff]/80 rounded transition-colors text-white font-medium"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                filteredAndSortedBattles.map((battle) => {
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
                })
              )}
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
