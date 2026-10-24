/**
 * Yield thresholds as one compact column chart (one column per threshold in
 * use) with the most common value, the median and the tail above 20%. The
 * exact numbers are in a screen-reader table and in each column's tooltip.
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import { formatCount, formatDecimal } from '../../../utils/adminDashboardFormat';
import { summarizeYield } from '../../../utils/adminMetaFormat';

export interface YieldHistogramProps {
  distribution: ReadonlyArray<{ threshold: number; count: number }> | null;
  loading: boolean;
}

/**
 * Axis labels on 0–20% in steps of 5 and on the highest threshold. Above 20%
 * the thresholds sit on adjacent columns (25, 30, 35…), so labelling each one
 * would make the labels collide.
 */
function showLabel(threshold: number, highest: number): boolean {
  return (threshold <= 20 && threshold % 5 === 0) || threshold === highest;
}

export function YieldHistogram({ distribution, loading }: YieldHistogramProps): ReactNode {
  const summary = distribution ? summarizeYield(distribution) : null;
  const max = summary ? Math.max(0, ...summary.bars.map((bar) => bar.count)) : 0;
  const highest = summary?.bars.at(-1)?.threshold ?? 0;

  return (
    <AdminPanel
      title="Yield thresholds"
      actions={summary ? <span className="text-xs text-secondary">{formatCount(summary.total)} robots</span> : undefined}
      loading={loading && !summary}
      skeletonRows={5}
    >
      {summary && (summary.total === 0 ? (
        <p className="p-5 text-sm text-tertiary">No robots</p>
      ) : (
        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-secondary">Most common</dt>
              <dd className="tabular-nums text-white">
                {summary.mostCommon?.threshold}%{' '}
                <span className="text-tertiary">({formatDecimal(summary.mostCommon?.share ?? 0)}%)</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Median</dt>
              <dd className="tabular-nums text-white">{summary.median}%</dd>
            </div>
            <div>
              <dt className="text-xs text-secondary">Above 20%</dt>
              <dd className="tabular-nums text-white">
                {formatCount(summary.above20.count)} <span className="text-tertiary">({formatDecimal(summary.above20.share)}%)</span>
              </dd>
            </div>
          </dl>

          <div aria-hidden="true">
            <div className="flex h-24 items-end gap-px border-b border-white/10">
              {summary.bars.map((bar) => (
                <div
                  key={bar.threshold}
                  title={`${bar.threshold}%: ${formatCount(bar.count)} robots (${formatDecimal(bar.share)}%)`}
                  className={`min-w-0 flex-1 rounded-t-sm ${bar.threshold === summary.mostCommon?.threshold ? 'bg-primary' : 'bg-primary/50'}`}
                  style={{ height: `${max > 0 ? Math.max(2, (bar.count / max) * 100) : 0}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex gap-px text-[10px] tabular-nums text-tertiary">
              {summary.bars.map((bar) => (
                <span key={bar.threshold} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
                  {showLabel(bar.threshold, highest) ? `${bar.threshold}%` : ''}
                </span>
              ))}
            </div>
          </div>

          <table className="sr-only">
            <caption>Robots per yield threshold</caption>
            <thead>
              <tr><th scope="col">Threshold</th><th scope="col">Robots</th><th scope="col">Share</th></tr>
            </thead>
            <tbody>
              {summary.bars.map((bar) => (
                <tr key={bar.threshold}>
                  <th scope="row">{bar.threshold}%</th>
                  <td>{formatCount(bar.count)}</td>
                  <td>{formatDecimal(bar.share)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </AdminPanel>
  );
}
