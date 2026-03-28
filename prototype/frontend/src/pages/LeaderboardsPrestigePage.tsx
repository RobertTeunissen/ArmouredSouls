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
  };  useEffect(() => {
    fetchLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minRobots]);

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'Legendary': return 'text-purple-400';
      case 'Champion': return 'text-warning';
      case 'Elite': return 'text-orange-400';
      case 'Veteran': return 'text-primary';
      case 'Established': return 'text-success';
      default: return 'text-secondary';
    }
  };

  return (
    <div className="min-h-screen bg-background text-primary">
      <Navigation />
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 font-header">
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
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Stable</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Prestige</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Robots</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Record</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Win %</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Best ELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry) => {
                  const isOwnStable = user && entry.userId === user.id;
                  return (
                    <tr key={entry.userId} className={`hover:bg-white/5 transition-colors ${isOwnStable ? 'bg-primary/10' : ''}`}>
                      <td className="px-4 py-3 text-primary font-medium">#{entry.rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium">{entry.stableName}</span>
                          {isOwnStable && <span className="text-xs px-2 py-0.5 bg-primary text-white rounded font-semibold">YOU</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-primary font-semibold">{entry.prestige.toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={`font-medium ${getRankColor(entry.prestigeRank)}`}>{entry.prestigeRank}</span></td>
                      <td className="px-4 py-3 text-secondary">{entry.totalRobots}</td>
                      <td className="px-4 py-3 text-secondary text-sm">{entry.totalWins}W-{entry.totalLosses}L-{entry.totalDraws}D</td>
                      <td className="px-4 py-3"><span className={`font-medium ${entry.winRate >= 60 ? 'text-success' : entry.winRate >= 50 ? 'text-warning' : 'text-orange-400'}`}>{entry.winRate}%</span></td>
                      <td className="px-4 py-3 text-primary">{entry.highestELO}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <div className="text-success font-medium">+{entry.battleWinningsBonus}%</div>
                          <div className="text-tertiary text-xs">{entry.merchandisingMultiplier.toFixed(1)}x merch</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/5">
            {leaderboard.map((entry) => {
              const isOwnStable = user && entry.userId === user.id;
              return (
                <div key={entry.userId} className={`p-4 ${isOwnStable ? 'bg-primary/10' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-secondary text-sm">#{entry.rank}</span>
                      <span className="text-primary font-medium ml-2">{entry.stableName}</span>
                      {isOwnStable && <span className="text-xs px-2 py-0.5 bg-primary text-white rounded font-semibold ml-2">YOU</span>}
                    </div>
                    <span className="text-primary font-semibold">{entry.prestige.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-secondary">Rank</span><span className={getRankColor(entry.prestigeRank)}>{entry.prestigeRank}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Robots</span><span className="text-primary">{entry.totalRobots}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Record</span><span className="text-secondary">{entry.totalWins}W-{entry.totalLosses}L-{entry.totalDraws}D</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Win %</span><span className={entry.winRate >= 60 ? 'text-success' : entry.winRate >= 50 ? 'text-warning' : 'text-orange-400'}>{entry.winRate}%</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Best ELO</span><span className="text-primary">{entry.highestELO}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Bonus</span><span className="text-success">+{entry.battleWinningsBonus}%</span></div>
                  </div>
                </div>
              );
            })}
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
            <span className="text-secondary font-medium">Novice:</span>
            <span className="text-secondary ml-2">0-999</span>
          </div>
          <div>
            <span className="text-success font-medium">Established:</span>
            <span className="text-secondary ml-2">1,000-4,999</span>
          </div>
          <div>
            <span className="text-primary font-medium">Veteran:</span>
            <span className="text-secondary ml-2">5,000-9,999</span>
          </div>
          <div>
            <span className="text-orange-400 font-medium">Elite:</span>
            <span className="text-secondary ml-2">10,000-24,999</span>
          </div>
          <div>
            <span className="text-warning font-medium">Champion:</span>
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
