/**
 * Dedicated persistence boundary for Search_Analytics_Event values.
 *
 * This adapter writes only the narrow completed-search event shape. It does not
 * read raw event rows, write AuditLog entries, expose player analytics fields,
 * retry failures, or reconstruct any values from other tables.
 */

import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import type { SearchAnalyticsEventInput, SearchAnalyticsStore } from './searchAnalyticsTypes';

/**
 * Fail-open persistence failures are retained only as a bounded operational
 * status by season/cycle. No phrase, request, event id, or database error is
 * retained, and the report uses this status only to expose its typed
 * incomplete-telemetry limitation.
 */
export const MAX_TRACKED_PERSISTENCE_FAILURE_SCOPES = 256;

/**
 * Bounded process-local operational status. It contains only season/cycle
 * scope, never phrases, users, responses, or database errors. Event rows
 * remain the durable analytics record; this marker only tells the report that
 * some rows may be missing after a fail-open write.
 */
interface SearchAnalyticsFailureMarker {
  seasonNumber: number;
  cycleNumber: number;
}

const persistenceFailureScopes = new Map<string, SearchAnalyticsFailureMarker>();

export interface SearchAnalyticsFailureScope {
  seasonNumber: number;
  cycleFrom: number | null;
  cycleTo: number | null;
}

function persistenceFailureScopeKey(seasonNumber: number, cycleNumber: number): string {
  return `${seasonNumber}:${cycleNumber}`;
}

export function hasSearchAnalyticsPersistenceFailure(scope: SearchAnalyticsFailureScope): boolean {
  for (const failedScope of persistenceFailureScopes.values()) {
    if (failedScope.seasonNumber !== scope.seasonNumber) continue;
    if (scope.cycleFrom !== null && failedScope.cycleNumber < scope.cycleFrom) continue;
    if (scope.cycleTo !== null && failedScope.cycleNumber > scope.cycleTo) continue;
    return true;
  }
  return false;
}

/** Test-only reset helper; it retains no event or phrase data. */
export function clearSearchAnalyticsPersistenceFailures(): void {
  persistenceFailureScopes.clear();
}

function recordSearchAnalyticsPersistenceFailure(seasonNumber: number, cycleNumber: number): void {
  const key = persistenceFailureScopeKey(seasonNumber, cycleNumber);
  if (persistenceFailureScopes.has(key)) return;

  if (persistenceFailureScopes.size >= MAX_TRACKED_PERSISTENCE_FAILURE_SCOPES) {
    const oldestKey = persistenceFailureScopes.keys().next().value;
    if (oldestKey !== undefined) persistenceFailureScopes.delete(oldestKey);
  }

  persistenceFailureScopes.set(key, { seasonNumber, cycleNumber });
}

/**
 * A successful insert needs no event payload returned to the caller. Selecting
 * only the generated identity keeps Prisma from materializing the raw event row;
 * the identity is deliberately discarded before leaving this adapter.
 */
const SEARCH_ANALYTICS_EVENT_WRITE_SELECT = {
  id: true,
} satisfies Prisma.SearchAnalyticsEventSelect;

function toCreateInput(
  input: SearchAnalyticsEventInput,
): Prisma.SearchAnalyticsEventUncheckedCreateInput {
  return {
    seasonNumber: input.seasonNumber,
    cycleNumber: input.cycleNumber,
    userId: input.userId,
    eventTimestamp: input.eventTimestamp,
    normalizedPhrase: input.normalizedPhrase,
    robotResultCount: input.robotResultCount,
    stableResultCount: input.stableResultCount,
    guideResultCount: input.guideResultCount,
    totalResultCount: input.totalResultCount,
    noResult: input.noResult,
  };
}

/**
 * Write one server-owned Search_Analytics_Event.
 *
 * The caller supplies only an internal, already-completed event input. The
 * Prisma rejection is intentionally allowed to propagate: fail-open handling
 * and safe diagnostics belong to Search_Analytics_Service, while this adapter
 * performs one database attempt and no retry or AuditLog fallback.
 */
export async function createSearchAnalyticsEvent(
  input: SearchAnalyticsEventInput,
): Promise<void> {
  try {
    await prisma.searchAnalyticsEvent.create({
      data: toCreateInput(input),
      select: SEARCH_ANALYTICS_EVENT_WRITE_SELECT,
    });
  } catch (error) {
    recordSearchAnalyticsPersistenceFailure(input.seasonNumber, input.cycleNumber);
    throw error;
  }
}

/** Shared application adapter used by the future analytics orchestration layer. */
export const searchAnalyticsStore: SearchAnalyticsStore = {
  createEvent: createSearchAnalyticsEvent,
};

export default searchAnalyticsStore;
