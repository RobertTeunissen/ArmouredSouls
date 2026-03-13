import apiClient from './apiClient';

export interface GuideArticleLink {
  slug: string;
  title: string;
  sectionSlug: string;
}

export interface RelatedArticleLink extends GuideArticleLink {
  sectionTitle: string;
}

export interface ArticleHeading {
  level: number;
  text: string;
  id: string;
}

export interface GuideArticleSummary {
  slug: string;
  title: string;
  description: string;
  sectionSlug: string;
  lastUpdated: string;
}

export interface GuideSection {
  slug: string;
  title: string;
  description: string;
  order: number;
  articles: GuideArticleSummary[];
}

export interface GuideArticle {
  slug: string;
  title: string;
  description: string;
  sectionSlug: string;
  sectionTitle: string;
  body: string;
  lastUpdated: string;
  relatedArticles: RelatedArticleLink[];
  previousArticle: GuideArticleLink | null;
  nextArticle: GuideArticleLink | null;
  headings: ArticleHeading[];
}

export interface SearchIndexEntry {
  slug: string;
  title: string;
  sectionSlug: string;
  sectionTitle: string;
  description: string;
  bodyText: string;
}

export async function fetchGuideSections(): Promise<GuideSection[]> {
  const response = await apiClient.get('/api/guide/sections');
  return response.data;
}

export async function fetchGuideArticle(
  sectionSlug: string,
  articleSlug: string
): Promise<GuideArticle> {
  const response = await apiClient.get(`/api/guide/articles/${sectionSlug}/${articleSlug}`);
  return response.data;
}

export async function fetchSearchIndex(): Promise<SearchIndexEntry[]> {
  const response = await apiClient.get('/api/guide/search-index');
  return response.data;
}
