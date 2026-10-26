/**
 * One effect value: colour band by size and sign (only when significant),
 * the number with its sign, and the standard error. Never colour alone.
 */
import type { EffectEstimate } from './types';
import { TONE_CLASSES, effectTone, formatEffect, formatSe } from '../../../utils/adminAttributesFormat';

export interface EffectCellProps {
  estimate: EffectEstimate;
  /** Show the ± standard error under the value. */
  withSe?: boolean;
  className?: string;
}

export function EffectValue({ estimate, withSe = true, className = '' }: EffectCellProps): React.ReactElement {
  const tone = effectTone(estimate);
  return (
    <span className={`inline-flex min-w-[4.5rem] flex-col items-center rounded px-2 py-1 tabular-nums ${TONE_CLASSES[tone]} ${className}`}>
      <span className={`text-sm ${estimate.significant ? 'font-semibold' : ''}`}>{formatEffect(estimate.effect).replace(' pp', '')}</span>
      {withSe && estimate.se !== null && <span className="text-[11px] opacity-80">{formatSe(estimate.se)}</span>}
      {estimate.effect !== null && !estimate.significant && <span className="sr-only">(not significant)</span>}
      {estimate.effect === null && <span className="sr-only">not enough data</span>}
    </span>
  );
}
