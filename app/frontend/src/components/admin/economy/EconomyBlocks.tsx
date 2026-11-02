/**
 * Blocks of the admin Economy page: KPI cards, flow bars (where credits come
 * from / where they go), repairs, earned vs spent per cycle, balance bands
 * and the per-stable-type table.
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import { MANUAL_REPAIR_DISCOUNT } from '@shared/utils/repairCost';
import type { EconomyFlow, EconomyOverview, EconomyStableKind, RepairTotals } from '../../../utils/adminEconomyApi';
import { SCOPE_LABELS, scopeNoun } from '../../../utils/adminEconomyFormat';
import { compactCreditsText } from '../../../utils/adminPlayersFormat';


const signed = (value: number): string => `${value > 0 ? '+' : ''}${compactCreditsText(value)}`;

export function EconomyKpis({ data }: { data: EconomyOverview }): ReactNode {
  const { kpis, scope } = data;
  const cards = [
    { label: 'Earned', value: compactCreditsText(kpis.earned), hint: `${compactCreditsText(kpis.earnedPerCycle)} per cycle`, bar: 'bg-success' },
    { label: 'Spent', value: compactCreditsText(kpis.spent), hint: `${compactCreditsText(kpis.spentPerCycle)} per cycle`, bar: 'bg-error' },
    { label: 'Net', value: signed(kpis.net), hint: kpis.net >= 0 ? 'added to balances' : 'taken from balances', bar: 'bg-primary' },
    {
      label: 'Repairs vs battle pay',
      value: kpis.repairsShareOfBattleIncome === null ? '—' : `${kpis.repairsShareOfBattleIncome}%`,
      hint: 'of battle income spent on repairs',
      bar: 'bg-warning',
    },
    { label: `Held by ${SCOPE_LABELS[scope.stables].toLowerCase()}`, value: compactCreditsText(kpis.heldNow), hint: `median ${compactCreditsText(kpis.medianBalance)} · ${kpis.stables.toLocaleString('en-US')} stables`, bar: 'bg-info' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="relative overflow-hidden rounded-lg border border-white/10 bg-surface py-3 pl-5 pr-4">
          <span className={`absolute inset-y-0 left-0 w-1 ${card.bar}`} aria-hidden="true" />
          <dt className="text-xs text-secondary">{card.label}</dt>
          <dd className="text-2xl font-bold tabular-nums text-white">{card.value}</dd>
          <dd className="text-xs text-secondary">{card.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

function FlowBars({ flows, tone, label }: { flows: EconomyFlow[]; tone: 'success' | 'error'; label: string }): ReactNode {
  const max = Math.max(1, ...flows.map((f) => f.amount));
  return (
    <ul className="space-y-2.5 p-5" aria-label={label}>
      {flows.map((flow) => (
        <li key={flow.key} className="grid grid-cols-[9rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
          <span className="truncate text-white">{flow.label}</span>
          <span className="block h-3 overflow-hidden rounded bg-surface-elevated" aria-hidden="true">
            <span className={`block h-full rounded ${tone === 'success' ? 'bg-success/80' : 'bg-error/75'}`} style={{ width: `${flow.amount > 0 ? Math.max(1, (flow.amount / max) * 100) : 0}%` }} />
          </span>
          <span className="text-right tabular-nums text-white">{compactCreditsText(flow.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export function EconomyFlows({ data }: { data: EconomyOverview }): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <AdminPanel title="Where credits come from" actions={<span className="text-xs text-secondary">Income by source</span>}>
        <FlowBars flows={data.sources} tone="success" label="Income by source" />
        <p className="px-5 pb-4 text-xs text-secondary">Battle income is league, tournament, King of the Hill and Grand Melee pay, including participation pay.</p>
      </AdminPanel>
      <AdminPanel title="Where credits go" actions={<span className="text-xs text-secondary">Spending by sink</span>}>
        <FlowBars flows={data.sinks} tone="error" label="Spending by sink" />
        <p className="px-5 pb-4 text-xs text-secondary">Upgrades, weapons and robots are choices; repairs and operating costs are running costs.</p>
      </AdminPanel>
    </div>
  );
}

export function EconomyPerCycle({ data }: { data: EconomyOverview }): ReactNode {
  const { perCycle } = data;
  const max = Math.max(1, ...perCycle.flatMap((c) => [c.earned, c.spent]));
  return (
    <AdminPanel title="Per cycle" actions={<span className="text-xs text-secondary">Earned vs spent · {SCOPE_LABELS[data.scope.stables].toLowerCase()} · last {perCycle.length} cycles</span>}>
      {perCycle.length === 0 ? <p className="p-5 text-sm text-secondary">No closed cycle yet this season.</p> : (
        <figure className="p-5">
          <div className="flex h-48 items-end gap-1" role="img" aria-label={`Earned and spent per cycle, oldest first: ${perCycle.map((c) => `cycle ${c.cycle} earned ${compactCreditsText(c.earned)}, spent ${compactCreditsText(c.spent)}`).join('; ')}`}>
            {perCycle.map((c) => (
              <div key={c.cycle} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px" title={`Cycle ${c.cycle}: earned ${compactCreditsText(c.earned)}, spent ${compactCreditsText(c.spent)}, net ${signed(c.earned - c.spent)}`}>
                <span className="w-1/2 max-w-4 rounded-t-sm bg-success/80" style={{ height: `${(c.earned / max) * 100}%` }} />
                <span className="w-1/2 max-w-4 rounded-t-sm bg-error/70" style={{ height: `${(c.spent / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 border-t border-white/10 pt-1 text-[10px] text-secondary" aria-hidden="true">
            {perCycle.map((c, i) => (
              <span key={c.cycle} className="min-w-0 flex-1 text-center">{perCycle.length <= 20 || i % 5 === 0 ? c.cycle : ''}</span>
            ))}
          </div>
          <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-secondary">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success/80" aria-hidden="true" />Earned</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-error/70" aria-hidden="true" />Spent</span>
            <span>Hover a cycle for its net.</span>
          </figcaption>
        </figure>
      )}
    </AdminPanel>
  );
}

export function EconomyBalances({ data }: { data: EconomyOverview }): ReactNode {
  const max = Math.max(1, ...data.balanceBands.map((b) => b.count));
  return (
    <AdminPanel title="Balances" actions={<span className="text-xs text-secondary">{scopeNoun(data.scope.stables)} per balance band, now</span>}>
      <ul className="space-y-2 p-5" aria-label="Stables per balance band">
        {data.balanceBands.map((band) => (
          <li key={band.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
            <span className="text-white">{band.label}</span>
            <span className="block h-3 overflow-hidden rounded bg-surface-elevated" aria-hidden="true">
              <span className={`block h-full rounded ${band.negative ? 'bg-error/75' : 'bg-primary/75'}`} style={{ width: `${band.count > 0 ? Math.max(1, (band.count / max) * 100) : 0}%` }} />
            </span>
            <span className="text-right tabular-nums text-white">{band.count.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

const KIND_ORDER: readonly EconomyStableKind[] = ['players', 'automatons', 'generated'];

export function EconomyByStableType({ data }: { data: EconomyOverview }): ReactNode {
  const rows = KIND_ORDER.flatMap((kind) => data.byStableType.filter((r) => r.stables === kind));
  return (
    <AdminPanel title="All stable types" actions={<span className="text-xs text-secondary">Same window, side by side</span>}>
      <div className="overflow-x-auto p-5">
        <table className="w-full text-sm">
          <caption className="sr-only">Credits earned, spent and held per stable type in this window</caption>
          <thead className="text-xs text-secondary">
            <tr>
              <th scope="col" className="py-1 pr-3 text-left font-medium">Stables</th>
              {['Count', 'Earned', 'Spent', 'Net', 'Held now'].map((h) => <th key={h} scope="col" className="py-1 pl-3 text-right font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stables} className={`border-t border-white/5 ${data.scope.stables === row.stables ? 'bg-surface-elevated' : ''}`}>
                <th scope="row" className="py-2 pr-3 text-left font-normal text-white">{SCOPE_LABELS[row.stables]}</th>
                <td className="py-2 pl-3 text-right tabular-nums text-white">{row.count.toLocaleString('en-US')}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-white">{compactCreditsText(row.earned)}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-white">{compactCreditsText(row.spent)}</td>
                <td className={`py-2 pl-3 text-right tabular-nums ${row.net < 0 ? 'text-error' : 'text-white'}`}>{signed(row.net)}</td>
                <td className="py-2 pl-3 text-right tabular-nums text-white">{compactCreditsText(row.heldNow)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-secondary">Generated stables buy nothing; their balances are deleted at rollover. Automatons building up right after activation spend far more than they earn.</p>
      </div>
    </AdminPanel>
  );
}

const off = (value: number): string => (value > 0 ? compactCreditsText(-value) : '₡0');
/** Average paid per repair; one decimal in the thousands (₡23.3k) so repair types stay comparable. */
function perRepair(totals: RepairTotals): string {
  if (totals.repairs === 0) return '—';
  const average = totals.paid / totals.repairs;
  return average >= 10_000 && average < 1_000_000 ? `₡${(average / 1_000).toFixed(1)}k` : compactCreditsText(Math.round(average));
}
const wholePercent = (share: number | null): string => (share === null ? '—' : `${Math.round(share)}%`);
const MANUAL_PERCENT = Math.round(MANUAL_REPAIR_DISCOUNT * 100);

/**
 * What repairs cost the stables in scope and which discounts applied (full
 * price, Repair Bay, Manual Repair, paid), split automatic / manual, and every
 * stable type side by side. Replaced the Repair Log page.
 */
export function EconomyRepairs({ data }: { data: EconomyOverview }): ReactNode {
  const { automatic, manual, total, playerStables, byStableType } = data.repairs;
  const saved = total.repairBayDiscount + total.manualDiscount;
  const savedShare = total.fullPrice > 0 ? Math.round((saved / total.fullPrice) * 100) : null;
  const stats = [
    { label: `repairs (${automatic.repairs.toLocaleString('en-US')} automatic · ${manual.repairs.toLocaleString('en-US')} manual)`, value: total.repairs.toLocaleString('en-US') },
    { label: total.repairs > 0 ? `paid · ${perRepair(total)} per repair` : 'paid', value: compactCreditsText(total.paid) },
    { label: `saved by discounts${savedShare === null ? '' : ` (${savedShare}% of the full price)`}`, value: compactCreditsText(saved) },
    ...(playerStables
      ? [{ label: `${data.scope.stables === 'players' ? 'stables' : 'player stables'} used Manual Repair`, value: `${playerStables.manual.toLocaleString('en-US')} of ${playerStables.repairing.toLocaleString('en-US')}` }]
      : []),
  ];
  const rows: { label: string; totals: RepairTotals; isTotal?: boolean; manualColumn: boolean }[] = [
    { label: 'Automatic', totals: automatic, manualColumn: false },
    { label: 'Manual', totals: manual, manualColumn: true },
    { label: 'Total', totals: total, isTotal: true, manualColumn: true },
  ];
  const kinds = KIND_ORDER.flatMap((kind) => byStableType.filter((r) => r.stables === kind));
  return (
    <AdminPanel title="Repairs" actions={<span className="text-xs text-secondary">What repairs cost and which discounts apply · same stables and window</span>}>
      <div className="space-y-5 p-5">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col-reverse">
              <dt className="text-xs text-secondary">{stat.label}</dt>
              <dd className="text-2xl font-bold tabular-nums text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">Repairs by type: full price, discounts and what was paid</caption>
                <thead className="text-xs text-secondary">
                  <tr>
                    <th scope="col" className="py-1 pr-3 text-left font-medium"><span className="sr-only">Repair type</span></th>
                    {['Repairs', 'Full price', 'Repair Bay', `Manual (${MANUAL_PERCENT}%)`, 'Paid', 'Per repair'].map((h) => <th key={h} scope="col" className="py-1 pl-3 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ label, totals, isTotal, manualColumn }) => (
                    <tr key={label} className={`border-t border-white/5 ${isTotal ? 'font-semibold' : ''}`}>
                      <th scope="row" className={`py-2 pr-3 text-left text-white ${isTotal ? 'font-semibold' : 'font-normal'}`}>{label}</th>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{totals.repairs.toLocaleString('en-US')}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{compactCreditsText(totals.fullPrice)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{off(totals.repairBayDiscount)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{manualColumn ? off(totals.manualDiscount) : '—'}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{compactCreditsText(totals.paid)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{perRepair(totals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-secondary">
              Full price is the shared repair formula before discounts. The Repair Bay takes a share off by facility level; Manual Repair takes {MANUAL_PERCENT}% off what is left, and only players repair by hand.
              From the financial ledger; older repairs without a price breakdown count at what was paid. One stable&apos;s repairs are in its Players panel.
            </p>
          </div>
          <div className="min-w-0 xl:border-l xl:border-white/10 xl:pl-6">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-secondary">All stable types · same window</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Repairs of each stable type in this window</caption>
                <thead className="text-xs text-secondary">
                  <tr>
                    <th scope="col" className="py-1 pr-3 text-left font-medium">Stables</th>
                    {['Repairs', 'Paid', 'Bay off', 'Manual'].map((h) => <th key={h} scope="col" className="py-1 pl-3 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {kinds.map((row) => (
                    <tr key={row.stables} className={`border-t border-white/5 ${data.scope.stables === row.stables ? 'bg-surface-elevated' : ''}`}>
                      <th scope="row" className="py-2 pr-3 text-left font-normal text-white">{SCOPE_LABELS[row.stables]}</th>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{row.repairs.toLocaleString('en-US')}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{compactCreditsText(row.paid)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{wholePercent(row.repairBayShare)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-white">{wholePercent(row.manualShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-secondary">Bay off is the Repair Bay share of the full price. Manual is the share of repairs done by hand.</p>
          </div>
        </div>
      </div>
    </AdminPanel>
  );
}
