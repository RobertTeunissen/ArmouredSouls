import type { ReactNode } from 'react';

export interface SearchHistoryListProps {
  searches: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
}

/**
 * Renders browser-local recent searches and the only history mutation control.
 * The list intentionally has no server or analytics dependencies.
 */
function SearchHistoryList({
  searches,
  onSelect,
  onClear,
}: SearchHistoryListProps): ReactNode {
  return (
    <section aria-labelledby="recent-searches-heading" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="recent-searches-heading" className="text-sm font-semibold text-primary">
          Recent searches
        </h3>
        {searches.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 min-w-11 shrink-0 rounded-md px-3 py-2 text-sm text-secondary underline-offset-4 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Clear recent searches"
          >
            Clear history
          </button>
        )}
      </div>
      {searches.length > 0 ? (
        <ul aria-label="Recent searches" className="space-y-2">
          {searches.map((search) => (
            <li key={`${search.toLocaleLowerCase()}-${search}`}>
              <button
                type="button"
                onClick={() => onSelect(search)}
                className="min-h-11 min-w-11 w-full rounded-md border border-white/10 bg-surface-elevated px-3 py-2 text-left text-primary transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={`Use recent search ${search}`}
              >
                <span className="block min-w-0 break-words">{search}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="break-words py-8 text-center text-secondary" role="status">
          No recent searches yet.
        </p>
      )}
    </section>
  );
}

export default SearchHistoryList;
