/**
 * Signals per bucket (hour for 24 hours, day otherwise), stacked by type. The
 * same numbers are available to screen readers as a table.
 */
import type { ReactNode } from 'react';
import { SIGNAL_LABELS, bucketLabel } from '../../../utils/adminSecurityFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';
import { SIGNAL_TONES } from './signalTones';
import type { SecurityOverview } from '@shared/types';

export interface SignalsChartProps {
  overview: SecurityOverview;
}

export function SignalsChart({ overview }: SignalsChartProps): ReactNode {
  const { buckets, bucket, signals } = overview;
  const totals = buckets.map((_, index) => signals.reduce((sum, s) => sum + (s.perBucket[index] ?? 0), 0));
  const peak = Math.max(1, ...totals);
  const fired = signals.filter((s) => s.total > 0);
  // Label every bucket for 7 days, every 4th for 24 hours, every 5th for 30 days.
  const labelEvery = buckets.length <= 7 ? 1 : bucket === 'hour' ? 4 : 5;

  if (fired.length === 0) {
    return <p className="px-5 py-6 text-sm text-secondary">No signals in this window.</p>;
  }

  return (
    <figure className="px-5 pb-4 pt-3">
      <div className="flex h-44 items-end gap-1 border-b border-tertiary" aria-hidden="true">
        {buckets.map((start, index) => (
          <div key={start} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${bucketLabel(start, bucket)}: ${formatCount(totals[index])}`}>
            {fired.map((s) => {
              const value = s.perBucket[index] ?? 0;
              if (value === 0) return null;
              return <span key={s.signal} className={`block w-full ${SIGNAL_TONES[s.signal].bar}`} style={{ height: `${(value / peak) * 100}%` }} />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[11px] text-secondary" aria-hidden="true">
        {buckets.map((start, index) => (
          <span key={start} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">{index % labelEvery === 0 ? bucketLabel(start, bucket) : ''}</span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
        {fired.map((s) => (
          <span key={s.signal} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${SIGNAL_TONES[s.signal].bar}`} aria-hidden="true" />
            {SIGNAL_LABELS[s.signal]}
          </span>
        ))}
        <span>Times in UTC.</span>
      </figcaption>
      <table className="sr-only">
        <caption>Signals per {bucket}</caption>
        <thead>
          <tr>
            <th scope="col">{bucket === 'hour' ? 'Hour' : 'Day'}</th>
            {fired.map((s) => <th key={s.signal} scope="col">{SIGNAL_LABELS[s.signal]}</th>)}
          </tr>
        </thead>
        <tbody>
          {buckets.map((start, index) => (
            <tr key={start}>
              <th scope="row">{bucketLabel(start, bucket)}</th>
              {fired.map((s) => <td key={s.signal}>{s.perBucket[index] ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
