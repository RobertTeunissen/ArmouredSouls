/**
 * Shared types and bounds for the authenticated universal-search contract.
 *
 * Search results intentionally contain only the identity and display fields
 * needed by the client to construct an approved destination route. Full source
 * records, private account fields, and arbitrary routes are not part of this
 * contract.
 */

export const SEARCH_CATEGORY_ORDER = ['robots', 'stables', 'guide'] as const;

export type SearchCategory = (typeof SEARCH_CATEGORY_ORDER)[number];

/** Match classes are ordered from most direct to least direct. */
export const MATCH_RANK_ORDER = ['exact', 'prefix', 'substring'] as const;

export type MatchRank = (typeof MATCH_RANK_ORDER)[number];

/** Maximum query length after leading and trailing whitespace is removed. */
export const MAXIMUM_QUERY_LENGTH = 100;

/** Minimum length used by the service/client eligibility branch. */
export const MINIMUM_QUERY_LENGTH = 2;

/** Maximum number of references returned in one category group. */
export const MAX_RESULTS_PER_CATEGORY = 10;

/** Maximum number of references returned across all category groups. */
export const MAX_TOTAL_RESULTS = 30;

/** Source fields selected for robot matching and safe subtitle shaping. */
export interface RobotSearchSource {
  id: number;
  name: string;
  stableName: string | null;
}

/** Source fields selected for stable matching and safe route construction. */
export interface StableSearchSource {
  userId: number;
  stableName: string | null;
}

/** Guide index fields used for matching and safe guide-reference shaping. */
export interface GuideSearchSource {
  slug: string;
  title: string;
  sectionSlug: string;
  sectionTitle: string;
  description: string;
  bodyText: string;
}

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

/**
 * Compatibility aliases for the Pascal_Snake domain names used in the feature
 * specification. Runtime code should prefer the conventional TypeScript names
 * above; the aliases keep the domain contract explicit at type boundaries.
 */
export type Search_Result = SearchResult;
export type Search_Response = SearchResponse;
export type Match_Rank = MatchRank;
