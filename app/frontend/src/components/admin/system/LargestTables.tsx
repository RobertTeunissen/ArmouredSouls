/**
 * Largest tables: the six biggest tables by size on disk (data, indexes and
 * TOAST), with their live row estimate (`pg_stat_user_tables`).
 */
import type { ReactNode } from 'react';
import type { SystemOverview } from '../../../utils/adminSystemApi';
import { formatRows, formatSize } from '../../../utils/adminSystemFormat';
import { AdminPanel } from '../shared';

export interface LargestTablesProps {
  database: SystemOverview['database'] | undefined;
  loading: boolean;
}

export function LargestTables({ database, loading }: LargestTablesProps): ReactNode {
  const largest = database?.tables[0]?.sizeBytes ?? 0;
  return (
    <AdminPanel
      title="Largest tables"
      loading={loading && database === undefined}
      skeletonRows={6}
      actions={<span className="text-xs text-secondary">size on disk · rows</span>}
    >
      {database === null && <p className="p-5 text-sm text-secondary">Table sizes could not be read.</p>}
      {database && (
        <div className="space-y-3 p-4 sm:p-5">
          <ul className="space-y-2.5" aria-label="Largest tables">
            {database.tables.map((table) => (
              <li key={table.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto_auto]">
                <span className="truncate font-mono text-white">{table.name}</span>
                <span className="col-span-3 row-start-2 h-1.5 rounded-full bg-white/10 sm:col-span-1 sm:row-start-auto" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-info"
                    style={{ width: `${largest > 0 ? Math.max(2, Math.round((table.sizeBytes / largest) * 100)) : 0}%` }}
                  />
                </span>
                <span className="w-16 text-right tabular-nums text-white">{formatSize(table.sizeBytes)}</span>
                <span className="w-14 text-right text-xs tabular-nums text-secondary">
                  {formatRows(table.rows)}<span className="sr-only"> rows</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-secondary">Database total {formatSize(database.sizeBytes)}. Rows are Postgres estimates.</p>
        </div>
      )}
    </AdminPanel>
  );
}
