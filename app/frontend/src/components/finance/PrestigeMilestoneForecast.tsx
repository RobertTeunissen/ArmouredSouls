import React from 'react';
import type { PrestigeMilestoneForecast as Forecast } from '../../utils/financeApi';

const STATUS_COPY: Record<Exclude<Forecast['status'], 'available'>, string> = {
  insufficient_history: 'Not enough completed-cycle history is available for an estimate.',
  no_positive_pace: 'No positive prestige pace was recorded in the completed-cycle sample.',
  no_next_gate: 'There is no next prestige gate to forecast.',
};

export function PrestigeMilestoneForecast({ forecast }: { forecast: Forecast }): React.ReactElement {
  return (
    <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby="prestige-forecast-heading">
      <h2 id="prestige-forecast-heading" className="text-xl font-medium">Prestige milestone forecast</h2>
      <p className="mt-1 text-sm text-secondary">A historical estimate from positive awards in completed cycles, not a promise or calendar forecast.</p>
      {forecast.status === 'available' ? (
        <p className="mt-4 text-2xl font-bold">
          About {forecast.estimatedCycles} completed cycle{forecast.estimatedCycles === 1 ? '' : 's'}
        </p>
      ) : (
        <p className="mt-4 rounded-md bg-background/40 p-3 text-sm">{STATUS_COPY[forecast.status]}</p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-secondary">Current prestige</dt><dd className="font-semibold tabular-nums">{forecast.currentPrestige.toLocaleString()}</dd></div>
        <div><dt className="text-secondary">Next gate</dt><dd className="font-semibold tabular-nums">{forecast.nextGatePrestige?.toLocaleString() ?? 'None'}</dd></div>
        <div><dt className="text-secondary">Cycles sampled</dt><dd className="font-semibold tabular-nums">{forecast.completedCyclesSampled}</dd></div>
        <div><dt className="text-secondary">Positive prestige</dt><dd className="font-semibold tabular-nums">{forecast.positivePrestigeAwarded.toLocaleString()}</dd></div>
        <div><dt className="text-secondary">Average per cycle</dt><dd className="font-semibold tabular-nums">{forecast.averagePerCompletedCycle?.toLocaleString() ?? 'Unavailable'}</dd></div>
        <div><dt className="text-secondary">Remaining</dt><dd className="font-semibold tabular-nums">{forecast.remainingPrestige?.toLocaleString() ?? 'None'}</dd></div>
      </dl>
    </section>
  );
}

export default PrestigeMilestoneForecast;
