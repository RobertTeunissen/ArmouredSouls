/**
 * Facilities: stables owning each facility (level ≥ 1) and their average
 * level, most owned first. A compact list that flows into two columns from
 * `sm` (top to bottom, then the next column), each row with an inline bar.
 */
import type { CSSProperties, ReactNode } from 'react';
import { AdminPanel } from '../shared';
import type { SystemStats } from '../types';
import { formatCount, formatDecimal } from '../../../utils/adminDashboardFormat';
import { humanizeKey } from '../../../utils/adminMetaFormat';

export interface FacilitiesCardProps {
  facilities: SystemStats['facilities'] | null;
  loading: boolean;
}

export function FacilitiesCard({ facilities, loading }: FacilitiesCardProps): ReactNode {
  const rows = facilities ? [...facilities.summary].sort((a, b) => b.purchaseCount - a.purchaseCount || a.type.localeCompare(b.type)) : null;
  const max = rows ? Math.max(0, ...rows.map((row) => row.purchaseCount)) : 0;
  // Column-major flow: the first half fills the left column.
  const columnRows = { '--facility-rows': Math.ceil((rows?.length ?? 0) / 2) } as CSSProperties;

  return (
    <AdminPanel
      title="Facilities"
      actions={<span className="text-xs text-secondary">Stables owning · avg level</span>}
      loading={loading && !rows}
      skeletonRows={8}
    >
      {rows && (rows.length === 0 ? (
        <p className="p-5 text-sm text-tertiary">No facilities owned yet</p>
      ) : (
        <ul
          aria-label="Stables owning each facility and their average level"
          style={columnRows}
          className="grid gap-x-8 gap-y-2 px-5 py-4 text-sm sm:grid-flow-col sm:grid-cols-2 sm:[grid-template-rows:repeat(var(--facility-rows),auto)]"
        >
          {rows.map((row) => (
            <li key={row.type} className="min-w-0">
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-white">{humanizeKey(row.type)}</span>
                <span className="tabular-nums text-white">
                  {formatCount(row.purchaseCount)}
                  <span className="sr-only"> stables, average level</span>
                </span>
                <span className="w-10 text-right tabular-nums text-tertiary">
                  <span aria-hidden="true">L</span>{formatDecimal(row.avgLevel)}
                </span>
              </div>
              <span className="mt-1 block h-1 rounded bg-white/5" aria-hidden="true">
                <span className="block h-1 rounded bg-primary/60" style={{ width: `${max > 0 ? (row.purchaseCount / max) * 100 : 0}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ))}
    </AdminPanel>
  );
}
