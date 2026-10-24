/**
 * One choice distribution (stances, loadouts) as a single stacked bar with a
 * compact legend: label, share and count per option, largest first.
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import { formatCount, formatDecimal } from '../../../utils/adminDashboardFormat';
import { toShares } from '../../../utils/adminMetaFormat';

export interface ShareCardProps {
  title: string;
  items: ReadonlyArray<{ label: string; value: number }> | null;
  loading: boolean;
}

/** Segment colours, in share order. Each legend row repeats its colour. */
const SEGMENT_COLORS = ['bg-primary', 'bg-info', 'bg-success', 'bg-warning', 'bg-error'] as const;

function color(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}

export function ShareCard({ title, items, loading }: ShareCardProps): ReactNode {
  const shares = items ? toShares(items) : null;
  const total = shares?.reduce((sum, item) => sum + item.value, 0) ?? 0;

  return (
    <AdminPanel
      title={title}
      actions={shares ? <span className="text-xs text-secondary">{formatCount(total)} robots</span> : undefined}
      loading={loading && !shares}
      skeletonRows={3}
    >
      {shares && (shares.length === 0 || total === 0 ? (
        <p className="p-5 text-sm text-tertiary">No robots</p>
      ) : (
        <div className="space-y-3 px-5 py-4">
          <div className="flex h-3 overflow-hidden rounded bg-white/5" aria-hidden="true">
            {shares.map((item, index) => (
              <div key={item.label} className={`${color(index)} h-full`} style={{ width: `${item.share}%` }} />
            ))}
          </div>
          <ul className="space-y-1 text-sm">
            {shares.map((item, index) => (
              <li key={item.label} className="flex items-center gap-2">
                <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-sm ${color(index)}`} />
                <span className="min-w-0 flex-1 truncate text-white">{item.label}</span>
                <span className="tabular-nums text-white">{formatDecimal(item.share)}%</span>
                <span className="w-16 text-right tabular-nums text-tertiary">{formatCount(item.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </AdminPanel>
  );
}
