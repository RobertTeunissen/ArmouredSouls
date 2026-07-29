/**
 * Season_Service (Spec #45).
 *
 * Owns the `seasons` table and answers one question cheaply: what phase are we
 * in and how far along. The Cycle_Scheduler consults this before every
 * Battle_Event_Job and at the top of every settlement.
 *
 * Season_Number 0 is the legacy season representing the open-ended timeline
 * that ran before this system existed. The number itself is the legacy marker —
 * there is deliberately no legacy flag column.
 *
 * @module services/season/seasonService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { loadEnvConfig } from '../../config/env';
import { SeasonError, SeasonErrorCode } from '../../errors';

/** The three permitted values of `seasons.phase`. */
export type SeasonPhase = 'preparation' | 'competitive' | 'completed';

/** Everything a caller needs to know about the current season in one read. */
export interface SeasonState {
  seasonNumber: number;
  phase: SeasonPhase;
  /** 1-based cycle within the Competitive_Phase; 0 while preparing. */
  seasonCycle: number;
  seasonLengthCycles: number;
  remainingCompetitiveCycles: number;
  /** 1-based preparation day; 0 while competitive. */
  preparationDay: number;
  remainingPreparationCycles: number;
  /** True only for Season_Number 0 — derived, never stored. */
  isLegacy: boolean;
}

/** Result of advancing a competitive cycle at settlement. */
export interface CompetitiveAdvanceResult {
  seasonNumber: number;
  competitiveCyclesCompleted: number;
  /** True when the season has reached its configured length. */
  boundaryReached: boolean;
}

/** Result of advancing a preparation cycle at settlement. */
export interface PreparationAdvanceResult {
  seasonNumber: number;
  preparationCyclesCompleted: number;
  remainingPreparationCycles: number;
  transitionedToCompetitive: boolean;
}

/**
 * Season_Number 0 is reserved for the legacy season. Used by callers that must
 * exempt it from automatic rollover.
 */
export const LEGACY_SEASON_NUMBER = 0;

// ─── In-process cache ────────────────────────────────────────────────
//
// getCurrentSeason() is called on every scheduler job invocation and every
// authenticated page load. The underlying read is a single indexed lookup, so
// this cache is a courtesy rather than a necessity — but it keeps a burst of
// page loads from issuing one query each.

const CACHE_TTL_MS = 60_000;

let cachedState: { state: SeasonState; expiresAt: number } | null = null;

/** Drop the memoised season state. Called after every write. */
export function invalidateSeasonCache(): void {
  cachedState = null;
}

// ─── Derivation ──────────────────────────────────────────────────────

interface SeasonRow {
  seasonNumber: number;
  phase: string;
  competitiveCyclesCompleted: number;
  preparationCyclesCompleted: number;
  /** Admin extension for this season only; null means use the configured length. */
  lengthOverrideCycles?: number | null;
}

/**
 * Derive the full SeasonState from a stored row plus configuration.
 *
 * Season_Cycle is a pure function of the counters — never derived from
 * wall-clock time, so a restart or a clock change cannot shift it.
 */
export function deriveSeasonState(
  row: SeasonRow,
  seasonLengthCycles: number,
  preparationLengthCycles: number,
): SeasonState {
  const phase = row.phase as SeasonPhase;
  const isCompetitive = phase === 'competitive';
  const isPreparing = phase === 'preparation';

  // Season_Zero has no fixed length, so it has no meaningful remaining count.
  const isLegacy = row.seasonNumber === LEGACY_SEASON_NUMBER;

  // An admin extension lengthens this season only; the configured value stays
  // authoritative for every later season.
  const effectiveLength = row.lengthOverrideCycles ?? seasonLengthCycles;

  const remainingCompetitive = isLegacy
    ? 0
    : Math.max(0, effectiveLength - row.competitiveCyclesCompleted);

  return {
    seasonNumber: row.seasonNumber,
    phase,
    seasonCycle: isCompetitive ? row.competitiveCyclesCompleted + 1 : 0,
    seasonLengthCycles: effectiveLength,
    remainingCompetitiveCycles: isCompetitive ? remainingCompetitive : 0,
    preparationDay: isPreparing ? row.preparationCyclesCompleted + 1 : 0,
    remainingPreparationCycles: isPreparing
      ? Math.max(0, preparationLengthCycles - row.preparationCyclesCompleted)
      : 0,
    isLegacy,
  };
}

// ─── Reads ───────────────────────────────────────────────────────────

/**
 * Find the single active season row, creating Season_Zero when none exists.
 *
 * Idempotent: a concurrent caller that loses the create race falls back to the
 * row the winner inserted, because `season_number` is unique.
 */
async function getOrCreateActiveSeason() {
  const existing = await prisma.season.findFirst({
    where: { phase: { not: 'completed' } },
    orderBy: { seasonNumber: 'desc' },
  });
  if (existing) return existing;

  // Any season row at all? If seasons exist but all are completed, something
  // interrupted a rollover — surface it rather than silently creating Season 0.
  const anySeason = await prisma.season.findFirst({ orderBy: { seasonNumber: 'desc' } });
  if (anySeason) {
    throw new SeasonError(
      SeasonErrorCode.SEASON_NOT_FOUND,
      `No active season: highest season ${anySeason.seasonNumber} is already completed. A rollover may have been interrupted.`,
      500,
    );
  }

  // Fresh install or a pre-season-system database: create Season_Zero with the
  // cycle counter backfilled so its cycle number reads truthfully.
  const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  const totalCycles = cycleMetadata?.totalCycles ?? 0;

  logger.info(
    `[season] No season record found — creating Season 0 (legacy) at cycle ${totalCycles}`,
  );

  try {
    return await prisma.season.create({
      data: {
        seasonNumber: LEGACY_SEASON_NUMBER,
        phase: 'competitive',
        competitiveCyclesCompleted: totalCycles,
        preparationCyclesCompleted: 0,
        startedAt: new Date(),
      },
    });
  } catch {
    // Lost the create race — read the winner's row.
    const created = await prisma.season.findUnique({
      where: { seasonNumber: LEGACY_SEASON_NUMBER },
    });
    if (created) return created;
    throw new SeasonError(
      SeasonErrorCode.SEASON_NOT_FOUND,
      'Failed to create or read Season 0',
      500,
    );
  }
}

/** Read the current season state, creating Season_Zero on first read if needed. */
export async function getCurrentSeason(): Promise<SeasonState> {
  if (cachedState && cachedState.expiresAt > Date.now()) {
    return cachedState.state;
  }

  const config = loadEnvConfig();
  const row = await getOrCreateActiveSeason();
  const state = deriveSeasonState(row, config.seasonLengthCycles, config.preparationLengthCycles);

  cachedState = { state, expiresAt: Date.now() + CACHE_TTL_MS };
  return state;
}

/**
 * Whether Battle_Event_Jobs may run. False for the whole Preparation_Phase, so
 * no matches are scheduled and no battles are executed while players rebuild.
 */
export async function isBattleAllowed(): Promise<boolean> {
  const state = await getCurrentSeason();
  return state.phase === 'competitive';
}

// ─── Writes ──────────────────────────────────────────────────────────

/**
 * Increment the competitive cycle counter at settlement.
 *
 * Reports whether the season has reached its configured length. Season_Zero
 * never reports a boundary — it has no fixed length and closes only by an
 * explicit admin action.
 */
export async function advanceCompetitiveCycle(): Promise<CompetitiveAdvanceResult> {
  const config = loadEnvConfig();
  const row = await getOrCreateActiveSeason();

  const updated = await prisma.season.update({
    where: { id: row.id },
    data: { competitiveCyclesCompleted: { increment: 1 } },
  });
  invalidateSeasonCache();

  const isLegacy = updated.seasonNumber === LEGACY_SEASON_NUMBER;
  const effectiveLength = updated.lengthOverrideCycles ?? config.seasonLengthCycles;
  const boundaryReached =
    !isLegacy && updated.competitiveCyclesCompleted >= effectiveLength;

  return {
    seasonNumber: updated.seasonNumber,
    competitiveCyclesCompleted: updated.competitiveCyclesCompleted,
    boundaryReached,
  };
}

/**
 * Increment the preparation cycle counter at settlement, flipping to
 * `competitive` when the preparation window is exhausted.
 */
export async function advancePreparationCycle(): Promise<PreparationAdvanceResult> {
  const config = loadEnvConfig();
  const row = await getOrCreateActiveSeason();

  const nextCompleted = row.preparationCyclesCompleted + 1;
  const shouldTransition = nextCompleted >= config.preparationLengthCycles;

  const updated = await prisma.season.update({
    where: { id: row.id },
    data: shouldTransition
      ? {
          preparationCyclesCompleted: nextCompleted,
          phase: 'competitive',
          competitiveCyclesCompleted: 0,
          startedAt: new Date(),
        }
      : { preparationCyclesCompleted: nextCompleted },
  });
  invalidateSeasonCache();

  if (shouldTransition) {
    logger.info(
      `[season] Season ${updated.seasonNumber} preparation complete — entering competitive phase`,
    );
  }

  return {
    seasonNumber: updated.seasonNumber,
    preparationCyclesCompleted: updated.preparationCyclesCompleted,
    remainingPreparationCycles: Math.max(
      0,
      config.preparationLengthCycles - updated.preparationCyclesCompleted,
    ),
    transitionedToCompetitive: shouldTransition,
  };
}

/**
 * Mark the current season completed and open the next one in its
 * Preparation_Phase. Called by the Season_Rollover_Service after the purge.
 */
export async function completeSeasonAndOpenNext(
  completedSeasonNumber: number,
  generatedStableCount: number,
): Promise<number> {
  const nextNumber = completedSeasonNumber + 1;

  await prisma.$transaction(async (tx) => {
    await tx.season.update({
      where: { seasonNumber: completedSeasonNumber },
      data: { phase: 'completed', endedAt: new Date(), generatedStableCount },
    });
    await tx.season.create({
      data: {
        seasonNumber: nextNumber,
        phase: 'preparation',
        competitiveCyclesCompleted: 0,
        preparationCyclesCompleted: 0,
        startedAt: new Date(),
      },
    });
  });
  invalidateSeasonCache();

  logger.info(
    `[season] Season ${completedSeasonNumber} completed — Season ${nextNumber} open in preparation`,
  );
  return nextNumber;
}

/**
 * Record how many Generated_Stables competed in a season. Called before those
 * stables are deleted so the figure survives the purge.
 */
export async function recordGeneratedStableCount(
  seasonNumber: number,
  count: number,
): Promise<void> {
  await prisma.season.update({
    where: { seasonNumber },
    data: { generatedStableCount: count },
  });
  invalidateSeasonCache();
}

/** Extend the current Competitive_Phase without changing later seasons. */
export async function extendCurrentSeason(additionalCycles: number): Promise<SeasonState> {
  if (!Number.isInteger(additionalCycles) || additionalCycles <= 0) {
    throw new SeasonError(
      SeasonErrorCode.CONFIRMATION_REQUIRED,
      'Extension must be a positive whole number of cycles',
      400,
    );
  }
  const config = loadEnvConfig();
  const row = await getOrCreateActiveSeason();
  // Raise this season's effective length. Rewinding `competitiveCyclesCompleted`
  // would defer the boundary too, but it would also make the cycle number the
  // player reads go backwards and would understate the cycle count written to
  // the archive.
  const currentLength = row.lengthOverrideCycles ?? config.seasonLengthCycles;
  await prisma.season.update({
    where: { id: row.id },
    data: { lengthOverrideCycles: currentLength + additionalCycles },
  });
  invalidateSeasonCache();
  return getCurrentSeason();
}

/** Set how many preparation cycles remain in the current Preparation_Phase. */
export async function setRemainingPreparationCycles(remaining: number): Promise<SeasonState> {
  const config = loadEnvConfig();
  if (!Number.isInteger(remaining) || remaining < 0 || remaining > 7) {
    throw new SeasonError(
      SeasonErrorCode.CONFIRMATION_REQUIRED,
      'Remaining preparation cycles must be a whole number between 0 and 7',
      400,
    );
  }
  const row = await getOrCreateActiveSeason();
  if (row.phase !== 'preparation') {
    throw new SeasonError(
      SeasonErrorCode.PREPARATION_PHASE_ACTIVE,
      'The current season is not in its preparation phase',
      400,
    );
  }
  await prisma.season.update({
    where: { id: row.id },
    data: {
      preparationCyclesCompleted: Math.max(0, config.preparationLengthCycles - remaining),
    },
  });
  invalidateSeasonCache();
  return getCurrentSeason();
}

/** List completed seasons, newest first. */
export async function listCompletedSeasons() {
  return prisma.season.findMany({
    where: { phase: 'completed' },
    orderBy: { seasonNumber: 'desc' },
  });
}
