/**
 * What robots fight with per league tier: one stacked bar per tier with the
 * archetypes that peak in some tier as segments and the rest as "Other".
 * Shows where the meta converges (usage, not win rate).
 */
import type { TierUsage } from './types';
import { archetypeLabel, formatUsage, tierLabel } from '../../../utils/adminWeaponsFormat';
import { formatCount } from '../../../utils/adminAttributesFormat';

export interface TierUsageBarsProps {
  usage: TierUsage;
}

/** Segment colours (theme tokens), then "Other". */
const SEGMENT_CLASSES = ['bg-primary', 'bg-primary/55', 'bg-warning/75', 'bg-success/60', 'bg-error/55'];
const OTHER_CLASS = 'bg-white/10';
/** Same as the backend's TIER_MIN_ROBOTS. */
const MIN_ROBOTS = 20;
/** From this share on, the mirror-match caveat is shown. */
const CONVERGED_SHARE = 0.3;

export function TierUsageBars({ usage }: TierUsageBarsProps): React.ReactElement {
  if (usage.rows.length === 0) {
    return <p className="p-5 text-sm text-secondary">No league or tournament battles in this window.</p>;
  }
  // The tier where the most used segment peaks (tiers with at least 20 robots).
  const top = usage.rows
    .filter((row) => row.robots >= MIN_ROBOTS)
    .reduce<TierUsage['rows'][number] | null>((best, row) => (best === null || row.shares[0] > best.shares[0] ? row : best), null);
  return (
    <div className="space-y-3 p-4 sm:p-5">
      <p className="text-xs text-secondary">Share of robots that fought, per league tier. Tournaments have no tier and get their own row.</p>
      <ul className="space-y-2" aria-hidden="true">
        {usage.rows.map((row) => (
          <li key={row.tier} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_11rem]">
            <span className="text-xs text-secondary sm:text-sm">{tierLabel(row.tier)}</span>
            <span className="flex h-5 overflow-hidden rounded-sm bg-background">
              {row.shares.map((share, k) => (
                <span
                  key={k}
                  className={`h-full ${k < usage.segments.length ? SEGMENT_CLASSES[k] : OTHER_CLASS}`}
                  style={{ width: `${share * 100}%` }}
                  title={`${k < usage.segments.length ? archetypeLabel(usage.segments[k]) : 'Other'}: ${formatUsage(share)}`}
                />
              ))}
            </span>
            <span className="col-start-2 text-[11px] text-tertiary sm:col-start-auto sm:text-right">
              {formatCount(row.robots)} robots · players {formatUsage(row.playersShare)}
            </span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary" aria-hidden="true">
        {usage.segments.map((key, k) => (
          <li key={key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${SEGMENT_CLASSES[k]}`} />{archetypeLabel(key)}</li>
        ))}
        <li className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${OTHER_CLASS}`} />Other</li>
      </ul>
      {usage.segments.length > 0 && top && (
        <p className="text-sm text-secondary">
          Most concentrated: <span className="text-white">{formatUsage(top.shares[0])}</span> of {tierLabel(top.tier)} robots fight {archetypeLabel(usage.segments[0]).toLowerCase()}.
          {top.shares[0] >= CONVERGED_SHARE && ' Many fights there are mirror matches, so its win rate in that tier says little; its edge shows against the other archetypes.'}
        </p>
      )}
      <div className="sr-only">
        <table>
          <caption>Share of robots per archetype and league tier</caption>
          <thead>
            <tr>
              <th scope="col">Tier</th>
              <th scope="col">Robots</th>
              {usage.segments.map((key) => <th key={key} scope="col">{archetypeLabel(key)}</th>)}
              <th scope="col">Other</th>
              <th scope="col">Players&apos; robots</th>
            </tr>
          </thead>
          <tbody>
            {usage.rows.map((row) => (
              <tr key={row.tier}>
                <th scope="row">{tierLabel(row.tier)}</th>
                <td>{formatCount(row.robots)}</td>
                {row.shares.map((share, k) => <td key={k}>{formatUsage(share)}</td>)}
                <td>{formatUsage(row.playersShare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
