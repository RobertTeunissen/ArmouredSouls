/**
 * Phrase table: All / No results tabs, a phrase filter, Export CSV, and per
 * phrase the searches, share, no-result rate, returned categories and the
 * mostly chosen category. Below `md` a Volume / Quality toggle switches
 * column sets instead of scrolling sideways.
 */
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { AdminPanel, ADMIN_FOCUS_RING } from '../shared';
import type {
  AdminSearchAnalyticsPhrasePage,
  AdminSearchAnalyticsPhraseRow,
  AdminSearchResultCategory,
} from '../../../utils/adminSearchAnalyticsApi';
import { formatCount } from '../../../utils/adminDashboardFormat';
import { CATEGORY_LABELS, CATEGORY_SINGULAR, type PhraseTab } from '../../../utils/adminSearchAnalyticsFormat';
import { SearchAnalyticsPagination } from './SearchAnalyticsPagination';

export interface PhraseTableProps {
  page: AdminSearchAnalyticsPhrasePage | null;
  loading: boolean;
  error: string | null;
  tab: PhraseTab;
  filter: string;
  exporting: boolean;
  exportError: string | null;
  onTabChange: (tab: PhraseTab) => void;
  onFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onExport: () => void;
  onRetry?: () => void;
}

type ColumnSet = 'volume' | 'quality';

const CHIP: Readonly<Record<AdminSearchResultCategory, { letter: string; on: string }>> = {
  robots: { letter: 'R', on: 'bg-primary/20 text-primary' },
  stables: { letter: 'S', on: 'bg-info/20 text-info' },
  guide: { letter: 'G', on: 'bg-success/20 text-success' },
};
const CATEGORIES: readonly AdminSearchResultCategory[] = ['robots', 'stables', 'guide'];

function cell(set: ColumnSet, view: ColumnSet): string {
  return set === view ? 'table-cell' : 'hidden md:table-cell';
}

function Returned({ row }: { row: AdminSearchAnalyticsPhraseRow }): ReactNode {
  const returned = CATEGORIES.filter((category) => row.returned[category]);
  return (
    <>
      <span className="inline-flex gap-1" aria-hidden="true">
        {CATEGORIES.map((category) => (
          <span
            key={category}
            className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${row.returned[category] ? CHIP[category].on : 'border border-white/10 text-tertiary'}`}
          >
            {CHIP[category].letter}
          </span>
        ))}
      </span>
      <span className="sr-only">
        {returned.length === 0 ? 'No results' : returned.map((category) => CATEGORY_LABELS[category]).join(', ')}
      </span>
    </>
  );
}

function MostChosen({ row }: { row: AdminSearchAnalyticsPhraseRow }): ReactNode {
  if (row.mostChosen === null) return <span className="text-tertiary">Not tracked</span>;
  if (row.mostChosen.category === null) return <span className="text-tertiary">Nothing chosen</span>;
  return (
    <>
      {CATEGORY_SINGULAR[row.mostChosen.category]} <span className="text-tertiary">· {row.mostChosen.share.toFixed(1)}%</span>
    </>
  );
}

function noResultTone(rate: number): string {
  if (rate >= 100) return 'text-error';
  if (rate > 0) return 'text-warning';
  return 'text-tertiary';
}

export function PhraseTable({
  page,
  loading,
  error,
  tab,
  filter,
  exporting,
  exportError,
  onTabChange,
  onFilterChange,
  onPageChange,
  onExport,
  onRetry,
}: PhraseTableProps): ReactNode {
  const [view, setView] = useState<ColumnSet>('volume');
  const filterId = useId();

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Phrases to show" className="flex rounded-md border border-white/10 bg-background p-0.5">
        {(['all', 'noResult'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={tab === option}
            onClick={() => onTabChange(option)}
            className={`min-h-11 rounded px-3 text-xs font-medium ${ADMIN_FOCUS_RING} ${tab === option ? 'bg-surface-elevated text-white' : 'text-secondary hover:text-white'}`}
          >
            {option === 'all' ? 'All phrases' : 'No results'}
          </button>
        ))}
      </div>
      <label htmlFor={filterId} className="sr-only">Filter phrases</label>
      <input
        id={filterId}
        type="search"
        value={filter}
        maxLength={100}
        placeholder="Filter phrases…"
        onChange={(event) => onFilterChange(event.target.value)}
        className={`min-h-11 w-44 rounded-md border border-white/10 bg-background px-3 text-sm text-white placeholder:text-tertiary ${ADMIN_FOCUS_RING}`}
      />
      <button
        type="button"
        onClick={onExport}
        disabled={exporting}
        className={`min-h-11 rounded-md border border-white/10 bg-surface-elevated px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60 ${ADMIN_FOCUS_RING}`}
      >
        {exporting ? 'Exporting…' : 'Export CSV'}
      </button>
    </div>
  );

  return (
    <AdminPanel title="Phrases" actions={actions} loading={loading} error={error ?? exportError} onRetry={error ? onRetry : undefined} skeletonRows={8}>
      {page && (
        <>
          <div className="px-3 pt-3 md:hidden">
            <div role="group" aria-label="Columns" className="inline-flex rounded-md border border-white/10 bg-background p-0.5">
              {(['volume', 'quality'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={`min-h-11 rounded px-3 text-xs font-medium ${ADMIN_FOCUS_RING} ${view === option ? 'bg-surface-elevated text-white' : 'text-secondary'}`}
                >
                  {option === 'volume' ? 'Volume' : 'Quality'}
                </button>
              ))}
            </div>
          </div>
          {page.rows.length === 0 ? (
            <p className="p-5 text-sm text-secondary">
              {filter.trim() !== '' ? 'No phrases match the filter.' : tab === 'noResult' ? 'No searches without results in this period.' : 'No searches in this period.'}
            </p>
          ) : (
            <div className="px-3 pb-2 sm:px-5">
              <table className="w-full text-sm">
                <caption className="sr-only">{tab === 'noResult' ? 'Phrases with searches that found nothing' : 'Searched phrases'}</caption>
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-secondary whitespace-nowrap">
                    <th scope="col" className="py-3 pr-2 text-left font-semibold">Phrase</th>
                    <th scope="col" className={`py-3 pl-2 text-right font-semibold ${cell('volume', view)}`}>Searches</th>
                    <th scope="col" className={`py-3 pl-2 text-right font-semibold ${cell('volume', view)}`}>Share</th>
                    <th scope="col" className={`py-3 pl-2 text-right font-semibold ${cell('quality', view)}`}>No-result</th>
                    <th scope="col" className={`py-3 pl-3 text-left font-semibold ${cell('quality', view)}`}>Returned</th>
                    <th scope="col" className={`py-3 pl-2 text-left font-semibold ${cell('quality', view)}`}>Mostly chosen</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {page.rows.map((row) => (
                    <tr key={row.phrase} className="border-b border-white/5">
                      <th scope="row" className="wrap-anywhere py-2 pr-2 text-left font-normal text-white">
                        {row.phrase}
                      </th>
                      <td className={`py-2 pl-2 text-right text-white ${cell('volume', view)}`}>{formatCount(row.searches)}</td>
                      <td className={`py-2 pl-2 text-right text-white ${cell('volume', view)}`}>{row.share.toFixed(1)}%</td>
                      <td className={`py-2 pl-2 text-right ${noResultTone(row.noResultRate)} ${cell('quality', view)}`}>{row.noResultRate.toFixed(0)}%</td>
                      <td className={`whitespace-nowrap py-2 pl-3 ${cell('quality', view)}`}><Returned row={row} /></td>
                      <td className={`whitespace-nowrap py-2 pl-2 text-white ${cell('quality', view)}`}><MostChosen row={row} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SearchAnalyticsPagination
            page={page.page}
            total={page.total}
            limit={page.limit}
            loading={loading}
            onPageChange={onPageChange}
            itemLabel="phrases"
            label="Phrase table pagination"
          />
        </>
      )}
    </AdminPanel>
  );
}
