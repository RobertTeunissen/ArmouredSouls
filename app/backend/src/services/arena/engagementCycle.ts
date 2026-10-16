/**
 * Engagement Cycle (#520)
 *
 * Decides each robot's engagement role and the two speed bursts that keep a
 * melee-versus-ranged fight moving between ranges:
 *
 * - **Melee commit:** a melee-role robot that has not landed a hit within its
 *   patience window (`getPatienceLimit`) pursues a ranged-role opponent at
 *   `BURST_SPEED_MULTIPLIER`, strain-free, until it is within melee reach.
 * - **Ranged disengage:** a ranged-role robot that takes its first melee-band
 *   hit of an engagement gets an escape burst at `BURST_SPEED_MULTIPLIER`,
 *   strain-free, for `2 + 0.04 × evasionThrusters` seconds, then a cooldown
 *   of one patience window before the next burst can trigger.
 *
 * All functions are pure with no module-level mutable state; `updateDisengage`
 * mutates only the state object passed in (acceptable within the simulation loop).
 */

import { RangeBand, RANGE_BAND_BOUNDARIES } from './types';

/** Engagement role derived from the robot's engagement range */
export type EngagementRole = 'melee' | 'ranged';

/** Active speed burst for a robot this tick */
export type SpeedBurst = 'none' | 'melee_commit' | 'ranged_disengage';

/** Speed multiplier for both bursts (melee commit and ranged disengage) */
export const BURST_SPEED_MULTIPLIER = 1.30;

/** Base duration of the ranged disengage burst in seconds */
export const DISENGAGE_BASE_SECONDS = 2;

/** Extra disengage burst seconds per Evasion Thrusters point (uncapped) */
export const DISENGAGE_SECONDS_PER_EVASION = 0.04;

/** Disengage bookkeeping carried on the robot's combat state */
export interface DisengageState {
  /** Time of the most recent melee-band hit taken, or null if none yet */
  lastMeleeHitTakenAt: number | null;
  /** Time until which the disengage burst is active */
  disengageBurstUntil: number;
  /** Earliest time a new melee hit can trigger a disengage burst */
  disengageReadyAt: number;
}

/** Inputs for the melee commit check */
export interface MeleeCommitInput {
  role: EngagementRole;
  opponentRole: EngagementRole | null;
  patienceTimer: number;
  patienceLimit: number;
  distance: number;
}

/** Inputs for the disengage update */
export interface DisengageUpdateInput {
  role: EngagementRole;
  currentTime: number;
  evasionThrusters: number;
  cooldownSeconds: number;
}

/** Engagement role: `melee` iff the engagement range band is `melee`. */
export function getEngagementRole(band: RangeBand): EngagementRole {
  return band === 'melee' ? 'melee' : 'ranged';
}

/** Disengage burst duration in seconds: 2 + 0.04 × Evasion Thrusters (uncapped). */
export function getDisengageDuration(evasionThrusters: number): number {
  return DISENGAGE_BASE_SECONDS + DISENGAGE_SECONDS_PER_EVASION * evasionThrusters;
}

/**
 * Melee commit is active for a melee-role robot against a ranged-role opponent
 * once its patience timer has reached the patience limit, while it is still
 * beyond melee reach.
 */
export function isMeleeCommitActive(input: MeleeCommitInput): boolean {
  return input.role === 'melee'
    && input.opponentRole === 'ranged'
    && input.patienceTimer >= input.patienceLimit
    && input.distance > RANGE_BAND_BOUNDARIES.melee.max;
}

/**
 * Start a disengage burst when a ranged-role robot has taken a melee hit since
 * its disengage became ready and no burst is running. Hits during a burst or its
 * cooldown are ignored. Mutates `state`.
 */
export function updateDisengage(state: DisengageState, input: DisengageUpdateInput): void {
  if (
    input.role === 'ranged'
    && state.lastMeleeHitTakenAt !== null
    && state.lastMeleeHitTakenAt >= state.disengageReadyAt
    && input.currentTime >= state.disengageBurstUntil
  ) {
    state.disengageBurstUntil = input.currentTime + getDisengageDuration(input.evasionThrusters);
    state.disengageReadyAt = state.disengageBurstUntil + input.cooldownSeconds;
  }
}

/** Whether the disengage burst is active at time `t`. */
export function isDisengageActive(state: DisengageState, t: number): boolean {
  return t < state.disengageBurstUntil;
}
