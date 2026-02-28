import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { getLeagueColor } from '../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || '';

interface FameLeaderboardEntry {
  rank: number;
  robotId: number;
  robotName: string;
  fame: number;
  fameTier: string;
  stableId: number;
  stableName: string;
  currentLeague: string;
  elo: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kills: number;
  damageDealtLifetime: number;
}

interface LeaderboardResponse {
  leaderboard: FameLeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    totalRobots: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: {
    league: string;
    minBattles: number;
  };
  timestamp: string;
}

function LeaderboardsFamePage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<FameLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [minBattles, setMinBattles] = useState(10);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get<LeaderboardResponse>(
        `${API_URL}/api/leaderboards/fame`,
        {
          params: {
            page: 1,
            limit: 100,
            league: leagueFilter,
            minBattles,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      setLeaderboard(response.data.leaderboard);
    } catch (err) {
      setError('Failed to load fame leaderboard');
      console.error('Fame leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };  useEffect(() => {
    fetchLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueFilter, minBattles]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Mythical': return 'text-purple-400';
      case 'Legendary': return 'text-yellow-400';
      case 'Renowned': return 'text-orange-400';
      case 'Famous': return 'text-blue-400';
      case 'Known': return 'text-green-400';
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
          🏆 Fame Leaderboard
        </h1>
        <p className="text-secondary">
          Top robots ranked by individual fame and reputation
        </p>
      </div>

      {/* Filters */}
      <div className="bg-surface-elevated border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-secondary mb-2">
              League Filter
            </label>
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-md px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Leagues</option>
              <option value="champion">Champion</option>
              <option value="diamond">Diamond</option>
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-secondary mb-2">
              Minimum Battles
            </label>
            <select
              value={minBattles}
              onChange={(e) => setMinBattles(parseInt(e.target.value))}
              className="w-full bg-surface border border-white/10 rounded-md px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="5">5+ battles</option>
              <option value="10">10+ battles</option>
              <option value="25">25+ battles</option>
              <option value="50">50+ battles</option>
              <option value="100">100+ battles</option>
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
                    Robot
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Fame
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Stable
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    League
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    ELO
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Record
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Win %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry) => {
                  const isOwnRobot = user && entry.stableId === user.id;
                  
                  return (
                    <tr
                      key={entry.robotId}
                      className={`hover:bg-white/5 transition-colors ${
                        isOwnRobot ? 'bg-primary/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-primary font-medium">
                        #{entry.rank}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium">
                            {entry.robotName}
                          </span>
                          {isOwnRobot && (
                            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
                              YOURS
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-primary font-semibold">
                        {entry.fame.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${getTierColor(entry.fameTier)}`}>
                          {entry.fameTier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {entry.stableName}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`capitalize ${getLeagueColor(entry.currentLeague)}`}>
                          {entry.currentLeague}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-primary">
                        {entry.elo}
                      </td>
                      <td className="px-4 py-3 text-secondary text-sm">
                        {entry.wins}W-{entry.losses}L-{entry.draws}D
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-secondary">
              No robots found matching the current filters.
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      {!loading && !error && leaderboard.length > 0 && (
        <div className="mt-4 text-sm text-tertiary text-center">
          Showing top {leaderboard.length} robots
        </div>
      )}
    </div>
    </div>
  );
}

export default LeaderboardsFamePage;
