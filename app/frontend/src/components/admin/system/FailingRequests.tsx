/**
 * Failing requests: server errors (5xx) per route and error code over the
 * last 7 UTC days, with a per-day strip. 4xx answers (bad links, probes,
 * validation) are left out. Counted per hour in `request_metrics`.
 */
import type { ReactNode } from 'react';
import type { SystemOverview } from '../../../utils/adminSystemApi';
import { formatDayTime } from '../../../utils/adminCycleFormat';
import { formatCount } from '../../../utils/adminFormat';
import { shortDate } from '../../../utils/adminPracticeArenaFormat';
import { errorCodeLabel } from '../../../utils/adminSystemFormat';
import { AdminPanel } from '../shared';
import { MiniBars } from './MiniBars';

export interface FailingRequestsProps {
  requests: SystemOverview['requests'] | null;
  now: Date;
  loading: boolean;
}

function perDayText(perDay: readonly number[], days: readonly string[]): string {
  return days.map((day, index) => `${shortDate(day)}: ${perDay[index] ?? 0}`).join(', ');
}

function EmptyState({ recordingSince, windowDays }: { recordingSince: string | null; windowDays: number }): ReactNode {
  return (
    <p className="text-sm text-secondary">
      {recordingSince === null
        ? 'Nothing recorded yet. Server errors are counted from this release on.'
        : `No server errors in the last ${windowDays} days.`}
    </p>
  );
}

export function FailingRequests({ requests, now, loading }: FailingRequestsProps): ReactNode {
  return (
    <AdminPanel
      title="Failing requests"
      loading={loading && !requests}
      skeletonRows={3}
      actions={<span className="text-xs text-secondary">server errors (5xx) per route · last {requests?.windowDays ?? 7} days</span>}
    >
      {requests && (
        <div className="space-y-3 p-4 sm:p-5">
          {requests.errors.length === 0 ? (
            <EmptyState recordingSince={requests.recordingSince} windowDays={requests.windowDays} />
          ) : (
            <>
              <ul className="divide-y divide-white/10 md:hidden" aria-label="Failing requests">
                {requests.errors.map((row) => (
                  <li key={`${row.method} ${row.route} ${row.code}`} className="space-y-1 py-2.5 text-sm">
                    <p className="break-all font-mono text-white">{row.method} {row.route}</p>
                    <p className="text-secondary">
                      {row.page} · <span className="text-error">{formatCount(row.count)}</span> × {errorCodeLabel(row.code)}
                    </p>
                    <p className="text-secondary">Last {formatDayTime(row.lastAt, now)}</p>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <caption className="sr-only">Server errors per route and error code, most first</caption>
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                      <th scope="col" className="py-2 text-left font-semibold">Route</th>
                      <th scope="col" className="py-2 text-left font-semibold">Page</th>
                      <th scope="col" className="py-2 text-right font-semibold">Errors</th>
                      <th scope="col" className="py-2 pl-4 text-left font-semibold">Kind</th>
                      <th scope="col" className="py-2 text-left font-semibold">Last</th>
                      <th scope="col" className="py-2 text-right font-semibold">Per day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.errors.map((row) => (
                      <tr key={`${row.method} ${row.route} ${row.code}`} className="border-b border-white/5">
                        <th scope="row" className="break-all py-2 pr-3 text-left font-mono font-normal text-white">{row.method} {row.route}</th>
                        <td className="py-2 pr-3 text-white">{row.page}</td>
                        <td className="py-2 text-right font-semibold tabular-nums text-error">{formatCount(row.count)}</td>
                        <td className="py-2 pl-4 text-white">{errorCodeLabel(row.code)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-white">{formatDayTime(row.lastAt, now)}</td>
                        <td className="py-2">
                          <div className="flex justify-end">
                            <MiniBars values={row.perDay} tone="error" />
                            <span className="sr-only">Per day: {perDayText(row.perDay, requests.days)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="text-xs text-secondary">
            Counted per hour and route, kept 30 days. 4xx answers (bad links, probes, invalid input) are left out. Times in UTC.
          </p>
        </div>
      )}
    </AdminPanel>
  );
}
