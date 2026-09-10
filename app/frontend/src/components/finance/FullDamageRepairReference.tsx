import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { FullDamageRepairReference as RepairReference } from '../../utils/financeApi';

export function FullDamageRepairReference({ reference }: { reference: RepairReference }): React.ReactElement {
  return (
    <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby="repair-reference-heading">
      <h2 id="repair-reference-heading" className="text-xl font-medium">Full-damage repair reference</h2>
      <p className="mt-1 text-sm text-secondary">A theoretical full-repairable-damage scenario using current active robots. It is not a quote, charge, or required action.</p>
      {reference.activeRobotCount === 0 ? (
        <p className="mt-4 rounded-md bg-background/40 p-3 text-sm">No active robots are available for this scenario.</p>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-background/40 p-3">
            <dt className="text-sm text-secondary">Automatic path</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatCurrency(reference.automatic.amount)}</dd>
            <dd className="text-xs text-tertiary">{reference.automatic.robotCount} robots</dd>
          </div>
          <div className="rounded-md bg-background/40 p-3">
            <dt className="text-sm text-secondary">Manual path</dt>
            <dd className="text-xl font-semibold tabular-nums">{formatCurrency(reference.manual.amount)}</dd>
            <dd className="text-xs text-tertiary">Saving {formatCurrency(reference.manual.saving)} across {reference.manual.robotCount} robots</dd>
          </div>
        </dl>
      )}
      <p className="mt-3 text-sm text-secondary">Current Repair Bay discount context: {reference.repairBayDiscountPercent}%</p>
    </section>
  );
}

export default FullDamageRepairReference;
