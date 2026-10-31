/**
 * Balance after each of the stable's last ledger cycles, as a line with the
 * low-balance threshold, plus the window's earned / running costs / bought.
 */
import type { ReactNode } from 'react';
import type { StableCashflow } from '../../../utils/adminPlayersApi';
import { compactCreditsText, creditsText } from '../../../utils/adminPlayersFormat';

export interface BalanceTrendProps {
  cashflow: StableCashflow;
  threshold: number;
}

const W = 520;
const H = 110;
const PAD = 10;

export function BalanceTrend({ cashflow, threshold }: BalanceTrendProps): ReactNode {
  const { points } = cashflow;
  if (points.length === 0) {
    return <p className="text-sm text-secondary">No ledger rows in the last 10 cycles.</p>;
  }
  const values = points.map((p) => p.balance);
  const max = Math.max(threshold, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  const x = (index: number): number => (points.length === 1 ? W / 2 : PAD + (index * (W - 2 * PAD)) / (points.length - 1));
  const y = (value: number): number => H - PAD - ((value - min) / span) * (H - 2 * PAD);
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full rounded-md bg-surface-elevated/60"
        role="img"
        aria-label={`Balance per cycle, oldest first: ${points.map((p) => `cycle ${p.cycle} ${creditsText(p.balance)}`).join(', ')}`}
        preserveAspectRatio="none"
      >
        <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} className="stroke-error" strokeOpacity={0.6} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-secondary" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />}
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.balance)}`).join(' ')}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => <circle key={p.cycle} cx={x(i)} cy={y(p.balance)} r={2.5} className={p.balance < threshold ? 'fill-error' : 'fill-primary'} />)}
      </svg>
      <figcaption className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-secondary">
        <span>Cycle {first.cycle}: {compactCreditsText(first.balance)}{points.length > 1 ? ` → cycle ${last.cycle}: ${compactCreditsText(last.balance)}` : ''}</span>
        <span>
          Earned {compactCreditsText(cashflow.earned)} · running costs {compactCreditsText(cashflow.runningCosts)} · bought {compactCreditsText(cashflow.bought)}
          <span className="text-error"> · dashed line {creditsText(threshold)}</span>
        </span>
      </figcaption>
    </figure>
  );
}
