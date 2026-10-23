/**
 * Per category: share of searches that returned a result, and share where
 * the player opened one (category-only selection tracking).
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import type { AdminSearchAnalyticsCategoryResults, AdminSearchResultCategory } from '../../../utils/adminSearchAnalyticsApi';
import { CATEGORY_LABELS, formatShare } from '../../../utils/adminSearchAnalyticsFormat';

export interface CategoryResultsProps {
  results: AdminSearchAnalyticsCategoryResults | null;
  tracked: boolean;
  loading: boolean;
  error: string | null;
}

const BAR: Readonly<Record<AdminSearchResultCategory, string>> = {
  robots: 'bg-primary',
  stables: 'bg-info',
  guide: 'bg-success',
};

const CATEGORIES: readonly AdminSearchResultCategory[] = ['robots', 'stables', 'guide'];

export function CategoryResults({ results, tracked, loading, error }: CategoryResultsProps): ReactNode {
  return (
    <AdminPanel title="Results by category" loading={loading} error={error} skeletonRows={4}>
      {results && (
        <div className="p-4 sm:p-5">
          <table className="w-full text-sm">
            <caption className="sr-only">Share of searches that returned and opened a result, per category</caption>
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                <th scope="col" className="pb-2 text-left font-semibold">Category</th>
                <th scope="col" className="pb-2 text-right font-semibold">Returned</th>
                <th scope="col" className="pb-2 text-right font-semibold">Chosen</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {CATEGORIES.map((category) => {
                const share = results[category];
                return (
                  <tr key={category}>
                    <th scope="row" className="pt-3 text-left font-normal text-white">
                      {CATEGORY_LABELS[category]}
                      <div className="mt-1.5 h-1.5 w-full rounded bg-white/5" aria-hidden="true">
                        <div className={`relative h-1.5 rounded ${BAR[category]} opacity-35`} style={{ width: `${share.returnedShare ?? 0}%` }}>
                          <div className={`absolute inset-y-0 left-0 rounded ${BAR[category]}`} style={{ width: share.returnedShare ? `${Math.min(100, ((share.chosenShare ?? 0) / share.returnedShare) * 100)}%` : '0%' }} />
                        </div>
                      </div>
                    </th>
                    <td className="pt-3 text-right align-top text-white">{formatShare(share.returnedShare)}</td>
                    <td className="pt-3 text-right align-top text-white">{tracked ? formatShare(share.chosenShare) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-tertiary">
            Returned: share of searches with at least one result in the category. Chosen: share where the player opened one
            {tracked && results.openedNothingShare !== null ? `; ${formatShare(results.openedNothingShare)} opened nothing` : ''}.
            Only the category is recorded, never which result.
            {!tracked && ' Chosen starts counting with new searches.'}
          </p>
        </div>
      )}
    </AdminPanel>
  );
}
