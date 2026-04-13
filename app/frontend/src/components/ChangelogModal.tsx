import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUnreadEntries, dismissChangelog, type ChangelogEntry } from '../utils/changelogApi';

const MAX_ENTRIES = 10;

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

function ChangelogModal() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const unread = await fetchUnreadEntries();
        if (!cancelled && unread.length > 0) {
          setTotalCount(unread.length);
          setEntries(unread.slice(0, MAX_ENTRIES));
          setVisible(true);
        }
      } catch {
        // Silently fail — dashboard still loads
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleDismiss = async () => {
    setVisible(false);
    try {
      await dismissChangelog();
    } catch {
      // Silently fail
    }
  };

  const handleViewAll = () => {
    setVisible(false);
    navigate('/changelog');
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60"
      data-testid="changelog-modal"
    >
      <div className="bg-surface-elevated border border-white/10 rounded-lg w-full h-full md:h-auto md:max-h-[85vh] md:max-w-2xl md:mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h2 className="text-xl font-bold text-white">📰 What&apos;s New</h2>
          <button
            onClick={handleDismiss}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss changelog"
            data-testid="changelog-dismiss"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="bg-surface border border-white/10 rounded-lg p-4"
              data-testid="changelog-modal-entry"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold border capitalize ${BADGE_COLORS[entry.category] || ''}`}
                  data-testid="changelog-category-badge"
                >
                  {entry.category}
                </span>
                {entry.publishDate && (
                  <span className="text-xs text-secondary" data-testid="changelog-publish-date">
                    {formatDate(entry.publishDate)}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1" data-testid="changelog-entry-title">
                {entry.title}
              </h3>
              <p className="text-sm text-secondary whitespace-pre-wrap" data-testid="changelog-entry-body">
                {entry.body}
              </p>
              {entry.imageUrl && (
                <img
                  src={entry.imageUrl}
                  alt={entry.title}
                  className="mt-2 rounded-lg w-full max-h-60 object-contain"
                  data-testid="changelog-entry-image"
                />
              )}
            </article>
          ))}

          {totalCount > MAX_ENTRIES && (
            <p className="text-center text-sm text-secondary" data-testid="changelog-overflow-message">
              {totalCount - MAX_ENTRIES} more update{totalCount - MAX_ENTRIES !== 1 ? 's' : ''} available on the changelog page.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 shrink-0">
          <button
            onClick={handleViewAll}
            className="min-w-[44px] min-h-[44px] px-4 py-2 text-primary hover:text-white transition-colors font-semibold text-sm"
            data-testid="changelog-view-all"
          >
            View all updates
          </button>
          <button
            onClick={handleDismiss}
            className="min-w-[44px] min-h-[44px] px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangelogModal;
