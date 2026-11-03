/**
 * Slow requests: routes that took 2 s or longer in the last 7 UTC days, with
 * count, average and slowest (aggregates per hour, so no median).
 */
import type { ReactNode } from 'react';
import type { SystemOverview } from '../../../utils/adminSystemApi';
import { formatDayTime } from '../../../utils/adminCycleFormat';
import { formatCount } from '../../../utils/adminFormat';
import { formatRequestMs } from '../../../utils/adminSystemFormat';
import { AdminPanel } from '../shared';

export interface SlowRequestsProps {
  requests: SystemOverview['requests'] | null;
  now: Date;
  loading: boolean;
}

export function SlowRequests({ requests, now, loading }: SlowRequestsProps): ReactNode {
  return (
    <AdminPanel
      title="Slow requests"
      loading={loading && !requests}
      skeletonRows={3}
      actions={<span className="text-xs text-secondary">2 s or longer · per route · last {requests?.windowDays ?? 7} days</span>}
    >
      {requests && (
        <div className="p-4 sm:p-5">
          {requests.slow.length === 0 ? (
            <p className="text-sm text-secondary">
              {requests.recordingSince === null
                ? 'Nothing recorded yet. Requests of 2 s or longer are counted from this release on.'
                : `No request took 2 s or longer in the last ${requests.windowDays} days.`}
            </p>
          ) : (
            <ul className="divide-y divide-white/10" aria-label="Slow requests, most first">
              {requests.slow.map((row) => (
                <li key={`${row.method} ${row.route}`} className="space-y-0.5 py-2.5 text-sm">
                  <p className="break-all font-mono text-white">{row.method} {row.route}</p>
                  <p className="text-secondary">
                    {row.page} · {formatCount(row.count)}× · average {formatRequestMs(row.avgMs)} · slowest{' '}
                    <span className="text-warning">{formatRequestMs(row.maxMs)}</span> · last {formatDayTime(row.lastAt, now)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminPanel>
  );
}
