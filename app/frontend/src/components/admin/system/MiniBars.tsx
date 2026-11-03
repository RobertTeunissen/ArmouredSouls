/**
 * Small bar strip (per day, per run). Decorative: the parent states the same
 * numbers in text, so the strip is hidden from assistive technology. A zero
 * shows as a thin baseline so gaps read as "none", not as missing data.
 */
import type { ReactNode } from 'react';
import { barShares } from '../../../utils/adminSystemFormat';

export type MiniBarTone = 'error' | 'primary' | 'warning';

const TONE: Readonly<Record<MiniBarTone, string>> = {
  error: 'bg-error',
  primary: 'bg-primary',
  warning: 'bg-warning',
};

export interface MiniBarsProps {
  values: readonly number[];
  tone: MiniBarTone;
  /** Tailwind height and width classes of the strip. */
  className?: string;
  /** Bars to draw in a muted tone (e.g. failed or interrupted runs). */
  muted?: readonly boolean[];
}

export function MiniBars({ values, tone, className = 'h-6 w-28', muted }: MiniBarsProps): ReactNode {
  const shares = barShares(values);
  return (
    <div className={`flex items-end gap-0.5 ${className}`} aria-hidden="true" data-testid="mini-bars">
      {shares.map((share, index) => (
        <div
          key={index}
          className={`flex-1 rounded-sm ${share > 0 ? (muted?.[index] ? 'bg-tertiary' : TONE[tone]) : 'bg-white/10'}`}
          style={{ height: share > 0 ? `${Math.max(12, Math.round(share * 100))}%` : '2px' }}
        />
      ))}
    </div>
  );
}
