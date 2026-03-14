import React from 'react';

export interface SearchResult {
  slug: string;
  title: string;
  sectionSlug: string;
  sectionTitle: string;
  description: string;
  matchType: 'title' | 'section' | 'body';
}

interface GuideSearchResultsProps {
  results: SearchResult[];
  query: string;
  onSelect: (sectionSlug: string, articleSlug: string) => void;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/30 text-white rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const GuideSearchResults: React.FC<GuideSearchResultsProps> = ({ results, query, onSelect }) => {
  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-secondary">
        <p className="mb-2">No results found for "{query}"</p>
        <p className="text-sm">Try browsing sections from the navigation menu.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-700 max-h-80 overflow-y-auto" role="listbox">
      {results.map((result) => (
        <li key={`${result.sectionSlug}/${result.slug}`}>
          <button
            className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
            onClick={() => onSelect(result.sectionSlug, result.slug)}
            role="option"
            aria-selected={false}
          >
            <div className="text-sm font-medium text-white">
              {highlightMatch(result.title, query)}
            </div>
            <div className="text-xs text-tertiary mt-0.5">
              {highlightMatch(result.sectionTitle, query)}
            </div>
            <div className="text-xs text-tertiary mt-0.5 truncate">
              {result.description}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
};

export default GuideSearchResults;
