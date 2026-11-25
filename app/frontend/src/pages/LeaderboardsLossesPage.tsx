import { useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useApiQuery } from '../hooks/useApiQuery';
import LeaderboardBody from '../components/leaderboards/LeaderboardBody';
import { LEADERBOARD_TH, lossRatioClass } from '../components/leaderboards/leaderboardFormat';
import { MobileStat, RobotMobileCard, RobotTableRow } from '../components/leaderboards/RobotLeaderboardRow';
import type { LeaderboardKillMode, LossesLeaderboardResponse, LossesSortKey } from '@shared/types';

/**
 * Battle types broken out as columns, in display order with short headers.
 */
const KILL_MODES: ReadonlyArray<{ key: LeaderboardKillMode; label: string }> = [
  { key: 'league_1v1', label: '1v1' },
  { key: 'league_2v2', label: '2v2' },
  { key: 'league_3v3', label: '3v3' },
  { key: 'tag_team', label: 'Tag' },
  { key: 'koth', label: 'KotH' },
  { key: 'grand_melee', label: 'Melee' },
  { key: 'tournament_1v1', label: 'T 1v1' },
  { key: 'tournament_2v2', label: 'T 2v2' },
  { key: 'tournament_3v3', label: 'T 3v3' },
];

type SortKey = LossesSortKey;

function LeaderboardsLossesPage() {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<SortKey>('total');
  const query = useApiQuery(
    (signal) => api.get<LossesLeaderboardResponse>('/api/leaderboards/losses', { params: { page: 1, limit: 100, sortBy }, signal }),
    [sortBy],
  );
  const leaderboard = query.data?.leaderboard ?? [];

  /** Ranking is server-side, so a header click just re-requests the ordering. */
  const sortButtonClass = (key: SortKey): string =>
    `w-full text-right hover:text-primary transition-colors ${
      sortBy === key ? 'text-primary' : 'text-tertiary'
    }`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 pb-24 lg:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
          Destructions Leaderboard
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
              <p className="font-semibold text-primary mb-1">About destructions</p>
              <p>
                A destruction is an opponent written off — reduced to 0 HP. The Total column counts
                every one a robot has inflicted this season; the columns beside it split that figure by
                battle type. The Hall of Records &quot;Most destructions&quot; record is the top of this list.
              </p>
              <p className="mt-2">
                Because participation is gated by your Booking Office subscriptions, most robots only
                fight a few battle types. Sort by a single type to rank specialists against each other,
                or by Total for the overall picture.
              </p>
              <p className="mt-2">
                <span className="font-semibold text-primary">Ratio</span> shows destructions inflicted
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

      <LeaderboardBody
        loading={query.loading && query.data === null}
        error={query.error ? 'Failed to load the destructions leaderboard' : null}
        count={leaderboard.length}
        emptyText="No robots found."
        countNoun="robots"
      >
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface border-b border-white/10">
              <tr>
                <th className={LEADERBOARD_TH}>#</th>
                <th className={LEADERBOARD_TH}>Robot</th>
                <th
                  className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider"
                  aria-sort={sortBy === 'total' ? 'descending' : 'none'}
                >
                  <button
                    type="button"
                    onClick={() => setSortBy('total')}
                    className={sortButtonClass('total')}
                    data-testid="sort-total"
                  >
                    Total{sortBy === 'total' ? ' ▾' : ''}
                  </button>
                </th>
                {KILL_MODES.map((mode) => (
                  <th
                    key={mode.key}
                    className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider"
                    aria-sort={sortBy === mode.key ? 'descending' : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => setSortBy(mode.key)}
                      className={sortButtonClass(mode.key)}
                      data-testid={`sort-${mode.key}`}
                    >
                      {mode.label}{sortBy === mode.key ? ' ▾' : ''}
                    </button>
                  </th>
                ))}
                <th className={LEADERBOARD_TH}>Ratio</th>
                <th className={LEADERBOARD_TH}>Stable</th>
                <th className={LEADERBOARD_TH}>ELO</th>
                <th className={LEADERBOARD_TH}>Record</th>
                <th className={LEADERBOARD_TH}>Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leaderboard.map((entry) => (
                <RobotTableRow key={entry.robotId} entry={entry} isOwn={entry.stableId === user?.id}>
                  <td className="px-3 py-3 text-right"><span className="text-error font-bold text-lg">{entry.totalLosses}</span></td>
                  {KILL_MODES.map((mode) => {
                    const value = entry.killsByMode[mode.key] ?? 0;
                    return (
                      <td key={mode.key} className="px-3 py-3 text-right">
                        <span className={value > 0 ? 'text-secondary' : 'text-tertiary'}>{value}</span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3"><span className={`font-semibold ${lossRatioClass(entry.lossRatio)}`}>{entry.lossRatio.toFixed(2)}</span></td>
                </RobotTableRow>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-white/5">
          {leaderboard.map((entry) => {
            // Per-type breakdown: only types the robot has actually fought are
            // listed, so a specialist's card stays short.
            const fought = KILL_MODES.filter((mode) => (entry.killsByMode[mode.key] ?? 0) > 0);
            return (
              <RobotMobileCard
                key={entry.robotId}
                entry={entry}
                isOwn={entry.stableId === user?.id}
                score={<span className="text-error font-bold text-lg">{entry.totalLosses}</span>}
                stats={<MobileStat label="Ratio"><span className={lossRatioClass(entry.lossRatio)}>{entry.lossRatio.toFixed(2)}</span></MobileStat>}
                footer={fought.length > 0 && (
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
                )}
              />
            );
          })}
        </div>
      </LeaderboardBody>
    </div>
    </div>
  );
}

export default LeaderboardsLossesPage;
