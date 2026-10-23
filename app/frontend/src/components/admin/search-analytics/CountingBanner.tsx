/**
 * Explains how searches are counted and switches between settled searches
 * and every recorded request.
 */
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import type { AdminSearchAnalyticsCountMode, AdminSearchAnalyticsReport } from '../../../utils/adminSearchAnalyticsApi';
import { formatCount } from '../../../utils/adminDashboardFormat';

export interface CountingBannerProps {
  report: AdminSearchAnalyticsReport | null;
  mode: AdminSearchAnalyticsCountMode;
  onModeChange: (mode: AdminSearchAnalyticsCountMode) => void;
}

function Message({ report, mode }: { report: AdminSearchAnalyticsReport; mode: AdminSearchAnalyticsCountMode }): ReactNode {
  const { totalSearches, rawRequests } = report.overview;
  if (mode === 'all') {
    return (
      <>
        Counting <span className="font-semibold">every request</span>: {formatCount(rawRequests)}.{' '}
        <span className="text-secondary">Includes half-typed phrases; switch to Settled for what players searched for.</span>
      </>
    );
  }
  const dropped = rawRequests - totalSearches;
  return (
    <>
      Counting <span className="font-semibold">settled searches</span>: {formatCount(totalSearches)} of {formatCount(rawRequests)} requests.{' '}
      <span className="text-secondary">
        {dropped > 0
          ? `The other ${formatCount(dropped)} were typing in progress (a longer phrase followed within 5 s).`
          : 'No requests were typing in progress.'}
      </span>
    </>
  );
}

export function CountingBanner({ report, mode, onModeChange }: CountingBannerProps): ReactNode {
  return (
    <section
      aria-label="How searches are counted"
      className="flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-white sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{report ? <Message report={report} mode={mode} /> : 'Counting settled searches…'}</p>
      <div role="group" aria-label="Count" className="flex shrink-0 self-start sm:self-auto rounded-md border border-white/10 bg-background p-0.5">
        {(['settled', 'all'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => onModeChange(option)}
            className={`min-h-11 rounded px-3 text-xs font-medium ${ADMIN_FOCUS_RING} ${mode === option ? 'bg-surface-elevated text-white' : 'text-secondary hover:text-white'}`}
          >
            {option === 'settled' ? 'Settled' : 'All requests'}
          </button>
        ))}
      </div>
    </section>
  );
}
