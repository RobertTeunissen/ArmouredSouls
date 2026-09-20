import type { AdminSearchAnalyticsPhraseSummary } from '../../../utils/adminSearchAnalyticsApi';

interface SearchAnalyticsPhraseListProps {
  title: string;
  phrases: AdminSearchAnalyticsPhraseSummary[];
  emptyMessage: string;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function SearchAnalyticsPhraseList({
  title,
  phrases,
  emptyMessage,
}: SearchAnalyticsPhraseListProps): React.ReactElement {
  return (
    <section className="rounded-lg bg-surface p-4 sm:p-6" aria-labelledby={`${title}-heading`}>
      <h3 id={`${title}-heading`} className="text-lg font-semibold text-white">{title}</h3>
      {phrases.length === 0 ? (
        <p className="mt-3 text-sm text-secondary">{emptyMessage}</p>
      ) : (
        <ol className="mt-3 divide-y divide-white/5" aria-label={`${title} list`}>
          {phrases.map((entry) => (
            <li key={`${entry.phrase}-${entry.count}`} className="flex min-w-0 items-center justify-between gap-4 py-3">
              <span className="min-w-0 break-words text-sm text-white">{entry.phrase}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-secondary">{formatCount(entry.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
