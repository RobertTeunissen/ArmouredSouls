import { Link } from 'react-router-dom';
import { getTierName } from '../../utils/tierHelpers';
import { battleTypeLabel, isSuccess, resultLabel } from '../../utils/stableViewFormat';
import type { RecentResult } from './types';

interface RecentResultsProps {
  results: readonly RecentResult[];
  isOwner: boolean;
}

function context(result: RecentResult): string {
  const parts = [battleTypeLabel(result.battleType)];
  if (result.tier) parts.push(getTierName(result.tier));
  if (result.tournamentRound !== null) parts.push(`Round ${result.tournamentRound}`);
  return parts.join(', ');
}

/** The stable's latest battles; each row opens the battle. */
export function RecentResults({ results, isOwner }: RecentResultsProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-surface p-5 sm:p-6" aria-labelledby="recent-heading">
      <h3 id="recent-heading" className="text-lg font-semibold">Recent results</h3>
      {results.length === 0 ? (
        <p className="mt-3 text-sm text-secondary">No battles yet this season.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/5">
          {results.map((result) => (
            <li key={result.battleId}>
              <Link
                to={`/battle/${result.battleId}`}
                className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm hover:text-primary"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{result.entries.map((e) => e.robotName).join(', ')}</span>
                  <span className="block truncate text-xs text-secondary">{context(result)}</span>
                </span>
                <span className="shrink-0 text-right font-semibold">
                  {result.entries.map((e, i) => (
                    <span key={e.robotId} className={isSuccess(e) ? 'text-success' : 'text-secondary'}>
                      {i > 0 && <span className="text-tertiary"> · </span>}
                      {resultLabel(e)}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <Link to="/battle-history" className="mt-3 inline-block text-sm text-primary hover:underline">Battle history →</Link>
      )}
    </section>
  );
}

export default RecentResults;
