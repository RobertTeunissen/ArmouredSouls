/**
 * Toolbar of the filtered admin overview pages (Dashboard, Meta): the
 * stable-type filter, what it applies to, freshness and Refresh.
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING, StableScopeToggle } from '../shared';
import type { StableScope } from '../../../utils/adminStableScope';
import { formatUtcTime } from '../../../utils/adminDashboardFormat';

export interface DashboardToolbarProps {
  filter: StableScope;
  onFilterChange: (filter: StableScope) => void;
  /** What the filter applies to on this page, shown next to it. */
  scopeNote: string;
  lastUpdated: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export function DashboardToolbar({
  filter,
  onFilterChange,
  scopeNote,
  lastUpdated,
  refreshing,
  onRefresh,
}: DashboardToolbarProps): ReactNode {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StableScopeToggle value={filter} onChange={onFilterChange} />
        <span className="text-xs text-tertiary">{scopeNote}</span>
      </div>

      <div className="flex items-center justify-between gap-3 xl:justify-end">
        <span className="text-xs text-secondary whitespace-nowrap" aria-live="polite">
          {refreshing ? 'Refreshing…' : lastUpdated ? `Last updated ${formatUtcTime(lastUpdated, true)}` : 'Not loaded yet'}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={`min-h-11 whitespace-nowrap rounded-md border border-white/10 bg-surface-elevated px-3 py-1.5 text-sm text-white transition-colors motion-reduce:transition-none hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
        >
          <span aria-hidden="true">↻ </span>Refresh
        </button>
      </div>
    </div>
  );
}
