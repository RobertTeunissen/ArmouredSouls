/**
 * Stables list: a table from 768 px with sortable column headers
 * (`aria-sort`, a 44 px header button and a visible arrow), one card per
 * stable below. The highest tier is shown with its mode ("Gold · 3v3 League").
 */
import type { ReactNode } from 'react';
import type { ProfileListItem } from '../../../utils/automatonAdminApi';
import { FOCUS_RING, Pill } from './ui';
import { formatCredits, formatNumber, highestTierText, lastCycleText, needAttentionText } from './automatonText';
import { nextSort, strategyName, type StableSort, type StableSortKey } from './stablesView';

export interface StablesListProps {
  rows: ProfileListItem[];
  sort: StableSort | null;
  onSortChange: (sort: StableSort) => void;
  onOpenStable: (catalogueKey: string) => void;
}

type Column = { label: string; sortKey?: StableSortKey };

const COLUMNS: readonly Column[] = [
  { label: 'Stable', sortKey: 'name' },
  { label: 'Strategy', sortKey: 'strategy' },
  { label: 'Status' },
  { label: 'Robots', sortKey: 'robots' },
  { label: 'Credits', sortKey: 'credits' },
  { label: 'Prestige', sortKey: 'prestige' },
  { label: 'Highest tier (any mode)', sortKey: 'tier' },
  { label: 'Last cycle', sortKey: 'lastCycle' },
  { label: 'Needs attention' },
];

function robotsText(item: ProfileListItem): string {
  const target = item.robots.target === null ? '—' : String(item.robots.target);
  return item.status === 'draft' ? `— / ${target}` : `${item.robots.current} / ${target}`;
}

function tierText(item: ProfileListItem): string {
  return item.status === 'draft' ? '—' : highestTierText(item.bestTier, item.bestTierMode);
}

const dash = (value: number | null, format: (n: number) => string): string => (value === null ? '—' : format(value));

export function StablesList({ rows, sort, onSortChange, onOpenStable }: StablesListProps): ReactNode {
  const stableLink = (item: ProfileListItem): ReactNode => (
    <button type="button" onClick={() => onOpenStable(item.catalogueKey)} className={`min-h-11 min-w-11 text-left font-medium text-primary underline-offset-2 hover:underline ${FOCUS_RING}`}>
      {item.stableName}
    </button>
  );

  const header = (column: Column): ReactNode => {
    if (!column.sortKey) return <th key={column.label} scope="col" className="py-2 pr-3 font-medium">{column.label}</th>;
    const key = column.sortKey;
    const active = sort?.key === key ? sort.direction : null;
    return (
      <th key={column.label} scope="col" aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'} className="pr-3 font-medium">
        <button
          type="button"
          onClick={() => onSortChange(nextSort(sort, key))}
          className={`inline-flex items-center gap-1 min-h-11 min-w-11 text-left font-medium hover:text-white ${active ? 'text-white' : ''} ${FOCUS_RING}`}
        >
          <span>
            {column.label}{' '}
            <span aria-hidden="true" className={active ? '' : 'opacity-60'}>{active === 'asc' ? '↑' : active === 'desc' ? '↓' : '↕'}</span>
          </span>
        </button>
      </th>
    );
  };

  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-secondary border-b border-white/10">{COLUMNS.map(header)}</tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.catalogueKey} className="border-b border-white/5 align-top">
                <td className="py-1 pr-3">{stableLink(item)}</td>
                <td className="py-3 pr-3">{strategyName(item)}</td>
                <td className="py-3 pr-3"><Pill tone={item.status}>{item.status === 'active' ? 'Active' : 'Draft'}</Pill></td>
                <td className="py-3 pr-3 whitespace-nowrap">{robotsText(item)}</td>
                <td className={`py-3 pr-3 whitespace-nowrap ${item.credits !== null && item.credits < 0 ? 'text-red-300' : ''}`}>{dash(item.credits, formatCredits)}</td>
                <td className="py-3 pr-3">{dash(item.prestige, formatNumber)}</td>
                <td className="py-3 pr-3">{tierText(item)}</td>
                <td className="py-3 pr-3">{lastCycleText(item)}</td>
                <td className="py-3 pr-3">{needAttentionText(item.needAttention)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden space-y-3" aria-label="Stables">
        {rows.map((item) => (
          <li key={item.catalogueKey} className="rounded-lg border border-white/10 bg-surface p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              {stableLink(item)}
              <Pill tone={item.status}>{item.status === 'active' ? 'Active' : 'Draft'}</Pill>
            </div>
            <p className="text-secondary">{strategyName(item)}</p>
            <dl className="mt-2 space-y-1">
              {item.status === 'active' && (
                <>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Robots</dt><dd>{robotsText(item)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Credits</dt><dd>{dash(item.credits, formatCredits)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Prestige</dt><dd>{dash(item.prestige, formatNumber)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-secondary">Highest tier</dt><dd className="text-right">{tierText(item)}</dd></div>
                </>
              )}
              <div className="flex justify-between gap-2"><dt className="text-secondary">Last cycle</dt><dd className="text-right">{lastCycleText(item)}</dd></div>
              {item.needAttention.length > 0 && (
                <div className="flex justify-between gap-2"><dt className="text-secondary">Needs attention</dt><dd className="text-right">{needAttentionText(item.needAttention)}</dd></div>
              )}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
