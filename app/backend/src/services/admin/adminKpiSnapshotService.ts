/**
 * Admin KPI snapshots — one row per competitive settlement.
 *
 * The dashboard compares today's active/inactive human-player counts with the
 * counts of about seven days ago. `users.last_login_at` only stores the latest
 * login, so the past counts have to be captured when they are current.
 *
 * Lookups go by `created_at`, never by cycle number: the global cycle counter
 * restarts at 0 every season, and the table survives Season_Rollover.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { countHumanPlayerActivity } from './adminPlayerActivityService';
import { PLAYER_ACTIVITY_WINDOW_MS } from './adminThresholds';

/** How far a snapshot may sit from exactly "7 days ago" and still be used. */
const LOOKUP_TOLERANCE_AFTER_MS = 60 * 60 * 1000; // 1 h newer than 7 days ago
const LOOKUP_TOLERANCE_BEFORE_MS = 24 * 60 * 60 * 1000; // up to 8 days ago

export interface PreviousKpiSnapshot {
  activePlayers7d: number;
  inactivePlayers3d: number;
  capturedAt: Date;
}

/**
 * Capture the current counts for a closed cycle. Idempotent per
 * `(seasonNumber, cycleNumber)`: a resumed settlement overwrites its own row.
 */
export async function recordKpiSnapshot(
  seasonNumber: number,
  cycleNumber: number,
  now: Date = new Date(),
): Promise<void> {
  const counts = await countHumanPlayerActivity(now);
  const data = {
    humanPlayers: counts.total,
    activePlayers7d: counts.active7d,
    inactivePlayers3d: counts.inactive3d,
  };
  await prisma.adminKpiSnapshot.upsert({
    where: { seasonNumber_cycleNumber: { seasonNumber, cycleNumber } },
    create: { seasonNumber, cycleNumber, ...data, createdAt: now },
    update: { ...data, createdAt: now },
  });
}

/**
 * Settlement wrapper: never throws. A failed snapshot only costs one day of
 * trend data, so it must not fail or block the cycle close.
 */
export async function recordKpiSnapshotNonFatal(seasonNumber: number, cycleNumber: number): Promise<void> {
  try {
    await recordKpiSnapshot(seasonNumber, cycleNumber);
  } catch (error) {
    logger.error(
      `Admin KPI snapshot for season ${seasonNumber} cycle ${cycleNumber} failed — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** The snapshot closest to (but not much newer than) seven days ago, or null. */
export async function findPreviousKpiSnapshot(now: Date = new Date()): Promise<PreviousKpiSnapshot | null> {
  const target = now.getTime() - PLAYER_ACTIVITY_WINDOW_MS;
  const row = await prisma.adminKpiSnapshot.findFirst({
    where: {
      createdAt: {
        lte: new Date(target + LOOKUP_TOLERANCE_AFTER_MS),
        gte: new Date(target - LOOKUP_TOLERANCE_BEFORE_MS),
      },
    },
    orderBy: { createdAt: 'desc' },
    select: { activePlayers7d: true, inactivePlayers3d: true, createdAt: true },
  });
  if (!row) return null;
  return { activePlayers7d: row.activePlayers7d, inactivePlayers3d: row.inactivePlayers3d, capturedAt: row.createdAt };
}
