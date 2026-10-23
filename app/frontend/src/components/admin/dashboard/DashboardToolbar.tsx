/**
 * Dashboard toolbar: the user-type filter, its scope, freshness and Refresh.
 */
import type { ReactNode } from 'react';
import { AdminFilterBar, ADMIN_FOCUS_RING, REAL_PLAYERS_HELP, type UserFilterType } from '../shared';
import { formatUtcTime } from '../../../utils/adminDashboardFormat';

export interface DashboardToolbarProps {
  filter: UserFilterType;
  onFilterChange: (filter: UserFilterType) => void;
  lastUpdated: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

const FILTERS: ReadonlyArray<{ key: UserFilterType; label: string; shortLabel?: string; description?: string }> = [
  { key: 'real', label: 'Real players', shortLabel: 'Real', description: REAL_PLAYERS_HELP },
  { key: 'auto', label: 'Auto-generated', shortLabel: 'Generated' },
  { key: 'automaton', label: 'Automatons' },
  { key: 'all', label: 'All' },
];

export function DashboardToolbar({
  filter,
  onFilterChange,
  lastUpdated,
  refreshing,
  onRefresh,
}: DashboardToolbarProps): ReactNode {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <AdminFilterBar
        variant="segmented"
        groupLabel="Stable type filter"
        filters={FILTERS.map((option) => ({ ...option, active: option.key === filter }))}
        onFilterToggle={(key) => onFilterChange(key as UserFilterType)}
      >
        <span className="text-xs text-tertiary">Filter applies to robots, battles and meta</span>
      </AdminFilterBar>

      <div className="flex items-center justify-between gap-3 xl:justify-end xl:mb-4">
        <span className="text-xs text-secondary whitespace-nowrap" aria-live="polite">
          {refreshing ? 'Refreshing…' : lastUpdated ? `Last updated ${formatUtcTime(lastUpdated, true)}` : 'Not loaded yet'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={`min-h-9 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 py-1.5 text-sm text-white transition-colors motion-reduce:transition-none hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
        >
          <span aria-hidden="true">↻ </span>Refresh
        </button>
      </div>
    </div>
  );
}
