import { Link } from 'react-router-dom';
import { ScrollRow } from '../hall-of-records/ScrollRow';
import { LEAGUE_TIERS, getTierIcon, getTierName } from '../../utils/tierHelpers';

export interface TierChipsProps {
  active: string;
  /** How many of the viewer's entries are in each tier of this league. */
  yours: ReadonlyMap<string, number>;
  hrefFor: (tier: string) => string;
}

/** The six tiers, each with the number of the viewer's entries in it. */
export function TierChips({ active, yours, hrefFor }: TierChipsProps) {
  return (
    <ScrollRow as="navigation" label="Tiers" wrapFrom="md">
      {LEAGUE_TIERS.map((tier) => {
        const selected = tier === active;
        const count = yours.get(tier) ?? 0;
        return (
          <Link
            key={tier}
            to={hrefFor(tier)}
            aria-current={selected ? 'page' : undefined}
            data-testid={`tier-chip-${tier}`}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm transition-colors ${
              selected
                ? 'border-primary bg-surface font-semibold text-white ring-1 ring-primary'
                : 'border-white/10 bg-surface text-secondary hover:bg-surface-elevated'
            }`}
          >
            <span aria-hidden="true">{getTierIcon(tier)}</span>
            {getTierName(tier)}
            {count > 0 && (
              <span className="rounded bg-primary/15 px-1.5 text-xs font-semibold text-primary">
                {count}
                <span className="sr-only"> of yours</span>
              </span>
            )}
          </Link>
        );
      })}
    </ScrollRow>
  );
}
