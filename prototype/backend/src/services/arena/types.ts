/**
 * Spatial type definitions for the 2D Combat Arena.
 *
 * This file contains all interfaces, types, and constants used by the
 * arena subsystems. Extended versions of CombatEvent, CombatResult, and
 * RobotCombatState add optional spatial fields while preserving backward
 * compatibility with the existing combatSimulator.ts contract.
 *
 * Requirements: 1.1, 3.1, 14.2, 14.3, 15.7, 16.1–16.7
 */

import { Position, Vector2D } from './vector2d';
import type { RobotWithWeapons, FormulaBreakdown } from '../combatSimulator';

// ─── Range Band Classification (Req 3.1) ────────────────────────────

/** Range band classification */
export type RangeBand = 'melee' | 'short' | 'mid' | 'long';

/** Range band boundaries in grid units */
export const RANGE_BAND_BOUNDARIES = {
  melee: { min: 0, max: 2 },
  short: { min: 3, max: 6 },
  mid:   { min: 7, max: 12 },
  long:  { min: 13, max: Infinity },
} as const;

/** Range penalty multipliers */
export const RANGE_PENALTY = {
  optimal:   1.1,   // Within optimal range: +10% bonus
  oneAway:   0.75,  // One band away: -25%
  twoOrMore: 0.5,   // Two+ bands away: -50%
} as const;

// ─── Arena Configuration (Req 1.1, 16.1, 16.4) ─────────────────────

/** Arena setup for a battle */
export interface ArenaConfig {
  radius: number;
  center: Position;
  spawnPositions: Position[];
  zones?: ArenaZone[];
}

/** Arena zone for future extensibility (Req 16.4) */
export interface ArenaZone {
  id: string;
  center: Position;
  radius: number;
  effect: 'damage_amp' | 'healing' | 'control_point' | 'custom';
  multiplier?: number;
}

// ─── Movement & AI Types ────────────────────────────────────────────

/** Movement intent computed by AI each tick (Req 5.1, 10.1–10.10) */
export interface MovementIntent {
  targetPosition: Position;
  strategy: 'random_bias' | 'direct_path' | 'calculated_path';
  preferredRange: RangeBand;
  stanceSpeedModifier: number;
}

/** Threat score for target selection (Req 6.1–6.5) */
export interface ThreatScore {
  robotIndex: number;
  score: number;
  factors: {
    combatPower: number;
    hpPercentage: number;
    weaponThreat: number;
    distance: number;
    proximityDecay: number;
    isTargetingMe: boolean;
  };
}

/** Weapon-to-range-band mapping (Req 3.2) */
export interface WeaponRangeMapping {
  weaponType: string;
  handsRequired: string;
  weaponName: string;
  optimalRange: RangeBand;
}

// ─── Extended Robot Combat State ────────────────────────────────────

/** Extended combat state with spatial tracking */
export interface RobotCombatState {
  // === Existing fields (preserved from combatSimulator.ts) ===
  robot: RobotWithWeapons;
  currentHP: number;
  maxHP: number;
  currentShield: number;
  maxShield: number;
  lastAttackTime: number;
  lastOffhandAttackTime: number;
  attackCooldown: number;
  offhandCooldown: number;
  totalDamageDealt: number;
  totalDamageTaken: number;

  // === New spatial fields (Req 1.5) ===
  position: Position;
  facingDirection: number;
  velocity: Vector2D;
  movementSpeed: number;
  effectiveMovementSpeed: number;

  // === Servo strain (Req 2.6) ===
  servoStrain: number;
  sustainedMovementTime: number;
  isUsingClosingBonus: boolean;

  // === AI state (Req 5.1–5.7) ===
  movementIntent: MovementIntent;
  currentTarget: number | null;
  patienceTimer: number;
  combatAlgorithmScore: number;

  // === Adaptation (Req 7.1–7.5) ===
  adaptationHitBonus: number;
  adaptationDamageBonus: number;
  hitsTaken: number;
  missCount: number;

  // === Pressure system (Req 8.1–8.4) ===
  pressureThreshold: number;
  isUnderPressure: boolean;

  // === Team (Req 12, 13) ===
  teamIndex: number;
  isAlive: boolean;
}

// ─── Extended CombatEvent (Backward Compatible — Req 14.2, 14.3) ───

/** Extended CombatEvent — all new fields are optional */
export interface CombatEvent {
  // === Existing fields (all preserved) ===
  timestamp: number;
  type:
    | 'attack' | 'miss' | 'critical' | 'counter'
    | 'shield_break' | 'shield_regen' | 'yield' | 'destroyed' | 'malfunction'
    // New spatial event types
    | 'movement' | 'range_transition' | 'out_of_range'
    | 'counter_out_of_range' | 'backstab' | 'flanking'
    // KotH event types
    | 'zone_defined' | 'zone_enter' | 'zone_exit' | 'score_tick'
    | 'kill_bonus' | 'zone_moving' | 'zone_active' | 'robot_eliminated'
    | 'passive_warning' | 'passive_penalty' | 'last_standing' | 'match_end';
  attacker?: string;
  defender?: string;
  weapon?: string;
  hand?: 'main' | 'offhand';
  damage?: number;
  shieldDamage?: number;
  hpDamage?: number;
  hit?: boolean;
  critical?: boolean;
  counter?: boolean;
  malfunction?: boolean;
  robot1HP?: number;
  robot2HP?: number;
  robot1Shield?: number;
  robot2Shield?: number;
  message: string;
  formulaBreakdown?: FormulaBreakdown;

  // === Per-robot HP/shield maps for N-robot modes (KotH/FFA) ===
  robotHP?: Record<string, number>;
  robotShield?: Record<string, number>;

  // === New optional position fields (Req 14.3, 15.4) ===
  positions?: Record<string, Position>;
  facingDirections?: Record<string, number>;
  distance?: number;
  rangeBand?: RangeBand;
  rangePenalty?: number;
  backstab?: boolean;
  flanking?: boolean;
  attackAngle?: number;

  // === KotH-specific fields (Req 12.1–12.5) ===
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

// ─── Extended CombatResult (Backward Compatible — Req 15.7) ────────

/** Extended CombatResult — new arena metadata fields are optional */
export interface CombatResult {
  // === Existing fields (all preserved) ===
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

  // === New optional arena metadata (Req 15.7) ===
  arenaRadius?: number;
  startingPositions?: Record<string, Position>;
  endingPositions?: Record<string, Position>;

  // === KotH metadata (Req 12.3, 12.4, 12.5) ===
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

  // === Final combat states for N-robot modes (optional) ===
  finalStates?: RobotCombatState[];
}

// ─── Extensibility Interfaces (Req 16.1–16.7) ──────────────────────

/** Game mode state for extensibility */
export interface GameModeState {
  mode: 'elimination' | 'zone_control' | 'battle_royale' | 'custom';
  zoneScores?: Record<number, number>;
  customData?: Record<string, unknown>;
}

/** Complete game mode configuration */
export interface GameModeConfig {
  targetPriority?: TargetPriorityStrategy;
  movementModifier?: MovementIntentModifier;
  winCondition?: WinConditionEvaluator;
  arenaZones?: ArenaZone[];
  maxDuration?: number;
}

/** Pluggable target priority strategy (Req 16.5) */
export interface TargetPriorityStrategy {
  selectTargets(
    robot: RobotCombatState,
    opponents: RobotCombatState[],
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): number[];
}

/** Pluggable movement intent modifier (Req 16.6) */
export interface MovementIntentModifier {
  modify(
    baseIntent: MovementIntent,
    robot: RobotCombatState,
    arena: ArenaConfig,
    gameState?: GameModeState,
  ): MovementIntent;
}

/** Pluggable win condition evaluator (Req 16.2) */
export interface WinConditionEvaluator {
  evaluate(
    teams: RobotCombatState[][],
    currentTime: number,
    gameState?: GameModeState,
  ): { ended: boolean; winnerId: number | null; reason: string } | null;
}
