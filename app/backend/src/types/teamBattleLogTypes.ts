/**
 * Shared type definitions for Team Battle (2v2 and 3v3) log payloads.
 *
 * These interfaces describe the JSON structures stored in the Prisma `Json`
 * field `Battle.battleLog` when `battleType === 'league_2v2'` or
 * `battleType === 'league_3v3'`. Cast via `as unknown as TeamBattleLog`.
 *
 * Consumed by:
 *   - `teamBattleEngine.ts`        (produces the result)
 *   - `teamBattleOrchestrator.ts`  (persists to Battle.battleLog)
 *   - Battle Detail frontend page  (renders team battle logs)
 *
 * Requirements: R5.7, R5.8
 */

import { ArenaPosition } from './battleLogTypes';

// ---------------------------------------------------------------------------
// Per-participant result
// ---------------------------------------------------------------------------

/**
 * Individual robot performance within a Team Battle.
 * One entry per robot (2N total across both teams).
 */
export interface TeamBattleParticipantResult {
  robotId: number;
  team: 1 | 2;
  damageDealt: number;
  damageTaken: number;
  finalHP: number;
  survivalSeconds: number;
}

// ---------------------------------------------------------------------------
// Combat event discriminated union
// ---------------------------------------------------------------------------

/** Base fields shared by all team battle combat events. */
interface TeamBattleCombatEventBase {
  tick: number;
  timestamp: number;
}

/** A robot dealt damage to an opponent. */
export interface TeamBattleDamageEvent extends TeamBattleCombatEventBase {
  type: 'damage';
  attackerRobotId: number;
  defenderRobotId: number;
  amount: number;
  weaponId: number | null;
  isFocusFire: boolean;
}

/** Focus fire detected: 2+ allies targeting the same enemy this tick. */
export interface TeamBattleFocusFireCombatEvent extends TeamBattleCombatEventBase {
  type: 'focus_fire';
  targetRobotId: number;
  contributorRobotIds: number[];
  bonusApplied: number;
}

/** A robot was eliminated (HP reached 0). */
export interface TeamBattleEliminationEvent extends TeamBattleCombatEventBase {
  type: 'elimination';
  robotId: number;
  eliminatedByRobotId: number | null;
  team: 1 | 2;
}

/** Ally shield regeneration applied via supportSystems. */
export interface TeamBattleShieldRegenEvent extends TeamBattleCombatEventBase {
  type: 'shield_regen';
  supporterRobotId: number;
  targetRobotId: number;
  amount: number;
}

/** Formation defence reduction applied via formationTactics. */
export interface TeamBattleFormationDefenceEvent extends TeamBattleCombatEventBase {
  type: 'formation_defence';
  robotId: number;
  alliesInRange: number;
  reductionPercent: number;
}

/** Battle ended in a draw due to timeout (300 seconds). */
export interface TeamBattleDrawTimeoutEvent extends TeamBattleCombatEventBase {
  type: 'draw_timeout';
  durationSeconds: number;
}

/**
 * Discriminated union of all combat events in a Team Battle log.
 * Discriminant field: `type`.
 */
export type TeamBattleCombatEvent =
  | TeamBattleDamageEvent
  | TeamBattleFocusFireCombatEvent
  | TeamBattleEliminationEvent
  | TeamBattleShieldRegenEvent
  | TeamBattleFormationDefenceEvent
  | TeamBattleDrawTimeoutEvent;

// ---------------------------------------------------------------------------
// Focus fire event (aggregated metric)
// ---------------------------------------------------------------------------

/**
 * A single focus fire occurrence aggregated for metrics.
 * Stored in `TeamBattleResult.focusFireEvents` for post-battle analysis.
 */
export interface FocusFireEvent {
  tick: number;
  targetRobotId: number;
  contributorRobotIds: number[];
  contributorCount: number;
  bonusApplied: number;
}

// ---------------------------------------------------------------------------
// Team-level coordination metrics
// ---------------------------------------------------------------------------

/** Per-team aggregated metric (team1 vs team2). */
export interface TeamMetricPair {
  team1: number;
  team2: number;
}

// ---------------------------------------------------------------------------
// Top-level result and log structures
// ---------------------------------------------------------------------------

/**
 * The full result of a Team Battle simulation.
 * Returned by `simulateTeamBattle()` in `teamBattleEngine.ts`.
 */
export interface TeamBattleResult {
  winningSide: 1 | 2 | null;
  winnerRobotId: number | null;
  isDraw: boolean;
  isByeMatch: boolean;
  durationSeconds: number;
  participants: TeamBattleParticipantResult[];
  battleLog: TeamBattleCombatEvent[];
  detailedCombatEvents: unknown[];
  focusFireEvents: FocusFireEvent[];
  focusFireMetrics: TeamMetricPair;
  allySupportMetrics: TeamMetricPair;
  formationDefenceMetrics: TeamMetricPair;
  arenaRadius: number;
  startingPositions: Record<string, ArenaPosition>;
  endingPositions: Record<string, ArenaPosition>;
}

/**
 * Top-level JSON structure stored in `Battle.battleLog` for team battles.
 * Stored when `battleType === 'league_2v2'` or `battleType === 'league_3v3'`.
 *
 * Cast from Prisma Json field via:
 *   `battle.battleLog as unknown as TeamBattleLog`
 */
export interface TeamBattleLog {
  teamBattle: true;
  teamSize: 2 | 3;
  winningSide: 1 | 2 | null;
  isDraw: boolean;
  isByeMatch: boolean;
  durationSeconds: number;
  participants: TeamBattleParticipantResult[];
  events: TeamBattleCombatEvent[];
  detailedCombatEvents: unknown[];
  focusFireEvents: FocusFireEvent[];
  focusFireMetrics: TeamMetricPair;
  allySupportMetrics: TeamMetricPair;
  formationDefenceMetrics: TeamMetricPair;
  arenaRadius: number;
  startingPositions: Record<string, ArenaPosition>;
  endingPositions: Record<string, ArenaPosition>;
}
