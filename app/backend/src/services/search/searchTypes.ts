/**
 * Bounds and source types of the authenticated universal search. The result
 * contract itself is in `app/shared/types/search.ts`.
 */

import type { SearchResponse, SearchResult } from '../../shared/types';

/** Match classes are ordered from most direct to least direct. */
export const MATCH_RANK_ORDER = ['exact', 'prefix', 'substring'] as const;

export type MatchRank = (typeof MATCH_RANK_ORDER)[number];

/** Maximum query length after leading and trailing whitespace is removed. */
export const MAXIMUM_QUERY_LENGTH = 100;

/** Minimum length used by the service/client eligibility branch. */
export const MINIMUM_QUERY_LENGTH = 2;

/** Result categories a privacy-light selection may report (nothing else). */
export const SEARCH_SELECTION_CATEGORIES = ['robots', 'stables', 'guide'] as const;
export type SearchSelectionCategory = (typeof SEARCH_SELECTION_CATEGORIES)[number];

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

/**
 * Compatibility aliases for the Pascal_Snake domain names used in the feature
 * specification. Runtime code should prefer the conventional TypeScript names
 * above; the aliases keep the domain contract explicit at type boundaries.
 */
export type Search_Result = SearchResult;
export type Search_Response = SearchResponse;
export type Match_Rank = MatchRank;
