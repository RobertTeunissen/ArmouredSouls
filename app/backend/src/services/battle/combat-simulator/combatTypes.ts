/**
 * Combat Simulator — Type definitions, interfaces, and constants.
 */

import { Robot, Weapon, WeaponInventory } from '../../../../generated/prisma';
import type {
  RobotCombatState,
  CombatEvent,
  CombatResult,
  RangeBand,
  ArenaConfig,
  GameModeConfig,
  GameModeState,
} from '../../arena/types';
import { Position } from '../../arena/vector2d';
import { WeaponLike } from '../../arena/rangeBands';

// Combat state, events and results are defined once, in arena/types.
export type { RobotCombatState, CombatEvent, CombatResult, RangeBand, ArenaConfig, GameModeConfig, GameModeState, Position, WeaponLike };

/**
 * Combat Simulator - Implements time-based combat formulas from ROBOT_ATTRIBUTES.md
 * Enhanced with 2D spatial arena mechanics.
 *
 * This simulator uses ALL 23 robot attributes to determine battle outcomes.
 * ELO is NOT used in combat calculations - it's only for matchmaking.
 *
 * Simulator inputs must be PREPARED robots: every robot passed to `simulateBattle`,
 * `simulateBattleMulti`, `simulateTeamBattle` or `simulateTagTeamBattle` must first go
 * through `prepareRobotForCombat()` (utils/robotCalculations.ts), which writes the
 * canonical effective attributes (weapons + tuning + loadout modifier). A raw robot
 * silently fights with base-only attributes.
 */

export interface RobotWithWeapons extends Robot {
  /**
   * Equipped main weapon. After `prepareRobotForCombat()` runs, the
   * `weapon` field carries POST-REFINEMENT effective stats (Spec #34) plus
   * two derived marker fields (`__refinementCount`, `__customName`) used
   * only by the battle log event emission. The simulator reads
   * `weapon.baseDamage` / `weapon.cooldown` / `weapon.<attr>Bonus` directly
   * — it never touches refinement records.
   */
  mainWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
  /** See `mainWeapon` — same post-refinement contract applies. */
  offhandWeapon?: (WeaponInventory & { weapon: Weapon }) | null;
  /** Tuning bonuses — sparse map of attribute name → bonus value. Folded into attributes by prepareRobotForCombat(). */
  tuningBonuses?: Partial<Record<string, number>>;
}

export interface FormulaBreakdown {
  calculation: string;
  components: Record<string, number>;
  result: number;
}

export const MAX_BATTLE_DURATION = 120; // seconds
export const SIMULATION_TICK = 0.1; // 100ms per tick

// Armor and penetration constants for new damage formula (Feb 2026)
export const ARMOR_EFFECTIVENESS = 1.5;
export const PENETRATION_BONUS = 2.0;

// Movement event throttling
export const MOVEMENT_EVENT_THRESHOLD = 1.0; // grid units
export const MOVEMENT_EVENT_MIN_INTERVAL = 0.5; // seconds

/**
 * Configuration for the unified battle simulator.
 * Replaces the old `isTournament` boolean with a general config object.
 */
export interface BattleConfig {
  /** If true, time-limit draws are resolved by HP tiebreaker (highest HP% wins) */
  allowDraws: boolean;
  /** Max battle duration in seconds (defaults to MAX_BATTLE_DURATION) */
  maxDuration?: number;
  /** Optional game mode config for extensible mechanics (KotH zones, targeting, etc.) */
  gameModeConfig?: GameModeConfig;
  /** Optional game mode state (zone scores, custom data, etc.) */
  gameModeState?: GameModeState;
  /** Optional arena radius override */
  arenaRadius?: number;
  /** Enable spatial partitioning for O(n×k) threat evaluation. Defaults to true. (Spec #44: R1.6) */
  spatialPartitioning?: boolean;
  /** Enable variable tick rate for distant robots (N≥10 only). Defaults to true. (Spec #44: R1.6) */
  variableTickRate?: boolean;
}
