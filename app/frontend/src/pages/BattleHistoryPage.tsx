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
  getBattleReward,
} from '../utils/matchmakingApi';
import { computeBattleSummary, EMPTY_SUMMARY } from '../utils/battleHistoryStats';

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
  const [battleFilter, setBattleFilter] = useState<'overall' | 'league' | 'tournament' | 'tag_team' | 'koth'>('overall');
  
  // Filter and sort state
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'elo-desc' | 'elo-asc' | 'reward-desc' | 'reward-asc'>('date-desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [resultsPerPage, setResultsPerPage] = useState(20);  useEffect(() => {
    fetchBattles(1, battleFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  useEffect(() => {
    // Refetch when results per page or battle filter changes
    fetchBattles(1, battleFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsPerPage, battleFilter]);

  const fetchBattles = async (page: number, filter: typeof battleFilter) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }
      
      const data: PaginatedResponse<BattleHistory> = await getMatchHistory(page, resultsPerPage, filter);
      
      setBattles(data.data);
      setPagination(data.pagination);
      setError(null);
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      setError(err.response?.data?.message || 'Failed to load battle history');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchBattles(newPage, battleFilter);
  };

  const isMyRobot = (robotUserId: number) => {
    return user && robotUserId === user.id;
  };

  const getMatchData = (battle: BattleHistory) => {
    const isKoth = battle.battleType === 'koth';
    const isMyRobot1 = isMyRobot(battle.robot1.userId);

    // For KotH, backend ensures user's robot is in robot1 (even for 3rd-6th place)
    const myRobot = isMyRobot1 ? battle.robot1 : battle.robot2;
    const opponent = isMyRobot1 ? battle.robot2 : battle.robot1;
    const myRobotId = myRobot.id;

    // For KotH, derive outcome from placement (1st = win, rest = loss)
    const outcome = isKoth
      ? (battle.kothPlacement === 1 ? 'win' : 'loss')
      : getBattleOutcome(battle, myRobotId);

    const eloChange = getELOChange(battle, myRobotId);

    return { myRobot, opponent, outcome, eloChange, myRobotId };
  };

  // Calculate summary statistics (extracted to battleHistoryStats.ts)
  const summaryStats = useMemo(
    () => (user ? computeBattleSummary(battles, user.id) : EMPTY_SUMMARY),
    [battles, user],
  );

  // Filter and sort battles (battle type filter now handled by backend)
  const filteredAndSortedBattles = useMemo(() => {
    let filtered = battles;

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
          return getBattleReward(b, bData.myRobotId) - getBattleReward(a, aData.myRobotId);
        case 'reward-asc':
          return getBattleReward(a, aData.myRobotId) - getBattleReward(b, bData.myRobotId);
        default:
          return 0;
      }
    });

    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battles, outcomeFilter, searchTerm, sortBy]);

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

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
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

        {!loading && !error && battles.length === 0 && battleFilter === 'overall' && (
          <div className="bg-[#252b38] p-6 rounded-lg">
            <p className="text-[#8b949e]">No battles yet. Your first match is coming soon!</p>
          </div>
        )}

        {!loading && !error && (battles.length > 0 || battleFilter !== 'overall') && (
          <>
            {/* Summary Statistics */}
            <BattleHistorySummary 
              stats={summaryStats} 
              view={battleFilter} 
              onViewChange={setBattleFilter}
            />

            {/* Filter and Sort Controls */}
            <div className="bg-[#252b38] border border-white/10 rounded-lg p-4 mb-4">
              <div className="flex flex-col lg:flex-row lg:flex-wrap gap-3">
                {/* Outcome Filter */}
                <select 
                  value={outcomeFilter}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => setOutcomeFilter(e.target.value as any)}
                  className="w-full lg:w-auto min-h-[44px] bg-[#1a1f29] border border-white/10 rounded px-3 py-2 text-sm text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
                >
                  <option value="all">All Outcomes</option>
                  <option value="win">Wins Only</option>
                  <option value="loss">Losses Only</option>
                  <option value="draw">Draws Only</option>
                </select>

                {/* Sort Control */}
                <select 
                  value={sortBy}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full lg:w-auto min-h-[44px] bg-[#1a1f29] border border-white/10 rounded px-3 py-2 text-sm text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
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
                  className="w-full lg:w-auto min-h-[44px] bg-[#1a1f29] border border-white/10 rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#57606a] lg:flex-1 lg:min-w-[200px] hover:border-[#58a6ff]/50 focus:border-[#58a6ff] focus:outline-none transition-colors"
                />

                {/* Results Per Page */}
                <select 
                  value={resultsPerPage}
                  onChange={(e) => setResultsPerPage(Number(e.target.value))}
                  className="w-full lg:w-auto min-h-[44px] bg-[#1a1f29] border border-white/10 rounded px-3 py-2 text-sm text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
                >
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="w-full lg:w-auto min-h-[44px] px-4 py-2 bg-[#1a1f29] border border-white/10 rounded text-sm text-[#8b949e] hover:bg-[#252b38] hover:text-[#e6edf3] hover:border-[#58a6ff]/50 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Filter Results Count */}
              {filteredAndSortedBattles.length !== battles.length && (
                <div className="mt-3 text-sm text-[#8b949e]">
                  Showing {filteredAndSortedBattles.length} of {battles.length} battles
                </div>
              )}
            </div>

            {/* Battle List */}
            <div className="mb-6">
              {filteredAndSortedBattles.length === 0 ? (
                <div className="bg-[#252b38] border border-white/10 rounded-lg p-12 text-center">
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
                      prestige={battle.prestigeAwarded}
                      fame={battle.fameAwarded}
                      streamingRevenue={battle.streamingRevenue}
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
