import { AdminEmptyState } from './AdminEmptyState';

export interface AdminDataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface AdminDataTableProps<T> {
  columns: AdminDataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  sortState?: { key: string; direction: 'asc' | 'desc' };
  onSort?: (key: string) => void;
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }): React.ReactElement {
  if (direction === 'asc') return <span aria-label="sorted ascending">▲</span>;
  if (direction === 'desc') return <span aria-label="sorted descending">▼</span>;
  return <span className="opacity-30" aria-hidden="true">⇅</span>;
}

export function AdminDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  pagination,
  sortState,
  onSort,
}: AdminDataTableProps<T>): React.ReactElement {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-secondary text-sm">Loading…</span>
      </div>
    );
  }

  if (data.length === 0) {
    return <AdminEmptyState icon="📭" title={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-elevated">
            {columns.map((col) => {
              const align = col.align ?? 'left';
              const isSorted = sortState?.key === col.key;
              const sortDir = isSorted ? sortState.direction : null;

              return (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold text-secondary ${ALIGN_CLASS[align]} ${
                    col.sortable ? 'cursor-pointer select-none hover:text-white' : ''
                  }`}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  aria-sort={
                    isSorted
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon direction={sortDir} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody className="divide-y divide-white/5">
          {data.map((row, idx) => (
            <tr
              key={idx}
              className={`transition-colors hover:bg-white/5 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => {
                const align = col.align ?? 'left';
                const cellValue = col.render
                  ? col.render(row)
                  : (row[col.key] as React.ReactNode);

                return (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-white ${ALIGN_CLASS[align]}`}
                  >
                    {cellValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <span className="text-xs text-secondary">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="px-3 py-1 text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="px-3 py-1 text-sm rounded bg-surface-elevated text-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
