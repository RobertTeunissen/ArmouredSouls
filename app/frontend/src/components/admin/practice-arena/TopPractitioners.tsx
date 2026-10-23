/**
 * Top practitioners this season, from each stable's practice counter, with
 * the latest recorded battle. Names open the player in Players.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PracticeArenaOverview } from '../../../utils/adminPracticeArenaApi';
import { formatDayTime } from '../../../utils/adminCycleFormat';
import { formatCount, shortDate } from '../../../utils/adminPracticeArenaFormat';
import { ADMIN_FOCUS_RING, AdminPanel } from '../shared';

export interface TopPractitionersProps {
  overview: PracticeArenaOverview | null;
  now: Date;
  loading: boolean;
}

export function TopPractitioners({ overview, now, loading }: TopPractitionersProps): ReactNode {
  const since = overview?.recordingSince ? shortDate(overview.recordingSince.slice(0, 10)) : null;
  return (
    <AdminPanel title="Top practitioners this season" loading={loading && !overview} skeletonRows={5}>
      {overview && (
        overview.topPractitioners.length === 0 ? (
          <p className="p-5 text-sm text-secondary">Nobody has practised this season yet.</p>
        ) : (
          <div className="p-4 sm:p-5">
            <table className="w-full text-sm">
              <caption className="sr-only">Players with the most practice battles this season</caption>
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                  <th scope="col" className="py-2 text-left font-semibold">Player</th>
                  <th scope="col" className="py-2 text-right font-semibold">Battles</th>
                  <th scope="col" className="py-2 text-right font-semibold">Last practice</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {overview.topPractitioners.map((player) => (
                  <tr key={player.userId} className="border-b border-white/5">
                    <th scope="row" className="py-1 text-left font-normal">
                      <Link
                        to={`/admin/players?user=${player.userId}`}
                        className={`inline-flex min-h-11 items-center text-primary hover:underline ${ADMIN_FOCUS_RING}`}
                      >
                        {player.username}
                      </Link>
                    </th>
                    <td className="py-1 text-right text-white">{formatCount(player.battles)}</td>
                    <td className={`py-1 text-right ${player.lastPracticeAt ? 'text-white' : 'text-tertiary'}`}>
                      {player.lastPracticeAt ? formatDayTime(player.lastPracticeAt, now) : since ? `before ${since}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-tertiary">
              Battles: each stable&apos;s practice counter for the whole season{overview.season.number !== null ? ` (Season ${overview.season.number})` : ''}. Last practice: from the recorded requests.
            </p>
          </div>
        )
      )}
    </AdminPanel>
  );
}
