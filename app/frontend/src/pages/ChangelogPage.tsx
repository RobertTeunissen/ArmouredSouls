import { useState } from 'react';
import { useApiQuery } from '../hooks/useApiQuery';
import {
  fetchPublishedEntries,
  type ChangelogEntry,
} from '../utils/changelogApi';
import { formatMediumDate } from '../utils/formatters';
import ChangelogCategoryBadge from '../components/changelog/ChangelogCategoryBadge';
import ChangelogPager from '../components/changelog/ChangelogPager';

const CATEGORIES = ['all', 'balance', 'feature', 'bugfix', 'economy'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];



function ChangelogPage() {
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [category, setCategory] = useState<CategoryFilter>('all');
  const query = useApiQuery(
    () => fetchPublishedEntries(page, perPage, category === 'all' ? undefined : category),
    [page, perPage, category],
  );
  const entries: ChangelogEntry[] = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const loading = query.loading;
  const error = query.error ? 'Failed to load changelog entries. Please try again.' : null;

  const totalPages = Math.ceil(total / perPage);

  const handleCategoryChange = (cat: CategoryFilter) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">📰 What&apos;s New</h1>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Category filters">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                category === cat
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-white/10 text-secondary hover:text-white hover:border-white/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-secondary">Loading...</div>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-secondary mb-4">{error}</p>
            <button
              onClick={query.refetch}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-20 text-secondary">
            No changelog entries found.
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <>
            <div className="space-y-4">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="bg-surface border border-white/10 rounded-lg p-4 sm:p-6"
                  data-testid="changelog-entry"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <ChangelogCategoryBadge category={entry.category} />
                    {entry.publishDate && (
                      <span className="text-xs text-secondary">{formatMediumDate(entry.publishDate)}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-white mb-2">{entry.title}</h2>
                  <p className="text-secondary whitespace-pre-wrap">{entry.body}</p>
                  {entry.imageUrl && (
                    <img
                      src={entry.imageUrl}
                      alt={entry.title}
                      className="mt-3 rounded-lg w-full max-h-80 object-contain"
                    />
                  )}
                </article>
              ))}
            </div>

            <ChangelogPager page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default ChangelogPage;
