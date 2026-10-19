/**
 * Achievement counter window (issue #342).
 *
 * A few achievements count history rows in `audit_logs` (E18–E20 weapon sales,
 * E22 weapon refinements). An account reset keeps audit history — the
 * financial ledger guide requires it — so without a window, sales and
 * refinements made before the reset counted towards the fresh account and a
 * single post-reset sale could unlock several achievements at once.
 *
 * These counters therefore only count events after the user's latest
 * `reset_logs.reset_at`. Season rollover needs no special handling: it
 * truncates `audit_logs`, so an older reset timestamp filters nothing.
 *
 * Accepted edge: `reset_at` is the reset transaction's start time (Postgres
 * `now()`). A sale that committed just before the reset, but whose separately
 * written audit row lands after the transaction started, counts as
 * post-reset. That is at most one in-flight sale.
 *
 * @module services/achievement/achievementCounterWindow
 */

import prisma from '../../lib/prisma';
import { Prisma } from '../../../generated/prisma';

/**
 * Start of the user's achievement counter window: the latest account reset,
 * or `null` when the user has never reset (count all history).
 */
export async function getAchievementCounterStart(userId: number): Promise<Date | null> {
  const latest = await prisma.resetLog.findFirst({
    where: { userId },
    orderBy: { resetAt: 'desc' },
    select: { resetAt: true },
  });
  return latest?.resetAt ?? null;
}

/** `audit_logs` filter for a counter, limited to events after `since` when set. */
export function buildAuditCounterWhere(
  userId: number,
  eventType: string,
  since: Date | null,
): Prisma.AuditLogWhereInput {
  return since ? { userId, eventType, eventTimestamp: { gt: since } } : { userId, eventType };
}

/** Raw-SQL `AND` fragment limiting an `audit_logs` query to events after `since`. */
export function auditCounterSinceSql(since: Date | null): Prisma.Sql {
  return since ? Prisma.sql`AND event_timestamp > ${since}` : Prisma.empty;
}
