/**
 * Wire contract for `GET /api/search`: player-safe references that carry only
 * the identity and display fields the client needs to build an approved route.
 */

export type SearchCategory = 'robots' | 'stables' | 'guide';

/** Safe robot reference returned by the player search endpoint. */
export interface RobotSearchResult {
  category: 'robots';
  id: number;
  label: string;
  subtitle?: string;
}

/** Safe stable reference returned by the player search endpoint. */
export interface StableSearchResult {
  category: 'stables';
  userId: number;
  label: string;
}

/** Safe guide reference returned by the player search endpoint. */
export interface GuideSearchResult {
  category: 'guide';
  title: string;
  sectionTitle: string;
  sectionSlug: string;
  articleSlug: string;
}

/** Discriminated player-safe result union. */
export type SearchResult = RobotSearchResult | StableSearchResult | GuideSearchResult;

/** Fixed three-group response returned by the authenticated search endpoint. */
export interface SearchResponse {
  robots: RobotSearchResult[];
  stables: StableSearchResult[];
  guide: GuideSearchResult[];
}
