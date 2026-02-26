import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { getLeagueColor } from '../utils/formatters';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface LossesLeaderboardEntry {
  rank: number;
  robotId: number;
  robotName: string;
  totalLosses: number; // Opponents destroyed
  stableId: number;
  stableName: string;
  currentLeague: string;
  elo: number;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  lossRatio: number; // Losses inflicted / losses taken
  damageDealtLifetime: number;
}

interface LeaderboardResponse {
  leaderboard: LossesLeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    totalRobots: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: {
    league: string;
  };
  timestamp: string;
}

function LeaderboardsLossesPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LossesLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leagueFilter, setLeagueFilter] = useState('all');

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get<LeaderboardResponse>(
        `${API_URL}/api/leaderboards/losses`,
        {
          params: {
            page: 1,
            limit: 100,
            league: leagueFilter,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      
      setLeaderboard(response.data.leaderboard);
    } catch (err) {
      setError('Failed to load total losses leaderboard');
      console.error('Total losses leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [leagueFilter]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Total Losses Leaderboard
        </h1>
        <p className="text-secondary">
          Cumulative lifetime ranking - all robots sorted by total opponents destroyed
        </p>
        <div className="mt-4 bg-surface border border-white/10 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-secondary">
              <p className="font-semibold text-primary mb-1">About Total Losses</p>
              <p>
                "Total Losses" tracks the cumulative number of opponents a robot has destroyed (reduced to 0 HP) across all battles. 
                This is a lifetime metric showing overall combat effectiveness and finishing power.
              </p>
              <p className="mt-2">
                <span className="font-semibold text-primary">Destruction Ratio</span> shows total losses inflicted (opponents destroyed) 
                divided by match losses taken. Higher is better - it means destroying more opponents per defeat.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-white/10 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4">
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
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && (
        <div className="bg-surface border border-white/10 rounded-lg overflow-hidden">
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
                    Total Losses
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">
                    Destruction Ratio
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
                      <td className="px-4 py-3">
                        <span className="text-red-400 font-bold text-lg">
                          {entry.totalLosses}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            entry.lossRatio >= 2.0
                              ? 'text-green-400'
                              : entry.lossRatio >= 1.0
                              ? 'text-yellow-400'
                              : 'text-orange-400'
                          }`}
                        >
                          {entry.lossRatio.toFixed(2)}
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

export default LeaderboardsLossesPage;
