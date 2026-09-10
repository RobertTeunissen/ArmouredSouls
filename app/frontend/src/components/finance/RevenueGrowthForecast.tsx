import React, { useId } from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { RevenueGrowth } from '../../utils/financeApi';

export interface RevenueGrowthForecastProps {
  growth: RevenueGrowth;
}

function signedAmount(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}${formatCurrency(Math.abs(amount))}`;
}

export function RevenueGrowthForecast({ growth }: RevenueGrowthForecastProps): React.ReactElement {
  const headingId = useId();
  const isPartial = growth.comparisonBasis === 'current_partial_to_completed';
  const comparisonLimited = growth.limitations.length > 0;

  return (
    <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-medium">Revenue growth</h2>
      <p className="mt-1 text-sm text-secondary">Actual earned Credits only; investment proceeds and purchases are excluded.</p>
      <p className="mt-4 text-2xl font-bold tabular-nums">{formatCurrency(growth.currentEarnedCredits)}</p>
      {comparisonLimited ? (
        <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-semibold">Revenue comparison unavailable because its financial evidence is incomplete.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {growth.limitations.map((limitation) => (
              <li key={`${limitation.code}:${limitation.affectedCycleNumber ?? 'range'}:${limitation.affectedSourceReference ?? limitation.message}`}>
                {limitation.affectedCycleNumber === undefined ? '' : `Cycle ${limitation.affectedCycleNumber}: `}
                {limitation.message}
              </li>
            ))}
          </ul>
        </div>
      ) : growth.amountDelta === null || growth.previousEarnedCredits === null ? (
        <p className="mt-2 text-sm text-secondary">A previous completed cycle is not available for comparison.</p>
      ) : (
        <div className="mt-2 space-y-1 text-sm">
          <p>
            <span className="font-semibold">{signedAmount(growth.amountDelta)}</span>
            {growth.percentDelta === null ? '' : ` (${growth.percentDelta >= 0 ? '+' : ''}${growth.percentDelta.toFixed(1)}%)`}
            {' '}versus Cycle {growth.comparedCycleNumber ?? '—'}.
          </p>
          <p className="text-secondary">Previous earned Credits: {formatCurrency(growth.previousEarnedCredits)}</p>
        </div>
      )}
      {isPartial ? (
        <p className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
          Provisional and asymmetric: the current cycle is partial through the report as-of time, while the comparison cycle is complete.
        </p>
      ) : (
        <p className="mt-3 text-sm text-secondary">This compares two completed historical cycles.</p>
      )}
    </section>
  );
}

export default RevenueGrowthForecast;
