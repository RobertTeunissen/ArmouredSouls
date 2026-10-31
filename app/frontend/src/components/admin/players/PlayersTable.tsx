/**
 * Human stables: a table with sortable headers from `md` up, cards below.
 * A row (or card) opens the stable detail panel.
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import type { PlayerIssue, PlayerRow } from '../../../utils/adminPlayersApi';
import {
  creditsText,
  displayName,
  lastSeenText,
  shortDateText,
  type PlayersSort,
  type PlayersSortKey,
} from '../../../utils/adminPlayersFormat';

export interface PlayersTableProps {
  rows: PlayerRow[];
  sort: PlayersSort;
  now: Date;
  onSort: (sort: PlayersSort) => void;
  onOpen: (userId: number) => void;
}

interface Column {
  key: PlayersSortKey;
  label: string;
  align: 'left' | 'right';
}

const COLUMNS: readonly Column[] = [
  { key: 'stable', label: 'Stable', align: 'left' },
  { key: 'robots', label: 'Robots', align: 'right' },
  { key: 'battles', label: 'Battles (season)', align: 'right' },
  { key: 'winRate', label: 'Win %', align: 'right' },
  { key: 'balance', label: 'Balance', align: 'right' },
  { key: 'lastLogin', label: 'Last login', align: 'left' },
  { key: 'joined', label: 'Joined', align: 'left' },
  { key: 'issues', label: 'Issues', align: 'left' },
];

/** Low balance in red, every other issue amber. */
export function IssueTag({ issue }: { issue: PlayerIssue }): ReactNode {
  const tone = issue.code === 'low_balance' ? 'bg-error/15 text-error' : 'bg-warning/15 text-warning';
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${tone}`}>{issue.label}</span>;
}

function Issues({ issues }: { issues: PlayerIssue[] }): ReactNode {
  if (issues.length === 0) return <span className="text-tertiary">—</span>;
  return <span className="flex flex-wrap gap-1">{issues.map((issue) => <IssueTag key={issue.code} issue={issue} />)}</span>;
}

const winRateText = (row: PlayerRow): string => (row.winRate === null ? '—' : `${row.winRate}%`);

export function PlayersTable({ rows, sort, now, onSort, onOpen }: PlayersTableProps): ReactNode {
  const header = (column: Column): ReactNode => {
    const active = sort.key === column.key;
    const next: PlayersSort = active
      ? { key: column.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
      : { key: column.key, direction: column.key === 'stable' ? 'asc' : 'desc' };
    return (
      <th
        key={column.key}
        scope="col"
        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-3 py-2 font-semibold ${column.align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          onClick={() => onSort(next)}
          className={`inline-flex min-h-11 items-center gap-1 rounded hover:text-white ${active ? 'text-white' : ''} ${ADMIN_FOCUS_RING}`}
        >
          {column.label}
          <span aria-hidden="true" className={active ? '' : 'opacity-30'}>{active ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Human stables. Select a stable to open its details.</caption>
          <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-secondary">
            <tr>{COLUMNS.map(header)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} onClick={() => onOpen(row.userId)} className="cursor-pointer border-t border-white/5 hover:bg-surface-elevated">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpen(row.userId); }}
                    className={`rounded text-left ${ADMIN_FOCUS_RING}`}
                    aria-label={`Open ${displayName(row)}`}
                  >
                    <span className="block font-semibold text-white">{displayName(row)}</span>
                    <span className="block text-xs text-secondary">@{row.username}</span>
                  </button>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-white">{row.robots}</td>
                <td className="px-3 py-2 text-right tabular-nums text-white">{row.battles.toLocaleString('en-US')}</td>
                <td className="px-3 py-2 text-right tabular-nums text-white">{winRateText(row)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${row.issues.some((i) => i.code === 'low_balance') ? 'text-error' : 'text-white'}`}>{creditsText(row.currency)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-white">{lastSeenText(row.lastLoginAt, now)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-secondary">{shortDateText(row.createdAt)}</td>
                <td className="px-3 py-2"><Issues issues={row.issues} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-white/5 md:hidden" aria-label="Human stables">
        {rows.map((row) => (
          <li key={row.userId}>
            <button
              type="button"
              onClick={() => onOpen(row.userId)}
              className={`block min-h-11 w-full px-4 py-3 text-left hover:bg-surface-elevated ${ADMIN_FOCUS_RING}`}
              aria-label={`Open ${displayName(row)}`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-white">{displayName(row)}</span>
                <span className={`shrink-0 tabular-nums text-sm ${row.issues.some((i) => i.code === 'low_balance') ? 'text-error' : 'text-white'}`}>{creditsText(row.currency)}</span>
              </span>
              <span className="mt-0.5 block text-xs text-secondary">
                {row.robots} robots · {row.battles.toLocaleString('en-US')} battles · {winRateText(row)} won · {lastSeenText(row.lastLoginAt, now)}
              </span>
              {row.issues.length > 0 && <span className="mt-1.5 block"><Issues issues={row.issues} /></span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
