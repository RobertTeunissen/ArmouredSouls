import { useState } from 'react';
import { ALL_ATTRIBUTES, formatPercent, formatValue, inBattle, type AttributeValues, type TuningMap } from '../../utils/workshopBuild';

interface InBattlePanelProps {
  values: AttributeValues;
  tuning: TuningMap;
  bonuses: Record<string, number>;
  loadoutType: string;
  stance: string;
  maxHP: number;
  maxShield: number;
}

/**
 * The robot's attributes as they fight, with the gear and stance parts split
 * out. By default only attributes the loadout or stance changes are listed.
 */
export function InBattlePanel({ values, tuning, bonuses, loadoutType, stance, maxHP, maxShield }: InBattlePanelProps) {
  const [showAll, setShowAll] = useState(false);
  const rows = ALL_ATTRIBUTES.map(({ key, label }) => ({
    key, label, ...inBattle(Number(values[key]), tuning[key] ?? 0, bonuses, key, loadoutType, stance),
  }));
  const affected = rows.filter((r) => r.weapon !== 0 || r.loadout !== 0 || r.stance !== 0);
  const shown = showAll ? rows : affected;

  return (
    <section className="rounded-lg border border-white/10 bg-surface p-4 sm:p-5" aria-labelledby="in-battle-heading">
      <h3 id="in-battle-heading" className="text-lg font-semibold">In battle</h3>
      <p className="mt-1 text-xs text-secondary">Updates as you change weapons, loadout or stance. Base is level + tuning, set in Build.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[22rem] text-sm [&_td]:pl-2 [&_thead_th+th]:pl-2">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-secondary">
              <th scope="col" className="pb-2 font-normal">Attribute</th>
              <th scope="col" className="pb-2 text-right font-normal"><abbr title="Base + tuning" className="no-underline">Base</abbr></th>
              <th scope="col" className="pb-2 text-right font-normal">Weapon</th>
              <th scope="col" className="pb-2 text-right font-normal">Loadout</th>
              <th scope="col" className="pb-2 text-right font-normal">Stance</th>
              <th scope="col" className="pb-2 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {shown.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="py-1.5 text-left font-normal">{r.label}</th>
                <td className="py-1.5 text-right tabular-nums">{formatValue(r.baseAndTuning)}</td>
                <td className={`py-1.5 text-right tabular-nums ${r.weapon > 0 ? 'text-success' : r.weapon < 0 ? 'text-error' : 'text-tertiary'}`}>
                  {r.weapon === 0 ? '—' : `${r.weapon > 0 ? '+' : '−'}${formatValue(Math.abs(r.weapon))}`}
                </td>
                <td className={`py-1.5 text-right tabular-nums ${r.loadout > 0 ? 'text-success' : r.loadout < 0 ? 'text-error' : 'text-tertiary'}`}>{formatPercent(r.loadout)}</td>
                <td className={`py-1.5 text-right tabular-nums ${r.stance > 0 ? 'text-success' : r.stance < 0 ? 'text-error' : 'text-tertiary'}`}>{formatPercent(r.stance)}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums">{r.total.toFixed(1)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="py-3 text-secondary">No weapon, loadout or stance changes any attribute.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setShowAll(!showAll)} className="mt-2 min-h-[44px] text-xs text-primary hover:underline" aria-expanded={showAll}>
        {showAll ? 'Show changed attributes only' : 'Show all 23 attributes'}
      </button>
      <p className="mt-2 text-sm">Max HP <span className="text-secondary">{maxHP}</span> · Max shield <span className="text-secondary">{maxShield}</span></p>
    </section>
  );
}

export default InBattlePanel;
