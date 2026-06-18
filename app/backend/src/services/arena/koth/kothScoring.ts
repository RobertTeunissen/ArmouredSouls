/**
 * King of the Hill — Scoring system and passive penalties.
 *
 * Requirements: 3.1–3.7
 */

import { euclideanDistance } from '../vector2d';
import type { RobotCombatState } from '../types';
import type {
  KothScoreState,
  KothZoneState,
  ZoneOccupationResult,
  KothCombatEvent,
} from './kothConfig';
import { KOTH_PASSIVE_PENALTIES, KOTH_MATCH_DEFAULTS } from './kothConfig';

// ─── Score State Factory ────────────────────────────────────────────

/**
 * Create an initial KothScoreState for a set of robot IDs.
 *
 * All scores, timers, and counters start at zero.
 */
export function createKothScoreState(robotIds: number[]): KothScoreState {
  const zoneScores: Record<number, number> = {};
  const zoneOccupationTime: Record<number, number> = {};
  const uncontestedTime: Record<number, number> = {};
  const passiveTimers: Record<number, number> = {};
  const passivePenalties: Record<number, { damageReduction: number; accuracyPenalty: number }> = {};
  const killCounts: Record<number, number> = {};

  for (const id of robotIds) {
    zoneScores[id] = 0;
    zoneOccupationTime[id] = 0;
    uncontestedTime[id] = 0;
    passiveTimers[id] = 0;
    passivePenalties[id] = { damageReduction: 0, accuracyPenalty: 0 };
    killCounts[id] = 0;
  }

  return {
    zoneScores,
    zoneOccupants: new Set(),
    zoneOccupationTime,
    uncontestedTime,
    passiveTimers,
    passivePenalties,
    eliminatedRobots: new Set(),
    eliminationScores: {},
    killCounts,
    nameMap: {},
    lastStandingPhase: false,
    lastStandingTimer: 0,
    lastStandingRobotId: null,
    scoreTickAccumulator: 0,
  };
}

// ─── Scoring System ─────────────────────────────────────────────────

/**
 * Reset the score tick accumulator on a score state (useful for testing).
 */
export function resetScoreTickAccumulator(scoreState?: KothScoreState): void {
  if (scoreState) {
    scoreState.scoreTickAccumulator = 0;
  }
}

/**
 * Tick the scoring system for a single simulation step.
 *
 * Awards 0.1 points per tick (1 pt/sec at 10 ticks/sec) when the zone is
 * in uncontested state. Awards 0 points when contested or empty.
 *
 * Emits a `score_tick` event every 1 second of accumulated game time.
 *
 * Mutates `scoreState` in place (zoneScores, zoneOccupants,
 * zoneOccupationTime, uncontestedTime).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6
 */
export function tickScoring(
  scoreState: KothScoreState,
  zoneState: KothZoneState,
  occupationResult: ZoneOccupationResult,
  deltaTime: number,
): KothCombatEvent[] {
  const events: KothCombatEvent[] = [];

  // Update zone occupants set
  scoreState.zoneOccupants = new Set(occupationResult.occupants);

  // Track zone occupation time for all occupants
  for (const robotId of occupationResult.occupants) {
    scoreState.zoneOccupationTime[robotId] =
      Math.round(((scoreState.zoneOccupationTime[robotId] ?? 0) + deltaTime) * 1e6) / 1e6;
  }

  // Award points only in uncontested state (Req 3.1)
  // No points for contested (Req 3.2) or empty (Req 3.3)
  if (occupationResult.state === 'uncontested' && zoneState.isActive) {
    const robotId = occupationResult.occupants[0];
    const pointsThisTick = deltaTime; // 0.1 per tick at 10Hz = 1 pt/sec
    scoreState.zoneScores[robotId] =
      Math.round(((scoreState.zoneScores[robotId] ?? 0) + pointsThisTick) * 1e6) / 1e6;

    // Track uncontested time
    scoreState.uncontestedTime[robotId] =
      Math.round(((scoreState.uncontestedTime[robotId] ?? 0) + deltaTime) * 1e6) / 1e6;
  }

  // Emit score_tick event every 1 second of game time (Req 3.6)
  // Use rounding to avoid IEEE 754 drift (10 × 0.1 ≠ 1.0 exactly)
  scoreState.scoreTickAccumulator =
    Math.round((scoreState.scoreTickAccumulator + deltaTime) * 1e6) / 1e6;

  if (scoreState.scoreTickAccumulator >= 1.0) {
    scoreState.scoreTickAccumulator =
      Math.round((scoreState.scoreTickAccumulator - 1.0) * 1e6) / 1e6;

    events.push({
      timestamp: 0, // caller should set the actual game timestamp
      type: 'score_tick' as KothCombatEvent['type'],
      attacker: occupationResult.state === 'uncontested'
        ? (scoreState.nameMap[occupationResult.occupants[0]] ?? `Robot ${occupationResult.occupants[0]}`)
        : undefined,
      damage: occupationResult.state === 'uncontested'
        ? Math.round((scoreState.zoneScores[occupationResult.occupants[0]] ?? 0) * 10) / 10
        : undefined,
      message: occupationResult.state === 'uncontested'
        ? `${scoreState.nameMap[occupationResult.occupants[0]] ?? `Robot ${occupationResult.occupants[0]}`} holds the zone unopposed`
        : occupationResult.state === 'contested'
          ? 'The zone is contested — no points awarded'
          : 'The zone is empty — no points awarded',
      kpiData: {
        zoneScores: { ...scoreState.zoneScores },
        zoneState: occupationResult.state,
        occupants: [...occupationResult.occupants],
      },
    });
  }

  return events;
}

// ─── Anti-Passive Penalty System ────────────────────────────────────

/**
 * Tick the passive penalty system for all alive, non-eliminated robots.
 *
 * For each robot:
 *   - Outside zone: increment passiveTimers by deltaTime, apply penalties
 *   - Inside zone: reset timer to 0, decay penalties linearly over 3s
 *
 * Penalty thresholds:
 *   20s outside → emit passive_warning (once)
 *   30s outside → damage reduction: 3% per 5s, capped at 30%
 *   60s outside → additional 15% accuracy penalty
 *
 * Mutates scoreState.passiveTimers and scoreState.passivePenalties.
 */
export function tickPassivePenalties(
  scoreState: KothScoreState,
  robots: RobotCombatState[],
  zone: KothZoneState,
  deltaTime: number,
): KothCombatEvent[] {
  const events: KothCombatEvent[] = [];

  for (const robot of robots) {
    const robotId = robot.robot.id;

    // Skip dead or eliminated robots
    if (!robot.isAlive || scoreState.eliminatedRobots.has(robotId)) continue;

    const distance = euclideanDistance(robot.position, zone.center);
    const insideZone = distance <= zone.radius;

    if (!insideZone) {
      // Outside zone: increment passive timer
      const prevTimer = scoreState.passiveTimers[robotId] ?? 0;
      const newTimer = prevTimer + deltaTime;
      scoreState.passiveTimers[robotId] = newTimer;

      // Check warning threshold (emit once when crossing 20s)
      if (prevTimer < KOTH_PASSIVE_PENALTIES.warningThreshold &&
          newTimer >= KOTH_PASSIVE_PENALTIES.warningThreshold) {
        const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;
        events.push({
          type: 'passive_warning' as KothCombatEvent['type'],
          timestamp: Date.now(),
          message: `${name} has been outside the zone for 20 seconds — return to the zone!`,
          kpiData: { robotId, timeOutside: newTimer },
        });
      }

      // Calculate penalties
      let damageReduction = 0;
      let accuracyPenalty = 0;

      if (newTimer >= KOTH_PASSIVE_PENALTIES.penaltyThreshold) {
        const secondsOverThreshold = newTimer - KOTH_PASSIVE_PENALTIES.penaltyThreshold;
        damageReduction = Math.min(
          KOTH_PASSIVE_PENALTIES.damageReductionCap,
          Math.floor(secondsOverThreshold / KOTH_PASSIVE_PENALTIES.damageReductionInterval) *
            KOTH_PASSIVE_PENALTIES.damageReductionPerInterval,
        );
      }

      if (newTimer >= KOTH_PASSIVE_PENALTIES.accuracyPenaltyThreshold) {
        accuracyPenalty = KOTH_PASSIVE_PENALTIES.accuracyPenalty;
      }

      // Store penalties
      const prevPenalties = scoreState.passivePenalties[robotId] ?? { damageReduction: 0, accuracyPenalty: 0 };
      scoreState.passivePenalties[robotId] = { damageReduction, accuracyPenalty };

      // Emit passive_penalty event when penalties change
      if (damageReduction !== prevPenalties.damageReduction ||
          accuracyPenalty !== prevPenalties.accuracyPenalty) {
        const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;
        events.push({
          type: 'passive_penalty' as KothCombatEvent['type'],
          timestamp: Date.now(),
          message: `${name} suffers a ${damageReduction * 100}% damage reduction for staying outside the zone`,
          kpiData: { robotId, damageReduction, accuracyPenalty, timeOutside: newTimer },
        });
      }
    } else {
      // Inside zone: reset timer, decay penalties
      const _prevTimer = scoreState.passiveTimers[robotId] ?? 0;

      // Reset timer on zone entry
      scoreState.passiveTimers[robotId] = 0;

      // Decay penalties linearly over penaltyDecayTime seconds
      const currentPenalties = scoreState.passivePenalties[robotId] ?? { damageReduction: 0, accuracyPenalty: 0 };
      if (currentPenalties.damageReduction > 0 || currentPenalties.accuracyPenalty > 0) {
        const decayRate = deltaTime / KOTH_PASSIVE_PENALTIES.penaltyDecayTime;
        const newDamageReduction = Math.max(0, currentPenalties.damageReduction - currentPenalties.damageReduction * decayRate);
        const newAccuracyPenalty = Math.max(0, currentPenalties.accuracyPenalty - currentPenalties.accuracyPenalty * decayRate);

        scoreState.passivePenalties[robotId] = {
          damageReduction: newDamageReduction,
          accuracyPenalty: newAccuracyPenalty,
        };
      }
    }
  }

  return events;
}

// ─── Kill Bonus ─────────────────────────────────────────────────────

/**
 * Award a kill bonus when a robot destroys an opponent.
 *
 * Awards exactly 5 points to the killer's Zone_Score and emits a
 * `kill_bonus` event.
 *
 * Mutates `scoreState.zoneScores` and `scoreState.killCounts`.
 *
 * Requirements: 3.4, 3.7
 */
export function awardKillBonus(
  scoreState: KothScoreState,
  killerRobotId: number,
  victimRobotId: number,
): KothCombatEvent {
  const bonus = KOTH_MATCH_DEFAULTS.killBonus; // 5 points

  scoreState.zoneScores[killerRobotId] =
    (scoreState.zoneScores[killerRobotId] ?? 0) + bonus;

  scoreState.killCounts[killerRobotId] =
    (scoreState.killCounts[killerRobotId] ?? 0) + 1;

  const killerName = scoreState.nameMap[killerRobotId] ?? `Robot ${killerRobotId}`;
  const victimName = scoreState.nameMap[victimRobotId] ?? `Robot ${victimRobotId}`;

  return {
    timestamp: 0, // caller should set the actual game timestamp
    type: 'kill_bonus' as KothCombatEvent['type'],
    message: `${killerName} eliminates ${victimName} and earns a kill bonus of ${bonus} points`,
    kpiData: {
      killerRobotId,
      victimRobotId,
      bonusAmount: bonus,
      zoneScores: { ...scoreState.zoneScores },
    },
  };
}
