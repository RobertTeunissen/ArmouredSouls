/**
 * Searchers: per-player search and no-result counts, collapsed by default.
 * Each player links to their detail panel on the Players page.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { AdminSearchAnalyticsPlayerAnalysis } from '../../../utils/adminSearchAnalyticsApi';
import { formatCount } from '../../../utils/adminDashboardFormat';
import { SearchAnalyticsPagination } from './SearchAnalyticsPagination';

export interface SearchersPanelProps {
  analysis: AdminSearchAnalyticsPlayerAnalysis | null;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function SearchersPanel({ analysis, loading, onPageChange }: SearchersPanelProps): ReactNode {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="rounded-lg border border-white/10 bg-surface">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-5 py-4 text-left hover:bg-white/5 ${ADMIN_FOCUS_RING}`}
        >
          <span aria-hidden="true" className="text-secondary">{open ? '▾' : '▸'}</span>
          <span className="text-base font-semibold text-white">Searchers{analysis ? ` (${formatCount(analysis.total)})` : ''}</span>
          <span className="text-sm font-normal text-secondary">Per-player search and no-result counts</span>
        </button>
      </h2>
      <div id={contentId} hidden={!open} className="border-t border-white/10">
        {analysis && analysis.entries.length === 0 && (
          <p className="p-5 text-sm text-secondary">No searches in this period.</p>
        )}
        {analysis && analysis.entries.length > 0 && (
          <div className="px-3 pb-2 sm:px-5">
            <table className="w-full text-sm">
              <caption className="sr-only">Searches per player</caption>
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                  <th scope="col" className="py-3 text-left font-semibold">Stable</th>
                  <th scope="col" className="py-3 text-right font-semibold">Searches</th>
                  <th scope="col" className="py-3 text-right font-semibold">No results</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {analysis.entries.map((entry) => (
                  <tr key={entry.userId} className="border-b border-white/5">
                    <th scope="row" className="py-2 text-left font-normal">
                      <Link to={`/admin/players?user=${entry.userId}`} className={`text-primary hover:underline ${ADMIN_FOCUS_RING}`}>
                        {entry.stableName?.trim() || 'Unnamed stable'}
                      </Link>
                      <span className="ml-2 text-xs text-tertiary">#{entry.userId}</span>
                    </th>
                    <td className="py-2 text-right text-white">{formatCount(entry.searchCount)}</td>
                    <td className="py-2 text-right text-white">{formatCount(entry.noResultCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {analysis && (
          <SearchAnalyticsPagination
            page={analysis.page}
            total={analysis.total}
            limit={analysis.limit}
            loading={loading}
            onPageChange={onPageChange}
          />
        )}
      </div>
    </section>
  );
}
