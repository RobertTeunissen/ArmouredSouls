import { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import BattleDetailsModal from '../components/BattleDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface SystemStats {
  robots: {
    total: number;
    byTier: Array<{ tier: string; count: number }>;
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

function AdminPage() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [bulkCycles, setBulkCycles] = useState(1);
  const [autoRepair, setAutoRepair] = useState(true);
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

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/admin/stats');
      setStats(response.data);
      showMessage('success', 'Stats refreshed successfully');
    } catch (error: any) {
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
        deductCosts: false,
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
    try {
      const response = await axios.post('/api/admin/cycles/bulk', {
        cycles: bulkCycles,
        autoRepair,
        includeDailyFinances,
        generateUsersPerCycle,
      });
      setBulkResults(response.data);
      showMessage(
        'success',
        `Completed ${response.data.cyclesCompleted} cycles in ${response.data.totalDuration.toFixed(2)}s`
      );
      // Refresh stats and user data if daily finances were processed
      if (includeDailyFinances) {
        await Promise.all([fetchStats(), refreshUser()]);
      } else {
        await fetchStats();
      }
    } catch (error: any) {
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
      showMessage('success', 'Robot statistics loaded successfully');
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Failed to fetch robot statistics');
    } finally {
      setRobotStatsLoading(false);
    }
  };

  // Auto-load battles when component mounts
  useEffect(() => {
    fetchBattles(1);
  }, []);

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

        {/* System Statistics */}
        {stats && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">System Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-blue-400">Robots</h3>
                <p>Total: {stats.robots.total}</p>
                <p>Battle Ready: {stats.robots.battleReady} ({stats.robots.battleReadyPercentage.toFixed(1)}%)</p>
                <div className="mt-2">
                  <p className="text-sm text-gray-400">By Tier:</p>
                  {stats.robots.byTier.map((tier) => (
                    <p key={tier.tier} className="text-sm ml-2">
                      {tier.tier}: {tier.count}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-green-400">Matches</h3>
                <p>Scheduled: {stats.matches.scheduled}</p>
                <p>Completed: {stats.matches.completed}</p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-purple-400">Battles</h3>
                <p>Last 24 Hours: {stats.battles.last24Hours}</p>
                <p>Total: {stats.battles.total}</p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Daily Cycle Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p>Total Duration: {bulkResults.totalDuration.toFixed(2)}s</p>
              <p>Average Cycle Duration: {bulkResults.averageCycleDuration.toFixed(2)}s</p>
              
              {bulkResults.results && bulkResults.results.length > 0 && (
                <div className="mt-4 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Cycle Details:</h4>
                  {bulkResults.results.map((result: any, idx: number) => (
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
                      {result.battles && result.battles.summary && (
                        <p>
                          - Battles: {result.battles.summary.successfulBattles}/
                          {result.battles.summary.totalBattles} successful
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
                          - Rebalancing: {result.rebalancing.summary.totalPromoted} promoted, 
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

        {/* Robot Statistics Section */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
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
                            <td className="p-2">{outlier.name}</td>
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
                            <td className="p-2">Q{quintile.quintile} ({idx === 0 ? 'Bottom 20%' : idx === 4 ? 'Top 20%' : 'Middle'})</td>
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
                          <span className="font-bold text-lg">#{idx + 1} {robot.name}</span>
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
                          <span className="font-bold">{robot.name}</span>
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

        {/* Battle Logs Section */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
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
                    {battles.map((battle) => (
                      <tr key={battle.id} className="border-t border-gray-700 hover:bg-gray-750">
                        <td className="p-3">#{battle.id}</td>
                        <td className="p-3">
                          <div className="text-blue-400">{battle.robot1.name}</div>
                          <div className="text-xs text-gray-400">
                            HP: {battle.robot1FinalHP} | ELO: {battle.robot1ELOBefore} → {battle.robot1ELOAfter}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-purple-400">{battle.robot2.name}</div>
                          <div className="text-xs text-gray-400">
                            HP: {battle.robot2FinalHP} | ELO: {battle.robot2ELOBefore} → {battle.robot2ELOAfter}
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              battle.winnerId === battle.robot1.id
                                ? 'text-blue-400'
                                : battle.winnerId === battle.robot2.id
                                ? 'text-purple-400'
                                : 'text-gray-400'
                            }
                          >
                            {battle.winnerName === 'Draw' ? '⚖️ ' : '🏆 '}
                            {battle.winnerName}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-gray-700 rounded text-xs">
                            {battle.leagueType}
                          </span>
                        </td>
                        <td className="p-3">{battle.durationSeconds}s</td>
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
                    ))}
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
