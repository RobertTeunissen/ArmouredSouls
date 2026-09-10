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
export const ALL_BATTLE_TYPES = [
  'league_1v1',
  'tournament_1v1',
  'tag_team',
  'koth',
  'league_2v2',
  'league_3v3',
  'tournament_2v2',
  'tournament_3v3',
  'grand_melee',
] as const;

export type BattleType = typeof ALL_BATTLE_TYPES[number];

/** Minimal context every battle mode needs before simulation. */
export interface BattleContext {
  /** The mode identifier stored in the Battle record. */
  battleType: BattleType;
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
 * Return the canonical active financial cycle. CycleMetadata.totalCycles is the
 * number of completed cycles, so every current writer belongs to +1.
 */
export async function getCurrentCycleNumber(): Promise<number> {
  return getActiveFinancialCycleNumber();
}
