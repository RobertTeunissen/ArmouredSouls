/**
 * Base Battle Orchestrator
 *
 * Shared utilities, types, and pipeline helpers used by all four
 * mode-specific battle orchestrators (league, tournament, tag-team, KotH).
 *
 * Each orchestrator has a very different execution flow (1v1 vs N-robot,
 * single-phase vs multi-phase tag-out, etc.), so this module provides
 * composable building blocks rather than a single monolithic pipeline.
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';

// ─── Shared Types ────────────────────────────────────────────────────

/** Minimal context every battle mode needs before simulation. */
export interface BattleContext {
  /** The mode identifier stored in the Battle record. */
  battleType: 'league' | 'tournament' | 'tag_team' | 'koth';
  /** League tier (e.g. 'bronze', 'silver') or mode name for non-league modes. */
  leagueType: string;
  /** Arbitrary mode-specific metadata. */
  metadata: Record<string, unknown>;
}

/** Common shape returned after a battle is recorded. */
export interface BattleRecordRef {
  battleId: number;
  winnerId: number | null;
  durationSeconds: number;
}

// ─── Shared Helpers ──────────────────────────────────────────────────

/**
 * Get the current cycle number from metadata.
 * Returns the CURRENT cycle number (same as totalCycles in cycleMetadata).
 * The settlement job increments totalCycles when closing a cycle,
 * so totalCycles always represents the active cycle number.
 * Returns 1 if metadata doesn't exist (e.g., during tests or first cycle).
 */
export async function getCurrentCycleNumber(): Promise<number> {
  try {
    const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    return metadata?.totalCycles || 1;
  } catch (error) {
    // If cycleMetadata table doesn't exist or query fails, return 1 (first cycle)
    logger.warn('[BaseOrchestrator] Could not fetch cycle number, defaulting to 1:', error);
    return 1;
  }
}
