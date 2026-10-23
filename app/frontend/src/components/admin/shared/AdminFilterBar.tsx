import { Fragment } from 'react';
import { ADMIN_FOCUS_RING } from './focusRing';

export interface FilterChip {
  key: string;
  label: string;
  /** Shorter label used below the `sm` breakpoint by the segmented variant. */
  shortLabel?: string;
  active: boolean;
  /** Help text: shown as a tooltip and announced with the chip. */
  description?: string;
}

/**
 * The user-type filter of the analytics pages (`?filter=` on the admin
 * endpoints). `real` is human players only: it excludes auto-generated bots
 * and Automatons (Spec #55, R1.6).
 */
export type UserFilterType = 'all' | 'real' | 'auto' | 'automaton';

/** Approved help text of the "Real Players" chip (Spec #55, PLAYER_FACING_TEXT §6.8). */
export const REAL_PLAYERS_HELP = 'Human players only. Excludes auto-generated bots and Automatons.';

export interface AdminFilterBarProps {
  filters: FilterChip[];
  onFilterToggle: (key: string) => void;
  onClearAll?: () => void;
  /**
   * `pills` (default): separate rounded chips. `segmented`: one joined control
   * for a single-choice filter, full width on small screens.
   */
  variant?: 'pills' | 'segmented';
  /** Accessible name of the segmented group. */
  groupLabel?: string;
  children?: React.ReactNode;
}

function HelpText({ filter }: { filter: FilterChip }): React.ReactElement | null {
  if (!filter.description) return null;
  return <span id={`admin-filter-help-${filter.key}`} className="sr-only">{filter.description}</span>;
}

function SegmentedFilters({
  filters,
  onFilterToggle,
  groupLabel,
}: Pick<AdminFilterBarProps, 'filters' | 'onFilterToggle' | 'groupLabel'>): React.ReactElement {
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex w-full sm:w-auto rounded-md border border-white/10 bg-surface p-0.5"
    >
      {filters.map((filter) => (
        <Fragment key={filter.key}>
          <button
            type="button"
            onClick={() => onFilterToggle(filter.key)}
            className={`flex-1 sm:flex-none min-h-11 whitespace-nowrap px-2 sm:px-3 py-1.5 text-sm font-medium rounded transition-colors motion-reduce:transition-none ${ADMIN_FOCUS_RING} ${
              filter.active ? 'bg-primary text-white' : 'text-secondary hover:text-white hover:bg-white/5'
            }`}
            aria-pressed={filter.active}
            aria-label={filter.shortLabel ? filter.label : undefined}
            title={filter.description}
            aria-describedby={filter.description ? `admin-filter-help-${filter.key}` : undefined}
          >
            {filter.shortLabel ? (
              <>
                <span className="sm:hidden">{filter.shortLabel}</span>
                <span className="hidden sm:inline">{filter.label}</span>
              </>
            ) : (
              filter.label
            )}
          </button>
          <HelpText filter={filter} />
        </Fragment>
      ))}
    </div>
  );
}

export function AdminFilterBar({
  filters,
  onFilterToggle,
  onClearAll,
  variant = 'pills',
  groupLabel,
  children,
}: AdminFilterBarProps): React.ReactElement {
  const hasActiveFilters = filters.some((f) => f.active);

  if (variant === 'segmented') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <SegmentedFilters filters={filters} onFilterToggle={onFilterToggle} groupLabel={groupLabel} />
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {filters.map((filter) => (
        <Fragment key={filter.key}>
        <button
          type="button"
          onClick={() => onFilterToggle(filter.key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            filter.active
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white hover:bg-white/10'
          }`}
          aria-pressed={filter.active}
          title={filter.description}
          aria-describedby={filter.description ? `admin-filter-help-${filter.key}` : undefined}
        >
          {filter.label}
        </button>
        <HelpText filter={filter} />
        </Fragment>
      ))}

      {onClearAll && hasActiveFilters && (
        <button
          type="button"
          onClick={onClearAll}
          className="px-3 py-1.5 text-sm text-secondary hover:text-white transition-colors"
        >
          Clear all
        </button>
      )}

      {children && (
        <div className="flex items-center gap-2 ml-auto">{children}</div>
      )}
    </div>
  );
}
