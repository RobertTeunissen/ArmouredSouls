/**
 * Battle activity per mode. All columns from `md`; below that a Volume / Rates
 * toggle switches column sets instead of scrolling sideways.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { BattleActivity, BattleActivityRow } from '../../../utils/adminDashboardApi';
import { formatCount, formatDecimal, formatUtcTime, modeLabel } from '../../../utils/adminDashboardFormat';
import { AdminPanel } from '../shared/AdminPanel';

export interface BattleActivityTableProps {
  activity: BattleActivity | null;
  loading: boolean;
  error: string | null;
}

type ColumnSet = 'volume' | 'rates';
type Values = Omit<BattleActivityRow, 'mode'>;

interface Column {
  key: string;
  label: string;
  shortLabel?: string;
  set: ColumnSet;
  render: (values: Values) => ReactNode;
}

const muted = (text: string): ReactNode => <span className="text-tertiary">{text}</span>;

const COLUMNS: readonly Column[] = [
  { key: 'lastCycle', label: 'Last cycle', shortLabel: 'Cycle', set: 'volume', render: (v) => (v.lastCycle === null ? muted('—') : formatCount(v.lastCycle)) },
  { key: 'season', label: 'Season', set: 'volume', render: (v) => formatCount(v.season) },
  { key: 'walkovers', label: 'Walkovers', shortLabel: 'W/O', set: 'volume', render: (v) => formatCount(v.walkovers) },
  { key: 'queued', label: 'Queued', set: 'volume', render: (v) => formatCount(v.queued) },
  { key: 'drawRate', label: 'Draw %', set: 'rates', render: (v) => (v.drawRate === null ? muted('n/a') : formatDecimal(v.drawRate)) },
  { key: 'killRate', label: 'Kill %', set: 'rates', render: (v) => formatDecimal(v.killRate) },
  { key: 'avg', label: 'Avg time', set: 'rates', render: (v) => `${formatDecimal(v.avgDurationSeconds)}s` },
];

function visibility(column: Column, view: ColumnSet): string {
  return column.set === view ? 'table-cell' : 'hidden md:table-cell';
}

function ViewToggle({ view, onChange }: { view: ColumnSet; onChange: (view: ColumnSet) => void }): ReactNode {
  return (
    <div role="group" aria-label="Columns" className="flex rounded-md border border-white/10 bg-background p-0.5 md:hidden">
      {(['volume', 'rates'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => onChange(option)}
          className={`min-h-8 rounded px-3 text-xs font-medium ${ADMIN_FOCUS_RING} ${view === option ? 'bg-surface-elevated text-white' : 'text-secondary'}`}
        >
          {option === 'volume' ? 'Volume' : 'Rates'}
        </button>
      ))}
    </div>
  );
}

function HeaderLabel({ column }: { column: Column }): ReactNode {
  if (!column.shortLabel) return column.label;
  return (
    <>
      <span className="md:hidden" aria-hidden="true">{column.shortLabel}</span>
      <span className="sr-only md:not-sr-only">{column.label}</span>
    </>
  );
}

export function BattleActivityTable({ activity, loading, error }: BattleActivityTableProps): ReactNode {
  const [view, setView] = useState<ColumnSet>('volume');

  const actions = (
    <div className="flex items-center gap-3">
      <ViewToggle view={view} onChange={setView} />
      <Link to="/admin/battles" className={`hidden text-sm text-primary hover:underline sm:inline ${ADMIN_FOCUS_RING}`}>
        Battles <span aria-hidden="true">→</span>
      </Link>
    </div>
  );

  const cycleWindow = activity?.lastCycleWindow;

  return (
    <AdminPanel title="Battle activity" actions={actions} loading={loading} error={error} skeletonRows={9}>
      {activity && (
        <div className="px-3 pb-4 sm:px-5">
          <table className="w-full text-sm">
            <caption className="sr-only">Battles per mode for the selected filter</caption>
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                <th scope="col" className="py-3 pr-2 text-left font-semibold">Mode</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} scope="col" className={`py-3 pl-2 text-right font-semibold ${visibility(column, view)}`}>
                    <HeaderLabel column={column} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {activity.rows.map((row) => (
                <tr key={row.mode} className="border-b border-white/5">
                  <th scope="row" className="py-2 pr-2 text-left font-normal text-white">{modeLabel(row.mode)}</th>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className={`py-2 pl-2 text-right text-white ${visibility(column, view)}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular-nums">
              <tr className="border-t border-white/20">
                <th scope="row" className="pt-3 pr-2 text-left font-semibold text-white">Total</th>
                {COLUMNS.map((column) => (
                  <td key={column.key} className={`pt-3 pl-2 text-right font-semibold text-white ${visibility(column, view)}`}>
                    {column.render(activity.totals)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          <p className="mt-4 text-xs text-tertiary">
            {cycleWindow
              ? `Last cycle: cycle ${formatCount(cycleWindow.cycleNumber)}, settled ${formatUtcTime(cycleWindow.to)}. `
              : 'Last cycle needs two settlements this season. '}
            Rates cover fought battles this season; walkovers (byes and forfeits) are counted but not rated.
            Counts include battles with at least one robot in the filter; Queued is system-wide.
          </p>
        </div>
      )}
    </AdminPanel>
  );
}
