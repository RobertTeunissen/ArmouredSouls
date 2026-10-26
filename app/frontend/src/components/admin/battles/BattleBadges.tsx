/**
 * Small badges of the Battles page: the stable-type tag on each side and the
 * result pill.
 */
import type { BattleResult, StableKind } from './types';
import { resultLabel, stableTypeLabel } from '../../../utils/adminBattlesFormat';

const STABLE_TAG_CLASS: Record<StableKind, string> = {
  human: 'border-primary/50 bg-primary/10 text-primary',
  generated: 'border-tertiary text-secondary',
  automaton: 'border-info/50 bg-info/10 text-info',
};

export function StableTag({ kind }: { kind: StableKind }): React.ReactElement {
  return (
    <span
      className={`inline-flex w-[4.75rem] shrink-0 justify-center rounded-full border px-1.5 py-px text-[10px] font-semibold ${STABLE_TAG_CLASS[kind]}`}
    >
      {stableTypeLabel(kind)}
    </span>
  );
}

const RESULT_CLASS: Record<BattleResult, string> = {
  win: 'bg-success/15 text-success',
  draw: 'bg-secondary/15 text-secondary',
  bye: 'bg-warning/15 text-warning',
  forfeit: 'bg-warning/15 text-warning',
};

export function ResultPill({ result }: { result: BattleResult }): React.ReactElement {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${RESULT_CLASS[result]}`}>
      {resultLabel(result)}
    </span>
  );
}
