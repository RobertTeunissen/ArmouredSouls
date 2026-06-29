/**
 * Combat Simulator — Type definitions, interfaces, and constants.
 */

import { Robot, Weapon, WeaponInventory } from '../../../../generated/prisma';
import {
  RobotCombatState as SpatialRobotCombatState,
  CombatEvent as SpatialCombatEvent,
  CombatResult as SpatialCombatResult,
  RangeBand,
  ArenaConfig,
  GameModeConfig,
  GameModeState,
} from '../../arena/types';
import { Position } from '../../arena/vector2d';
import { WeaponLike } from '../../arena/rangeBands';

// Re-export arena types used by other sub-modules
export type { SpatialRobotCombatState, SpatialCombatEvent, SpatialCombatResult, RangeBand, ArenaConfig, GameModeConfig, GameModeState, Position, WeaponLike };

/** Type alias for GameModeState used in spatial context */
export type SpatialGameModeState = GameModeState;

/**
 * Combat Simulator - Implements time-based combat formulas from ROBOT_ATTRIBUTES.md
 * Enhanced with 2D spatial arena mechanics.
 *
 * This simulator uses ALL 23 robot attributes to determine battle outcomes.
 * ELO is NOT used in combat calculations - it's only for matchmaking.
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

export interface CombatEvent {
  timestamp: number;
  type: 'attack' | 'miss' | 'critical' | 'counter' | 'shield_break' | 'shield_regen' | 'yield' | 'destroyed' | 'malfunction'
    | 'movement' | 'range_transition' | 'out_of_range' | 'counter_out_of_range' | 'backstab' | 'flanking'
    | 'zone_defined' | 'zone_enter' | 'zone_exit' | 'score_tick'
    | 'kill_bonus' | 'zone_moving' | 'zone_active' | 'robot_eliminated'
    | 'passive_warning' | 'passive_penalty' | 'last_standing' | 'match_end';
  attacker?: string;
  defender?: string;
  weapon?: string;
  /**
   * Spec #34: optional player-set custom name for the weapon used in this attack.
   * Set when the inventory row used by the attacker has a non-null `customName`.
   * Frontend battle reports render this italicised below the (rank-prefixed) `weapon` field.
   */
  customName?: string | null;
  hand?: 'main' | 'offhand';
  damage?: number;
  shieldDamage?: number;
  hpDamage?: number;
  hit?: boolean;
  critical?: boolean;
  counter?: boolean;
  malfunction?: boolean;
  /**
   * @deprecated Use robotHP[name] instead. These legacy fields swap based on attacker/defender
   * roles in performAttack(), causing incorrect values when robot2 attacks. Kept only for
   * backward compatibility with old battle data.
   */
  robot1HP?: number;
  /** @deprecated Use robotHP[name] instead. See robot1HP deprecation notice. */
  robot2HP?: number;
  /** @deprecated Use robotShield[name] instead. See robot1HP deprecation notice. */
  robot1Shield?: number;
  /** @deprecated Use robotShield[name] instead. See robot1HP deprecation notice. */
  robot2Shield?: number;
  /**
   * Per-robot HP map keyed by robot name. This is the canonical source of truth for HP values.
   * Always use this instead of robot1HP/robot2HP. Scales to N-robot modes (KotH, FFA, etc.).
   * Injected by the combat simulator via a proxy on every event push.
   */
  robotHP?: Record<string, number>;
  /**
   * Per-robot shield map keyed by robot name. This is the canonical source of truth for shield values.
   * Always use this instead of robot1Shield/robot2Shield. Scales to N-robot modes.
   */
  robotShield?: Record<string, number>;
  message: string;
  formulaBreakdown?: FormulaBreakdown;
  // Optional spatial fields
  positions?: Record<string, Position>;
  facingDirections?: Record<string, number>;
  distance?: number;
  rangeBand?: RangeBand;
  rangePenalty?: number;
  backstab?: boolean;
  flanking?: boolean;
  attackAngle?: number;
  // KotH-specific fields
  kpiData?: {
    robotId?: number;
    killerRobotId?: number;
    victimRobotId?: number;
    bonus?: number;
    bonusAmount?: number;
    zoneScores?: Record<number, number>;
    zoneScore?: number;
    zoneState?: string;
    center?: { x: number; y: number };
    radius?: number;
    newCenter?: { x: number; y: number };
    countdown?: number;
    survivorId?: number;
    winnerId?: number | null;
    placements?: Array<{ robotId: number; placement: number; zoneScore: number }>;
    reason?: string;
    damageReduction?: number;
    accuracyPenalty?: number;
    timeOutside?: number;
    duration?: number;
    occupants?: number[];
    rotationCount?: number;
    destroyerRobotId?: number;
    winReason?: string;
  };
}

export interface FormulaBreakdown {
  calculation: string;
  components: Record<string, number>;
  result: number;
}

export interface CombatResult {
  winnerId: number | null;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1FinalShield: number;
  robot2FinalShield: number;
  robot1Damage: number;
  robot2Damage: number;
  robot1DamageDealt: number;
  robot2DamageDealt: number;
  durationSeconds: number;
  isDraw: boolean;
  events: CombatEvent[];
  // Optional arena metadata
  arenaRadius?: number;
  startingPositions?: Record<string, Position>;
  endingPositions?: Record<string, Position>;
  // KotH metadata
  kothMetadata?: {
    finalZoneScores?: Record<number, number>;
    placementOrder?: Array<{ robotId: number; placement: number; zoneScore: number }>;
    zoneOccupationTimes?: Record<number, number>;
    uncontestedTimes?: Record<number, number>;
    zoneEntries?: Record<number, number>;
    zoneExits?: Record<number, number>;
    killCounts?: Record<number, number>;
    eliminationStatuses?: Record<number, 'destroyed' | 'yielded' | 'survived'>;
    matchDuration?: number;
    winReason?: string;
    zoneVariant?: 'fixed' | 'rotating';
  };
}

export const BASE_WEAPON_COOLDOWN = 4; // seconds
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
