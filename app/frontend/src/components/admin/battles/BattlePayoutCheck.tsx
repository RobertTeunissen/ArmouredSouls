/**
 * Payout check: credits written on the participants against the
 * `financial_ledger` entries that reference the battle, per stable.
 */
import { useState } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { StableTag } from './BattleBadges';
import type { PayoutCheck, StablePayoutCheck } from './types';
import { formatCredits, formatNumber } from '../../../utils/adminBattlesFormat';

const OVERALL: Record<PayoutCheck['status'], { text: string; tone: string }> = {
  match: { text: 'All payouts match the ledger', tone: 'bg-success/15 text-success' },
  mismatch: { text: 'Payout differs from the ledger', tone: 'bg-error/15 text-error' },
  missing: { text: 'Ledger entry missing', tone: 'bg-warning/15 text-warning' },
  unavailable: { text: 'No ledger entries found', tone: 'bg-secondary/15 text-secondary' },
};

const STATUS_TEXT: Record<StablePayoutCheck['status'], { text: string; tone: string }> = {
  match: { text: 'Match', tone: 'text-success' },
  mismatch: { text: 'Mismatch', tone: 'text-error' },
  missing: { text: 'Missing', tone: 'text-warning' },
};

function Amount({ robots, ledger }: { robots: number; ledger: number | null }): React.ReactElement {
  const gap = ledger === null ? null : ledger - robots;
  return (
    <>
      <td className="px-2 py-2 text-right tabular-nums">{formatCredits(robots)}</td>
      <td className={`px-2 py-2 text-right tabular-nums ${gap !== null && gap !== 0 ? 'text-error' : ''}`}>
        {formatCredits(ledger)}
        {gap !== null && gap !== 0 && <span className="block text-xs">({gap > 0 ? '+' : '−'}{formatCredits(Math.abs(gap))})</span>}
      </td>
    </>
  );
}

function Formula({ s }: { s: StablePayoutCheck }): React.ReactElement | null {
  const i = s.inputs;
  if (!i) return null;
  const parts = [
    i.participationFloor !== null ? `participationFloor ${formatCredits(i.participationFloor)}` : null,
    i.winComponent !== null ? `winComponent ${formatCredits(i.winComponent)}` : null,
  ].filter(Boolean);
  const extra = [
    i.teamSize !== null ? `teamSize ${i.teamSize}` : null,
    i.modifiers.length > 0 ? `modifiers ${JSON.stringify(i.modifiers)}` : 'no modifiers',
    i.formula ? `formula ${i.formula}${i.formulaVersion ? ` v${i.formulaVersion}` : ''}` : null,
    i.outcome ? `outcome ${i.outcome}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="mx-4 mb-3 rounded bg-background px-3 py-2">
      <p className="font-mono text-xs text-white">
        {parts.join(' + ')}{s.battleIncome.ledger !== null && ` = ${formatCredits(s.battleIncome.ledger)}`}
      </p>
      <p className="mt-1 text-xs text-secondary">{extra}</p>
    </div>
  );
}

export function BattlePayoutCheck({ payout }: { payout: PayoutCheck }): React.ReactElement {
  const [open, setOpen] = useState<number | null>(null);
  const overall = OVERALL[payout.status];
  return (
    <section aria-labelledby="payout-check-heading" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="payout-check-heading" className="text-base font-semibold text-white">Payout check</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${overall.tone}`}>{overall.text}</span>
      </div>
      <p className="text-xs text-secondary">
        Credits written on the participants compared with the {formatNumber(payout.ledgerEntries)} ledger {payout.ledgerEntries === 1 ? 'entry' : 'entries'} that reference this battle.
        Prestige and fame aren’t credits, so they aren’t in the ledger.
      </p>
      {payout.stables.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-surface-elevated">
          <table className="w-full min-w-[36rem] text-sm text-white">
            <caption className="sr-only">Payout check per stable</caption>
            <thead className="text-xs font-semibold uppercase tracking-wide text-secondary">
              <tr>
                <th scope="col" rowSpan={2} className="py-2 pl-4 pr-2 text-left align-bottom">Stable</th>
                <th scope="colgroup" colSpan={2} className="px-2 pt-2 text-center">Battle income</th>
                <th scope="colgroup" colSpan={2} className="px-2 pt-2 text-center">Streaming</th>
                <th scope="col" rowSpan={2} className="py-2 pl-2 pr-4 text-right align-bottom">Status</th>
              </tr>
              <tr className="normal-case tracking-normal">
                <th scope="col" className="px-2 pb-2 text-right font-normal">Robots</th>
                <th scope="col" className="px-2 pb-2 text-right font-normal">Ledger</th>
                <th scope="col" className="px-2 pb-2 text-right font-normal">Robots</th>
                <th scope="col" className="px-2 pb-2 text-right font-normal">Ledger</th>
              </tr>
            </thead>
            {payout.stables.map((s) => {
              const expanded = open === s.stable.userId;
              const status = STATUS_TEXT[s.status];
              return (
                <tbody key={s.stable.userId} className="border-t border-white/5">
                  <tr>
                    <td className="py-2 pl-4 pr-2">
                      <span className="flex flex-wrap items-center gap-2">
                        {s.stable.name}
                        <StableTag kind={s.stable.stableType} />
                      </span>
                      {s.inputs && (
                        <button
                          type="button"
                          onClick={() => setOpen(expanded ? null : s.stable.userId)}
                          aria-expanded={expanded}
                          className={`min-h-11 rounded text-xs text-primary hover:underline ${ADMIN_FOCUS_RING}`}
                        >
                          {expanded ? 'Hide formula' : 'Show formula'}
                        </button>
                      )}
                    </td>
                    <Amount robots={s.battleIncome.participants} ledger={s.battleIncome.ledger} />
                    <Amount robots={s.streaming.participants} ledger={s.streaming.ledger} />
                    <td className={`py-2 pl-2 pr-4 text-right text-xs font-semibold ${status.tone}`}>{status.text}</td>
                  </tr>
                  {expanded && (
                    <tr><td colSpan={6}><Formula s={s} /></td></tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
    </section>
  );
}
