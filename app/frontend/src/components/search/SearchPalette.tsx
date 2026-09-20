import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import SearchHistoryList from './SearchHistoryList';

/**
 * Presentation states supplied by the search palette controller.
 *
 * `closed` is accepted for compatibility with the controller state model, but
 * the palette remains unmounted while `isOpen` is false.
 */
export type SearchPaletteState =
  | 'closed'
  | 'loading'
  | 'results'
  | 'recent-history'
  | 'too-short'
  | 'empty'
  | 'error';

export interface SearchPaletteProps {
  isOpen: boolean;
  query: string;
  state: SearchPaletteState;
  onQueryChange: (query: string) => void;
  onSubmit?: () => void;
  onClose: () => void;
  onRetry?: () => void;
  errorMessage?: string | null;
  recentSearches?: string[];
  onSelectRecentSearch?: (query: string) => void;
  onClearHistory?: () => void;
  /** Content supplied by the future SearchResultList integration. */
  resultContent?: ReactNode;
  /** Children are supported as an alternative result-list composition slot. */
  children?: ReactNode;
  /** Optional replacement for the palette's built-in recent-history list. */
  historyContent?: ReactNode;
  inputRef?: RefObject<HTMLInputElement | null>;
  dialogRef?: RefObject<HTMLElement | null>;
  onDialogKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  /** Called when the query form is submitted. */
  onInputFocus?: () => void;
  /** Called after an open palette transitions to closed, for trigger focus restoration. */
  onRestoreFocus?: () => void;
}

const SCOPE_TEXT = 'Search robots, stables, or guide articles';

function SearchStateContent({
  state,
  errorMessage,
  onRetry,
  recentSearches,
  onSelectRecentSearch,
  onClearHistory,
  resultContent,
  children,
  historyContent,
}: Pick<
  SearchPaletteProps,
  | 'state'
  | 'errorMessage'
  | 'onRetry'
  | 'recentSearches'
  | 'onSelectRecentSearch'
  | 'onClearHistory'
  | 'resultContent'
  | 'children'
  | 'historyContent'
>): ReactNode {
  if (state === 'loading') {
    return (
      <p className="break-words py-8 text-center text-secondary" role="status">
        Searching robots, stables, and guide articles…
      </p>
    );
  }

  if (state === 'results') {
    return (
      <div aria-label="Search results" role="region" className="min-w-0">
        {resultContent ?? children ?? (
          <p className="py-8 text-center text-secondary" role="status">
            Search results will appear here.
          </p>
        )}
      </div>
    );
  }

  if (state === 'recent-history') {
    return historyContent ?? (
      <SearchHistoryList
        searches={recentSearches ?? []}
        onSelect={onSelectRecentSearch ?? (() => undefined)}
        onClear={onClearHistory ?? (() => undefined)}
      />
    );
  }

  if (state === 'too-short') {
    return (
      <p className="break-words py-8 text-center text-secondary" role="status">
        Type at least 2 characters to search.
      </p>
    );
  }

  if (state === 'empty') {
    return (
      <p className="break-words py-8 text-center text-secondary" role="status">
        No matches found in robots, stables, or guide articles.
      </p>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center" role="alert">
        <p className="break-words text-secondary">{errorMessage || 'Search is unavailable. Please try again.'}</p>
        <button
          type="button"
          onClick={() => onRetry?.()}
          className="min-h-11 min-w-11 rounded-md bg-primary px-4 py-2 font-medium text-surface transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Retry search
        </button>
      </div>
    );
  }

  return null;
}

/**
 * Search-only dialog shell. Search execution, ranking, result navigation, and
 * debounce behavior are intentionally supplied by the surrounding controller.
 */
export function SearchPalette({
  isOpen,
  query,
  state,
  onQueryChange,
  onSubmit,
  onClose,
  onRetry,
  errorMessage,
  recentSearches = [],
  onSelectRecentSearch,
  onClearHistory,
  resultContent,
  children,
  historyContent,
  inputRef,
  dialogRef,
  onDialogKeyDown,
  onInputFocus,
  onRestoreFocus,
}: SearchPaletteProps): ReactNode {
  const generatedInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = inputRef ?? generatedInputRef;
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      searchInputRef.current?.focus();
      onInputFocus?.();
    }

    if (!isOpen && wasOpenRef.current) {
      onRestoreFocus?.();
    }

    wasOpenRef.current = isOpen;
  }, [isOpen, onInputFocus, onRestoreFocus, searchInputRef]);

  if (!isOpen || state === 'closed') return null;

  return (
    <div className="fixed inset-0 z-[1100] flex w-full items-end justify-center overflow-x-hidden overflow-y-auto bg-black/70 px-0 py-2 lg:items-start lg:px-4 lg:py-16">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 h-full w-full cursor-default focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary"
        onClick={onClose}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={state === 'loading'}
        onKeyDown={(event) => {
          onDialogKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
        className="relative flex max-h-[calc(100dvh-1rem)] min-h-0 w-full min-w-0 max-w-2xl flex-col overflow-hidden overscroll-contain rounded-t-2xl border border-white/10 bg-surface shadow-2xl lg:max-h-[min(80vh,680px)] lg:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold text-primary">
              Search
            </h2>
            <p id={descriptionId} className="mt-1 break-words text-sm text-secondary">
              {SCOPE_TEXT}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 shrink-0 rounded-md text-2xl leading-none text-secondary transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Close search"
          >
            <span aria-hidden="true">×</span>
          </button>
          {recentSearches.length > 0 && state !== 'recent-history' && (
            <button
              type="button"
              onClick={onClearHistory}
              className="min-h-11 min-w-11 shrink-0 rounded-md px-3 py-2 text-sm text-secondary underline-offset-4 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Clear recent searches"
            >
              Clear history
            </button>
          )}
        </header>

        <div className="shrink-0 px-4 py-4 sm:px-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit?.();
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              {SCOPE_TEXT}
            </label>
            <input
              ref={searchInputRef}
              id={inputId}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onFocus={onInputFocus}
              autoComplete="off"
              spellCheck={false}
              placeholder="Search robots, stables, or guide articles"
              className="min-h-11 w-full min-w-0 rounded-md border border-white/15 bg-surface-elevated px-4 py-2 text-primary outline-none transition-colors placeholder:text-tertiary focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </form>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-6">
          <SearchStateContent
            state={state}
            errorMessage={errorMessage}
            onRetry={onRetry}
            recentSearches={recentSearches}
            onSelectRecentSearch={onSelectRecentSearch}
            onClearHistory={onClearHistory}
            resultContent={resultContent}
            children={children}
            historyContent={historyContent}
          />
        </div>
      </section>
    </div>
  );
}

export default SearchPalette;
