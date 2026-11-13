/**
 * Scheduled-match executor shared by the placement modes (KotH, Grand Melee).
 *
 * MEMORY OPTIMIZATION STRATEGY:
 * - Process matches one at a time (no batch loading)
 * - Short pause (500ms) between each match for event loop
 * - Medium pause (5s) every 10 matches for GC opportunity
 * - Long pause (30s) every 20 matches to force memory reclamation
 *
 * For 200 matches on 2GB RAM VPS:
 * - 10 super-batches of 20 matches each
 * - ~5 minutes of GC pauses total
 * - Peak memory should stay under 500MB
 *
 * The pauses are 0 outside production. A Thin_Instance bye resolves without
 * combat (Spec #49); a failed match is cancelled through the shared failure
 * policy (rule 7) and the run carries on.
 *
 * @module services/battle/placementMatchExecutor
 */

import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { resolvePlacementBye } from '../scheduling/thinInstanceByes';
import { handleMatchFailure } from './matchFailurePolicy';
import type { PlacementMode } from './placementBattleSteps';

/** Yield the event loop so Express can serve requests between heavy DB work */
const throttle = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Delay between processing each match (ms) - 0 locally, 500 on server */
const MATCH_THROTTLE_MS = process.env.NODE_ENV === 'production' ? 500 : 0;
/** Number of matches to process before a longer cooldown pause */
const BATCH_SIZE = 10;
/** Cooldown pause between batches to allow GC and free memory (ms) */
const BATCH_COOLDOWN_MS = process.env.NODE_ENV === 'production' ? 5000 : 0;
/** Number of matches before a super-batch pause for heavy GC (memory safety) */
const SUPER_BATCH_SIZE = 20;
/** Long pause between super-batches to ensure memory is reclaimed (ms) */
const SUPER_BATCH_COOLDOWN_MS = process.env.NODE_ENV === 'production' ? 30000 : 0;

/** A scheduled placement match as read from the unified scheduling table. */
export type ScheduledPlacementMatch = Prisma.ScheduledMatchGetPayload<{ include: { participants: true } }>;

/** What one processed placement match produced, for the executor's counters. */
export interface PlacementMatchOutcome<TPlacement> {
  outcome: 'fought' | 'below_minimum';
  winnerId: number | null;
  placements: TPlacement[];
  forfeitedCount: number;
}

/** Summary of a placement-mode battle execution run. */
export interface PlacementExecutionSummary<TPlacement> {
  totalMatches: number;
  successfulMatches: number;
  /**
   * Bye_Events resolved this run (Spec #49).
   *
   * A sibling of `successfulMatches`, not a subset: the four counters
   * (successful, bye, below-minimum, failed) partition `totalMatches`, so
   * `successfulMatches` keeps meaning "combat was simulated" — which is what
   * an operator reads when diagnosing a cycle. `matchResults.length`
   * therefore equals `successfulMatches + byeMatches + belowMinimumMatches`.
   */
  byeMatches: number;
  /**
   * Matches whose ready field fell below the minimum at battle time: the
   * forfeiters got a forfeit-only battle and the ready robots byes.
   */
  belowMinimumMatches: number;
  failedMatches: number;
  /** Robots placed last without fighting because they had no main weapon. */
  forfeitedRobots: number;
  totalRobotsInvolved: number;
  matchResults: Array<{
    matchId: number;
    winnerId: number | null;
    placements: TPlacement[];
  }>;
  errors: string[];
}

function fetchNextMatch(mode: PlacementMode, attempted: number[]): Promise<ScheduledPlacementMatch | null> {
  return prisma.scheduledMatch.findFirst({
    where: { matchType: mode, status: 'scheduled', id: { notIn: [...attempted] } },
    include: { participants: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Execute every scheduled match of one placement mode.
 *
 * @param opts.logTag - Log prefix, e.g. '[KotH Orchestrator]'
 * @param opts.label - Mode name in log and error lines, e.g. 'KotH'
 * @param opts.processMatch - Fights one non-bye match
 */
export async function executePlacementMatches<TPlacement>(opts: {
  mode: PlacementMode;
  logTag: string;
  label: string;
  processMatch: (match: ScheduledPlacementMatch) => Promise<PlacementMatchOutcome<TPlacement>>;
}): Promise<PlacementExecutionSummary<TPlacement>> {
  const { mode, logTag, label, processMatch } = opts;
  const totalCount = await prisma.scheduledMatch.count({ where: { matchType: mode, status: 'scheduled' } });
  logger.info(`${logTag} Found ${totalCount} ${label} matches to execute`);

  const summary: PlacementExecutionSummary<TPlacement> = {
    totalMatches: totalCount,
    successfulMatches: 0,
    byeMatches: 0,
    belowMinimumMatches: 0,
    failedMatches: 0,
    forfeitedRobots: 0,
    totalRobotsInvolved: 0,
    matchResults: [],
    errors: [],
  };

  let processed = 0;
  // In-run exclusion set: a match whose cancel write fails (handleMatchFailure
  // returns cancelled: false) stays 'scheduled' and must not be re-fetched in
  // this run.
  const attempted: number[] = [];

  // Process one match at a time: fetch → execute → release memory → repeat
  while (processed < totalCount) {
    let match = await fetchNextMatch(mode, attempted);
    if (!match) break;

    // SUPER-BATCH: Every 20 matches, take a long pause for memory reclamation
    if (processed > 0 && processed % SUPER_BATCH_SIZE === 0) {
      const memBefore = process.memoryUsage().heapUsed;
      logger.info(`${logTag} Super-batch cooldown after ${processed} matches (mem: ${Math.round(memBefore / 1024 / 1024)}MB) - waiting ${SUPER_BATCH_COOLDOWN_MS / 1000}s for GC`);

      if (global.gc) global.gc();
      await throttle(SUPER_BATCH_COOLDOWN_MS);
      if (global.gc) global.gc();

      const memAfter = process.memoryUsage().heapUsed;
      logger.info(`${logTag} Super-batch resumed (mem: ${Math.round(memAfter / 1024 / 1024)}MB, freed: ${Math.round((memBefore - memAfter) / 1024 / 1024)}MB)`);

      // Re-fetch after the pause
      match = await fetchNextMatch(mode, attempted);
      if (!match) break;
    }
    // REGULAR BATCH: Every 10 matches, short pause for GC opportunity
    else if (processed > 0 && processed % BATCH_SIZE === 0) {
      logger.info(`${logTag} Batch cooldown after ${processed} matches (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`);
      await throttle(BATCH_COOLDOWN_MS);
      if (global.gc) global.gc();
    }
    // MATCH THROTTLE: Brief pause between each match
    else if (processed > 0) {
      await throttle(MATCH_THROTTLE_MS);
    }

    const matchId = match.id;
    attempted.push(matchId);
    const participantIds = match.participants.map(p => p.participantId);
    const participantCount = participantIds.length;

    try {
      // A Thin_Instance bye resolves without combat (Spec #49). One entry
      // point, identity only. It is paid at the match tier: without it the
      // bye writer defaults to bronze and every silver+ bye was underpaid.
      if (match.isByeMatch === true) {
        await resolvePlacementBye(match.id, mode, participantIds, match.leagueType ?? undefined);
        summary.byeMatches++;
        summary.totalRobotsInvolved += participantCount;
        summary.matchResults.push({ matchId, winnerId: null, placements: [] });
        processed++;
        continue;
      }

      const result = await processMatch(match);
      if (result.outcome === 'below_minimum') summary.belowMinimumMatches++;
      else summary.successfulMatches++;
      summary.forfeitedRobots += result.forfeitedCount;
      summary.totalRobotsInvolved += participantCount;
      // Only store lightweight placement data, not the full result
      summary.matchResults.push({ matchId, winnerId: result.winnerId, placements: result.placements });
    } catch (error) {
      // Rule 7: cancel the match (no retry, no reward), log, carry on.
      summary.failedMatches++;
      const { errorSummary } = await handleMatchFailure({
        mode,
        ref: { source: 'scheduled_match', id: matchId },
        error,
        participants: participantIds,
      });
      summary.errors.push(`${label} Match ${matchId}: ${errorSummary}`);
    }

    processed++;
  }

  logger.info(`${logTag} Execution complete: ${summary.successfulMatches} successful, ${summary.byeMatches} byes, ${summary.belowMinimumMatches} below minimum, ${summary.forfeitedRobots} robots forfeited, ${summary.failedMatches} failed (mem: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB)`);
  return summary;
}
