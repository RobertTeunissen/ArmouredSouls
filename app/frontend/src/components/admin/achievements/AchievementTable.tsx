/**
 * Every achievement with its unlocks this season: filter by category, sort by
 * any column. "All accounts" includes stables outside the rate's population
 * (dormant players). The first 15 rows of the current sort show until "Show
 * all" is pressed. A table from md up, a list below.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING, AdminPanel } from '../shared';
import type { AchievementCategory, AchievementRow } from '../../../utils/adminAchievementsApi';
import {
  CATEGORY_ORDER,
  categoryLabel,
  defaultDirection,
  formatRate,
  medianDayLabel,
  sortAchievements,
  tierLabel,
  type AchievementSortKey,
  type SortDirection,
} from '../../../utils/adminAchievementsFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';

interface Column {
  key: AchievementSortKey;
  label: string;
  numeric?: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: 'name', label: 'Achievement' },
  { key: 'category', label: 'Category' },
  { key: 'tier', label: 'Tier' },
  { key: 'unlocked', label: 'Unlocked', numeric: true },
  { key: 'medianDay', label: 'Median day', numeric: true },
  { key: 'unlockedAll', label: 'All accounts', numeric: true },
];

/** Rows shown before "Show all". */
const COLLAPSED_ROWS = 15;

export interface AchievementTableProps {
  rows: AchievementRow[];
  /** "active players" / "Automatons" / "generated stables", for the column note. */
  who: string;
  /** Whether the All accounts column differs from Unlocked (players only). */
  showAllAccounts: boolean;
}

export function AchievementTable({ rows, who, showAllAccounts }: AchievementTableProps): ReactNode {
  const [category, setCategory] = useState<AchievementCategory | 'all'>('all');
  const [sort, setSort] = useState<{ key: AchievementSortKey; direction: SortDirection }>({ key: 'unlocked', direction: 'desc' });
  const [showAll, setShowAll] = useState(false);

  const columns = showAllAccounts ? COLUMNS : COLUMNS.filter((column) => column.key !== 'unlockedAll');
  const shown = useMemo(
    () => sortAchievements(category === 'all' ? rows : rows.filter((row) => row.category === category), sort.key, sort.direction),
    [rows, category, sort],
  );
  const visible = showAll ? shown : shown.slice(0, COLLAPSED_ROWS);

  const toggleSort = (key: AchievementSortKey): void => {
    setSort((current) => (current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: defaultDirection(key) }));
  };

  const ariaSort = (key: AchievementSortKey): 'ascending' | 'descending' | undefined =>
    (sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined);

  return (
    <AdminPanel title="All achievements" actions={<span className="text-xs text-secondary">{formatCount(visible.length)} of {formatCount(shown.length)} shown</span>}>
      <div className="flex flex-wrap gap-2 px-5 pt-4" role="group" aria-label="Category">
        {(['all', ...CATEGORY_ORDER] as const).map((option) => {
          const pressed = option === category;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={pressed}
              onClick={() => setCategory(option)}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none ${pressed ? 'border-primary bg-primary/15 text-primary' : 'border-white/10 bg-surface-elevated text-white hover:bg-white/10'} ${ADMIN_FOCUS_RING}`}
            >
              {option === 'all' ? 'All categories' : categoryLabel(option)}
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Achievements and their unlocks this season, sortable</caption>
          <thead>
            <tr className="border-b border-white/10 text-xs text-secondary">
              {columns.map((column) => (
                <th key={column.key} scope="col" aria-sort={ariaSort(column.key)} className={`px-5 py-2 font-normal ${column.numeric ? 'text-right' : 'text-left'}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={`inline-flex min-h-11 items-center gap-1 hover:text-white ${sort.key === column.key ? 'text-white' : ''} ${ADMIN_FOCUS_RING}`}
                  >
                    {column.label}
                    <span aria-hidden="true">{sort.key === column.key ? (sort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.achievementId} className="border-b border-white/5 last:border-0">
                <th scope="row" className="px-5 py-2 text-left font-normal">
                  <span className="text-white">{row.name}</span> <span className="text-xs text-secondary">{row.achievementId}</span>
                  <span className="block max-w-md truncate text-xs text-tertiary">{row.description}</span>
                </th>
                <td className="px-5 py-2 text-secondary">{categoryLabel(row.category)}</td>
                <td className="px-5 py-2 text-secondary">{tierLabel(row.tier)}</td>
                <td className="px-5 py-2 text-right tabular-nums text-white">
                  {formatCount(row.unlocked)} <span className="text-secondary">({formatRate(row.rate)})</span>
                </td>
                <td className="px-5 py-2 text-right tabular-nums text-white">{medianDayLabel(row.medianDay)}</td>
                {showAllAccounts && <td className="px-5 py-2 text-right tabular-nums text-secondary">{formatCount(row.unlockedAll)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 divide-y divide-white/5 md:hidden" aria-label="Achievements">
        {visible.map((row) => (
          <li key={row.achievementId} className="px-5 py-3 text-sm">
            <p className="text-white">{row.name} <span className="text-xs text-secondary">{row.achievementId}</span></p>
            <p className="text-xs text-secondary">{categoryLabel(row.category)} · {tierLabel(row.tier)} · {medianDayLabel(row.medianDay)}</p>
            <p className="mt-1 tabular-nums text-white">
              {formatCount(row.unlocked)} unlocked <span className="text-secondary">({formatRate(row.rate)})</span>
              {showAllAccounts && <span className="text-xs text-secondary"> · {formatCount(row.unlockedAll)} all accounts</span>}
            </p>
          </li>
        ))}
      </ul>

      {shown.length > COLLAPSED_ROWS && (
        <div className="px-5 pt-2">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
            className={`min-h-11 text-sm text-primary hover:underline ${ADMIN_FOCUS_RING}`}
          >
            {showAll ? `Show the first ${COLLAPSED_ROWS}` : `Show all ${formatCount(shown.length)} achievements`}
          </button>
        </div>
      )}

      <p className="px-5 pb-4 pt-3 text-xs text-tertiary">
        Unlocked and its rate count {who}. Median day counts from the season start; unlocks during preparation or the rollover re-award show as before start.
        {showAllAccounts && ' All accounts also counts players who have not logged in this season.'}
      </p>
    </AdminPanel>
  );
}
