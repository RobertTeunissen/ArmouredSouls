import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useApiQuery } from '../hooks/useApiQuery';
import LeaderboardBody from '../components/leaderboards/LeaderboardBody';
import { LEADERBOARD_TH, fameTierClass } from '../components/leaderboards/leaderboardFormat';
import { MobileStat, RobotMobileCard, RobotTableRow } from '../components/leaderboards/RobotLeaderboardRow';
import type { FameLeaderboardResponse } from '@shared/types';

function LeaderboardsFamePage() {
  const { user } = useAuth();
  // Ranks every robot (no filters); the ranking only changes on the daily cycle.
  const query = useApiQuery(
    (signal) => api.get<FameLeaderboardResponse>('/api/leaderboards/fame', { params: { page: 1, limit: 100 }, signal }),
    [],
  );
  const leaderboard = query.data?.leaderboard ?? [];

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
          🏆 Fame Leaderboard
        </h1>
        <p className="text-secondary">
          Top robots ranked by individual fame and reputation
        </p>
      </div>

      <LeaderboardBody
        loading={query.loading && query.data === null}
        error={query.error ? 'Failed to load fame leaderboard' : null}
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
                <th className={LEADERBOARD_TH}>Fame</th>
                <th className={LEADERBOARD_TH}>Tier</th>
                <th className={LEADERBOARD_TH}>Stable</th>
                <th className={LEADERBOARD_TH}>ELO</th>
                <th className={LEADERBOARD_TH}>Record</th>
                <th className={LEADERBOARD_TH}>Win %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leaderboard.map((entry) => (
                <RobotTableRow key={entry.robotId} entry={entry} isOwn={entry.stableId === user?.id}>
                  <td className="px-4 py-3 text-primary font-semibold">{entry.fame.toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={`font-medium ${fameTierClass(entry.fameTier)}`}>{entry.fameTier}</span></td>
                </RobotTableRow>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-white/5">
          {leaderboard.map((entry) => (
            <RobotMobileCard
              key={entry.robotId}
              entry={entry}
              isOwn={entry.stableId === user?.id}
              score={<span className="text-primary font-semibold">{entry.fame.toLocaleString()}</span>}
              stats={<MobileStat label="Tier"><span className={fameTierClass(entry.fameTier)}>{entry.fameTier}</span></MobileStat>}
            />
          ))}
        </div>
      </LeaderboardBody>
    </div>
    </div>
  );
}

export default LeaderboardsFamePage;
