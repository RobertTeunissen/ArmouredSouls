/**
 * Weapons: effect of carrying each catalogue weapon (either slot) against the
 * average robot at equal strength, with usage, price and the raw win rate for
 * context. Sorted by effect; collapsed, it shows the strongest and the weakest
 * six; weapons with too few fights come last.
 */
import { useMemo, useState } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { EffectBar } from './EffectBar';
import type { AnalysisColumn, WeaponRow } from './types';
import { formatEffect, formatSe } from '../../../utils/adminAttributesFormat';
import { WEAPONS_COLLAPSED, bandLabel, formatCost, formatUsage, formatWinRate, handsLabel, sortWeapons } from '../../../utils/adminWeaponsFormat';

export interface WeaponsTableProps {
  weapons: WeaponRow[];
  column: AnalysisColumn;
}

/** Half-width of the effect bars: the biggest |effect| + SE shown, at least 5 pp. */
function barScale(rows: readonly WeaponRow[], column: AnalysisColumn): number {
  let max = 5;
  for (const row of rows) {
    const { effect, se } = row.results[column].effect;
    if (effect !== null) max = Math.max(max, Math.abs(effect) + (se ?? 0));
  }
  return Math.ceil(max);
}

interface Visible {
  head: WeaponRow[];
  tail: WeaponRow[];
  hidden: number;
}

function visibleRows(sorted: WeaponRow[], column: AnalysisColumn, expanded: boolean): Visible {
  if (expanded || sorted.length <= WEAPONS_COLLAPSED) return { head: sorted, tail: [], hidden: 0 };
  const estimated = sorted.filter((row) => row.results[column].effect.effect !== null);
  if (estimated.length <= WEAPONS_COLLAPSED) {
    return { head: sorted.slice(0, WEAPONS_COLLAPSED), tail: [], hidden: sorted.length - WEAPONS_COLLAPSED };
  }
  const half = WEAPONS_COLLAPSED / 2;
  return { head: estimated.slice(0, half), tail: estimated.slice(-half), hidden: sorted.length - WEAPONS_COLLAPSED };
}

function EffectText({ row, column }: { row: WeaponRow; column: AnalysisColumn }): React.ReactElement {
  const { effect } = row.results[column];
  if (effect.effect === null) return <span className="text-xs text-tertiary">too few fights</span>;
  return (
    <span className={effect.significant ? 'font-semibold text-white' : 'text-secondary'}>
      {formatEffect(effect.effect).replace(' pp', '')} <span className="text-[11px] font-normal text-tertiary">{formatSe(effect.se)}</span>
      {!effect.significant && <span className="sr-only"> (not significant)</span>}
    </span>
  );
}

export function WeaponsTable({ weapons, column }: WeaponsTableProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => sortWeapons(weapons, column), [weapons, column]);
  const { head, tail, hidden } = visibleRows(sorted, column, expanded);
  const scale = barScale(sorted, column);
  const gap = hidden > 0 && tail.length > 0 ? `… ${hidden} more weapon${hidden === 1 ? '' : 's'} in between and below` : null;

  const desktopRow = (row: WeaponRow): React.ReactElement => {
    const r = row.results[column];
    const few = r.effect.effect === null;
    return (
      <tr key={row.weaponId} className={`border-t border-white/5 ${few ? 'text-tertiary' : ''}`}>
        <th scope="row" className={`whitespace-nowrap px-5 py-2 text-left font-normal ${few ? '' : 'text-white'}`}>{row.name}</th>
        <td className="px-2 py-2 text-secondary">{bandLabel(row.rangeBand)}</td>
        <td className="px-2 py-2 text-secondary">{handsLabel(row.handsRequired)}</td>
        <td className="px-2 py-2 text-right tabular-nums text-secondary">{formatCost(row.cost)}</td>
        <td className="px-2 py-2 text-right tabular-nums text-secondary">{formatUsage(r.share)} · {r.robots.toLocaleString('en-US')}</td>
        <td className="px-2 py-2 text-right tabular-nums text-secondary">{formatUsage(r.playersShare)}</td>
        <td className="px-2 py-2 text-right tabular-nums text-secondary">{formatWinRate(r.rawWinRate)}</td>
        <td className="px-5 py-2">
          <span className="flex items-center justify-end gap-3 tabular-nums">
            {!few && <EffectBar estimate={r.effect} scale={scale} />}
            <span className="w-24 text-right"><EffectText row={row} column={column} /></span>
          </span>
        </td>
      </tr>
    );
  };

  const mobileItem = (row: WeaponRow): React.ReactElement => {
    const r = row.results[column];
    return (
      <li key={row.weaponId} className="rounded-md border border-white/10 px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${r.effect.effect === null ? 'text-tertiary' : 'text-white'}`}>{row.name}</span>
          <span className="text-sm tabular-nums"><EffectText row={row} column={column} /></span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-secondary">
            {bandLabel(row.rangeBand)} · {handsLabel(row.handsRequired)} · {formatCost(row.cost)} · {formatUsage(r.share)} · P {formatUsage(r.playersShare)}
          </span>
          {r.effect.effect !== null && <EffectBar estimate={r.effect} scale={scale} width={80} />}
        </div>
      </li>
    );
  };

  return (
    <div className="pb-4">
      <p className="px-4 pt-4 text-xs text-secondary sm:px-5">
        Carried in either slot · effect vs the average robot at equal strength, ± 1 standard error. Raw win follows price: richer robots carry pricier weapons.
      </p>
      <div className="hidden overflow-x-auto md:block">
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Effect of each weapon on win chance, with usage, price and raw win rate.</caption>
          <thead className="bg-surface-elevated text-xs font-semibold uppercase tracking-wide text-secondary">
            <tr>
              <th scope="col" className="px-5 py-2.5 text-left">Weapon</th>
              <th scope="col" className="px-2 py-2.5 text-left">Range</th>
              <th scope="col" className="px-2 py-2.5 text-left">Hands</th>
              <th scope="col" className="px-2 py-2.5 text-right">Price</th>
              <th scope="col" className="px-2 py-2.5 text-right">Fought with</th>
              <th scope="col" className="px-2 py-2.5 text-right">Players</th>
              <th scope="col" className="px-2 py-2.5 text-right">Raw win</th>
              <th scope="col" className="px-5 py-2.5 text-right">Effect (pp)</th>
            </tr>
          </thead>
          <tbody>
            {head.map(desktopRow)}
            {gap && (
              <tr className="border-t border-white/5">
                <td colSpan={8} className="px-5 py-1.5 text-xs text-tertiary">{gap}</td>
              </tr>
            )}
            {tail.map(desktopRow)}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 space-y-2 px-4 md:hidden" aria-label="Weapon effects">
        {head.map(mobileItem)}
        {gap && <li className="px-1 text-xs text-tertiary">{gap}</li>}
        {tail.map(mobileItem)}
      </ul>

      {sorted.length > WEAPONS_COLLAPSED && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          className={`mx-4 mt-3 min-h-11 rounded px-2 text-sm text-primary hover:underline sm:mx-5 ${ADMIN_FOCUS_RING}`}
        >
          {expanded ? 'Show fewer weapons' : `Show all ${sorted.length} weapons`}
        </button>
      )}
    </div>
  );
}
