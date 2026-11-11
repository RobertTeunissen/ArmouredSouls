import { Link } from 'react-router-dom';
import { ScrollRow } from '../hall-of-records/ScrollRow';
import { getTierName } from '../../utils/tierHelpers';
import { instanceLabel } from '../../utils/leagueStandings';
import type { LeagueInstanceSummary } from '../../utils/leagueStandingsApi';

export interface InstanceChipsProps {
  tier: string;
  instances: readonly LeagueInstanceSummary[];
  /** null = the whole tier. */
  active: string | null;
  /** How many of the viewer's entries are in each instance. */
  yours: ReadonlyMap<string, number>;
  /** Stables filter on Players: count players' entries instead of all entries. */
  playersOnly?: boolean;
  hrefFor: (instance: string | null) => string;
}

const players = (n: number): string => `${n} ${n === 1 ? 'player' : 'players'}`;

const chipClasses = (selected: boolean): string =>
  `inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors ${
    selected
      ? 'border-primary bg-primary font-semibold text-background'
      : 'border-white/10 bg-surface text-secondary hover:bg-surface-elevated'
  }`;

/** The tier's instances (each is a league of its own) and "All of <tier>". */
export function InstanceChips({ tier, instances, active, yours, playersOnly = false, hrefFor }: InstanceChipsProps) {
  if (instances.length === 0) return null;
  const total = instances.reduce((sum, i) => sum + i.size, 0);
  const totalPlayers = instances.reduce((sum, i) => sum + i.players, 0);
  return (
    <ScrollRow as="navigation" label={`${getTierName(tier)} instances`} wrapFrom="md">
      {instances.map((instance) => {
        const count = yours.get(instance.id) ?? 0;
        return (
          <Link
            key={instance.id}
            to={hrefFor(instance.id)}
            aria-current={instance.id === active ? 'page' : undefined}
            data-testid={`instance-chip-${instance.id}`}
            className={chipClasses(instance.id === active)}
          >
            {instanceLabel(instance.id)} · {playersOnly ? players(instance.players) : instance.size}
            {count > 0 && ` · ${count} yours`}
          </Link>
        );
      })}
      {instances.length > 1 && (
        <Link to={hrefFor(null)} aria-current={active === null ? 'page' : undefined} data-testid="instance-chip-all" className={chipClasses(active === null)}>
          All of {getTierName(tier)} · {playersOnly ? players(totalPlayers) : total}
        </Link>
      )}
    </ScrollRow>
  );
}
