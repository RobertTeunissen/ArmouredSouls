import { Suspense, useCallback, useEffect } from 'react';
import type { ReactElement } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import AppErrorBoundary from '../AppErrorBoundary';
import Navigation from '../Navigation';
import SearchPalette from '../search/SearchPalette';
import SearchResultList from '../search/SearchResultList';
import useSearchPalette from '../search/useSearchPalette';
import { buildSearchResultRoute } from '../../utils/searchRoutes';
import type { SearchResult } from '../../utils/searchTypes';

function PageLoader(): ReactElement {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-background text-white">
      <div className="text-secondary">Loading...</div>
    </div>
  );
}

function PlayerNotFound(): ReactElement {
  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-background px-4 text-white">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-primary">Page not found</h1>
        <p className="mt-2 text-secondary">The page you requested does not exist.</p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-surface transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}

/**
 * Shared authenticated player layout. It owns the only player Navigation and
 * SearchPalette instances, so page content can load or fail without removing
 * the global header and search entry point.
 */
function PlayerShell(): ReactElement {
  const navigate = useNavigate();
  const searchPalette = useSearchPalette();
  const { openSearch, selectResult } = searchPalette;

  const handleOpenSearch = useCallback((): void => {
    openSearch();
  }, [openSearch]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent): void => {
      if (searchPalette.isOpen || event.key.toLowerCase() !== 'k' || (!event.ctrlKey && !event.metaKey)) {
        return;
      }

      event.preventDefault();
      openSearch(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    };

    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, [openSearch, searchPalette.isOpen]);

  const handleResultSelect = useCallback((result: SearchResult): void => {
    const route = buildSearchResultRoute(result);
    if (route === null) return;

    selectResult(result);
    navigate(route);
  }, [navigate, selectResult]);

  return (
    <>
      <Navigation onOpenSearch={handleOpenSearch} />
      <SearchPalette
        isOpen={searchPalette.isOpen}
        query={searchPalette.query}
        state={searchPalette.state}
        onQueryChange={searchPalette.onQueryChange}
        onSubmit={searchPalette.submitQuery}
        onClose={searchPalette.closeSearch}
        onRetry={searchPalette.retry}
        errorMessage={searchPalette.errorMessage}
        recentSearches={searchPalette.history}
        onSelectRecentSearch={searchPalette.selectRecentSearch}
        onClearHistory={searchPalette.clearHistory}
        inputRef={searchPalette.inputRef}
        dialogRef={searchPalette.dialogRef}
        onDialogKeyDown={searchPalette.handleDialogKeyDown}
        resultContent={searchPalette.response ? (
          <SearchResultList
            results={searchPalette.response}
            onSelect={handleResultSelect}
            activeResultIndex={searchPalette.activeResultIndex}
            onActiveResultIndexChange={searchPalette.onActiveResultIndexChange}
          />
        ) : undefined}
      />
      <AppErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </AppErrorBoundary>
    </>
  );
}

export { PlayerNotFound };
export default PlayerShell;
