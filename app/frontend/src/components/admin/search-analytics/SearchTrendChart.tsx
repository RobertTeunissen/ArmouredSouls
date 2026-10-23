/**
 * Searches per cycle (bars) and no-result rate (line, second axis). A
 * "View as table" toggle shows the same numbers as an accessible table.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminPanel, ADMIN_FOCUS_RING } from '../shared';
import type { AdminSearchAnalyticsTrend } from '../../../utils/adminSearchAnalyticsApi';
import { formatCount } from '../../../utils/adminDashboardFormat';
import { formatShare } from '../../../utils/adminSearchAnalyticsFormat';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

export interface SearchTrendChartProps {
  trends: AdminSearchAnalyticsTrend[] | null;
  /** "Settled searches" or "Search requests". */
  volumeLabel: string;
  loading: boolean;
  error: string | null;
}

// Theme tokens (index.css @theme) — recharts needs literal colours.
const PRIMARY = '#58a6ff';
const WARNING = '#d29922';
const GRID = 'rgba(255,255,255,0.06)';
const AXIS = '#8b949e';

function TrendTable({ trends, volumeLabel }: { trends: AdminSearchAnalyticsTrend[]; volumeLabel: string }): ReactNode {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{volumeLabel} and no-result rate per cycle</caption>
      <thead>
        <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary">
          <th scope="col" className="py-2 text-left font-semibold">Cycle</th>
          <th scope="col" className="py-2 text-right font-semibold">{volumeLabel}</th>
          <th scope="col" className="py-2 text-right font-semibold">Searchers</th>
          <th scope="col" className="py-2 text-right font-semibold">No-result rate</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {trends.map((trend) => (
          <tr key={trend.cycleNumber} className="border-b border-white/5">
            <th scope="row" className="py-1.5 text-left font-normal text-white">{trend.cycleNumber}</th>
            <td className="py-1.5 text-right text-white">{formatCount(trend.totalSearches)}</td>
            <td className="py-1.5 text-right text-white">{formatCount(trend.uniqueSearchers)}</td>
            <td className="py-1.5 text-right text-white">{formatShare(trend.noResultRate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SearchTrendChart({ trends, volumeLabel, loading, error }: SearchTrendChartProps): ReactNode {
  const [asTable, setAsTable] = useState(false);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const toggle = (
    <button
      type="button"
      aria-pressed={asTable}
      onClick={() => setAsTable((value) => !value)}
      className={`min-h-11 rounded px-2 text-sm text-primary hover:underline ${ADMIN_FOCUS_RING}`}
    >
      {asTable ? 'View as chart' : 'View as table'}
    </button>
  );

  return (
    <AdminPanel title="Searches per cycle" actions={toggle} loading={loading} error={error} skeletonRows={6}>
      {trends && (
        <div className="p-4 sm:p-5">
          {trends.length === 0 ? (
            <p className="text-sm text-secondary">No searches in this period.</p>
          ) : asTable ? (
            <TrendTable trends={trends} volumeLabel={volumeLabel} />
          ) : (
            <div className="h-64" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trends} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="cycleNumber" stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis yAxisId="volume" stroke={AXIS} tick={{ fontSize: 11 }} allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="rate" orientation="right" stroke={AXIS} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value}%`} domain={[0, 'auto']} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1f29', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6 }}
                    labelFormatter={(cycle) => `Cycle ${String(cycle)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
                  <Bar yAxisId="volume" dataKey="totalSearches" name={volumeLabel} fill={PRIMARY} fillOpacity={0.7} radius={[3, 3, 0, 0]} isAnimationActive={!reduceMotion} />
                  <Line yAxisId="rate" dataKey="noResultRate" name="No-result rate (%)" stroke={WARNING} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={!reduceMotion} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {!asTable && trends.length > 0 && (
            <p className="mt-2 text-xs text-tertiary">Use “View as table” for the exact numbers.</p>
          )}
        </div>
      )}
    </AdminPanel>
  );
}
