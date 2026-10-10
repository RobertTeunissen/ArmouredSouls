import AutomatonBadge from '../AutomatonBadge';
import type { StableType } from '../../types/stable';

export interface RecordStableNameProps {
  /** Display name of the record holder's stable. */
  name: string;
  /** Stable_Type of that stable; `automaton` adds the Automaton_Badge. */
  stableType?: StableType | null;
}

/**
 * A stable name inside a Hall of Records record (Spec #55 decision 42).
 *
 * Robot records ("Robot by Stable") and battle details name the stable as plain
 * text. For an Automaton the badge follows the name on the same line, as
 * `OwnerNameLink` does for the stable records: the wrapper never wraps and the
 * name truncates before the badge would move to a line of its own.
 */
export function RecordStableName({ name, stableType }: RecordStableNameProps) {
  if (stableType !== 'automaton') return <>{name}</>;
  return (
    <span
      className="inline-flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 align-middle"
      data-testid="record-stable-name"
    >
      <span className="min-w-0 truncate">{name}</span>
      <AutomatonBadge stableType={stableType} />
    </span>
  );
}
