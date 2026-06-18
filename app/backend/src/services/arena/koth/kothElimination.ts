/**
 * King of the Hill — Robot elimination handling (yield & destruction).
 *
 * Requirements: 4.4, 4.5, 4.12, 7.1–7.6
 */

import type { RobotCombatState } from '../types';
import type {
  KothScoreState,
  KothZoneState,
  KothPlacement,
  KothCombatEvent,
} from './kothConfig';
import { awardKillBonus } from './kothScoring';

// ─── Zone Occupant Removal ──────────────────────────────────────────

/**
 * Remove a robot from the zone occupants set if present.
 *
 * Helper used by both yield and destruction handlers.
 *
 * Requirements: 7.5
 */
export function removeFromZoneOccupants(
  scoreState: KothScoreState,
  robotId: number,
): void {
  scoreState.zoneOccupants.delete(robotId);
}

// ─── Robot Yield ────────────────────────────────────────────────────

/**
 * Handle a robot voluntarily yielding from the match.
 *
 * Permanently eliminates the robot, records its Zone_Score at elimination
 * time, removes it from zone occupants if present, and emits a
 * `robot_eliminated` event with reason 'yielded'.
 *
 * No Kill_Bonus is awarded to anyone (yield is voluntary).
 *
 * Requirements: 7.1, 7.2, 7.5, 7.6
 */
export function handleRobotYield(
  scoreState: KothScoreState,
  robotId: number,
  _zoneState: KothZoneState,
): KothCombatEvent {
  // Permanently eliminate the robot
  scoreState.eliminatedRobots.add(robotId);

  // Record Zone_Score at elimination time
  scoreState.eliminationScores[robotId] = scoreState.zoneScores[robotId] ?? 0;

  // Remove from zone occupants if inside zone
  removeFromZoneOccupants(scoreState, robotId);

  const zoneScore = scoreState.zoneScores[robotId] ?? 0;
  const name = scoreState.nameMap[robotId] ?? `Robot ${robotId}`;

  return {
    timestamp: Date.now(),
    type: 'robot_eliminated' as KothCombatEvent['type'],
    attacker: name,
    message: `${name} has yielded with a Zone Score of ${zoneScore}`,
    kpiData: {
      robotId,
      reason: 'yielded',
      zoneScore,
    },
  };
}

// ─── Robot Destruction ──────────────────────────────────────────────

/**
 * Handle a robot being destroyed by another robot.
 *
 * Permanently eliminates the destroyed robot, records its Zone_Score at
 * elimination time, awards a Kill_Bonus to the destroyer, removes the
 * destroyed robot from zone occupants if present, and emits both a
 * `robot_eliminated` event and a `kill_bonus` event.
 *
 * Requirements: 7.1, 7.3, 7.4, 7.5, 7.6
 */
export function handleRobotDestruction(
  scoreState: KothScoreState,
  destroyerRobotId: number,
  destroyedRobotId: number,
  _zoneState: KothZoneState,
): KothCombatEvent[] {
  // Permanently eliminate the destroyed robot
  scoreState.eliminatedRobots.add(destroyedRobotId);

  // Record Zone_Score at elimination time
  scoreState.eliminationScores[destroyedRobotId] = scoreState.zoneScores[destroyedRobotId] ?? 0;

  // Remove from zone occupants if inside zone
  removeFromZoneOccupants(scoreState, destroyedRobotId);

  // Award kill bonus to destroyer
  const killBonusEvent = awardKillBonus(scoreState, destroyerRobotId, destroyedRobotId);

  const zoneScore = scoreState.zoneScores[destroyedRobotId] ?? 0;
  const destroyedName = scoreState.nameMap[destroyedRobotId] ?? `Robot ${destroyedRobotId}`;

  const eliminatedEvent: KothCombatEvent = {
    timestamp: Date.now(),
    type: 'robot_eliminated' as KothCombatEvent['type'],
    attacker: destroyedName,
    message: `${destroyedName} has been destroyed with a Zone Score of ${zoneScore}`,
    kpiData: {
      robotId: destroyedRobotId,
      reason: 'destroyed',
      zoneScore,
      destroyerRobotId,
    },
  };

  return [eliminatedEvent, killBonusEvent];
}

// ─── Final Placement Calculation ────────────────────────────────────

/**
 * Calculate final placements for all robots in a KotH match.
 *
 * Ordering rules (Req 4.12):
 *   1. Zone_Score descending
 *   2. Zone occupation time descending (tiebreaker)
 *   3. Total damage dealt descending (tiebreaker)
 *
 * Both surviving and eliminated robots are ranked. Eliminated robots
 * use their score at elimination time (stored in eliminationScores).
 *
 * Requirements: 4.4, 4.5, 4.12
 */
export function calculateFinalPlacements(
  scoreState: KothScoreState,
  robots: RobotCombatState[],
): KothPlacement[] {
  const entries: KothPlacement[] = robots.map((robot) => {
    const robotId = robot.robot.id;
    const isEliminated = scoreState.eliminatedRobots.has(robotId);
    const zoneScore = isEliminated
      ? (scoreState.eliminationScores[robotId] ?? scoreState.zoneScores[robotId] ?? 0)
      : (scoreState.zoneScores[robotId] ?? 0);

    return {
      robotId,
      placement: 0, // assigned after sorting
      zoneScore,
      zoneOccupationTime: scoreState.zoneOccupationTime[robotId] ?? 0,
      totalDamageDealt: robot.totalDamageDealt,
    };
  });

  // Sort: Zone_Score desc → survival (alive > eliminated) → zone occupation time desc → damage dealt desc
  entries.sort((a, b) => {
    if (b.zoneScore !== a.zoneScore) return b.zoneScore - a.zoneScore;
    const aEliminated = scoreState.eliminatedRobots.has(a.robotId) ? 1 : 0;
    const bEliminated = scoreState.eliminatedRobots.has(b.robotId) ? 1 : 0;
    if (aEliminated !== bEliminated) return aEliminated - bEliminated; // alive (0) ranks above eliminated (1)
    if (b.zoneOccupationTime !== a.zoneOccupationTime)
      return b.zoneOccupationTime - a.zoneOccupationTime;
    return b.totalDamageDealt - a.totalDamageDealt;
  });

  // Assign placement numbers (1-indexed)
  for (let i = 0; i < entries.length; i++) {
    entries[i].placement = i + 1;
  }

  return entries;
}
