export interface FilterChip {
  key: string;
  label: string;
  active: boolean;
}

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
        <button
          key={filter.key}
          type="button"
          onClick={() => onFilterToggle(filter.key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            filter.active
              ? 'bg-primary text-white'
              : 'bg-surface-elevated text-secondary hover:text-white hover:bg-white/10'
          }`}
          aria-pressed={filter.active}
        >
          {filter.label}
        </button>
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
