/**
 * Stables tab toolbar: strategy filter, search over name / catalogue key /
 * franchise, and Sort by with a direction button (the only sort control
 * below 768 px, where the table headers are not shown). Every control is
 * labelled, 44 px high and wraps to its own line on narrow screens.
 */
import type { ReactNode } from 'react';
import { ActionButton, Field, INPUT_CLASS } from './ui';
import { STABLE_SORT_OPTIONS, nextSort, type StableSort, type StableSortKey, type StrategyOption } from './stablesView';

export interface StablesToolbarProps {
  strategies: StrategyOption[];
  strategy: string | null;
  query: string;
  sort: StableSort | null;
  onStrategyChange: (key: string | null) => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: StableSort | null) => void;
}

export function StablesToolbar({ strategies, strategy, query, sort, onStrategyChange, onQueryChange, onSortChange }: StablesToolbarProps): ReactNode {
  // A deep link may name a strategy that is not in the list; keep the select in sync with the chip.
  const options = strategy !== null && !strategies.some((s) => s.key === strategy)
    ? [...strategies, { key: strategy, displayName: strategy }]
    : strategies;
  const ascending = sort?.direction !== 'desc';

  return (
    <div className="flex flex-wrap items-end gap-3 min-w-0">
      <div className="w-full sm:w-52">
        <Field label="Strategy">
          {(props) => (
            <select {...props} className={INPUT_CLASS} value={strategy ?? ''} onChange={(e) => onStrategyChange(e.target.value === '' ? null : e.target.value)}>
              <option value="">All strategies</option>
              {options.map((s) => <option key={s.key} value={s.key}>{s.displayName}</option>)}
            </select>
          )}
        </Field>
      </div>
      <div className="w-full sm:w-64">
        <Field label="Search stables">
          {(props) => (
            <input
              {...props}
              type="search"
              className={INPUT_CLASS}
              placeholder="Name, key or franchise"
              maxLength={100}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap w-full sm:w-auto items-end gap-2">
        {/* Below ~360 px of row width the direction button wraps under the select instead of clipping "Catalogue order". */}
        <div className="min-w-44 flex-1 sm:w-48 sm:flex-none">
          <Field label="Sort by">
            {(props) => (
              <select
                {...props}
                className={INPUT_CLASS}
                value={sort?.key ?? ''}
                onChange={(e) => onSortChange(e.target.value === '' ? null : nextSort(null, e.target.value as StableSortKey))}
              >
                <option value="">Catalogue order</option>
                {STABLE_SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            )}
          </Field>
        </div>
        <ActionButton
          className="shrink-0"
          disabled={sort === null}
          onClick={() => sort && onSortChange({ key: sort.key, direction: ascending ? 'desc' : 'asc' })}
        >
          <span className="sr-only">Sort direction: </span>
          <span aria-hidden="true">{ascending ? '↑' : '↓'}</span> {ascending ? 'Ascending' : 'Descending'}
        </ActionButton>
      </div>
    </div>
  );
}
