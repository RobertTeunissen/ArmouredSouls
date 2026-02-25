import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';

const API_URL = import.meta.env.VITE_API_URL || '';

interface PrestigeLeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  stableName: string;
  prestige: number;
  prestigeRank: string;
  totalRobots: number;
  totalBattles: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number;
  highestELO: number;
  championshipTitles: number;
  battleWinningsBonus: number;
  merchandisingMultiplier: number;
}

interface LeaderboardResponse {
  leaderboard: PrestigeLeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    totalStables: number;
    totalPages: number;
    hasMore: boolean;
  };
  timestamp: string;
}

function LeaderboardsPrestigePage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<PrestigeLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minRobots, setMinRobots] = useState(1);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get<LeaderboardResponse>(
        `${API_URL}/api/leaderboards/prestige`,
        {
          params: {
            page: 1,
            limit: 100,
            minRobots,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      setLeaderboard(response.data.leaderboard);
    } catch (err) {
      setError('Failed to load prestige leaderboard');
      console.error('Prestige leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [minRobots]);

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'Legendary': return 'text-purple-400';
      case 'Champion': return 'text-yellow-400';
      case 'Elite': return 'text-orange-400';
      case 'Veteran': return 'text-blue-400';
      case 'Established': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-background text-primary">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2 font-header">
          🏆 Prestige Leaderboard
        </h1>
        <p className="text-secondary">
          Top stables ranked by prestige and reputation
        </p>
      </div>

      {/* Filters */}
      <div className="bg-surface-elevated border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-secondary mb-2">
              Minimum Robots
            </label>
            <select
              value={minRobots}
              onChange={(e) => setMinRobots(parseInt(e.target.value))}
              className="w-full bg-surface border border-white/10 rounded-md px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="1">1+ robots</option>
              <option value="3">3+ robots</option>
              <option value="5">5+ robots</option>
              <option value="10">10+ robots</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchLeaderboard}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-secondary">Loading leaderboard...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-error">
          {error}
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && (
        <div className="bg-surface-elevated border border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Stable
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Prestige
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Rank Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Robots
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Record
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Win %
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Highest ELO
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Income Bonus
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry) => {
                  const isOwnStable = user && entry.userId === user.id;
                  
                  return (
                    <tr
                      key={entry.userId}
                      className={`hover:bg-white/5 transition-colors ${
                        isOwnStable ? 'bg-primary/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-primary font-medium">
                        #{entry.rank}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium">
                            {entry.stableName}
                          </span>
                          {isOwnStable && (
                            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-primary font-semibold">
                        {entry.prestige.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${getRankColor(entry.prestigeRank)}`}>
                          {entry.prestigeRank}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {entry.totalRobots}
                      </td>
                      <td className="px-4 py-3 text-secondary text-sm">
                        {entry.totalWins}W-{entry.totalLosses}L-{entry.totalDraws}D
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium ${
                            entry.winRate >= 60
                              ? 'text-green-400'
                              : entry.winRate >= 50
                              ? 'text-yellow-400'
                              : 'text-orange-400'
                          }`}
                        >
                          {entry.winRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-primary">
                        {entry.highestELO}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-green-400 font-medium">
                            +{entry.battleWinningsBonus}%
                          </div>
                          <div className="text-tertiary text-xs">
                            {entry.merchandisingMultiplier.toFixed(1)}x merch
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-secondary">
              No stables found.
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      {!loading && !error && leaderboard.length > 0 && (
        <div className="mt-4 text-sm text-tertiary text-center">
          Showing top {leaderboard.length} stables
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 bg-surface-elevated border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Prestige Ranks</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <span className="text-gray-400 font-medium">Novice:</span>
            <span className="text-secondary ml-2">0-999</span>
          </div>
          <div>
            <span className="text-green-400 font-medium">Established:</span>
            <span className="text-secondary ml-2">1,000-4,999</span>
          </div>
          <div>
            <span className="text-blue-400 font-medium">Veteran:</span>
            <span className="text-secondary ml-2">5,000-9,999</span>
          </div>
          <div>
            <span className="text-orange-400 font-medium">Elite:</span>
            <span className="text-secondary ml-2">10,000-24,999</span>
          </div>
          <div>
            <span className="text-yellow-400 font-medium">Champion:</span>
            <span className="text-secondary ml-2">25,000-49,999</span>
          </div>
          <div>
            <span className="text-purple-400 font-medium">Legendary:</span>
            <span className="text-secondary ml-2">50,000+</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-primary mt-6 mb-4">Income Bonuses</h3>
        <div className="text-secondary space-y-2">
          <p>• Battle Winnings Bonus: +5% to +20% based on prestige</p>
          <p>• Merchandising Multiplier: Scales with prestige (formula: 1 + prestige/10,000)</p>
        </div>
      </div>
    </div>
    </div>
  );
}

export default LeaderboardsPrestigePage;
