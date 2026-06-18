/**
 * King of the Hill — Configuration, interfaces, and constants.
 *
 * Requirements: 1.1, 1.2, 1.5, 11.4, 11.5
 */

import type { Position } from '../vector2d';
import type {
  ArenaZone,
  CombatEvent,
  RobotCombatState,
} from '../types';

// ─── KotH Match Configuration ───────────────────────────────────────

/** KotH match configuration provided by the orchestrator */
export interface KothMatchConfig {
  scoreThreshold?: number;    // default 30, range [15, 90]
  timeLimit?: number;         // default 150s, range [60, 300]
  zoneRadius?: number;        // default 5, range [3, 8]
  rotatingZone?: boolean;     // default false
  participantCount: number;   // 5 or 6
  matchId: number;            // for deterministic zone rotation seed
}

// ─── KotH Zone State ────────────────────────────────────────────────

/** Runtime state of the control zone during a match */
export interface KothZoneState {
  center: Position;
  radius: number;
  isActive: boolean;           // false during transition period
  transitionTarget?: Position; // next zone position (rotating variant)
  transitionCountdown?: number;
  rotationCount: number;
  rotationTimer?: number;      // tracks time since last rotation
  transitionTimer?: number;    // tracks time during the 3s inactive transition period
}

// ─── Zone Occupation Result ─────────────────────────────────────────

/** Result of evaluating which robots occupy the zone */
export interface ZoneOccupationResult {
  occupants: number[];
  state: 'uncontested' | 'contested' | 'empty';
}

// ─── Config Validation Result ───────────────────────────────────────

/** Result of validating a KotH match configuration */
export interface KothConfigValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── KotH Score State ───────────────────────────────────────────────

/** Runtime scoring state tracked throughout a KotH match */
export interface KothScoreState {
  zoneScores: Record<number, number>;        // robotId → cumulative score
  zoneOccupants: Set<number>;                // robotIds currently in zone
  zoneOccupationTime: Record<number, number>;// robotId → total seconds in zone
  uncontestedTime: Record<number, number>;   // robotId → seconds of uncontested control
  passiveTimers: Record<number, number>;     // robotId → consecutive seconds outside zone
  passivePenalties: Record<number, { damageReduction: number; accuracyPenalty: number }>;
  eliminatedRobots: Set<number>;             // robotIds permanently eliminated
  eliminationScores: Record<number, number>; // robotId → score at elimination time
  killCounts: Record<number, number>;        // robotId → kills in this match
  nameMap: Record<number, string>;           // robotId → robot name for messages
  lastStandingPhase: boolean;
  lastStandingTimer: number;
  lastStandingRobotId: number | null;
  scoreTickAccumulator: number;              // fractional second tracker for score_tick emission
}

// ─── KotH Combat Event ─────────────────────────────────────────────

/** KotH-specific event types extending the base CombatEvent */
export type KothEventType =
  | 'zone_defined'
  | 'zone_enter'
  | 'zone_exit'
  | 'score_tick'
  | 'kill_bonus'
  | 'zone_moving'
  | 'zone_active'
  | 'robot_eliminated'
  | 'passive_warning'
  | 'passive_penalty'
  | 'last_standing'
  | 'match_end';

/** Placement entry for final match results */
export interface KothPlacement {
  robotId: number;
  placement: number;
  zoneScore: number;
  zoneOccupationTime: number;
  totalDamageDealt: number;
}

/** Combat event with KotH-specific type support — now a type alias since CombatEvent includes KotH types */
export type KothCombatEvent = CombatEvent;

// ─── Constants ──────────────────────────────────────────────────────

export const KOTH_PASSIVE_PENALTIES = {
  warningThreshold: 20,
  penaltyThreshold: 30,
  damageReductionPerInterval: 0.03,
  damageReductionInterval: 5,
  damageReductionCap: 0.30,
  accuracyPenaltyThreshold: 60,
  accuracyPenalty: 0.15,
  penaltyDecayTime: 3,
} as const;

export const KOTH_MATCH_DEFAULTS = {
  scoreThreshold: 30,
  timeLimit: 150,
  zoneRadius: 5,
  arenaRadius: 14,
  killBonus: 5,
  rotatingZoneScoreThreshold: 45,
  rotatingZoneTimeLimit: 210,
  rotatingZoneInterval: 30,
  zoneTransitionDuration: 3,
  zoneWarningTime: 5,
  lastStandingDuration: 10,
} as const;

// ─── Config Validation ──────────────────────────────────────────────

/**
 * Validate a KotH match configuration.
 *
 * Checks:
 *  - participantCount must be between 5 and 7
 *  - scoreThreshold (if provided) must be in [15, 90]
 *  - timeLimit (if provided) must be in [60, 300]
 *  - zoneRadius (if provided) must be in [3, 8]
 *
 * Returns { valid, errors[] } with descriptive messages for each violation.
 *
 * Requirements: 11.4, 11.5
 */
export function validateKothConfig(config: KothMatchConfig): KothConfigValidationResult {
  const errors: string[] = [];

  if (config.participantCount < 5 || config.participantCount > 7) {
    errors.push(
      `participantCount must be between 5 and 7, got ${config.participantCount}`,
    );
  }

  if (
    config.scoreThreshold !== undefined &&
    (config.scoreThreshold < 15 || config.scoreThreshold > 90)
  ) {
    errors.push(
      `scoreThreshold must be between 15 and 90, got ${config.scoreThreshold}`,
    );
  }

  if (
    config.timeLimit !== undefined &&
    (config.timeLimit < 60 || config.timeLimit > 300)
  ) {
    errors.push(
      `timeLimit must be between 60 and 300 seconds, got ${config.timeLimit}`,
    );
  }

  if (
    config.zoneRadius !== undefined &&
    (config.zoneRadius < 3 || config.zoneRadius > 8)
  ) {
    errors.push(
      `zoneRadius must be between 3 and 8 grid units, got ${config.zoneRadius}`,
    );
  }

  return { valid: errors.length === 0, errors };
}

// ─── Enriched Placement ─────────────────────────────────────────────

/**
 * Enriched placement with all fields needed by processKothBattle for DB records.
 */
export interface KothEnrichedPlacement extends KothPlacement {
  robotName: string;
  zoneTime: number;
  kills: number;
  destroyed: boolean;
  damageDealt: number;
  finalHP: number;
  uncontestedScore: number;
}
