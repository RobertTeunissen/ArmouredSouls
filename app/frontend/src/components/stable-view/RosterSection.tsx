import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import RobotDashboardCard from '../RobotDashboardCard';
import { ModeStrip } from './ModeStrip';
import { TierChip } from './TierChip';
import { MODE_SHORT_LABELS, ROSTER_MODES, sortRoster, type ModeCell, type RosterSortKey, type SortDirection, type TierSummary } from '../../utils/stableViewFormat';
import type { PublicRobot } from './types';

export interface RosterEntry {
  robot: PublicRobot;
  cells: readonly ModeCell[];
  summary: TierSummary | null;
}

interface RosterSectionProps {
  entries: readonly RosterEntry[];
}

type RosterView = 'table' | 'cards';

/** Rows shown on narrow screens before "Show all". */
const MOBILE_ROW_LIMIT = 5;

const SORT_COLUMNS: ReadonlyArray<{ key: RosterSortKey; label: string }> = [
  { key: 'name', label: 'Robot' },
  { key: 'elo', label: 'ELO' },
  { key: 'tier', label: 'Highest tier' },
  { key: 'fame', label: 'Fame' },
  { key: 'kills', label: 'Kills' },
];

/** Shared column template so the header and rows line up on wide screens. */
const ROW_GRID = 'lg:grid lg:grid-cols-[2rem_minmax(0,1fr)_4.5rem_8.5rem_12rem_4.5rem_3.5rem] lg:items-center lg:gap-3';

export function RosterSection({ entries }: RosterSectionProps) {
  const [view, setView] = useState<RosterView>('table');
  const [sortKey, setSortKey] = useState<RosterSortKey>('elo');
  const [direction, setDirection] = useState<SortDirection>('desc');
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(
    () => sortRoster(
      entries.map((e) => ({ ...e, id: e.robot.id, name: e.robot.name, elo: e.robot.elo, fame: e.robot.fame, kills: e.robot.kills })),
      sortKey,
      direction,
    ),
    [entries, sortKey, direction],
  );

  const sortBy = (key: RosterSortKey): void => {
    if (key === sortKey) {
      setDirection(direction === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setDirection(key === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <section className="rounded-lg border border-white/10 bg-surface p-5 sm:p-6" aria-labelledby="roster-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="roster-heading" className="text-lg font-semibold">
          Roster <span className="ml-1 text-sm font-normal text-secondary">{entries.length} {entries.length === 1 ? 'robot' : 'robots'}</span>
        </h3>
        {entries.length > 0 && (
          <div className="flex items-center gap-2">
            {view === 'table' && (
              <label className="flex items-center gap-2 text-xs text-secondary lg:hidden">
                Sort
                <select
                  value={`${sortKey}:${direction}`}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(':') as [RosterSortKey, SortDirection];
                    setSortKey(key);
                    setDirection(dir);
                  }}
                  className="min-h-[44px] rounded bg-surface-elevated px-2 text-sm text-white"
                >
                  {SORT_COLUMNS.map((c) => (
                    <option key={c.key} value={`${c.key}:${c.key === 'name' ? 'asc' : 'desc'}`}>{c.label}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex rounded-md bg-surface-elevated p-0.5" role="group" aria-label="Roster view">
              {(['table', 'cards'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`min-h-[44px] rounded px-3 text-xs capitalize transition-colors lg:min-h-[32px] ${view === v ? 'bg-primary/20 text-primary' : 'text-secondary hover:text-white'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-4 rounded-lg bg-surface-elevated p-6 text-center text-secondary">This stable has no robots yet</p>
      ) : view === 'cards' ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map(({ robot }) => (
            <RobotDashboardCard key={robot.id} robot={{ ...robot, currentHP: 0, maxHP: 1 }} variant="public" />
          ))}
        </div>
      ) : (
        <>
          <div className={`mt-4 hidden border-b border-white/10 pb-2 text-xs uppercase tracking-wide text-secondary ${ROW_GRID}`}>
            <span>#</span>
            {SORT_COLUMNS.slice(0, 3).map((c) => (
              <SortHeader key={c.key} column={c} active={sortKey === c.key} direction={direction} onSort={sortBy} />
            ))}
            <span className="flex gap-1" aria-hidden="true">
              {ROSTER_MODES.map((m) => <span key={m} className="w-7 text-center text-[10px]">{MODE_SHORT_LABELS[m]}</span>)}
            </span>
            {SORT_COLUMNS.slice(3).map((c) => (
              <SortHeader key={c.key} column={c} active={sortKey === c.key} direction={direction} onSort={sortBy} align="right" />
            ))}
          </div>
          <ol className="mt-2 divide-y divide-white/5 lg:mt-0">
            {rows.map((row, index) => (
              <li
                key={row.robot.id}
                className={`${index >= MOBILE_ROW_LIMIT && !showAll ? 'hidden lg:grid' : 'flex'} items-center gap-3 py-2.5 ${ROW_GRID}`}
              >
                <span className="hidden text-sm text-secondary lg:block">{index + 1}</span>
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <Thumb imageUrl={row.robot.imageUrl} />
                  <span className="min-w-0">
                    <Link to={`/robots/${row.robot.id}`} className="block truncate font-semibold text-white hover:text-primary">
                      {row.robot.name}
                    </Link>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-secondary lg:hidden">
                      {row.robot.elo.toLocaleString()} ELO <TierChip summary={row.summary} />
                    </span>
                  </span>
                </span>
                <span className="hidden text-right text-sm lg:block">{row.robot.elo.toLocaleString()}</span>
                <span className="hidden lg:block"><TierChip summary={row.summary} /></span>
                <span className="shrink-0">
                  <span className="lg:hidden"><ModeStrip cells={row.cells} showLabels /></span>
                  <span className="hidden lg:block"><ModeStrip cells={row.cells} /></span>
                </span>
                <span className="hidden text-right text-sm text-secondary lg:block">{row.robot.fame.toLocaleString()}</span>
                <span className="hidden text-right text-sm text-secondary lg:block">{row.robot.kills.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          {rows.length > MOBILE_ROW_LIMIT && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 min-h-[44px] w-full rounded-lg bg-surface-elevated text-sm text-primary lg:hidden"
            >
              Show all {rows.length} robots
            </button>
          )}
          <p className="mt-3 text-xs text-tertiary">
            Team modes use the robot&apos;s team standing. KotH and Grand Melee count first places, not a win–loss record. Hover or focus a cell for its record and LP.
          </p>
        </>
      )}
    </section>
  );
}

function SortHeader({
  column, active, direction, onSort, align = 'left',
}: {
  column: { key: RosterSortKey; label: string };
  active: boolean;
  direction: SortDirection;
  onSort: (key: RosterSortKey) => void;
  align?: 'left' | 'right';
}) {
  const state = active ? `, sorted ${direction === 'asc' ? 'ascending' : 'descending'}` : '';
  return (
    <span className={align === 'right' ? 'text-right' : ''}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        aria-label={`Sort by ${column.label}${state}`}
        className={`uppercase tracking-wide hover:text-white ${active ? 'text-white' : ''}`}
      >
        {column.label}{active && <span aria-hidden="true">{direction === 'asc' ? ' ▴' : ' ▾'}</span>}
      </button>
    </span>
  );
}

function Thumb({ imageUrl }: { imageUrl: string | null }) {
  return imageUrl ? (
    <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover lg:h-8 lg:w-8" />
  ) : (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-sm lg:h-8 lg:w-8">🤖</span>
  );
}

export default RosterSection;
