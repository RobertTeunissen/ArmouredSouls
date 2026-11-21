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

import { getActiveFinancialCycleNumber } from '../cycle/canonicalCycleIdentity';

// ─── Shared Types ────────────────────────────────────────────────────

/** All supported battle mode identifiers. */
export type BattleType =
  | 'league_1v1'
  | 'tournament_1v1'
  | 'tag_team'
  | 'koth'
  | 'league_2v2'
  | 'league_3v3'
  | 'tournament_2v2'
  | 'tournament_3v3'
  | 'grand_melee';

// ─── Shared Helpers ──────────────────────────────────────────────────

/**
 * Return the canonical active financial cycle. CycleMetadata.totalCycles is the
 * number of completed cycles, so every current writer belongs to +1.
 */
export async function getCurrentCycleNumber(): Promise<number> {
  return getActiveFinancialCycleNumber();
}
