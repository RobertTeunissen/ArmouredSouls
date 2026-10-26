/**
 * Filter panel of the Battles page: stable type, mode, date range, search and
 * outcome. Every change goes to the URL (see BattlesPage), so a view can be linked.
 */
import { useEffect, useRef, useState } from 'react';
import { AdminFilterBar, ADMIN_FOCUS_RING } from '../shared';
import type { BattleFilters, BattleModeFilter, BattleRangeFilter } from './types';
import {
  MODE_GROUPS,
  OUTCOME_FILTER_OPTIONS,
  RANGE_OPTIONS,
  STABLE_FILTER_OPTIONS,
  isDefaultFilters,
  modeLabel,
} from '../../../utils/adminBattlesFormat';

export const SEARCH_DEBOUNCE_MS = 400;

export interface BattlesFiltersProps {
  filters: BattleFilters;
  onChange: (next: Partial<BattleFilters>) => void;
  onReset: () => void;
}

const CONTROL = `min-h-11 rounded-md border border-white/10 bg-background px-3 text-sm text-white ${ADMIN_FOCUS_RING}`;

export function BattlesFilters({ filters, onChange, onReset }: BattlesFiltersProps): React.ReactElement {
  const [search, setSearch] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in step when the URL changes from outside (Reset, back button).
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const commitSearch = (value: string): void => {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim() !== filters.q.trim()) onChange({ q: value, page: 1 });
  };

  const onSearchChange = (value: string): void => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commitSearch(value), SEARCH_DEBOUNCE_MS);
  };

  return (
    <section aria-label="Battle filters" className="rounded-lg border border-white/10 bg-surface p-4">
      <AdminFilterBar
        variant="segmented"
        groupLabel="Stables"
        filters={STABLE_FILTER_OPTIONS.map((o) => ({ key: o.key, label: o.label, description: o.description, active: filters.stable === o.key }))}
        onFilterToggle={(key) => onChange({ stable: key as BattleFilters['stable'], page: 1 })}
      >
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-1 sm:flex-wrap">
          <label className="contents">
            <span className="sr-only">Mode</span>
            <select
              value={filters.mode}
              onChange={(e) => onChange({ mode: e.target.value as BattleModeFilter, page: 1 })}
              className={`${CONTROL} sm:w-44`}
            >
              <option value="all">All modes</option>
              {MODE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.modes.map((mode) => <option key={mode} value={mode}>{modeLabel(mode)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="contents">
            <span className="sr-only">Date range</span>
            <select
              value={filters.range}
              onChange={(e) => onChange({ range: e.target.value as BattleRangeFilter, page: 1 })}
              className={`${CONTROL} sm:w-40`}
            >
              {RANGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <form
            role="search"
            className="col-span-2 sm:min-w-56 sm:flex-1"
            onSubmit={(e) => { e.preventDefault(); commitSearch(search); }}
          >
            <label htmlFor="battle-search" className="sr-only">Search by robot, stable or battle id</label>
            <input
              id="battle-search"
              type="search"
              value={search}
              maxLength={100}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Robot, stable or #battle id"
              className={`${CONTROL} w-full placeholder:text-tertiary`}
            />
          </form>
        </div>
      </AdminFilterBar>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="group" aria-labelledby="battle-outcome-label" className="flex flex-wrap items-center gap-2">
          <span id="battle-outcome-label" className="mr-1 text-xs text-secondary">Outcome</span>
          {OUTCOME_FILTER_OPTIONS.map((o) => {
            const active = filters.outcome === o.key;
            return (
              <button
                key={o.key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ outcome: o.key, page: 1 })}
                className={`min-h-11 rounded-full border px-4 text-xs font-semibold transition-colors motion-reduce:transition-none ${ADMIN_FOCUS_RING} ${
                  active ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/15 text-secondary hover:text-white'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={isDefaultFilters(filters)}
          className={`ml-auto min-h-11 rounded px-2 text-sm text-primary hover:underline disabled:cursor-default disabled:text-tertiary disabled:no-underline ${ADMIN_FOCUS_RING}`}
        >
          Reset filters
        </button>
      </div>
    </section>
  );
}
