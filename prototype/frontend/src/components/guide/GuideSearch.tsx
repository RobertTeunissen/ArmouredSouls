import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchIndexEntry, fetchSearchIndex } from '../../utils/guideApi';
import GuideSearchResults from './GuideSearchResults';
import { filterAndRankResults } from '../../utils/guideSearchUtils';

interface GuideSearchProps {
  onResultSelect?: (sectionSlug: string, articleSlug: string) => void;
}

const GuideSearch: React.FC<GuideSearchProps> = ({ onResultSelect }) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadSearchIndex = useCallback(async (): Promise<void> => {
    if (searchIndex !== null || indexError) return;
    try {
      const data = await fetchSearchIndex();
      setSearchIndex(data);
    } catch {
      setIndexError(true);
    }
  }, [searchIndex, indexError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 200);
  };

  const handleFocus = (): void => {
    loadSearchIndex();
    setShowResults(true);
  };

  const handleSelect = (sectionSlug: string, articleSlug: string): void => {
    setShowResults(false);
    setQuery('');
    setDebouncedQuery('');
    onResultSelect?.(sectionSlug, articleSlug);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const results = searchIndex ? filterAndRankResults(searchIndex, debouncedQuery) : [];

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={indexError ? 'Search unavailable' : 'Search guide...'}
          disabled={indexError}
          className={`w-full px-4 py-2 pl-9 rounded-lg text-sm transition-colors ${
            indexError
              ? 'bg-surface text-tertiary cursor-not-allowed border border-white/10'
              : 'bg-surface text-white border border-white/10 focus:border-primary focus:outline-none'
          }`}
          aria-label="Search guide"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-sm">
          🔍
        </span>
      </div>

      {showResults && debouncedQuery.length >= 2 && searchIndex && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-elevated border border-white/10 rounded-lg shadow-xl z-30">
          <GuideSearchResults
            results={results}
            query={debouncedQuery}
            onSelect={handleSelect}
          />
        </div>
      )}
    </div>
  );
};

export default GuideSearch;
