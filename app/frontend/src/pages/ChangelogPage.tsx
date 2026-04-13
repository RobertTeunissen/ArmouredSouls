import { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import {
  fetchPublishedEntries,
  type ChangelogEntry,
  type PaginatedChangelogResult,
} from '../utils/changelogApi';

const CATEGORIES = ['all', 'balance', 'feature', 'bugfix', 'economy'] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

const BADGE_COLORS: Record<string, string> = {
  balance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  feature: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  bugfix: 'bg-red-500/20 text-red-400 border-red-500/30',
  economy: 'bg-green-500/20 text-green-400 border-green-500/30',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const cat = category === 'all' ? undefined : category;
        const result: PaginatedChangelogResult = await fetchPublishedEntries(page, perPage, cat);
        if (!cancelled) {
          setEntries(result.entries);
          setTotal(result.total);
        }
      } catch {
        if (!cancelled) setError('Failed to load changelog entries. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [page, perPage, category, retryKey]);

  const totalPages = Math.ceil(total / perPage);

  const handleCategoryChange = (cat: CategoryFilter) => {
    setCategory(cat);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
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
              onClick={() => setRetryKey(k => k + 1)}
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
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold border capitalize ${BADGE_COLORS[entry.category] || ''}`}
                    >
                      {entry.category}
                    </span>
                    {entry.publishDate && (
                      <span className="text-xs text-secondary">{formatDate(entry.publishDate)}</span>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-2 rounded bg-surface border border-white/10 text-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-secondary">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-2 rounded bg-surface border border-white/10 text-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ChangelogPage;
