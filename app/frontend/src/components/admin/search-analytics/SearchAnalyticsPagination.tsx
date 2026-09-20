interface SearchAnalyticsPaginationProps {
  page: number;
  total: number;
  limit: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function SearchAnalyticsPagination({
  page,
  total,
  limit,
  loading,
  onPageChange,
}: SearchAnalyticsPaginationProps): React.ReactElement | null {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  if (totalPages <= 1) return null;

  return (
    <nav className="flex flex-col gap-3 border-t border-white/5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between" aria-label="Player analysis pagination">
      <span className="text-xs text-secondary">Page {page} of {totalPages} ({formatCount(total)} players)</span>
      <div className="flex gap-2">
        <button
          type="button"
          className="min-h-11 min-w-11 rounded bg-surface-elevated px-3 text-sm text-secondary transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous player analysis page"
        >
          Prev
        </button>
        <button
          type="button"
          className="min-h-11 min-w-11 rounded bg-surface-elevated px-3 text-sm text-secondary transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next player analysis page"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
