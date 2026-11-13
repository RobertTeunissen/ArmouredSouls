import { api } from './api';
import type { GuideArticle, GuideSection, SearchIndexEntry } from '@shared/types';

export async function fetchGuideSections(): Promise<GuideSection[]> {
  return api.get<GuideSection[]>('/api/guide/sections');
}

export async function fetchGuideArticle(
  sectionSlug: string,
  articleSlug: string
): Promise<GuideArticle> {
  return api.get<GuideArticle>(`/api/guide/articles/${sectionSlug}/${articleSlug}`);
}

export async function fetchSearchIndex(): Promise<SearchIndexEntry[]> {
  return api.get<SearchIndexEntry[]>('/api/guide/search-index');
}
