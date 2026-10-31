/**
 * Strategies tab — Economy: per strategy, the stables in deficit (balance
 * below ₡0), the median balance, what a stable earns and pays in running
 * costs (repairs + operating costs) per cycle over the last closed cycles,
 * and the Goal most of them are stuck saving for. Activation-batch chips
 * (one per activation day) compare a later batch with the first. A table
 * from 768 px, one card per strategy below.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getStrategyEconomy, type StrategyEconomy as StrategyEconomyData, type StrategyEconomyRow } from '../../../utils/automatonAdminApi';
import { FOCUS_RING, ToggleChip } from './ui';
import { errorText } from './requestErrors';
import { batchLabel, formatCredits, formatNumber, savingGoalText } from './automatonText';

export interface StrategyEconomyProps {
  onOpenStrategy: (strategyKey: string) => void;
}


const share = (row: StrategyEconomyRow): number => (row.stables > 0 ? row.inDeficit / row.stables : 0);
const perCycle = (value: number | null): string => (value === null ? '—' : formatCredits(value));
const goalText = (row: StrategyEconomyRow): string => {
  const goal = row.topSavingGoal;
  if (!goal) return '—';
  const text = goal.target === null ? goal.label : savingGoalText(goal.label, goal.target);
  return `${text} · ${goal.stables} of ${row.stables}`;
};

function DeficitBar({ row }: { row: StrategyEconomyRow }): ReactNode {
  return (
    <span className="block h-2.5 w-32 overflow-hidden rounded bg-surface-elevated" aria-hidden="true">
      <span className="block h-full rounded bg-red-500/75" style={{ width: `${share(row) * 100}%` }} />
    </span>
  );
}

export function StrategyEconomy({ onOpenStrategy }: StrategyEconomyProps): ReactNode {
  const [activated, setActivated] = useState<string | null>(null);
  const [data, setData] = useState<StrategyEconomyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getStrategyEconomy(activated)
      .then((value) => { if (!cancelled) setData(value); })
      .catch((err: unknown) => { if (!cancelled) setError(errorText(err, 'The economy could not be loaded.')); });
    return () => { cancelled = true; };
  }, [activated]);

  if (error) return <p role="alert" className="text-sm text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-secondary">Loading…</p>;
  const shown = data.activated === activated ? data : null;

  const name = (row: StrategyEconomyRow): ReactNode => (
    <button type="button" onClick={() => onOpenStrategy(row.strategyKey)} className={`min-h-11 min-w-11 text-left font-medium text-primary hover:underline ${FOCUS_RING}`}>
      {row.displayName}
    </button>
  );
  const deficitText = (row: StrategyEconomyRow): string => `${row.inDeficit} · ${formatNumber(Math.round(share(row) * 100))}%`;
  const deficitTone = (row: StrategyEconomyRow): string => (share(row) >= 0.3 ? 'text-red-300' : 'text-white');
  const runningTone = (row: StrategyEconomyRow): string =>
    (row.runningCostsPerCycle !== null && row.earnedPerCycle !== null && row.runningCostsPerCycle > row.earnedPerCycle ? 'text-red-300' : 'text-white');

  return (
    <section aria-labelledby="strategy-economy-heading" className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="strategy-economy-heading" className="text-base font-semibold text-white">Economy by strategy</h3>
        <p className="text-sm text-secondary">Balances now · flows per stable per cycle, cycles {data.window.fromCycle}–{data.window.toCycle}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Activation batch">
        <ToggleChip pressed={activated === null} onClick={() => setActivated(null)} className="px-3">All stables</ToggleChip>
        {data.batches.map((batch) => (
          <ToggleChip key={batch.date} pressed={activated === batch.date} onClick={() => setActivated(batch.date)} className="px-3">
            {batchLabel(batch.date)} · {batch.stables}
          </ToggleChip>
        ))}
      </div>

      {!shown ? <p className="text-sm text-secondary">Loading…</p> : shown.rows.length === 0 ? (
        <p className="text-sm text-secondary">No active stables in this batch.</p>
      ) : (
        <>
          <p role="status" className="text-sm text-secondary">
            {shown.totals.inDeficit} of {shown.totals.stables} stables in deficit
          </p>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Economy per strategy</caption>
              <thead>
                <tr className="text-left text-secondary border-b border-white/10">
                  {['Strategy', 'Stables', 'In deficit', '', 'Median balance', 'Earned / cycle', 'Running costs / cycle', 'Stuck saving for'].map((h, i) => (
                    <th key={h || `col${i}`} scope="col" className={`py-2 pr-3 font-medium ${i >= 1 && i <= 6 && i !== 3 ? 'text-right' : ''}`}>{h || <span className="sr-only">Share in deficit</span>}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((row) => (
                  <tr key={row.strategyKey} className="border-b border-white/5">
                    <td className="py-1 pr-3">{name(row)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.stables}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${deficitTone(row)}`}>{deficitText(row)}</td>
                    <td className="py-2 pr-3"><DeficitBar row={row} /></td>
                    <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{formatCredits(row.medianBalance)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">{perCycle(row.earnedPerCycle)}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums whitespace-nowrap ${runningTone(row)}`}>{perCycle(row.runningCostsPerCycle)}</td>
                    <td className="py-2 pr-3">{goalText(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-3" aria-label="Economy per strategy">
            {shown.rows.map((row) => (
              <li key={row.strategyKey} className="rounded-lg border border-white/10 bg-surface p-3 text-sm">
                <div className="flex items-center justify-between gap-2">{name(row)}<span className="text-secondary">{row.stables} stables</span></div>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between gap-2"><dt className="text-secondary">In deficit</dt><dd className={deficitTone(row)}>{deficitText(row)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Median balance</dt><dd>{formatCredits(row.medianBalance)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Earned / cycle</dt><dd>{perCycle(row.earnedPerCycle)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Running costs / cycle</dt><dd className={runningTone(row)}>{perCycle(row.runningCostsPerCycle)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Stuck saving for</dt><dd className="text-right">{goalText(row)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-secondary">
        In deficit: balance below ₡0 now. Earned counts every kind of income; running costs are repairs and operating costs (purchases are not). Per cycle divides by the cycles a stable has
        ledger rows in, so stables activated during the window are not averaged down. Red: 30% or more in deficit, or running costs above income. Stuck saving for: the Goal the latest
        completed turn ended saving on, most common first. A strategy opens the Stables tab filtered on it.
      </p>
    </section>
  );
}
