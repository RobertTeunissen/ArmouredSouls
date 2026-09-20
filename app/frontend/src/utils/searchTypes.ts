/**
 * Player-safe DTOs returned by the universal search endpoint.
 *
 * These types intentionally contain only the identity and display fields the
 * client needs to build an approved destination route. They are not full
 * robot, stable, or guide records and contain no analytics data.
 */

export type SearchCategory = 'robots' | 'stables' | 'guide';

export interface RobotSearchResult {
  category: 'robots';
  id: number;
  label: string;
  subtitle?: string;
}

export interface StableSearchResult {
  category: 'stables';
  userId: number;
  label: string;
}

export interface GuideSearchResult {
  category: 'guide';
  title: string;
  sectionTitle: string;
  sectionSlug: string;
  articleSlug: string;
}

export type SearchResult =
  | RobotSearchResult
  | StableSearchResult
  | GuideSearchResult;

export interface SearchResponse {
  robots: RobotSearchResult[];
  stables: StableSearchResult[];
  guide: GuideSearchResult[];
}
