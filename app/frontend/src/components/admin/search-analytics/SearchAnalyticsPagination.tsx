import { ADMIN_FOCUS_RING } from '../shared/focusRing';

interface SearchAnalyticsPaginationProps {
  page: number;
  total: number;
  limit: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  /** Plural noun of the rows ("players", "phrases"). */
  itemLabel?: string;
  /** Accessible name of the navigation landmark. */
  label?: string;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

const BUTTON = `min-h-11 min-w-11 rounded bg-surface-elevated px-3 text-sm text-secondary transition-colors motion-reduce:transition-none hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${ADMIN_FOCUS_RING}`;

export function SearchAnalyticsPagination({
  page,
  total,
  limit,
  loading,
  onPageChange,
  itemLabel = 'players',
  label = 'Player analysis pagination',
}: SearchAnalyticsPaginationProps): React.ReactElement | null {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  if (totalPages <= 1) return null;
  const first = (page - 1) * limit + 1;
  const last = Math.min(total, page * limit);

  return (
    <nav className="flex flex-col gap-3 border-t border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label={label}>
      <span className="text-xs text-secondary">
        {formatCount(first)}–{formatCount(last)} of {formatCount(total)} {itemLabel}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={`Previous page of ${itemLabel}`}
        >
          Prev
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={`Next page of ${itemLabel}`}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
