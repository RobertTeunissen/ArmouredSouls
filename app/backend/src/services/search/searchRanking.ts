/**
 * Pure matching, ranking, and bounding helpers for Universal Search.
 *
 * This module deliberately has no database, guide-service, or request
 * dependencies. Source adapters can rank their selected records here and
 * shape them separately through the player-safe reference builder.
 */

import {
  GuideSearchSource,
  MatchRank,
  MATCH_RANK_ORDER,
  MAX_RESULTS_PER_CATEGORY,
  RobotSearchSource,
  StableSearchSource,
} from './searchTypes';

/** A source record annotated with its best match rank. */
export interface RankedSearchSource<T> {
  source: T;
  rank: MatchRank;
}

const MATCH_RANK_INDEX: Readonly<Record<MatchRank, number>> = {
  exact: 0,
  prefix: 1,
  substring: 2,
};

/**
 * Removes only leading and trailing whitespace from a search query.
 * Internal whitespace and all other characters are preserved.
 */
export function normalizeSearchQuery(query: string): string {
  return query.trim();
}

/**
 * Classifies a case-insensitive substring match.
 *
 * Empty queries never match: otherwise JavaScript's empty-string substring
 * semantics would make every source record eligible.
 */
export function classifyMatch(query: string, searchableValue: string): MatchRank | null {
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery.length === 0) {
    return null;
  }

  const comparableQuery = normalizedQuery.toLowerCase();
  const comparableValue = searchableValue.toLowerCase();

  if (comparableValue === comparableQuery) {
    return 'exact';
  }
  if (comparableValue.startsWith(comparableQuery)) {
    return 'prefix';
  }
  if (comparableValue.includes(comparableQuery)) {
    return 'substring';
  }
  return null;
}

/**
 * Returns the strongest match rank across a set of searchable values.
 * Match_Rank order is exact, then prefix, then substring.
 */
export function getBestMatchRank(query: string, searchableValues: readonly string[]): MatchRank | null {
  let bestRank: MatchRank | null = null;
  let bestRankIndex: number = MATCH_RANK_ORDER.length;

  for (const searchableValue of searchableValues) {
    const rank = classifyMatch(query, searchableValue);
    if (rank === null) {
      continue;
    }

    const rankIndex = MATCH_RANK_INDEX[rank];
    if (rankIndex < bestRankIndex) {
      bestRank = rank;
      bestRankIndex = rankIndex;
    }
  }

  return bestRank;
}

/** Returns the best match rank from a Guide_Search_Index entry. */
export function getGuideMatchRank(query: string, guide: GuideSearchSource): MatchRank | null {
  return getBestMatchRank(query, [guide.title, guide.description, guide.bodyText]);
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareRanks(left: MatchRank, right: MatchRank): number {
  return MATCH_RANK_INDEX[left] - MATCH_RANK_INDEX[right];
}

/**
 * Sorts ranked records without mutating the input collection.
 * The supplied comparator must provide the category-specific deterministic
 * tie-break for records with the same Match_Rank.
 */
export function sortRankedSources<T>(
  rankedSources: readonly RankedSearchSource<T>[],
  compareSources: (left: T, right: T) => number,
): RankedSearchSource<T>[] {
  return [...rankedSources].sort((left, right) => {
    const rankComparison = compareRanks(left.rank, right.rank);
    return rankComparison !== 0 ? rankComparison : compareSources(left.source, right.source);
  });
}

function compareRobots(left: RobotSearchSource, right: RobotSearchSource): number {
  const nameComparison = compareStrings(left.name.toLowerCase(), right.name.toLowerCase());
  return nameComparison !== 0 ? nameComparison : left.id - right.id;
}

function getStableName(source: StableSearchSource): string {
  return source.stableName?.trim() ?? '';
}

function compareStables(left: StableSearchSource, right: StableSearchSource): number {
  const nameComparison = compareStrings(getStableName(left).toLowerCase(), getStableName(right).toLowerCase());
  return nameComparison !== 0 ? nameComparison : left.userId - right.userId;
}

function compareGuides(left: GuideSearchSource, right: GuideSearchSource): number {
  const titleComparison = compareStrings(left.title.toLowerCase(), right.title.toLowerCase());
  if (titleComparison !== 0) return titleComparison;

  const sectionComparison = compareStrings(left.sectionSlug, right.sectionSlug);
  return sectionComparison !== 0 ? sectionComparison : compareStrings(left.slug, right.slug);
}

function rankAndDedupe<T>(
  rankedSources: readonly RankedSearchSource<T>[],
  compareSources: (left: T, right: T) => number,
  identity: (source: T) => string,
): RankedSearchSource<T>[] {
  const sortedSources = sortRankedSources(rankedSources, compareSources);
  const seen = new Set<string>();
  return sortedSources.filter(({ source }) => {
    const sourceIdentity = identity(source);
    if (seen.has(sourceIdentity)) return false;
    seen.add(sourceIdentity);
    return true;
  });
}

/** Ranks robot names, using lower-case name then numeric id as the tie-break. */
export function rankRobotSources(
  query: string,
  sources: readonly RobotSearchSource[],
): RankedSearchSource<RobotSearchSource>[] {
  const ranked = sources.flatMap((source) => {
    const rank = classifyMatch(query, source.name);
    return rank === null ? [] : [{ source, rank }];
  });
  return rankAndDedupe(ranked, compareRobots, (source) => String(source.id));
}

/**
 * Ranks eligible stable names, using lower-case trimmed name then numeric
 * userId as the tie-break. Null and whitespace-only names are excluded.
 */
export function rankStableSources(
  query: string,
  sources: readonly StableSearchSource[],
): RankedSearchSource<StableSearchSource>[] {
  const ranked = sources.flatMap((source) => {
    const stableName = getStableName(source);
    if (stableName.length === 0) return [];

    const rank = classifyMatch(query, stableName);
    return rank === null ? [] : [{ source, rank }];
  });
  return rankAndDedupe(ranked, compareStables, (source) => String(source.userId));
}

/**
 * Ranks guide entries using the strongest title/description/body match, then
 * lower-case title, section slug, and article slug as deterministic tie-breaks.
 */
export function rankGuideSources(
  query: string,
  sources: readonly GuideSearchSource[],
): RankedSearchSource<GuideSearchSource>[] {
  const ranked = sources.flatMap((source) => {
    const rank = getGuideMatchRank(query, source);
    return rank === null ? [] : [{ source, rank }];
  });
  return rankAndDedupe(ranked, compareGuides, (source) => `${source.sectionSlug}/${source.slug}`);
}

/**
 * Applies the fixed Per_Category_Result_Limit after ranking and tie-breaking.
 * The optional argument is clamped so callers cannot widen the contract.
 */
export function limitCategoryResults<T>(
  rankedSources: readonly T[],
  requestedLimit: number = MAX_RESULTS_PER_CATEGORY,
): T[] {
  const safeLimit = Math.min(MAX_RESULTS_PER_CATEGORY, Math.max(0, Math.floor(requestedLimit)));
  return [...rankedSources].slice(0, safeLimit);
}
