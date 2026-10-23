/**
 * Privacy-light search selection tracking.
 *
 * When a player opens a search result, the palette reports only the result's
 * CATEGORY. This service attaches it to that player's most recent
 * Search_Analytics_Event of the active season within the last 60 seconds that
 * has no selection yet. No result id, label, position or route is accepted or
 * stored, and nothing is returned to the player.
 *
 * Telemetry is fail-open: a missing event is a no-op and a failure is logged
 * without phrases or results; neither affects the player's navigation.
 */
import { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { getCurrentSeason } from '../season/seasonService';
import type { SearchSelectionCategory } from './searchTypes';

/** A selection attaches only to a search made this recently. */
export const SEARCH_SELECTION_WINDOW_MS = 60_000;

export type SearchSelectionOutcome = 'attached' | 'no_recent_search' | 'failed';

/**
 * Attach a selected category to the player's latest recent search. One
 * parameterized UPDATE; never throws.
 */
export async function recordSearchSelection(
  userId: number,
  category: SearchSelectionCategory,
  now: Date = new Date(),
): Promise<SearchSelectionOutcome> {
  try {
    const season = await getCurrentSeason();
    const since = new Date(now.getTime() - SEARCH_SELECTION_WINDOW_MS);
    // The outer `"selected_category" IS NULL` is deliberate: when two
    // selections race, both subqueries can pick the same event. The second
    // writer waits on the row lock, re-evaluates the outer predicate against
    // the committed row (READ COMMITTED) and updates nothing, so an existing
    // selection is never replaced.
    const updated = await prisma.$executeRaw(Prisma.sql`
      UPDATE "search_analytics_events"
      SET "selected_category" = ${category}, "selected_at" = ${now}
      WHERE "selected_category" IS NULL
        AND "id" = (
        SELECT "id" FROM "search_analytics_events"
        WHERE "user_id" = ${userId}
          AND "season_number" = ${season.seasonNumber}
          AND "event_timestamp" >= ${since}
          AND "event_timestamp" <= ${now}
          AND "selection_tracked" = TRUE
          AND "selected_category" IS NULL
        ORDER BY "event_timestamp" DESC, "id" DESC
        LIMIT 1
      )
    `);
    return updated > 0 ? 'attached' : 'no_recent_search';
  } catch (error) {
    logger.warn('[SearchAnalytics] selection not recorded', {
      operation: 'search_selection',
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return 'failed';
  }
}
