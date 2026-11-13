/**
 * Wire contract for the in-game guide: `GET /api/guide/sections`,
 * `/api/guide/articles/:sectionSlug/:articleSlug` and `/api/guide/search-index`.
 */

/**
 * Represents a heading extracted from Markdown content.
 */
export interface ArticleHeading {
  level: number; // 2 or 3
  text: string;
  id: string; // slugified anchor
}

/**
 * Summary of a guide article for section listings.
 */
export interface GuideArticleSummary {
  slug: string;
  title: string;
  description: string;
  sectionSlug: string;
  lastUpdated: string;
}

/**
 * A guide section containing ordered article summaries.
 */
export interface GuideSection {
  slug: string;
  title: string;
  description: string;
  order: number;
  articles: GuideArticleSummary[];
}

/**
 * Link to a guide article (used for previous/next navigation).
 */
export interface GuideArticleLink {
  slug: string;
  title: string;
  sectionSlug: string;
}

/**
 * Link to a related article with section title context.
 */
export interface RelatedArticleLink extends GuideArticleLink {
  sectionTitle: string;
}

/**
 * Full guide article with body, navigation, and metadata.
 */
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

/**
 * Entry in the search index for client-side full-text search.
 */
export interface SearchIndexEntry {
  slug: string;
  title: string;
  sectionSlug: string;
  sectionTitle: string;
  description: string;
  bodyText: string;
}
