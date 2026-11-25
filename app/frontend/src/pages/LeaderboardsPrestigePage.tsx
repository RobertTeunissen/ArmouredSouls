import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useApiQuery } from '../hooks/useApiQuery';
import OwnerNameLink from '../components/OwnerNameLink';
import LeaderboardBody from '../components/leaderboards/LeaderboardBody';
import { LEADERBOARD_TH, prestigeRankClass, winRateClass } from '../components/leaderboards/leaderboardFormat';
import { PRESTIGE_RANKS } from '@shared/utils/prestigeTiers';
import type { PrestigeLeaderboardResponse } from '@shared/types';

/** "1,000-4,999" for every rank but the last, which reads "50,000+". */
function rankRange(index: number): string {
  const min = PRESTIGE_RANKS[index].min.toLocaleString();
  const next = PRESTIGE_RANKS[index + 1];
  return next ? `${min}-${(next.min - 1).toLocaleString()}` : `${min}+`;
}

function LeaderboardsPrestigePage() {
  const { user } = useAuth();
  // Ranks every stable (no filters); the ranking only changes on the daily cycle.
  const query = useApiQuery(
    (signal) => api.get<PrestigeLeaderboardResponse>('/api/leaderboards/prestige', { params: { page: 1, limit: 100 }, signal }),
    [],
  );
  const leaderboard = query.data?.leaderboard ?? [];

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
          🏆 Prestige Leaderboard
        </h1>
        <p className="text-secondary">
          Top stables ranked by prestige and reputation
        </p>
      </div>

      <LeaderboardBody
        loading={query.loading && query.data === null}
        error={query.error ? 'Failed to load prestige leaderboard' : null}
        count={leaderboard.length}
        emptyText="No stables found."
        countNoun="stables"
      >
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface border-b border-white/10">
              <tr>
                <th className={LEADERBOARD_TH}>#</th>
                <th className={LEADERBOARD_TH}>Stable</th>
                <th className={LEADERBOARD_TH}>Prestige</th>
                <th className={LEADERBOARD_TH}>Rank</th>
                <th className={LEADERBOARD_TH}>Robots</th>
                <th className={LEADERBOARD_TH}>Record</th>
                <th className={LEADERBOARD_TH}>Win %</th>
                <th className={LEADERBOARD_TH}>Best ELO</th>
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
                        <OwnerNameLink userId={entry.userId} displayName={entry.stableName} stableType={entry.stableType} />
                        {isOwnStable && <span className="text-xs px-2 py-0.5 bg-primary text-white rounded font-semibold">YOU</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-primary font-semibold">{entry.prestige.toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`font-medium ${prestigeRankClass(entry.prestigeRank)}`}>{entry.prestigeRank}</span></td>
                    <td className="px-4 py-3 text-secondary">{entry.totalRobots}</td>
                    <td className="px-4 py-3 text-secondary text-sm">{entry.totalWins}W-{entry.totalLosses}L-{entry.totalDraws}D</td>
                    <td className="px-4 py-3"><span className={`font-medium ${winRateClass(entry.winRate)}`}>{entry.winRate}%</span></td>
                    <td className="px-4 py-3 text-primary">{entry.highestELO}</td>
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
                    <OwnerNameLink userId={entry.userId} displayName={entry.stableName} stableType={entry.stableType} className="ml-2" />
                    {isOwnStable && <span className="text-xs px-2 py-0.5 bg-primary text-white rounded font-semibold ml-2">YOU</span>}
                  </div>
                  <span className="text-primary font-semibold">{entry.prestige.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-secondary">Rank</span><span className={prestigeRankClass(entry.prestigeRank)}>{entry.prestigeRank}</span></div>
                  <div className="flex justify-between"><span className="text-secondary">Robots</span><span className="text-primary">{entry.totalRobots}</span></div>
                  <div className="flex justify-between"><span className="text-secondary">Record</span><span className="text-secondary">{entry.totalWins}W-{entry.totalLosses}L-{entry.totalDraws}D</span></div>
                  <div className="flex justify-between"><span className="text-secondary">Win %</span><span className={winRateClass(entry.winRate)}>{entry.winRate}%</span></div>
                  <div className="flex justify-between"><span className="text-secondary">Best ELO</span><span className="text-primary">{entry.highestELO}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </LeaderboardBody>

      {/* Legend */}
      <div className="mt-8 bg-surface-elevated border border-white/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-primary mb-4">Prestige Ranks</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {PRESTIGE_RANKS.map(({ rank }, index) => (
            <div key={rank}>
              <span className={`${prestigeRankClass(rank)} font-medium`}>{rank}:</span>
              <span className="text-secondary ml-2">{rankRange(index)}</span>
            </div>
          ))}
        </div>

        <h3 className="text-lg font-semibold text-primary mt-6 mb-4">Income Bonuses</h3>
        <div className="text-secondary space-y-2">
          <p>• Merchandising Multiplier: scales with prestige per roster slot (formula: 1 + prestige ÷ roster capacity ÷ 10,000)</p>
        </div>
      </div>
    </div>
    </div>
  );
}

export default LeaderboardsPrestigePage;
