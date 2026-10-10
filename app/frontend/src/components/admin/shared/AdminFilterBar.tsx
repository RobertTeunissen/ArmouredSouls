import { Fragment } from 'react';

export interface FilterChip {
  key: string;
  label: string;
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
  children?: React.ReactNode;
}

export function AdminFilterBar({
  filters,
  onFilterToggle,
  onClearAll,
  children,
}: AdminFilterBarProps): React.ReactElement {
  const hasActiveFilters = filters.some((f) => f.active);

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
        {filter.description && (
          <span id={`admin-filter-help-${filter.key}`} className="sr-only">{filter.description}</span>
        )}
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
