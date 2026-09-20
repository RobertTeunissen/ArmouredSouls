import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { SearchPaletteState } from './SearchPalette';
import { search } from '../../utils/searchApi';
import {
  addRecentSearch,
  clearRecentSearches,
  normalizeRecentSearch,
  readRecentSearches,
  writeRecentSearches,
} from '../../utils/searchHistory';
import type { SearchResponse, SearchResult } from '../../utils/searchTypes';

/** The delay between the latest eligible input change and a search request. */
export const SEARCH_DEBOUNCE_MS = 200;

/** The shortest normalized query that may be sent to the Search_Endpoint. */
export const MINIMUM_QUERY_LENGTH = 2;

/** Player-safe copy used for every failed search request. */
export const SEARCH_ERROR_MESSAGE = 'Search is unavailable. Please try again.';

export interface UseSearchPaletteOptions {
  /** Called after a result is selected; route validation stays with the caller. */
  onResultSelect?: (result: SearchResult) => void;
}

export interface UseSearchPaletteResult {
  isOpen: boolean;
  query: string;
  normalizedQuery: string;
  state: SearchPaletteState;
  response: SearchResponse | null;
  /** Alias for consumers that call the grouped response `results`. */
  results: SearchResponse | null;
  errorMessage: string | null;
  activeResultIndex: number | null;
  history: string[];
  inputRef: RefObject<HTMLInputElement | null>;
  dialogRef: RefObject<HTMLElement | null>;
  openSearch: (openingControl?: HTMLElement | null) => void;
  closeSearch: () => void;
  onOpenSearch: (openingControl?: HTMLElement | null) => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  retry: () => void;
  onRetry: () => void;
  selectRecentSearch: (query: string) => void;
  onSelectRecentSearch: (query: string) => void;
  clearHistory: () => void;
  onClearHistory: () => void;
  /** Remember a submitted query without creating a network request. */
  rememberQuery: (query: string) => string[];
  /** Remember the current normalized query when a palette form is submitted. */
  submitQuery: () => void;
  /** Remember the current query and close before the optional result callback. */
  selectResult: (result: SearchResult) => void;
  setActiveResultIndex: (index: number | null) => void;
  onActiveResultIndexChange: (index: number) => void;
  /** Attach this handler to the dialog to coordinate Escape and Tab trapping. */
  handleDialogKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  onDialogKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  restoreFocus: () => void;
  onRestoreFocus: () => void;
}

function hasSearchResults(response: SearchResponse): boolean {
  return response.robots.length + response.stables.length + response.guide.length > 0;
}

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  const candidates = dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"]), summary',
  );

  return Array.from(candidates).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Controls the Search_Palette without coupling it to ranking, route building,
 * analytics, or server-side history. The request generation guard remains the
 * correctness mechanism; AbortController only avoids unnecessary work.
 */
export function useSearchPalette(
  options: UseSearchPaletteOptions = {},
): UseSearchPaletteResult {
  const { onResultSelect } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchPaletteState>('recent-history');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<string[]>(() => readRecentSearches());
  const [retryToken, setRetryToken] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const openingControlRef = useRef<HTMLElement | null>(null);
  const responseRef = useRef<SearchResponse | null>(null);
  const responseQueryRef = useRef<string | null>(null);
  const errorQueryRef = useRef<string | null>(null);
  const failedRetryTokenRef = useRef<number | null>(null);
  const historyRef = useRef(history);
  const requestGenerationRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const wasOpenRef = useRef(false);

  const normalizedQuery = query.trim();

  const cancelCurrentRequest = useCallback((): void => {
    requestGenerationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const stateForQuery = useCallback((normalized: string): SearchPaletteState => {
    if (normalized.length === 0) return 'recent-history';
    if (normalized.length < MINIMUM_QUERY_LENGTH) return 'too-short';
    if (errorQueryRef.current === normalized) return 'error';

    const currentResponse = responseRef.current;
    if (responseQueryRef.current === normalized && currentResponse !== null) {
      return hasSearchResults(currentResponse) ? 'results' : 'empty';
    }

    return 'loading';
  }, []);

  const restoreFocus = useCallback((): void => {
    const openingControl = openingControlRef.current;
    openingControlRef.current = null;

    if (openingControl && openingControl.isConnected) {
      openingControl.focus();
    }
  }, []);

  const openSearch = useCallback(
    (openingControl?: HTMLElement | null): void => {
      if (openingControl) {
        openingControlRef.current = openingControl;
      } else if (typeof document !== 'undefined') {
        const activeElement = document.activeElement;
        openingControlRef.current = activeElement instanceof HTMLElement ? activeElement : null;
      }

      setState(stateForQuery(query.trim()));
      setIsOpen(true);
    },
    [query, stateForQuery],
  );

  const closeSearch = useCallback((): void => {
    cancelCurrentRequest();
    setIsOpen(false);
    setState('closed');
  }, [cancelCurrentRequest]);

  const rememberQuery = useCallback((value: string): string[] => {
    const nextHistory = addRecentSearch(historyRef.current, value);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    writeRecentSearches(nextHistory);
    return nextHistory;
  }, []);

  const clearHistory = useCallback((): void => {
    cancelCurrentRequest();
    historyRef.current = [];
    setHistory([]);
    clearRecentSearches();
    setState('recent-history');
  }, [cancelCurrentRequest]);

  const onQueryChange = useCallback(
    (nextQuery: string): void => {
      const previousNormalizedQuery = query.trim();
      const nextNormalizedQuery = nextQuery.trim();
      const normalizedQueryChanged = nextNormalizedQuery !== previousNormalizedQuery;

      if (normalizedQueryChanged) {
        cancelCurrentRequest();
        responseRef.current = null;
        responseQueryRef.current = null;
        errorQueryRef.current = null;
        failedRetryTokenRef.current = null;
        setResponse(null);
        setErrorMessage(null);
        setActiveResultIndex(null);
        setState(stateForQuery(nextNormalizedQuery));
      }

      setQuery(nextQuery);
    },
    [cancelCurrentRequest, query, stateForQuery],
  );

  const selectRecentSearch = useCallback(
    (recentQuery: string): void => {
      const normalizedRecentQuery = normalizeRecentSearch(recentQuery);
      if (normalizedRecentQuery === null) return;
      onQueryChange(normalizedRecentQuery);
    },
    [onQueryChange],
  );

  const retry = useCallback((): void => {
    const currentNormalizedQuery = query.trim();
    if (currentNormalizedQuery.length < MINIMUM_QUERY_LENGTH) {
      setState(stateForQuery(currentNormalizedQuery));
      return;
    }

    cancelCurrentRequest();
    responseRef.current = null;
    responseQueryRef.current = null;
    errorQueryRef.current = null;
    failedRetryTokenRef.current = null;
    setResponse(null);
    setErrorMessage(null);
    setActiveResultIndex(null);
    setState('loading');
    setRetryToken((token) => token + 1);
  }, [cancelCurrentRequest, query, stateForQuery]);

  const submitQuery = useCallback((): void => {
    const currentNormalizedQuery = normalizeRecentSearch(query);
    if (
      currentNormalizedQuery === null ||
      currentNormalizedQuery.length < MINIMUM_QUERY_LENGTH
    ) {
      return;
    }

    rememberQuery(currentNormalizedQuery);
  }, [query, rememberQuery]);

  const selectResult = useCallback(
    (result: SearchResult): void => {
      submitQuery();
      closeSearch();
      onResultSelect?.(result);
    },
    [closeSearch, onResultSelect, submitQuery],
  );

  useEffect(() => {
    const generation = ++requestGenerationRef.current;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;

    if (!isOpen || normalizedQuery.length === 0 || normalizedQuery.length < MINIMUM_QUERY_LENGTH) {
      return undefined;
    }

    if (
      errorQueryRef.current === normalizedQuery &&
      failedRetryTokenRef.current === retryToken
    ) {
      setState('error');
      return undefined;
    }

    const currentResponse = responseRef.current;
    if (responseQueryRef.current === normalizedQuery && currentResponse !== null) {
      setState(hasSearchResults(currentResponse) ? 'results' : 'empty');
      return undefined;
    }

    setState('loading');
    setResponse(null);
    setErrorMessage(null);

    const timer = setTimeout((): void => {
      const controller = new AbortController();
      requestControllerRef.current = controller;

      void search(normalizedQuery, controller.signal)
        .then((nextResponse) => {
          if (controller.signal.aborted || requestGenerationRef.current !== generation) return;

          responseRef.current = nextResponse;
          responseQueryRef.current = normalizedQuery;
          errorQueryRef.current = null;
          failedRetryTokenRef.current = null;
          setResponse(nextResponse);
          setErrorMessage(null);
          setActiveResultIndex(null);
          setState(hasSearchResults(nextResponse) ? 'results' : 'empty');
        })
        .catch(() => {
          if (controller.signal.aborted || requestGenerationRef.current !== generation) return;

          responseRef.current = null;
          responseQueryRef.current = null;
          errorQueryRef.current = normalizedQuery;
          failedRetryTokenRef.current = retryToken;
          setResponse(null);
          setErrorMessage(SEARCH_ERROR_MESSAGE);
          setActiveResultIndex(null);
          setState('error');
        })
        .finally(() => {
          if (requestGenerationRef.current !== generation) return;
          if (requestControllerRef.current === controller) {
            requestControllerRef.current = null;
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
    };
  }, [isOpen, normalizedQuery, retryToken]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      inputRef.current?.focus();
    }

    if (!isOpen && wasOpenRef.current) {
      restoreFocus();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen, restoreFocus]);

  const handleDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
        return;
      }

      if (event.key !== 'Tab' || !isOpen) return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = typeof document !== 'undefined' ? document.activeElement : null;

      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    },
    [closeSearch, isOpen],
  );

  const onActiveResultIndexChange = useCallback((index: number): void => {
    setActiveResultIndex(index);
  }, []);

  return {
    isOpen,
    query,
    normalizedQuery,
    state,
    response,
    results: response,
    errorMessage,
    activeResultIndex,
    history,
    inputRef,
    dialogRef,
    openSearch,
    closeSearch,
    onOpenSearch: openSearch,
    onClose: closeSearch,
    onQueryChange,
    retry,
    onRetry: retry,
    selectRecentSearch,
    onSelectRecentSearch: selectRecentSearch,
    clearHistory,
    onClearHistory: clearHistory,
    rememberQuery,
    submitQuery,
    selectResult,
    setActiveResultIndex,
    onActiveResultIndexChange,
    handleDialogKeyDown,
    onDialogKeyDown: handleDialogKeyDown,
    restoreFocus,
    onRestoreFocus: restoreFocus,
  };
}

export default useSearchPalette;
