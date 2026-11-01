/**
 * The two tables of the Security page: stables with signals (each opens the
 * stable's detail panel on Players) and sources without an account (by IP).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { SecuritySignal, SignalSourceRow, SignalStableRow } from '../../../utils/adminSecurityApi';
import { STABLE_SIGNAL_LABELS, shortDateTime, stableLabel } from '../../../utils/adminSecurityFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';

const STABLE_TYPE_LABELS: Readonly<Record<NonNullable<SignalStableRow['stableType']>, string>> = {
  human: 'Player',
  automaton: 'Automaton',
  generated: 'Generated',
};

const CHIP_TONE: Readonly<Record<SecuritySignal, string>> = {
  failed_login: 'bg-warning/15 text-warning',
  rate_limit: 'bg-warning/15 text-warning',
  ownership_violation: 'bg-error/15 text-error',
  race_condition_burst: 'bg-info/15 text-info',
  robot_creation_burst: 'bg-primary/15 text-primary',
  malformed_request: 'bg-surface-elevated text-secondary',
};

export function SignalStablesTable({ rows }: { rows: readonly SignalStableRow[] }): ReactNode {
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-secondary">No stable triggered a signal in this window.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-secondary">
            <th scope="col" className="px-5 py-2 font-medium">Stable</th>
            <th scope="col" className="px-3 py-2 font-medium">Signals</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-2.5">
                <Link to={`/admin/players?user=${row.userId}`} className={`font-semibold text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
                  {stableLabel(row)}
                </Link>
                <span className="block text-xs text-secondary">
                  {row.username ? `@${row.username}` : `#${row.userId}`}
                  {row.stableType ? ` · ${STABLE_TYPE_LABELS[row.stableType]}` : ''}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className="flex flex-wrap gap-1.5">
                  {(Object.entries(row.counts) as [SecuritySignal, number][]).map(([signal, count]) => (
                    <span key={signal} className={`rounded-full px-2 py-0.5 text-xs ${CHIP_TONE[signal]}`}>
                      {STABLE_SIGNAL_LABELS[signal]} {formatCount(count)}
                    </span>
                  ))}
                </span>
              </td>
              <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-white">{shortDateTime(row.lastSeenAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SignalSourcesTable({ rows, burstCount, burstWindowMinutes }: { rows: readonly SignalSourceRow[]; burstCount: number; burstWindowMinutes: number }): ReactNode {
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-secondary">No failed logins or malformed requests without an account in this window.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-secondary">
            <th scope="col" className="px-5 py-2 font-medium">Source IP</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Failed logins</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Accounts tried</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Malformed requests</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Rate-limit hits</th>
            <th scope="col" className="px-3 py-2 font-medium">Endpoints</th>
            <th scope="col" className="px-5 py-2 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.sourceIp} className="border-b border-white/5 last:border-0">
              <td className="px-5 py-2.5 font-mono text-xs text-white">{row.sourceIp}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-white">{formatCount(row.failedLogins)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-white">{formatCount(row.accountsTried)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-white">{formatCount(row.malformedRequests)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-white">{formatCount(row.rateLimitHits)}</td>
              <td className="max-w-[16rem] truncate px-3 py-2.5 text-xs text-secondary" title={row.endpoints.join(', ')}>{row.endpoints.join(', ')}</td>
              <td className="whitespace-nowrap px-5 py-2.5 text-white">
                {shortDateTime(row.lastSeenAt)}
                {row.burst && (
                  <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                    Burst: {row.burst.count} in {burstWindowMinutes} min
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-5 py-3 text-xs text-secondary">
        A burst is {burstCount} or more failed logins from one IP within {burstWindowMinutes} minutes, the login rate limiter&apos;s window.
        Accounts tried counts existing accounts only; names that match no account are not stored.
      </p>
    </div>
  );
}
