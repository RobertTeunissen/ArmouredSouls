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
 * Fail-open persistence failures are retained in a dedicated active-season
 * status table by season/cycle. No phrase, request, event id, user, or database
 * error is retained, and Season_Rollover purges the status with the event rows.
 */
export interface SearchAnalyticsFailureScope {
  seasonNumber: number;
  cycleFrom: number | null;
  cycleTo: number | null;
}

/**
 * Read the durable, active-season failure marker without retaining phrases,
 * users, responses, errors, or an unbounded process-local history. The unique
 * season/cycle constraint and Season_Rollover purge bound this table to the
 * current season's cycle range.
 */
export async function hasSearchAnalyticsPersistenceFailure(
  scope: SearchAnalyticsFailureScope,
): Promise<boolean> {
  const marker = await prisma.searchAnalyticsFailure.findFirst({
    where: {
      seasonNumber: scope.seasonNumber,
      ...(scope.cycleFrom !== null || scope.cycleTo !== null
        ? {
            cycleNumber: {
              ...(scope.cycleFrom !== null ? { gte: scope.cycleFrom } : {}),
              ...(scope.cycleTo !== null ? { lte: scope.cycleTo } : {}),
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return marker !== null;
}

/** Test-only reset helper; it retains no event or phrase data. */
export async function clearSearchAnalyticsPersistenceFailures(): Promise<void> {
  await prisma.searchAnalyticsFailure.deleteMany({});
}

async function recordSearchAnalyticsPersistenceFailure(
  seasonNumber: number,
  cycleNumber: number,
): Promise<void> {
  await prisma.searchAnalyticsFailure.upsert({
    where: {
      seasonNumber_cycleNumber: { seasonNumber, cycleNumber },
    },
    create: { seasonNumber, cycleNumber },
    update: {},
    select: { id: true },
  });
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
    try {
      await recordSearchAnalyticsPersistenceFailure(input.seasonNumber, input.cycleNumber);
    } catch {
      // The marker is best-effort and contains no phrase or player data. The
      // original event failure remains the single failed event attempt.
    }
    throw error;
  }
}

/** Shared application adapter used by the future analytics orchestration layer. */
export const searchAnalyticsStore: SearchAnalyticsStore = {
  createEvent: createSearchAnalyticsEvent,
};

export default searchAnalyticsStore;
