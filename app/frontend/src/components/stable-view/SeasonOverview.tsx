import { getTierColor, getTierName } from '../../utils/tierHelpers';
import {
  MODE_LONG_LABELS,
  MODE_SHORT_LABELS,
  bestTierPerMode,
  tierDistribution,
  type ModeCell,
  type TierSummary,
} from '../../utils/stableViewFormat';

interface SeasonOverviewProps {
  strips: ReadonlyArray<readonly ModeCell[]>;
  summaries: ReadonlyArray<TierSummary | null>;
}

/** "This season": robots per highest tier, and the stable's best tier in each mode. */
export function SeasonOverview({ strips, summaries }: SeasonOverviewProps) {
  const distribution = tierDistribution(summaries);
  const placed = distribution.reduce((sum, d) => sum + d.count, 0);
  const perMode = bestTierPerMode(strips);

  return (
    <section className="rounded-lg border border-white/10 bg-surface p-5 sm:p-6" aria-labelledby="this-season">
      <h3 id="this-season" className="text-lg font-semibold">This season</h3>
      {placed === 0 ? (
        <p className="mt-2 text-sm text-secondary">No robot has played a league or event match yet this season.</p>
      ) : (
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="text-xs uppercase tracking-wide text-secondary">Highest tier per robot</h4>
            <div className="mt-2 flex h-3 overflow-hidden rounded" aria-hidden="true">
              {distribution.map((d) => (
                <span
                  key={d.tier}
                  className={`bg-current ${getTierColor(d.tier)}`}
                  style={{ width: `${(d.count / placed) * 100}%` }}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {distribution.map((d) => (
                <li key={d.tier} className={getTierColor(d.tier)}>
                  {d.count} {getTierName(d.tier)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-secondary">Best tier per mode</h4>
            <ul className="mt-2 flex flex-wrap gap-2">
              {perMode.map(({ mode, tier }) => (
                <li
                  key={mode}
                  title={`${MODE_LONG_LABELS[mode]}: ${tier ? getTierName(tier) : 'not played'}`}
                  className={
                    tier
                      ? `rounded-full bg-current/10 px-3 py-1 text-xs ring-1 ring-current/30 ${getTierColor(tier)}`
                      : 'rounded-full border border-dashed border-white/15 px-3 py-1 text-xs text-tertiary'
                  }
                >
                  {MODE_SHORT_LABELS[mode]} · {tier ? getTierName(tier) : '–'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

