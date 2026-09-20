import { getCurrentSeason } from '../season/seasonService';
import { logSearchPersistenceFailure } from './searchAnalyticsDiagnostics';
import searchAnalyticsStore from './searchAnalyticsStore';
import {
  MAXIMUM_QUERY_LENGTH,
  MINIMUM_QUERY_LENGTH,
  type SearchResponse,
} from './searchTypes';
import type {
  ActiveSeasonContext,
  SearchAnalyticsLimitation,
  SearchAnalyticsStore,
} from './searchAnalyticsTypes';
import type { SearchPersistenceFailureContext } from './searchAnalyticsDiagnostics';

/** Input assembled by the authenticated Search_Endpoint after grouped search completion. */
export interface RecordExecutedSearchInput {
  response: SearchResponse;
  normalizedPhrase: string;
  activeSeasonContext: ActiveSeasonContext;
  userId: number;
}

/** Result of the single fail-open telemetry boundary. */
export interface SearchAnalyticsRecordResult {
  /** The exact response supplied by the caller; analytics never augments it. */
  response: SearchResponse;
  /** Whether one Search_Analytics_Store write was attempted. */
  attempted: boolean;
  /** Whether the one attempted write completed successfully. */
  persisted: boolean;
  /** A typed report limitation when the one persistence attempt failed. */
  limitation: SearchAnalyticsLimitation | null;
}

export interface SearchAnalyticsServiceDependencies {
  store?: SearchAnalyticsStore;
  now?: () => Date;
  logPersistenceFailure?: (context: SearchPersistenceFailureContext) => void;
}

const INCOMPLETE_TELEMETRY_LIMITATION: SearchAnalyticsLimitation = Object.freeze({
  code: 'analyticsDataIncomplete',
  message: 'Search analytics data may be incomplete because persistence failed.',
});

function hasValidCompletedSearchContext(input: RecordExecutedSearchInput): boolean {
  const { normalizedPhrase, activeSeasonContext, userId } = input;

  return (
    Number.isSafeInteger(userId) &&
    userId > 0 &&
    Number.isSafeInteger(activeSeasonContext.seasonNumber) &&
    activeSeasonContext.seasonNumber >= 0 &&
    Number.isSafeInteger(activeSeasonContext.cycleNumber) &&
    activeSeasonContext.cycleNumber >= 0 &&
    normalizedPhrase === normalizedPhrase.trim() &&
    normalizedPhrase.length >= MINIMUM_QUERY_LENGTH &&
    normalizedPhrase.length <= MAXIMUM_QUERY_LENGTH
  );
}

function countResults(response: SearchResponse) {
  const counts = {
    robots: response.robots.length,
    stables: response.stables.length,
    guide: response.guide.length,
  };

  return {
    ...counts,
    total: counts.robots + counts.stables + counts.guide,
  };
}

function toLimitation(): SearchAnalyticsLimitation {
  return { ...INCOMPLETE_TELEMETRY_LIMITATION };
}

/**
 * Orchestrates the one-write Search_Analytics_Store boundary.
 *
 * The caller must invoke this only after SearchService has returned a complete
 * grouped response. Eligibility is checked defensively as well, so a short or
 * malformed phrase cannot create an event if a future caller bypasses the
 * route/schema boundary. Persistence is deliberately not retried: a rejected
 * store call is converted to a typed limitation and the original response is
 * returned unchanged.
 */
export class SearchAnalyticsService {
  private readonly store: SearchAnalyticsStore;
  private readonly now: () => Date;
  private readonly logPersistenceFailure: (
    context: SearchPersistenceFailureContext,
  ) => void;
  private incompleteTelemetryObserved = false;

  constructor(dependencies: SearchAnalyticsServiceDependencies = {}) {
    this.store = dependencies.store ?? searchAnalyticsStore;
    this.now = dependencies.now ?? (() => new Date());
    this.logPersistenceFailure = dependencies.logPersistenceFailure ?? logSearchPersistenceFailure;
  }

  /**
   * Capture one eligible completed search, returning the unchanged response in
   * both success and fail-open persistence paths.
   */
  async recordExecutedSearch(
    input: RecordExecutedSearchInput,
  ): Promise<SearchAnalyticsRecordResult> {
    if (!hasValidCompletedSearchContext(input)) {
      return {
        response: input.response,
        attempted: false,
        persisted: false,
        limitation: null,
      };
    }

    const counts = countResults(input.response);
    const eventTimestamp = this.now();

    try {
      await this.store.createEvent({
        userId: input.userId,
        seasonNumber: input.activeSeasonContext.seasonNumber,
        cycleNumber: input.activeSeasonContext.cycleNumber,
        eventTimestamp,
        normalizedPhrase: input.normalizedPhrase,
        robotResultCount: counts.robots,
        stableResultCount: counts.stables,
        guideResultCount: counts.guide,
        totalResultCount: counts.total,
        noResult: counts.total === 0,
      });

      return {
        response: input.response,
        attempted: true,
        persisted: true,
        limitation: null,
      };
    } catch {
      this.incompleteTelemetryObserved = true;

      try {
        this.logPersistenceFailure({
          userId: input.userId,
          eventTimestamp,
          seasonNumber: input.activeSeasonContext.seasonNumber,
          cycleNumber: input.activeSeasonContext.cycleNumber,
          resultCounts: counts,
        });
      } catch {
        // Diagnostics are deliberately best-effort and must not change the
        // successful player response or create a retry path.
      }

      return {
        response: input.response,
        attempted: true,
        persisted: false,
        limitation: toLimitation(),
      };
    }
  }

  /**
   * Expose only the typed report limitation state to the later admin report
   * service; no failed phrase, error, request, or response is retained.
   */
  getIncompleteTelemetryLimitations(): SearchAnalyticsLimitation[] {
    return this.incompleteTelemetryObserved ? [toLimitation()] : [];
  }
}

/** Resolve the active server-owned season context for the Search_Endpoint. */
export async function getActiveSearchSeasonContext(): Promise<ActiveSeasonContext> {
  const season = await getCurrentSeason();
  return {
    seasonNumber: season.seasonNumber,
    cycleNumber: season.seasonCycle,
  };
}

export const searchAnalyticsService = new SearchAnalyticsService();

export async function recordExecutedSearch(
  input: RecordExecutedSearchInput,
): Promise<SearchAnalyticsRecordResult> {
  return searchAnalyticsService.recordExecutedSearch(input);
}

export default searchAnalyticsService;
