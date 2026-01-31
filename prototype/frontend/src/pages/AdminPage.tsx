import { useState } from 'react';
import Navigation from '../components/Navigation';
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

function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [bulkCycles, setBulkCycles] = useState(1);
  const [autoRepair, setAutoRepair] = useState(true);
  const [bulkResults, setBulkResults] = useState<any>(null);

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
      });
      setBulkResults(response.data);
      showMessage(
        'success',
        `Completed ${response.data.cyclesCompleted} cycles in ${response.data.totalDuration.toFixed(2)}s`
      );
      fetchStats();
    } catch (error: any) {
      showMessage('error', error.response?.data?.error || 'Bulk cycles failed');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="mb-4">
            <label className="block mb-2">
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
              <p>Total Duration: {bulkResults.totalDuration.toFixed(2)}s</p>
              <p>Average Cycle Duration: {bulkResults.averageCycleDuration.toFixed(2)}s</p>
              
              {bulkResults.results && bulkResults.results.length > 0 && (
                <div className="mt-4 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Cycle Details:</h4>
                  {bulkResults.results.map((result: any, idx: number) => (
                    <div key={idx} className="mb-2 p-2 bg-gray-800 rounded text-sm">
                      <p className="font-semibold">Cycle {result.cycle}:</p>
                      {result.repair && <p>- Repaired: {result.repair.robotsRepaired} robots</p>}
                      {result.matchmaking && <p>- Matches: {result.matchmaking.matchesCreated} created</p>}
                      {result.battles && (
                        <p>
                          - Battles: {result.battles.summary.successfulBattles}/
                          {result.battles.summary.totalBattles} successful
                        </p>
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
      </div>
    </div>
  );
}

export default AdminPage;
