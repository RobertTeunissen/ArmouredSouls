import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import Navigation from '../components/Navigation';
import { createLogger } from '../utils/logger';

const log = createLogger('LeaderboardsLossesPage');
import OwnerNameLink from '../components/OwnerNameLink';

/**
 * Battle types broken out as columns, in display order with short headers.
 * Mirrors KILL_MODES on the backend.
 */
const KILL_MODES = [
  { key: 'league_1v1', label: '1v1' },
  { key: 'league_2v2', label: '2v2' },
  { key: 'league_3v3', label: '3v3' },
  { key: 'tag_team', label: 'Tag' },
  { key: 'koth', label: 'KotH' },
  { key: 'grand_melee', label: 'Melee' },
  { key: 'tournament_1v1', label: 'T 1v1' },
  { key: 'tournament_2v2', label: 'T 2v2' },
  { key: 'tournament_3v3', label: 'T 3v3' },
] as const;

type SortKey = 'total' | (typeof KILL_MODES)[number]['key'];

interface LossesLeaderboardEntry {
  rank: number;
  robotId: number;
  robotName: string;
  totalLosses: number; // Opponents destroyed, all battle types
  killsByMode: Record<string, number>;
  stableId: number;
  stableName: string;
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
  sortBy: SortKey;
  timestamp: string;
}

function LeaderboardsLossesPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LossesLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('total');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await api.get<LeaderboardResponse>(
          '/api/leaderboards/losses',
          { params: { page: 1, limit: 100, sortBy } },
        );

        setLeaderboard(data.leaderboard);
      } catch (err) {
        setError('Failed to load total losses leaderboard');
        log.error('Total losses leaderboard error', { err });
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [sortBy]);

  /** Ranking is server-side, so a header click just re-requests the ordering. */
  const sortButtonClass = (key: SortKey): string =>
    `w-full text-right hover:text-primary transition-colors ${
      sortBy === key ? 'text-primary' : 'text-tertiary'
    }`;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
          Total Losses Leaderboard
        </h1>
        <p className="text-secondary">
          Season ranking of opponents destroyed, in total and split by battle type
        </p>
        <div className="mt-4 bg-surface border border-white/10 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-secondary">
              <p className="font-semibold text-primary mb-1">About Total Losses</p>
              <p>
                A &quot;total loss&quot; is an opponent written off — reduced to 0 HP. The Total column counts
                every one a robot has inflicted this season; the columns beside it split that figure by
                battle type.
              </p>
              <p className="mt-2">
                Because participation is gated by your Booking Office subscriptions, most robots only
                fight a few battle types. Sort by a single type to rank specialists against each other,
                or by Total for the overall picture.
              </p>
              <p className="mt-2">
                <span className="font-semibold text-primary">Ratio</span> shows total losses inflicted
                divided by match losses taken. Higher is better — it means writing off more opponents per
                defeat.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile ranking control — the desktop table sorts via column headers,
          which the card layout has no room for. */}
      <div className="md:hidden mb-6">
        <label htmlFor="losses-sort" className="block text-sm font-medium text-secondary mb-2">
          Rank by
        </label>
        <select
          id="losses-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="w-full min-h-[44px] bg-surface border border-white/10 rounded-md px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="total">All battle types</option>
          {KILL_MODES.map((mode) => (
            <option key={mode.key} value={mode.key}>{mode.label}</option>
          ))}
        </select>
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
          <p className="text-error">{error}</p>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && (
        <div className="bg-surface border border-white/10 rounded-lg overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Robot</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => setSortBy('total')}
                      className={sortButtonClass('total')}
                      aria-sort={sortBy === 'total' ? 'descending' : 'none'}
                      data-testid="sort-total"
                    >
                      Total{sortBy === 'total' ? ' ▾' : ''}
                    </button>
                  </th>
                  {KILL_MODES.map((mode) => (
                    <th key={mode.key} className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => setSortBy(mode.key)}
                        className={sortButtonClass(mode.key)}
                        aria-sort={sortBy === mode.key ? 'descending' : 'none'}
                        data-testid={`sort-${mode.key}`}
                      >
                        {mode.label}{sortBy === mode.key ? ' ▾' : ''}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Ratio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Stable</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">ELO</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Record</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-tertiary uppercase tracking-wider">Win %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry) => {
                  const isOwnRobot = user && entry.stableId === user.id;
                  return (
                    <tr key={entry.robotId} className={`hover:bg-white/5 transition-colors ${isOwnRobot ? 'bg-primary/10' : ''}`}>
                      <td className="px-4 py-3 text-primary font-medium">#{entry.rank}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-primary font-medium">{entry.robotName}</span>
                          {isOwnRobot && <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">YOURS</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right"><span className="text-error font-bold text-lg">{entry.totalLosses}</span></td>
                      {KILL_MODES.map((mode) => {
                        const value = entry.killsByMode[mode.key] ?? 0;
                        return (
                          <td key={mode.key} className="px-3 py-3 text-right">
                            <span className={value > 0 ? 'text-secondary' : 'text-tertiary'}>{value}</span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3"><span className={`font-semibold ${entry.lossRatio >= 2.0 ? 'text-success' : entry.lossRatio >= 1.0 ? 'text-warning' : 'text-orange-400'}`}>{entry.lossRatio.toFixed(2)}</span></td>
                      <td className="px-4 py-3"><OwnerNameLink userId={entry.stableId} displayName={entry.stableName} /></td>
                      <td className="px-4 py-3 text-primary">{entry.elo}</td>
                      <td className="px-4 py-3 text-secondary text-sm">{entry.wins}W-{entry.losses}L-{entry.draws}D</td>
                      <td className="px-4 py-3"><span className={`font-medium ${entry.winRate >= 60 ? 'text-success' : entry.winRate >= 50 ? 'text-warning' : 'text-orange-400'}`}>{entry.winRate}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-white/5">
            {leaderboard.map((entry) => {
              const isOwnRobot = user && entry.stableId === user.id;
              return (
                <div key={entry.robotId} className={`p-4 ${isOwnRobot ? 'bg-primary/10' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-secondary text-sm">#{entry.rank}</span>
                      <span className="text-primary font-medium ml-2">{entry.robotName}</span>
                      {isOwnRobot && <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded ml-2">YOURS</span>}
                    </div>
                    <span className="text-error font-bold text-lg">{entry.totalLosses}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-secondary">Ratio</span><span className={entry.lossRatio >= 2.0 ? 'text-success' : entry.lossRatio >= 1.0 ? 'text-warning' : 'text-orange-400'}>{entry.lossRatio.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">ELO</span><span className="text-primary">{entry.elo}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Win %</span><span className={entry.winRate >= 60 ? 'text-success' : entry.winRate >= 50 ? 'text-warning' : 'text-orange-400'}>{entry.winRate}%</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Record</span><span className="text-secondary">{entry.wins}W-{entry.losses}L-{entry.draws}D</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Stable</span><OwnerNameLink userId={entry.stableId} displayName={entry.stableName} className="truncate ml-2" /></div>
                  </div>
                  {/* Per-type breakdown. Only types the robot has actually
                      fought are listed, so a specialist's card stays short. */}
                  {(() => {
                    const fought = KILL_MODES.filter((mode) => (entry.killsByMode[mode.key] ?? 0) > 0);
                    if (fought.length === 0) return null;
                    return (
                      <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {fought.map((mode) => (
                          <span
                            key={mode.key}
                            className={sortBy === mode.key ? 'text-primary' : 'text-tertiary'}
                          >
                            {mode.label} {entry.killsByMode[mode.key]}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-secondary">
              No robots found.
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
