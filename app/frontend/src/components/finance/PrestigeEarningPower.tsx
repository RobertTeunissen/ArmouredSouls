import React from 'react';
import type { PrestigeMilestoneForecast } from '../../utils/financeApi';

export function PrestigeEarningPower({ forecast }: { forecast: PrestigeMilestoneForecast }): React.ReactElement {
  return (
    <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby="prestige-power-heading">
      <h2 id="prestige-power-heading" tabIndex={-1} className="text-xl font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Prestige earning power</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-secondary">Current prestige</dt><dd className="font-semibold tabular-nums">{forecast.currentPrestige.toLocaleString()}</dd></div>
        <div><dt className="text-secondary">Next facility gate</dt><dd className="font-semibold tabular-nums">{forecast.nextGatePrestige?.toLocaleString() ?? 'All gates reached'}</dd></div>
      </dl>
      <div className="mt-4 space-y-2 text-sm text-secondary">
        <p>Battle Multiplier increases the base Credits awarded by battle results; prestige itself is never currency.</p>
        <p>Merchandising uses prestige per roster capacity. Roster capacity is the roster expansion level plus one.</p>
      </div>
    </section>
  );
}

export default PrestigeEarningPower;
