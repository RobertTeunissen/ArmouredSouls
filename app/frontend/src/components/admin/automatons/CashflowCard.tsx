/**
 * Editor — Cashflow: one Automaton's last ledger cycles. Per cycle a green
 * bar above the line for what it earned and bars below for running costs
 * (repairs + operating costs, amber) and purchases (red), then the balance
 * it ended on. Drafts have no ledger yet.
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getProfileCashflow, type ProfileCashflow } from '../../../utils/automatonAdminApi';
import { Card } from './ui';
import { errorText } from './requestErrors';
import { formatCredits } from './automatonText';

export interface CashflowCardProps {
  catalogueKey: string;
  active: boolean;
}

const HALF = 56;

export function CashflowCard({ catalogueKey, active }: CashflowCardProps): ReactNode {
  const [data, setData] = useState<ProfileCashflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setData(null);
    setError(null);
    getProfileCashflow(catalogueKey).then(
      (value) => { if (!cancelled) setData(value); },
      (err: unknown) => { if (!cancelled) setError(errorText(err, 'The cashflow could not be loaded.')); },
    );
    return () => { cancelled = true; };
  }, [catalogueKey, active]);

  let body: ReactNode;
  if (!active) body = <p className="text-sm text-secondary">A draft has no ledger yet.</p>;
  else if (error) body = <p role="alert" className="text-sm text-red-300">{error}</p>;
  else if (!data) body = <p className="text-sm text-secondary">Loading…</p>;
  else if (data.points.length === 0) body = <p className="text-sm text-secondary">No ledger rows in the last 10 cycles.</p>;
  else {
    const max = Math.max(1, ...data.points.flatMap((p) => [p.earned, p.runningCosts + p.bought]));
    const scale = (value: number): number => (value / max) * HALF;
    const last = data.points[data.points.length - 1];
    body = (
      <figure className="space-y-2">
        <div
          className="flex items-stretch gap-1"
          style={{ height: HALF * 2 }}
          role="img"
          aria-label={`Per cycle, oldest first: ${data.points.map((p) => `cycle ${p.cycle} earned ${formatCredits(p.earned)}, running costs ${formatCredits(p.runningCosts)}, bought ${formatCredits(p.bought)}, balance ${formatCredits(p.balance)}`).join('; ')}`}
        >
          {data.points.map((p) => (
            <div key={p.cycle} className="flex min-w-0 flex-1 flex-col" title={`Cycle ${p.cycle}: earned ${formatCredits(p.earned)}, running costs ${formatCredits(p.runningCosts)}, bought ${formatCredits(p.bought)}, balance ${formatCredits(p.balance)}`}>
              <div className="flex flex-1 items-end justify-center border-b border-white/20">
                <span className="w-3/5 rounded-t-sm bg-green-500/80" style={{ height: scale(p.earned) }} />
              </div>
              <div className="flex flex-1 items-start justify-center gap-px">
                <span className="w-2/5 rounded-b-sm bg-amber-500/80" style={{ height: scale(p.runningCosts) }} />
                {p.bought > 0 && <span className="w-2/5 rounded-b-sm bg-red-500/75" style={{ height: scale(p.bought) }} />}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-1 text-[10px] text-secondary" aria-hidden="true">
          {data.points.map((p) => <span key={p.cycle} className="min-w-0 flex-1 text-center">{p.cycle}</span>)}
        </div>
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500/80" aria-hidden="true" />Earned {formatCredits(data.earned)}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500/80" aria-hidden="true" />Running costs {formatCredits(data.runningCosts)}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500/75" aria-hidden="true" />Bought {formatCredits(data.bought)}</span>
          <span className={last.balance < 0 ? 'text-red-300' : 'text-white'}>Balance after cycle {last.cycle}: {formatCredits(last.balance)}</span>
        </figcaption>
      </figure>
    );
  }
  return <Card title="Cashflow · last 10 cycles">{body}</Card>;
}
