import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import BattleDetailsModal from '../components/BattleDetailsModal';
import TournamentManagement from '../components/TournamentManagement';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

type TabType = 'dashboard' | 'cycles' | 'battles' | 'tournaments' | 'stats';

interface SessionLogEntry {
  timestamp: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  details?: unknown;
}

interface SystemStats {
  robots: {
    total: number;
    byTier: Array<{ league: string; count: number }>;
    battleReady: number;
    battleReadyPercentage: number;
  };
  matches: {
    scheduled: number;
    completed: number;
  };
  battles: {
    last24Hours: number;
    total: number;
    draws: number;
    drawPercentage: number;
    avgDuration: number;
    kills: number;
    killPercentage: number;
  };
  finances: {
    totalCredits: number;
    avgBalance: number;
    usersAtRisk: number;
    totalUsers: number;
  };
  facilities: {
    summary: Array<{
      type: string;
      purchaseCount: number;
      avgLevel: number;
    }>;
    totalPurchases: number;
    mostPopular: string;
  };
  weapons: {
    totalBought: number;
    equipped: number;
  };
  stances: Array<{
    stance: string;
    count: number;
  }>;
  loadouts: Array<{
    type: string;
    count: number;
  }>;
  yieldThresholds: {
    distribution: Array<{
      threshold: number;
      count: number;
    }>;
    mostCommon: number;
    mostCommonCount: number;
  };
}

interface Battle {
  id: number;
  robot1: { id: number; name: string };
  robot2: { id: number; name: string };
  winnerId: number | null;
  winnerName: string;
  leagueType: string;
  durationSeconds: number;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1ELOBefore: number;
  robot2ELOBefore: number;
  robot1ELOAfter: number;
  robot2ELOAfter: number;
  createdAt: string;
}

interface BattleListResponse {
  battles: Battle[];
  pagination: {
    page: number;
    limit: number;
    totalBattles: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface RobotStats {
  summary: {
    totalRobots: number;
    robotsWithBattles: number;
    totalBattles: number;
    overallWinRate: number;
    averageElo: number;
  };
  attributeStats: Record<string, {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
    lowerBound: number;
    upperBound: number;
  }>;
  outliers: Record<string, Array<{
    id: number;
    name: string;
    value: number;
    league: string;
    elo: number;
    winRate: number;
  }>>;
  statsByLeague: Record<string, any>;
  winRateAnalysis: Record<string, Array<{
    quintile: number;
    avgValue: number;
    avgWinRate: number;
    sampleSize: number;
  }>>;
  topPerformers: Record<string, any[]>;
  bottomPerformers: Record<string, any[]>;
}

// Helper function for quintile labels
const getQuintileLabel = (quintileNumber: number): string => {
  switch (quintileNumber) {
    case 1: return 'Bottom 20%';
    case 2: return '2nd 20%';
    case 3: return '3rd 20%';
    case 4: return '4th 20%';
    case 5: return 'Top 20%';
    default: return `Q${quintileNumber}`;
  }
};

// Helper function to get battle outcome icon and description
const getBattleOutcome = (battle: Battle): { icon: string; label: string; color: string } => {
  if (battle.winnerId === null) {
    return { icon: '⚖️', label: 'Draw', color: 'text-gray-400' };
  }
  
  const winnerHP = battle.winnerId === battle.robot1.id ? battle.robot1FinalHP : battle.robot2FinalHP;
  
  if (winnerHP > 50) {
    return { icon: '🏆', label: 'Clear Victory', color: 'text-green-400' };
  } else if (winnerHP > 0) {
    return { icon: '💪', label: 'Narrow Victory', color: 'text-yellow-400' };
  }
  
  // Fallback for edge cases (shouldn't normally happen)
  return { icon: '🏆', label: 'Victory', color: 'text-blue-400' };
};

// Helper function to determine if battle is unusual (for border styling)
const getBattleHighlight = (battle: Battle): string => {
  // Draw - red border (rare)
  if (battle.winnerId === null) {
    return 'border-l-4 border-red-500';
  }
  
  // Long battle - yellow border (potential balance issue)
  if (battle.durationSeconds > 90) {
    return 'border-l-4 border-yellow-500';
  }
  
  // Large ELO swing - blue border (upset or significant match)
  const eloSwing = Math.abs(battle.robot1ELOAfter - battle.robot1ELOBefore);
  if (eloSwing > 50) {
    return 'border-l-4 border-blue-500';
  }
  
  return '';
};

interface CycleResult {
  cycle: number;
  userGeneration?: {
    usersCreated: number;
    error?: string;
  };
  repair?: {
    robotsRepaired: number;
  };
  repairPreTournament?: {
    robotsRepaired: number;
  };
  repairPreLeague?: {
    robotsRepaired: number;
  };
  matchmaking?: {
    matchesCreated: number;
  };
  battles?: {
    totalBattles: number;
    successfulBattles: number;
    failedBattles: number;
    byeBattles: number;
    errors: string[];
  };
  tournaments?: {
    executed?: number;
    completed?: number;
    failed?: number;
    tournamentsExecuted?: number;
    roundsExecuted?: number;
    matchesExecuted?: number;
    tournamentsCompleted?: number;
    tournamentsCreated?: number;
    errors?: string[];
    error?: string;
  };
  finances?: {
    usersProcessed: number;
    totalCostsDeducted: number;
    bankruptUsers: number;
  };
  rebalancing?: {
    summary: {
      totalPromoted: number;
      totalDemoted: number;
    };
  };
  duration: number;
  error?: string;
}

function AdminPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Get tab from localStorage or URL hash
    const hash = window.location.hash.replace('#', '');
    if (['dashboard', 'cycles', 'battles', 'tournaments', 'stats'].includes(hash)) {
      return hash as TabType;
    }
    const stored = localStorage.getItem('adminActiveTab');
    return (stored && ['dashboard', 'cycles', 'battles', 'tournaments', 'stats'].includes(stored)) 
      ? stored as TabType 
      : 'dashboard';
  });

  // Session log state
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('adminSessionLog');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      // Validate that it's an array
      if (!Array.isArray(parsed)) return [];
      // Basic validation of entries
      return parsed.filter(entry => 
        entry && 
        typeof entry.timestamp === 'string' &&
        typeof entry.type === 'string' &&
        typeof entry.message === 'string'
      );
    } catch (error) {
      console.error('Failed to load session log from localStorage:', error);
      return [];
    }
  });

  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [bulkCycles, setBulkCycles] = useState(1);
  const [autoRepair, setAutoRepair] = useState(true);
  const [includeTournaments, setIncludeTournaments] = useState(true);
  const [includeDailyFinances, setIncludeDailyFinances] = useState(true);
  const [generateUsersPerCycle, setGenerateUsersPerCycle] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  
  // Battle log state
  const [battles, setBattles] = useState<Battle[]>([]);
  const [battlesPagination, setBattlesPagination] = useState<any>(null);
  const [battlesLoading, setBattlesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [battleTypeFilter, setBattleTypeFilter] = useState('all'); // Add battle type filter
  const [selectedBattleId, setSelectedBattleId] = useState<number | null>(null);
  const [showBattleModal, setShowBattleModal] = useState(false);

  // Robot statistics state
  const [robotStats, setRobotStats] = useState<RobotStats | null>(null);
  const [robotStatsLoading, setRobotStatsLoading] = useState(false);
  const [showRobotStats, setShowRobotStats] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<string>('combatPower');

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  // Session log helpers
  const addSessionLog = (type: SessionLogEntry['type'], message: string, details?: unknown) => {
    const entry: SessionLogEntry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details
    };
    
    setSessionLog((prev) => {
      const newLog = [entry, ...prev].slice(0, 100); // Keep last 100 entries
      localStorage.setItem('adminSessionLog', JSON.stringify(newLog));
      return newLog;
    });
  };

  const clearSessionLog = () => {
    setSessionLog([]);
    localStorage.removeItem('adminSessionLog');
    showMessage('success', 'Session log cleared');
  };

  const exportSessionLog = () => {
    const dataStr = JSON.stringify(sessionLog, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-session-log-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showMessage('success', 'Session log exported');
  };

  // Tab management
  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    localStorage.setItem('adminActiveTab', tab);
    window.location.hash = tab;
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/stats');
      setStats(response.data);
      addSessionLog('success', 'System statistics refreshed');
      showMessage('success', 'Stats refreshed successfully');
    } catch (error: any) {
      addSessionLog('error', 'Failed to fetch system statistics', error.response?.data);
      showMessage('error', error.response?.data?.error || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const runMatchmaking = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/admin/matchmaking/run');
      showMessage('success', `Matchmaking completed! Created ${response.data.matchesCreated} matches`);
      fetchStats();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Matchmaking failed');
    } finally {
      setLoading(false);
    }
  };

  const executeBattles = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/admin/battles/run');
      const summary = response.data.summary;
      showMessage(
        'success',
        `Battles executed! Total: ${summary.totalBattles}, Success: ${summary.successfulBattles}, Failed: ${summary.failedBattles}`
      );
      fetchStats();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Battle execution failed');
    } finally {
      setLoading(false);
    }
  };

  const rebalanceLeagues = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/admin/leagues/rebalance');
      const summary = response.data.summary;
      showMessage(
        'success',
        `League rebalancing completed! Promoted: ${summary.totalPromoted}, Demoted: ${summary.totalDemoted}`
      );
      fetchStats();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'League rebalancing failed');
    } finally {
      setLoading(false);
    }
  };

  const repairAllRobots = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/admin/repair/all', {
        deductCosts: true,
      });
      showMessage('success', `Repaired ${response.data.robotsRepaired} robots`);
      fetchStats();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Repair failed');
    } finally {
      setLoading(false);
    }
  };

  const processDailyFinances = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/admin/daily-finances/process');
      const summary = response.data.summary;
      showMessage(
        'success',
        `Daily finances processed! ${summary.usersProcessed} users, ₡${summary.totalCostsDeducted.toLocaleString()} deducted${summary.bankruptUsers > 0 ? `, ${summary.bankruptUsers} bankruptcies` : ''}`
      );
      // Refresh stats and user data in parallel (daily finances may affect current user's credits)
      await Promise.all([fetchStats(), refreshUser()]);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Daily finances failed');
    } finally {
      setLoading(false);
    }
  };

  const runBulkCycles = async () => {
    if (bulkCycles < 1 || bulkCycles > 100) {
      showMessage('error', 'Cycles must be between 1 and 100');
      return;
    }

    setLoading(true);
    setBulkResults(null);
    addSessionLog('info', `Starting bulk cycle run: ${bulkCycles} cycle(s)`, {
      includeTournaments,
      generateUsersPerCycle
    });

    try {
      const response = await axios.post('/api/admin/cycles/bulk', {
        cycles: bulkCycles,
        includeTournaments,
        generateUsersPerCycle,
      });
      setBulkResults(response.data);

      // Add detailed session log entries for each cycle
      if (response.data.results && response.data.results.length > 0) {
        response.data.results.forEach((result: CycleResult) => {
          // Step 1: Pre-tournament repair
          if (result.repair1) {
            addSessionLog('info', `Cycle ${result.cycle}: Step 1 - Repaired ${result.repair1.robotsRepaired} robot(s) for ₡${result.repair1.totalFinalCost.toLocaleString()}`);
          }

          // Step 2: Tournament execution
          if (result.tournaments) {
            if (result.tournaments.error) {
              addSessionLog('error', `Cycle ${result.cycle}: Step 2 - Tournament execution failed`, result.tournaments);
            } else {
              const t = result.tournaments;
              const details = [
                t.tournamentsExecuted ? `${t.tournamentsExecuted} tournament(s)` : null,
                t.roundsExecuted ? `${t.roundsExecuted} round(s)` : null,
                t.matchesExecuted ? `${t.matchesExecuted} match(es)` : null,
                t.tournamentsCompleted ? `${t.tournamentsCompleted} completed` : null,
                t.tournamentsCreated ? `${t.tournamentsCreated} created` : null,
              ].filter(Boolean).join(', ');
              
              if (details) {
                addSessionLog(
                  t.errors && t.errors.length > 0 ? 'warning' : 'success',
                  `Cycle ${result.cycle}: Step 2 - Tournaments: ${details}`,
                  t.errors && t.errors.length > 0 ? { errors: t.errors } : undefined
                );
              }
            }
          }

          // Step 3: Post-tournament repair
          if (result.repair2) {
            addSessionLog('info', `Cycle ${result.cycle}: Step 3 - Repaired ${result.repair2.robotsRepaired} robot(s) for ₡${result.repair2.totalFinalCost.toLocaleString()}`);
          }

          // Step 4: Battle execution
          if (result.battles) {
            const { totalBattles, successfulBattles, failedBattles } = result.battles;
            addSessionLog(
              failedBattles > 0 ? 'warning' : 'success',
              `Cycle ${result.cycle}: Step 4 - Executed ${totalBattles} battle(s) (${successfulBattles} successful, ${failedBattles} failed)`
            );
          }

          // Step 5: League rebalancing
          if (result.rebalancing && result.rebalancing.summary) {
            const { totalPromoted, totalDemoted } = result.rebalancing.summary;
            addSessionLog('info', `Cycle ${result.cycle}: Step 5 - Rebalanced: ${totalPromoted} promoted, ${totalDemoted} demoted`);
          }

          // Step 6: User generation
          if (result.userGeneration) {
            if (result.userGeneration.error) {
              addSessionLog('error', `Cycle ${result.cycle}: Step 6 - User generation failed`, result.userGeneration);
            } else {
              addSessionLog('success', `Cycle ${result.cycle}: Step 6 - Generated ${result.userGeneration.usersCreated} new user(s)`);
            }
          }

          // Step 7: Post-league repair
          if (result.repair3) {
            addSessionLog('info', `Cycle ${result.cycle}: Step 7 - Repaired ${result.repair3.robotsRepaired} robot(s) for ₡${result.repair3.totalFinalCost.toLocaleString()}`);
          }

          // Step 8: Matchmaking
          if (result.matchmaking) {
            addSessionLog('success', `Cycle ${result.cycle}: Step 8 - Created ${result.matchmaking.matchesCreated} match(es)`);
          }
        });
      }

      const completionMsg = `Bulk cycle run completed: ${response.data.cyclesCompleted} cycle(s) in ${response.data.totalDuration?.toFixed(2) || 0}s`;
      addSessionLog('success', completionMsg);
      showMessage(
        'success',
        `Completed ${response.data.cyclesCompleted} cycles in ${response.data.totalDuration?.toFixed(2) || 0}s`
      );
      // Refresh stats and user data (repairs deduct costs)
      await Promise.all([fetchStats(), refreshUser()]);
    } catch (error: any) {
      addSessionLog('error', 'Bulk cycle run failed', error.response?.data);
      showMessage('error', error.response?.data?.error || 'Bulk cycles failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchBattles = async (page: number = 1) => {
    setBattlesLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (searchQuery) params.search = searchQuery;
      if (leagueFilter !== 'all') params.leagueType = leagueFilter;
      if (battleTypeFilter !== 'all') params.battleType = battleTypeFilter; // Add battle type filter

      const response = await axios.get<BattleListResponse>('/api/admin/battles', { params });
      setBattles(response.data.battles);
      setBattlesPagination(response.data.pagination);
      setCurrentPage(page);
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to fetch battles');
    } finally {
      setBattlesLoading(false);
    }
  };

  const handleViewBattle = (battleId: number) => {
    setSelectedBattleId(battleId);
    setShowBattleModal(true);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchBattles(1);
  };

  const fetchRobotStats = async () => {
    setRobotStatsLoading(true);
    try {
      const response = await axios.get('/api/admin/stats/robots');
      setRobotStats(response.data);
      setShowRobotStats(true);
      sessionStorage.setItem('adminRobotStatsLoaded', 'true');
      addSessionLog('success', 'Robot statistics loaded successfully');
      showMessage('success', 'Robot statistics loaded successfully');
    } catch (error: any) {
      addSessionLog('error', 'Failed to fetch robot statistics', error.response?.data);
      showMessage('error', error.response?.data?.error || 'Failed to fetch robot statistics');
    } finally {
      setRobotStatsLoading(false);
    }
  };

  // Auto-load stats and battles when component mounts
  useEffect(() => {
    fetchStats(); // Load system statistics by default
    fetchBattles(1);
  }, []);

  // Auto-load robot stats when Stats tab is first viewed
  useEffect(() => {
    if (activeTab === 'stats' && !showRobotStats && !robotStatsLoading) {
      const hasLoadedBefore = sessionStorage.getItem('adminRobotStatsLoaded');
      if (!hasLoadedBefore) {
        // Auto-load on first view
        fetchRobotStats();
      }
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Admin Portal</h1>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh Stats'}
          </button>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded ${
              message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-700">
          <div className="flex space-x-1" role="tablist" aria-label="Admin sections">
            <button
              id="dashboard-tab"
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              aria-controls="dashboard-panel"
              onClick={() => switchTab('dashboard')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              id="cycles-tab"
              role="tab"
              aria-selected={activeTab === 'cycles'}
              aria-controls="cycles-panel"
              onClick={() => switchTab('cycles')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'cycles'
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              ⚙️ Cycle Controls
            </button>
            <button
              id="tournaments-tab"
              role="tab"
              aria-selected={activeTab === 'tournaments'}
              aria-controls="tournaments-panel"
              onClick={() => switchTab('tournaments')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'tournaments'
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              🏆 Tournaments
            </button>
            <button
              id="battles-tab"
              role="tab"
              aria-selected={activeTab === 'battles'}
              aria-controls="battles-panel"
              onClick={() => switchTab('battles')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'battles'
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              ⚔️ Battle Logs
            </button>
            <button
              id="stats-tab"
              role="tab"
              aria-selected={activeTab === 'stats'}
              aria-controls="stats-panel"
              onClick={() => switchTab('stats')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'stats'
                  ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              🤖 Robot Stats
            </button>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab" className="space-y-8">
            {/* Statistics Display */}
            {stats && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
                  {/* Robots Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-blue-400">Robots</h3>
                    <p>Total: {stats.robots.total}</p>
                    <p>Battle Ready: {stats.robots.battleReady} ({stats.robots.battleReadyPercentage.toFixed(1)}%)</p>
                    <div className="mt-2">
                      <p className="text-sm text-gray-400">By Tier:</p>
                      {stats.robots.byTier.map((tier) => (
                        <p key={tier.league} className="text-sm ml-2">
                          {tier.league}: {tier.count}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Matches Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-green-400">Matches</h3>
                    <p>Scheduled: {stats.matches.scheduled}</p>
                    <p>Completed: {stats.matches.completed}</p>
                  </div>

                  {/* Battles Section - Enhanced */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-purple-400 flex items-center gap-2">
                      Battles
                      <span className="text-xs text-gray-400 font-normal" title="Battle statistics including outcomes and durations">ℹ️</span>
                    </h3>
                    <p>Last 24 Hours: {stats.battles.last24Hours}</p>
                    <p>Total: {stats.battles.total}</p>
                    <p className="mt-2 text-sm" title="Battles ending with no clear winner">
                      Draws: {stats.battles.draws} ({stats.battles.drawPercentage}%)
                    </p>
                    <p className="text-sm" title="Battles where the loser was reduced to 0 HP">
                      Kills: {stats.battles.kills} ({stats.battles.killPercentage}%)
                    </p>
                    <p className="text-sm text-gray-400 mt-1">Avg Duration: {stats.battles.avgDuration}s</p>
                  </div>

                  {/* Financial Section - New */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-yellow-400 flex items-center gap-2">
                      Finances
                      <span className="text-xs text-gray-400 font-normal" title="Total credits in system and user balance statistics">ℹ️</span>
                    </h3>
                    <p>Total Credits: ₡{stats.finances.totalCredits.toLocaleString()}</p>
                    <p>Avg Balance: ₡{stats.finances.avgBalance.toLocaleString()}</p>
                    <p>Total Users: {stats.finances.totalUsers}</p>
                    <p 
                      className={`mt-2 text-sm ${stats.finances.usersAtRisk > 0 ? 'text-red-400' : 'text-green-400'}`}
                      title={`Users with balance below ₡10,000 (estimated 3 days of operating costs)`}
                    >
                      {stats.finances.usersAtRisk > 0 ? '⚠️ ' : '✓ '}
                      At Risk: {stats.finances.usersAtRisk}
                    </p>
                  </div>

                  {/* Facilities Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-cyan-400 flex items-center gap-2">
                      Facilities
                      <span className="text-xs text-gray-400 font-normal" title="Facility purchases across all users">ℹ️</span>
                    </h3>
                    {stats.facilities.summary.length > 0 ? (
                      <>
                        <p>Total Purchases: {stats.facilities.totalPurchases}</p>
                        <p>Most Popular: {stats.facilities.mostPopular === 'None' || stats.facilities.summary.length === 0
                          ? 'No facilities yet'
                          : stats.facilities.mostPopular.replace(/_/g, ' ')}</p>
                        <div className="mt-2">
                          <p className="text-sm text-gray-400">Top 3:</p>
                          {stats.facilities.summary.slice(0, 3).map((facility, idx) => (
                            <p key={facility.type} className="text-sm ml-2">
                              {idx + 1}. {facility.type.replace(/_/g, ' ')}: {facility.purchaseCount}
                            </p>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">No facilities purchased yet</p>
                    )}
                  </div>

                  {/* Weapons Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-orange-400 flex items-center gap-2">
                      Weapons
                      <span className="text-xs text-gray-400 font-normal" title="Weapon purchases and equipment">ℹ️</span>
                    </h3>
                    <p>Total Bought: {stats.weapons.totalBought}</p>
                    <p>Equipped: {stats.weapons.equipped}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {stats.weapons.totalBought > 0 
                        ? `${Math.round((stats.weapons.equipped / stats.weapons.totalBought) * 100)}% equipped`
                        : 'No weapons yet'}
                    </p>
                  </div>

                  {/* Stances Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-pink-400 flex items-center gap-2">
                      Stances
                      <span className="text-xs text-gray-400 font-normal" title="Combat stances used by robots">ℹ️</span>
                    </h3>
                    {stats.stances.length > 0 ? (
                      stats.stances.map((s) => (
                        <p key={s.stance} className="text-sm">
                          {s.stance.charAt(0).toUpperCase() + s.stance.slice(1)}: {s.count}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">No data</p>
                    )}
                  </div>

                  {/* Loadouts Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-teal-400 flex items-center gap-2">
                      Loadouts
                      <span className="text-xs text-gray-400 font-normal" title="Equipment configurations">ℹ️</span>
                    </h3>
                    {stats.loadouts.length > 0 ? (
                      stats.loadouts.map((l) => (
                        <p key={l.type} className="text-sm">
                          {l.type.replace(/_/g, ' ')}: {l.count}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">No data</p>
                    )}
                  </div>

                  {/* Yield Thresholds Section */}
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-indigo-400 flex items-center gap-2">
                      Yield Thresholds
                      <span className="text-xs text-gray-400 font-normal" title="HP % where robots surrender">ℹ️</span>
                    </h3>
                    {stats.yieldThresholds.distribution.length > 0 ? (
                      <>
                        <p className="text-sm">Most Common: {stats.yieldThresholds.mostCommon}%</p>
                        <p className="text-xs text-gray-400">({stats.yieldThresholds.mostCommonCount} robots)</p>
                        <div className="mt-2">
                          <p className="text-sm text-gray-400">Distribution:</p>
                          {stats.yieldThresholds.distribution.slice(0, 4).map((y) => (
                            <p key={y.threshold} className="text-sm ml-2">
                              {y.threshold}%: {y.count}
                            </p>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">No data</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cycle Controls Tab */}
        {activeTab === 'cycles' && (
          <div role="tabpanel" id="cycles-panel" aria-labelledby="cycles-tab" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Cycle Controls */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold mb-4">Daily Cycle Controls</h2>
                <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={repairAllRobots}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded font-semibold transition-colors"
                >
                  🔧 Auto-Repair All Robots
                </button>
                <button
                  onClick={runMatchmaking}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded font-semibold transition-colors"
                >
                  🎯 Run Matchmaking
                </button>
                <button
                  onClick={executeBattles}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-6 py-3 rounded font-semibold transition-colors"
                >
                  ⚔️ Execute Battles
                </button>
                <button
                  onClick={processDailyFinances}
                  disabled={loading}
                  className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 px-6 py-3 rounded font-semibold transition-colors"
                >
                  💰 Process Daily Finances
                </button>
                <button
                  onClick={rebalanceLeagues}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-6 py-3 rounded font-semibold transition-colors"
                >
                  📊 Rebalance Leagues
                </button>
              </div>
            </div>

            {/* Bulk Cycle Testing */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Bulk Cycle Testing</h2>
              <div className="mb-4 space-y-3">
            <label className="block">
              Number of Cycles (1-100):
              <input
                type="number"
                min="1"
                max="100"
                value={bulkCycles}
                onChange={(e) => setBulkCycles(parseInt(e.target.value) || 1)}
                className="ml-2 bg-gray-700 text-white px-3 py-1 rounded w-24"
              />
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRepair}
                onChange={(e) => setAutoRepair(e.target.checked)}
                className="mr-2"
              />
              Auto-repair before each cycle
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeTournaments}
                onChange={(e) => setIncludeTournaments(e.target.checked)}
                className="mr-2"
              />
              Include tournament execution
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeDailyFinances}
                onChange={(e) => setIncludeDailyFinances(e.target.checked)}
                className="mr-2"
              />
              Include daily finances processing
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={generateUsersPerCycle}
                onChange={(e) => setGenerateUsersPerCycle(e.target.checked)}
                className="mr-2"
              />
              Generate users per cycle
              <span className="ml-2 text-sm text-gray-400">
                (Adds N users each cycle: cycle 1 → 1 user, cycle 2 → 2 users, etc.)
              </span>
            </label>
          </div>
          <button
            onClick={runBulkCycles}
            disabled={loading}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 px-6 py-3 rounded font-semibold transition-colors"
          >
            🚀 Run {bulkCycles} Cycle{bulkCycles !== 1 ? 's' : ''}
          </button>

              {bulkResults && (
                <div className="mt-4 bg-gray-700 rounded p-4">
                  <h3 className="text-xl font-semibold mb-2">Bulk Cycle Results</h3>
                  <p>Cycles Completed: {bulkResults.cyclesCompleted}</p>
                  {bulkResults.totalCyclesInSystem && (
                    <p className="text-green-400">Total Cycles in System: {bulkResults.totalCyclesInSystem}</p>
                  )}
                  <p>Total Duration: {bulkResults.totalDuration?.toFixed(2) || 0}s</p>
                  <p>Average Cycle Duration: {bulkResults.averageCycleDuration?.toFixed(2) || 0}s</p>
                  
                  {bulkResults.results && bulkResults.results.length > 0 && (
                    <div className="mt-4 max-h-96 overflow-y-auto">
                      <h4 className="font-semibold mb-2">Cycle Details:</h4>
                      {bulkResults.results.map((result: CycleResult, idx: number) => (
                        <div key={idx} className="mb-2 p-2 bg-gray-800 rounded text-sm">
                          <p className="font-semibold">Cycle {result.cycle}:</p>
                          {result.userGeneration && (
                            <div className="ml-2 text-green-400">
                              <p>- Users: {result.userGeneration.usersCreated} new users created</p>
                              {result.userGeneration.error && (
                                <p className="text-red-400 ml-2">• ⚠️ Error: {result.userGeneration.error}</p>
                              )}
                            </div>
                          )}
                          {result.repair && <p>- Repaired: {result.repair.robotsRepaired} robots</p>}
                          {result.matchmaking && <p>- Matches: {result.matchmaking.matchesCreated} created</p>}
                          {result.battles && (
                            <p>
                              - Battles: {result.battles.successfulBattles}/
                              {result.battles.totalBattles} successful
                            </p>
                          )}
                          {result.finances && (
                            <div className="ml-2 text-yellow-400">
                              <p>- Finances: ₡{result.finances.totalCostsDeducted.toLocaleString()} deducted</p>
                              <p className="ml-2">• {result.finances.usersProcessed} users processed</p>
                              {result.finances.bankruptUsers > 0 && (
                                <p className="ml-2 text-red-400">• ⚠️ {result.finances.bankruptUsers} bankruptcies!</p>
                              )}
                            </div>
                          )}
                          {result.rebalancing && (
                            <p>
                              - Rebalancing: {result.rebalancing.summary.totalPromoted} promoted,{' '}
                              {result.rebalancing.summary.totalDemoted} demoted
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Full Session Log */}
          <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Session Log</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportSessionLog}
                    disabled={sessionLog.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold transition-colors text-sm"
                  >
                    Export
                  </button>
                  <button
                    onClick={clearSessionLog}
                    disabled={sessionLog.length === 0}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold transition-colors text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {sessionLog.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sessionLog.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded text-sm ${
                        entry.type === 'success'
                          ? 'bg-green-900 bg-opacity-30 text-green-200'
                          : entry.type === 'error'
                          ? 'bg-red-900 bg-opacity-30 text-red-200'
                          : entry.type === 'warning'
                          ? 'bg-yellow-900 bg-opacity-30 text-yellow-200'
                          : 'bg-blue-900 bg-opacity-30 text-blue-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">
                          {entry.type === 'success' && '✓ '}
                          {entry.type === 'error' && '✗ '}
                          {entry.type === 'warning' && '⚠ '}
                          {entry.type === 'info' && 'ℹ '}
                          {entry.message}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {entry.details !== undefined && entry.details !== null && (
                        <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">
                          {typeof entry.details === 'string' 
                            ? entry.details 
                            : JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No log entries</p>
              )}
            </div>
          </div>
        )}

        {/* Battle Logs Tab */}
        {activeTab === 'battles' && (
          <div role="tabpanel" id="battles-panel" aria-labelledby="battles-tab" className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Battle Logs & Debugging</h2>
              <button
                onClick={() => fetchBattles(1)}
                disabled={battlesLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded font-semibold transition-colors text-sm"
              >
                {battlesLoading ? 'Loading...' : 'Refresh Battles'}
              </button>
            </div>

            {/* Visual Indicators Legend */}
            <div className="mb-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-sm font-semibold mb-2 text-gray-300">Visual Indicators:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <span className="text-green-400">Clear Victory</span>
                  <span className="text-gray-400">(HP &gt; 50)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💪</span>
                  <span className="text-yellow-400">Narrow Victory</span>
                  <span className="text-gray-400">(HP 1-50)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚖️</span>
                  <span className="text-gray-400">Draw</span>
                  <span className="text-gray-400">(No winner)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-red-500"></span>
                  <span className="text-gray-300">Draw</span>
                  <span className="text-gray-400">(rare event)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-yellow-500"></span>
                  <span className="text-gray-300">Long Battle</span>
                  <span className="text-gray-400">(&gt;90s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500"></span>
                  <span className="text-gray-300">Big ELO Swing</span>
                  <span className="text-gray-400">(&gt;50 points)</span>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="mb-4 flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by robot name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded"
                />
              </div>
              <select
                value={leagueFilter}
                onChange={(e) => setLeagueFilter(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded"
              >
                <option value="all">All Leagues</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
                <option value="diamond">Diamond</option>
                <option value="champion">Champion</option>
              </select>
              <select
                value={battleTypeFilter}
                onChange={(e) => setBattleTypeFilter(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded"
              >
                <option value="all">All Battle Types</option>
                <option value="league">League Battles</option>
                <option value="tournament">Tournament Battles</option>
              </select>
              <button
                onClick={handleSearch}
                disabled={battlesLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold transition-colors"
              >
                Search
              </button>
            </div>

            {/* Battle Table */}
            {battles.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="p-3 text-left">ID</th>
                        <th className="p-3 text-left">Robot 1</th>
                        <th className="p-3 text-left">Robot 2</th>
                        <th className="p-3 text-left">Winner</th>
                        <th className="p-3 text-left">League</th>
                        <th className="p-3 text-left">Duration</th>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {battles.map((battle) => {
                        const outcome = getBattleOutcome(battle);
                        const highlight = getBattleHighlight(battle);
                        
                        return (
                          <tr 
                            key={battle.id} 
                            className={`border-t border-gray-700 hover:bg-gray-750 ${highlight}`}
                          >
                            <td className="p-3">#{battle.id}</td>
                            <td className="p-3">
                              <Link 
                                to={`/robots/${battle.robot1.id}`} 
                                className="text-blue-400 hover:underline"
                                aria-label={`View robot details for ${battle.robot1.name}`}
                              >
                                {battle.robot1.name}
                              </Link>
                              <div className="text-xs text-gray-400">
                                HP: {battle.robot1FinalHP} | ELO: {battle.robot1ELOBefore} → {battle.robot1ELOAfter}
                              </div>
                            </td>
                            <td className="p-3">
                              <Link 
                                to={`/robots/${battle.robot2.id}`} 
                                className="text-purple-400 hover:underline"
                                aria-label={`View robot details for ${battle.robot2.name}`}
                              >
                                {battle.robot2.name}
                              </Link>
                              <div className="text-xs text-gray-400">
                                HP: {battle.robot2FinalHP} | ELO: {battle.robot2ELOBefore} → {battle.robot2ELOAfter}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col">
                                <span className={outcome.color}>
                                  {outcome.icon} {battle.winnerName}
                                </span>
                                <span className="text-xs text-gray-400 mt-1">
                                  {outcome.label}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-1 bg-gray-700 rounded text-xs">
                                {battle.leagueType}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={battle.durationSeconds > 90 ? 'text-yellow-400 font-semibold' : ''}>
                                {battle.durationSeconds}s
                              </span>
                            </td>
                            <td className="p-3 text-xs text-gray-400">
                              {new Date(battle.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => handleViewBattle(battle.id)}
                                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-semibold"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {battlesPagination && (
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-400">
                      Showing {battles.length} of {battlesPagination.totalBattles} battles
                      (Page {battlesPagination.page} of {battlesPagination.totalPages})
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchBattles(currentPage - 1)}
                        disabled={currentPage === 1 || battlesLoading}
                        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 px-4 py-2 rounded font-semibold transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => fetchBattles(currentPage + 1)}
                        disabled={!battlesPagination.hasMore || battlesLoading}
                        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 px-4 py-2 rounded font-semibold transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">
                {battlesLoading ? (
                  <div>Loading battles...</div>
                ) : (
                  <div>
                    <p className="mb-2">No battles found.</p>
                    <button
                      onClick={() => fetchBattles(1)}
                      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold"
                    >
                      Load Battles
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tournaments Tab */}
        {activeTab === 'tournaments' && (
          <div role="tabpanel" id="tournaments-panel" aria-labelledby="tournaments-tab">
            <TournamentManagement />
          </div>
        )}

        {/* Robot Stats Tab */}
        {activeTab === 'stats' && (
          <div role="tabpanel" id="stats-panel" aria-labelledby="stats-tab" className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">🤖 Robot Attribute Statistics</h2>
              <button
                onClick={fetchRobotStats}
                disabled={robotStatsLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 px-6 py-2 rounded font-semibold transition-colors"
              >
                {robotStatsLoading ? 'Loading...' : showRobotStats ? 'Refresh Stats' : 'Load Statistics'}
              </button>
            </div>

            {!showRobotStats && !robotStatsLoading && (
              <div className="text-center py-8 text-gray-400">
                <p className="mb-4">Click "Load Statistics" to analyze robot attributes and find outliers</p>
                <p className="text-sm">This will show:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• Statistical analysis of all 23 attributes</li>
                  <li>• Outlier detection using IQR method</li>
                  <li>• Win rate correlations</li>
                  <li>• League-based comparisons</li>
                  <li>• Top/bottom performers</li>
                </ul>
              </div>
            )}

            {robotStatsLoading && (
              <div className="text-center py-8 text-gray-400">
                <div className="animate-pulse">Loading robot statistics...</div>
              </div>
            )}

            {showRobotStats && robotStats && (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-3">Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Total Robots</p>
                      <p className="text-2xl font-bold">{robotStats.summary.totalRobots}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">With Battles</p>
                      <p className="text-2xl font-bold">{robotStats.summary.robotsWithBattles}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Total Battles</p>
                      <p className="text-2xl font-bold">{robotStats.summary.totalBattles}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Win Rate</p>
                      <p className="text-2xl font-bold">{robotStats.summary.overallWinRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Avg ELO</p>
                      <p className="text-2xl font-bold">{robotStats.summary.averageElo}</p>
                    </div>
                  </div>
                </div>

                {/* Attribute Selector */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-xl font-semibold mb-3">Select Attribute to Analyze</h3>
                  <select
                    value={selectedAttribute}
                    onChange={(e) => setSelectedAttribute(e.target.value)}
                    className="w-full bg-gray-800 text-white px-4 py-2 rounded"
                  >
                    <optgroup label="Combat Systems">
                      <option value="combatPower">Combat Power</option>
                      <option value="targetingSystems">Targeting Systems</option>
                      <option value="criticalSystems">Critical Systems</option>
                      <option value="penetration">Penetration</option>
                      <option value="weaponControl">Weapon Control</option>
                      <option value="attackSpeed">Attack Speed</option>
                    </optgroup>
                    <optgroup label="Defensive Systems">
                      <option value="armorPlating">Armor Plating</option>
                      <option value="shieldCapacity">Shield Capacity</option>
                      <option value="evasionThrusters">Evasion Thrusters</option>
                      <option value="damageDampeners">Damage Dampeners</option>
                      <option value="counterProtocols">Counter Protocols</option>
                    </optgroup>
                    <optgroup label="Chassis & Mobility">
                      <option value="hullIntegrity">Hull Integrity</option>
                      <option value="servoMotors">Servo Motors</option>
                      <option value="gyroStabilizers">Gyro Stabilizers</option>
                      <option value="hydraulicSystems">Hydraulic Systems</option>
                      <option value="powerCore">Power Core</option>
                    </optgroup>
                    <optgroup label="AI Processing">
                      <option value="combatAlgorithms">Combat Algorithms</option>
                      <option value="threatAnalysis">Threat Analysis</option>
                      <option value="adaptiveAI">Adaptive AI</option>
                      <option value="logicCores">Logic Cores</option>
                    </optgroup>
                    <optgroup label="Team Coordination">
                      <option value="syncProtocols">Sync Protocols</option>
                      <option value="supportSystems">Support Systems</option>
                      <option value="formationTactics">Formation Tactics</option>
                    </optgroup>
                  </select>
                </div>

                {/* Attribute Statistics */}
                {robotStats.attributeStats[selectedAttribute] && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-xl font-semibold mb-3">
                      {selectedAttribute.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} - Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      {Object.entries(robotStats.attributeStats[selectedAttribute]).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-gray-400">{key.toUpperCase()}</p>
                          <p className="text-lg font-bold">{Number(value).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outliers */}
                {robotStats.outliers[selectedAttribute] && robotStats.outliers[selectedAttribute].length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-xl font-semibold mb-3 text-yellow-400">
                      ⚠️ Outliers Detected ({robotStats.outliers[selectedAttribute].length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-800">
                          <tr>
                            <th className="p-2 text-left">Robot</th>
                            <th className="p-2 text-left">Value</th>
                            <th className="p-2 text-left">League</th>
                            <th className="p-2 text-left">ELO</th>
                            <th className="p-2 text-left">Win Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {robotStats.outliers[selectedAttribute].map((outlier, idx) => (
                            <tr key={idx} className="border-t border-gray-600">
                              <td className="p-2">
                                <Link 
                                  to={`/robots/${outlier.id}`}
                                  className="text-blue-400 hover:underline"
                                  aria-label={`View robot details for ${outlier.name}`}
                                >
                                  {outlier.name}
                                </Link>
                              </td>
                              <td className="p-2 font-bold text-yellow-400">{outlier.value}</td>
                              <td className="p-2">
                                <span className="px-2 py-1 bg-gray-800 rounded text-xs">{outlier.league}</span>
                              </td>
                              <td className="p-2">{outlier.elo}</td>
                              <td className="p-2">{outlier.winRate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Win Rate Analysis */}
                {robotStats.winRateAnalysis[selectedAttribute] && robotStats.winRateAnalysis[selectedAttribute].length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-xl font-semibold mb-3">🎯 Win Rate Correlation</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-800">
                          <tr>
                            <th className="p-2 text-left">Quintile</th>
                            <th className="p-2 text-left">Avg Value</th>
                            <th className="p-2 text-left">Avg Win Rate</th>
                            <th className="p-2 text-left">Sample Size</th>
                            <th className="p-2 text-left">Visual</th>
                          </tr>
                        </thead>
                        <tbody>
                          {robotStats.winRateAnalysis[selectedAttribute].map((quintile, idx) => (
                            <tr key={idx} className="border-t border-gray-600">
                              <td className="p-2">{getQuintileLabel(quintile.quintile)}</td>
                              <td className="p-2 font-bold">{quintile.avgValue.toFixed(2)}</td>
                              <td className="p-2 font-bold text-green-400">{quintile.avgWinRate.toFixed(1)}%</td>
                              <td className="p-2">{quintile.sampleSize}</td>
                              <td className="p-2">
                                <div className="bg-gray-800 rounded h-4 overflow-hidden">
                                  <div 
                                    className="bg-green-500 h-full"
                                    style={{ width: `${quintile.avgWinRate}%` }}
                                  ></div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      💡 Higher win rate in top quintile = attribute strongly impacts success
                    </p>
                  </div>
                )}

                {/* League Comparison */}
                {robotStats.statsByLeague && Object.keys(robotStats.statsByLeague).length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-xl font-semibold mb-3">🏆 League Comparison</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-800">
                          <tr>
                            <th className="p-2 text-left">League</th>
                            <th className="p-2 text-left">Robots</th>
                            <th className="p-2 text-left">Avg ELO</th>
                            <th className="p-2 text-left">Mean {selectedAttribute}</th>
                            <th className="p-2 text-left">Median {selectedAttribute}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'].map((league) => {
                            const leagueData = robotStats.statsByLeague[league];
                            if (!leagueData) return null;
                            const attrData = leagueData.attributes[selectedAttribute];
                            return (
                              <tr key={league} className="border-t border-gray-600">
                                <td className="p-2 capitalize font-semibold">{league}</td>
                                <td className="p-2">{leagueData.count}</td>
                                <td className="p-2">{leagueData.averageElo}</td>
                                <td className="p-2 font-bold">{attrData?.mean?.toFixed(2) || 'N/A'}</td>
                                <td className="p-2">{attrData?.median?.toFixed(2) || 'N/A'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Top Performers */}
                {robotStats.topPerformers[selectedAttribute] && robotStats.topPerformers[selectedAttribute].length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-xl font-semibold mb-3 text-green-400">🌟 Top 5 Performers</h3>
                    <div className="space-y-2">
                      {robotStats.topPerformers[selectedAttribute].map((robot: any, idx: number) => (
                        <div key={idx} className="bg-gray-800 rounded p-3 flex justify-between items-center">
                          <div>
                            <Link 
                              to={`/robots/${robot.id}`}
                              className="font-bold text-lg text-green-400 hover:underline"
                              aria-label={`View robot details for ${robot.name}`}
                            >
                              #{idx + 1} {robot.name}
                            </Link>
                            <p className="text-sm text-gray-400">
                              {robot.league} | ELO: {robot.elo} | Win Rate: {robot.winRate}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-400">{robot.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Performers */}
                {robotStats.bottomPerformers[selectedAttribute] && robotStats.bottomPerformers[selectedAttribute].length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-xl font-semibold mb-3 text-red-400">📉 Bottom 5 Performers</h3>
                    <div className="space-y-2">
                      {robotStats.bottomPerformers[selectedAttribute].map((robot: any, idx: number) => (
                        <div key={idx} className="bg-gray-800 rounded p-3 flex justify-between items-center">
                          <div>
                            <Link 
                              to={`/robots/${robot.id}`}
                              className="font-bold text-red-400 hover:underline"
                              aria-label={`View robot details for ${robot.name}`}
                            >
                              {robot.name}
                            </Link>
                            <p className="text-sm text-gray-400">
                              {robot.league} | ELO: {robot.elo} | Win Rate: {robot.winRate}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-red-400">{robot.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Battle Details Modal */}
        <BattleDetailsModal
          isOpen={showBattleModal}
          onClose={() => setShowBattleModal(false)}
          battleId={selectedBattleId}
        />
      </div>
    </div>
  );
}

export default AdminPage;
