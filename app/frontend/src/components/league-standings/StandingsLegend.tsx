import { StatusChip } from './StatusChip';
import type { StandingStatus } from '@shared/types';

const EXAMPLES: Array<{ status: StandingStatus; text: string }> = [
  { status: { kind: 'promotes', zone: 'promotion' }, text: 'moves up at the next rebalance' },
  { status: { kind: 'demotes', zone: 'demotion' }, text: 'moves down' },
  { status: { kind: 'held_lp', zone: 'promotion', minLP: 125 }, text: 'in a promotion place, below the LP minimum' },
  { status: { kind: 'held_cycles', zone: 'promotion', cyclesToGo: 2 }, text: 'in a zone place, not long enough in the tier yet' },
];

export interface StandingsLegendProps {
  tier: string;
}

/** What the status chips mean; zone places are never backfilled. */
export function StandingsLegend({ tier }: StandingsLegendProps) {
  return (
    <section aria-label="What the statuses mean" className="mt-6 space-y-3 text-xs text-secondary" data-testid="standings-legend">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {EXAMPLES.map(({ status, text }) => (
          <li key={status.kind} className="flex items-center gap-2">
            <StatusChip status={status} tier={tier} />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="text-tertiary">
        Promotion and demotion places are the top and bottom 10% of each instance. A held place stays empty; the next robot
        down does not take it. Robots and teams that left the league keep their place and show "Not entered".
      </p>
    </section>
  );
}
