import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { formatFinanceInstant } from '../../utils/financeTime';
import type { RecordedDriver } from '../../utils/financeApi';

export function ActionEffectTrend({ drivers }: { drivers: RecordedDriver[] }): React.ReactElement {
  return (
    <section className="rounded-lg border border-gray-700 bg-surface-elevated p-4" aria-labelledby="action-effect-heading">
      <h2 id="action-effect-heading" className="text-xl font-medium">What changed?</h2>
      <p className="mt-1 text-sm text-secondary">Recorded changes are evidence from the selected cycle. They do not prove that one event caused another result.</p>
      {drivers.length === 0 ? (
        <p className="mt-4 rounded-md bg-background/40 p-3 text-sm">No recorded drivers are available for this cycle.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {drivers.map((driver, index) => (
            <li key={`${driver.kind}-${driver.sourceReference ?? index}`} className="rounded-md bg-background/40 p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{driver.label}</p>
                  <p className="text-sm text-secondary">{driver.description}</p>
                  {driver.occurredAt ? <time className="text-xs text-tertiary" dateTime={driver.occurredAt}>{formatFinanceInstant(driver.occurredAt)}</time> : null}
                  {driver.sourceReference ? <p className="break-all text-xs text-tertiary">Reference {driver.sourceReference}</p> : null}
                </div>
                {driver.amountDelta === null ? null : (
                  <p className="shrink-0 font-semibold tabular-nums">{driver.amountDelta >= 0 ? '+' : '−'}{formatCurrency(Math.abs(driver.amountDelta))}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default ActionEffectTrend;
