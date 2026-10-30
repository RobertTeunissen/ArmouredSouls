/**
 * Controls of the Weapons page: date range, mode column and strength. All go
 * to the URL (see WeaponsPage), so a view can be linked.
 */
import { useId } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import { ANALYSIS_COLUMNS } from '../attributes/types';
import type { AnalysisColumn, AnalysisRange, WeaponFilters } from './types';
import { RANGE_OPTIONS, columnDetail, columnLabel } from '../../../utils/adminAttributesFormat';
import { DEFAULT_WEAPON_FILTERS, STRENGTH_OPTIONS, isDefaultWeaponFilters } from '../../../utils/adminWeaponsFormat';

export interface WeaponsControlsProps {
  filters: WeaponFilters;
  onChange: (next: Partial<WeaponFilters>) => void;
}

const SELECT = `min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-white ${ADMIN_FOCUS_RING}`;

function pill(active: boolean): string {
  return `min-h-11 rounded-full border px-4 text-xs font-semibold transition-colors motion-reduce:transition-none ${ADMIN_FOCUS_RING} ${
    active ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/15 text-secondary hover:text-white'
  }`;
}

export function WeaponsControls({ filters, onChange }: WeaponsControlsProps): React.ReactElement {
  const id = useId();
  return (
    <section aria-label="Analysis settings" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-white/10 bg-surface p-4">
      <label className="flex items-center gap-2 text-xs text-secondary">
        <span>Battles from</span>
        <select value={filters.range} onChange={(e) => onChange({ range: e.target.value as AnalysisRange })} className={SELECT}>
          {RANGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>

      <div role="group" aria-labelledby={`${id}-mode`} className="flex flex-wrap items-center gap-2">
        <span id={`${id}-mode`} className="text-xs text-secondary">Mode</span>
        {ANALYSIS_COLUMNS.map((column: AnalysisColumn) => (
          <button
            key={column}
            type="button"
            aria-pressed={filters.column === column}
            title={columnDetail(column)}
            onClick={() => onChange({ column })}
            className={pill(filters.column === column)}
          >
            {columnLabel(column)}
          </button>
        ))}
      </div>

      <div role="group" aria-labelledby={`${id}-strength`} className="flex flex-wrap items-center gap-2">
        <span id={`${id}-strength`} className="text-xs text-secondary">Strength</span>
        {STRENGTH_OPTIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={filters.strength === o.key}
            title={o.description}
            onClick={() => onChange({ strength: o.key })}
            className={pill(filters.strength === o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_WEAPON_FILTERS })}
        disabled={isDefaultWeaponFilters(filters)}
        className={`ml-auto min-h-11 rounded px-2 text-sm text-primary hover:underline disabled:cursor-default disabled:text-tertiary disabled:no-underline ${ADMIN_FOCUS_RING}`}
      >
        Reset
      </button>
    </section>
  );
}
