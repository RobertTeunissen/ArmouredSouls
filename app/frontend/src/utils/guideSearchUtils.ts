import { SearchIndexEntry } from './guideApi';
import { SearchResult } from '../components/guide/GuideSearchResults';

export function filterAndRankResults(
  entries: SearchIndexEntry[],
  query: string
): SearchResult[] {
  if (query.length < 2) return [];

  const lowerQuery = query.toLowerCase();
  const titleMatches: SearchResult[] = [];
  const sectionMatches: SearchResult[] = [];
  const bodyMatches: SearchResult[] = [];

  for (const entry of entries) {
    const titleMatch = entry.title.toLowerCase().includes(lowerQuery);
    const sectionMatch = entry.sectionTitle.toLowerCase().includes(lowerQuery);
    const bodyMatch = entry.bodyText.toLowerCase().includes(lowerQuery);

    if (titleMatch) {
      titleMatches.push({
        slug: entry.slug,
        title: entry.title,
        sectionSlug: entry.sectionSlug,
        sectionTitle: entry.sectionTitle,
        description: entry.description,
        matchType: 'title',
      });
    } else if (sectionMatch) {
      sectionMatches.push({
        slug: entry.slug,
        title: entry.title,
        sectionSlug: entry.sectionSlug,
        sectionTitle: entry.sectionTitle,
        description: entry.description,
        matchType: 'section',
      });
    } else if (bodyMatch) {
      bodyMatches.push({
        slug: entry.slug,
        title: entry.title,
        sectionSlug: entry.sectionSlug,
        sectionTitle: entry.sectionTitle,
        description: entry.description,
        matchType: 'body',
      });
    }
  }

  return [...titleMatches, ...sectionMatches, ...bodyMatches];
}
