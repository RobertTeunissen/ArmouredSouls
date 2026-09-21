import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { SearchResponse, SearchResult } from '../../utils/searchTypes';

export interface SearchResultListProps {
  /** The bounded, player-safe groups returned by the universal search endpoint. */
  results: SearchResponse;
  /** Notifies the owner that a result was activated; routing stays outside this component. */
  onSelect: (result: SearchResult) => void;
  /** Optional controlled active result index for palette-level keyboard state. */
  activeResultIndex?: number | null;
  /** Reports the flattened result index reached with pointer or Arrow-key interaction. */
  onActiveResultIndexChange?: (index: number) => void;
}

type SearchGroup = {
  category: keyof SearchResponse;
  heading: string;
  emptyMessage: string;
};

const SEARCH_GROUPS: SearchGroup[] = [
  { category: 'robots', heading: 'Robots', emptyMessage: 'No robot results.' },
  { category: 'stables', heading: 'Stables', emptyMessage: 'No stable results.' },
  { category: 'guide', heading: 'Guide articles', emptyMessage: 'No guide article results.' },
];

function getResultKey(result: SearchResult): string {
  switch (result.category) {
    case 'robots':
      return `robot-${result.id}`;
    case 'stables':
      return `stable-${result.userId}`;
    case 'guide':
      return `guide-${result.sectionSlug}-${result.articleSlug}`;
  }
}

function getResultName(result: SearchResult): string {
  switch (result.category) {
    case 'robots': {
      const subtitle = result.subtitle?.trim();
      return subtitle ? `Robot: ${result.label}, ${subtitle}` : `Robot: ${result.label}`;
    }
    case 'stables':
      return `Stable: ${result.label}`;
    case 'guide':
      return `Guide article: ${result.title}, section ${result.sectionTitle}`;
  }
}

function getResultHeading(result: SearchResult): string {
  switch (result.category) {
    case 'robots':
      return result.label;
    case 'stables':
      return result.label;
    case 'guide':
      return result.title;
  }
}

function getResultContext(result: SearchResult): string | null {
  switch (result.category) {
    case 'robots':
      return result.subtitle ?? null;
    case 'stables':
      return null;
    case 'guide':
      return result.sectionTitle;
  }
}

function flattenResults(results: SearchResponse): SearchResult[] {
  return [...results.robots, ...results.stables, ...results.guide];
}

function ResultButton({
  result,
  index,
  isActive,
  onActivate,
  onKeyDown,
  registerButton,
}: {
  result: SearchResult;
  index: number;
  isActive: boolean;
  onActivate: (result: SearchResult, index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  registerButton: (index: number, button: HTMLButtonElement | null) => void;
}): ReactNode {
  const context = getResultContext(result);

  return (
    <li
      key={getResultKey(result)}
      role="option"
      aria-selected={isActive}
      className="min-w-0"
    >
      <button
        ref={(button) => registerButton(index, button)}
        type="button"
        onClick={() => onActivate(result, index)}
        onKeyDown={(event) => onKeyDown(event, index)}
        aria-label={getResultName(result)}
        className={`flex min-h-11 min-w-11 w-full flex-col items-start justify-center gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
          isActive ? 'bg-primary/10' : ''
        }`}
      >
        <span className="min-w-0 break-words [overflow-wrap:anywhere] text-primary">{getResultHeading(result)}</span>
        {context ? (
          <span className="w-full min-w-0 break-words text-sm text-secondary [overflow-wrap:anywhere] sm:w-auto sm:max-w-[45%] sm:shrink sm:text-right">
            {context}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function SearchResultList({
  results,
  onSelect,
  activeResultIndex,
  onActiveResultIndexChange,
}: SearchResultListProps): ReactNode {
  const [uncontrolledActiveIndex, setUncontrolledActiveIndex] = useState<number | null>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const flattenedResults = flattenResults(results);
  const currentActiveIndex = activeResultIndex === undefined ? uncontrolledActiveIndex : activeResultIndex;

  const setActiveIndex = (index: number): void => {
    if (activeResultIndex === undefined) {
      setUncontrolledActiveIndex(index);
    }
    onActiveResultIndexChange?.(index);
  };

  const activateResult = (result: SearchResult, index: number): void => {
    setActiveIndex(index);
    onSelect(result);
  };

  const handleResultKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const result = flattenedResults[index];
      if (result) activateResult(result, index);
      return;
    }

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    if (flattenedResults.length === 0) return;

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + direction + flattenedResults.length) % flattenedResults.length;
    setActiveIndex(nextIndex);
    buttonRefs.current[nextIndex]?.focus();
  };

  const registerButton = (index: number, button: HTMLButtonElement | null): void => {
    buttonRefs.current[index] = button;
  };

  return (
    <div
      role="listbox"
      aria-label="Search results"
      aria-orientation="vertical"
      className="w-full min-w-0 space-y-5"
    >
      {SEARCH_GROUPS.map(({ category, heading, emptyMessage }) => {
        const groupResults = results[category];
        const headingId = `search-results-${category}`;

        return (
          <section key={category} role="group" aria-labelledby={headingId} className="min-w-0">
            <h3 id={headingId} className="mb-2 break-words text-sm font-semibold tracking-wide text-primary">
              {heading}
            </h3>
            {groupResults.length > 0 ? (
              <ul aria-label={`${heading} search results`} className="min-w-0 space-y-1">
                {groupResults.map((result) => {
                  const index = flattenedResults.indexOf(result);
                  return (
                    <ResultButton
                      key={getResultKey(result)}
                      result={result}
                      index={index}
                      isActive={currentActiveIndex === index}
                      onActivate={activateResult}
                      onKeyDown={handleResultKeyDown}
                      registerButton={registerButton}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-secondary" role="status">
                {emptyMessage}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default SearchResultList;
