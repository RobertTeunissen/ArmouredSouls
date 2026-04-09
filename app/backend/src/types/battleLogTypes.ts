/**
 * Shared type definitions for Battle.battleLog JSON payloads.
 *
 * These interfaces describe the JSON structures stored in the Prisma `Json`
 * field `Battle.battleLog`. The shapes are derived from the code that
 * constructs battle logs in:
 *   - `leagueBattleOrchestrator.ts`   (standard league battles)
 *   - `tournamentBattleOrchestrator.ts` (tournament battles)
 *   - `tagTeamBattleOrchestrator.ts`  (tag-team battles)
 *   - `CombatMessageGenerator.buildKothBattleLog()` (KotH battles)
 *
 * Requirements: 2.1, 5.1
 */

// ---------------------------------------------------------------------------
// Narrative events (stored in battleLog.events)
// ---------------------------------------------------------------------------

/**
 * A single narrative event in the battle log.
 *
 * Produced by `CombatMessageGenerator.convertSimulatorEvents()` and related
 * converters. Each event has a timestamp, a type tag, and a human-readable
 * message. Attack/counter events also carry attacker/defender/weapon metadata.
 */
export interface NarrativeEvent {
  timestamp: number;
  type: string;
  message: string;
  attacker?: string;
  defender?: string;
  weapon?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// KotH-specific sub-structures
// ---------------------------------------------------------------------------

/** KotH placement entry stored in `battleLog.placements`. */
export interface KothPlacement {
  robotId: number;
  robotName: string;
  placement: number;
  zoneScore: number;
  zoneTime: number;
  kills: number;
  destroyed: boolean;
}

/** KotH metadata stored in `battleLog.kothData`. */
export interface KothData {
  isKoth: boolean;
  participantCount: number;
  scoreThreshold: number;
  zoneRadius: number;
  colorPalette: string[];
}

// ---------------------------------------------------------------------------
// Top-level battle log shapes (one per battle type)
// ---------------------------------------------------------------------------

/** Position coordinate used in spatial metadata. */
export interface ArenaPosition {
  x: number;
  y: number;
}

/**
 * Battle log JSON for a standard league battle.
 * Stored in `Battle.battleLog` when `battleType === 'league'`.
 */
export interface LeagueBattleLogData {
  events: NarrativeEvent[];
  isByeMatch: boolean;
  detailedCombatEvents: unknown[];
  arenaRadius?: number;
  startingPositions?: Record<string, ArenaPosition>;
  endingPositions?: Record<string, ArenaPosition>;
}

/**
 * Battle log JSON for a tournament battle.
 * Stored in `Battle.battleLog` when `battleType === 'tournament'`.
 */
export interface TournamentBattleLogData {
  events: NarrativeEvent[];
  isTournament: true;
  round: number;
  maxRounds: number;
  isFinals: boolean;
  detailedCombatEvents: unknown[];
  arenaRadius?: number;
  startingPositions?: Record<string, ArenaPosition>;
  endingPositions?: Record<string, ArenaPosition>;
}

/**
 * Battle log JSON for a tag-team battle.
 * Stored in `Battle.battleLog` when `battleType === 'tag_team'`.
 */
export interface TagTeamBattleLogData {
  events: NarrativeEvent[];
  detailedCombatEvents: unknown[];
  tagTeamBattle: true;
  team1TagOutTime: number | null;
  team2TagOutTime: number | null;
  arenaRadius?: number;
  startingPositions?: Record<string, ArenaPosition>;
  endingPositions?: Record<string, ArenaPosition>;
}

/**
 * Battle log JSON for a King of the Hill battle.
 * Produced by `CombatMessageGenerator.buildKothBattleLog()`.
 */
export interface KothBattleLogData {
  events: NarrativeEvent[];
  detailedCombatEvents: unknown[];
  isKothMatch: true;
  participantCount: number;
  arenaRadius: number;
  startingPositions: Record<string, ArenaPosition>;
  endingPositions: Record<string, ArenaPosition>;
  kothData: KothData;
  placements: KothPlacement[];
}

/**
 * Union of all battle log shapes that can be stored in `Battle.battleLog`.
 *
 * Use this when you need to accept any battle log variant. For code that
 * knows the battle type, prefer the specific interface directly.
 */
export type BattleLogData =
  | LeagueBattleLogData
  | TournamentBattleLogData
  | TagTeamBattleLogData
  | KothBattleLogData;
