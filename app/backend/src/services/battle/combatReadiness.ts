/**
 * Battle-time combat readiness — the check every orchestrator runs on the
 * robots actually loaded for a battle (after the bye short-circuit).
 *
 * Scheduling uses `checkSchedulingReadiness` (services/analytics/matchmakingService)
 * with the same shared rule, `evaluateLoadoutReadiness`. At battle time the rule
 * is fed IDs derived from the LOADED weapon relations, so a dangling
 * `mainWeaponId` whose relation is null counts as missing.
 *
 * Outcomes:
 * - No main weapon → the robot cannot fight. In two-sided modes its whole side
 *   forfeits; in placement modes (KotH, Grand Melee) it takes last place.
 * - Main weapon but an incomplete (or unknown) loadout → the robot fights as
 *   `single` for this battle only. The offhand is never promoted.
 *
 * Pure: no Prisma, no I/O.
 *
 * @module services/battle/combatReadiness
 */

import { evaluateLoadoutReadiness } from '../../shared/utils/loadout-readiness';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';
import type { RobotWithWeapons } from './combatSimulator';

export interface CombatEntryDecision {
  robotId: number;
  /** False only when the main-hand weapon relation is absent. */
  canFight: boolean;
  /** Shared-rule reasons (same strings as the robot page badge). */
  reasons: string[];
  /** Set when the stored loadout is incomplete but a main weapon is present. */
  loadoutFallback: { storedLoadout: string; battleLoadout: 'single' } | null;
}

export type SideId = 1 | 2;

export type MatchEntryOutcome =
  | { kind: 'fight'; decisions: CombatEntryDecision[] }
  | { kind: 'forfeit'; forfeitingSides: [SideId]; decisions: CombatEntryDecision[] }
  | { kind: 'double_forfeit'; forfeitingSides: [1, 2]; decisions: CombatEntryDecision[] };

function hasMainWeapon(robot: RobotWithWeapons): boolean {
  return robot.mainWeapon?.weapon != null;
}

/** Evaluate one loaded robot at battle time. */
export function evaluateCombatEntry(robot: RobotWithWeapons): CombatEntryDecision {
  const mainWeaponId = robot.mainWeapon?.weapon ? robot.mainWeapon.id : null;
  const offhandWeaponId = robot.offhandWeapon?.weapon ? robot.offhandWeapon.id : null;
  const readiness = evaluateLoadoutReadiness({
    loadoutType: robot.loadoutType,
    mainWeaponId,
    offhandWeaponId,
  });
  const canFight = mainWeaponId !== null;

  return {
    robotId: robot.id,
    canFight,
    reasons: readiness.reasons,
    // Covers dual_wield/weapon_shield without an offhand AND an unknown loadout string.
    loadoutFallback:
      canFight && !readiness.isReady
        ? { storedLoadout: robot.loadoutType, battleLoadout: 'single' }
        : null,
  };
}

/** Two-sided modes. A side forfeits if ANY of its robots cannot fight (tag team included). */
export function evaluateMatchEntry(
  side1: RobotWithWeapons[],
  side2: RobotWithWeapons[],
): MatchEntryOutcome {
  const side1Decisions = side1.map(evaluateCombatEntry);
  const side2Decisions = side2.map(evaluateCombatEntry);
  const decisions = [...side1Decisions, ...side2Decisions];
  const side1Forfeits = side1Decisions.some((d) => !d.canFight);
  const side2Forfeits = side2Decisions.some((d) => !d.canFight);

  if (side1Forfeits && side2Forfeits) {
    return { kind: 'double_forfeit', forfeitingSides: [1, 2], decisions };
  }
  if (side1Forfeits) return { kind: 'forfeit', forfeitingSides: [1], decisions };
  if (side2Forfeits) return { kind: 'forfeit', forfeitingSides: [2], decisions };
  return { kind: 'fight', decisions };
}

/** Placement modes. Partition, preserving input order. */
export function partitionPlacementField<T extends RobotWithWeapons>(
  robots: T[],
): { ready: T[]; forfeited: T[]; decisions: CombatEntryDecision[] } {
  const ready: T[] = [];
  const forfeited: T[] = [];
  const decisions: CombatEntryDecision[] = [];
  for (const robot of robots) {
    const decision = evaluateCombatEntry(robot);
    decisions.push(decision);
    (decision.canFight ? ready : forfeited).push(robot);
  }
  return { ready, forfeited, decisions };
}

/**
 * In-memory only: sets robot.loadoutType = 'single' for each decision with a fallback.
 * Must run BEFORE prepareRobotForCombat (which reads loadoutType for LOADOUT_BONUSES, #517).
 * Never persists. Returns the robots it changed, for one warn log per robot by the caller.
 */
export function applyLoadoutFallbacks(
  robots: RobotWithWeapons[],
  decisions: CombatEntryDecision[],
): number[] {
  const fallbackIds = new Set(
    decisions.filter((d) => d.loadoutFallback !== null).map((d) => d.robotId),
  );
  const changed: number[] = [];
  for (const robot of robots) {
    if (!fallbackIds.has(robot.id)) continue;
    robot.loadoutType = 'single';
    changed.push(robot.id);
  }
  return changed;
}

/** Simulator backstop. Throws BattleError(ROBOT_NOT_BATTLE_READY, 500, { robotIds }). */
export function assertAllRobotsArmed(robots: RobotWithWeapons[]): void {
  const robotIds = robots.filter((robot) => !hasMainWeapon(robot)).map((robot) => robot.id);
  if (robotIds.length === 0) return;
  throw new BattleError(
    BattleErrorCode.ROBOT_NOT_BATTLE_READY,
    `Robot(s) ${robotIds.join(', ')} reached the combat simulator without a main weapon`,
    500,
    { robotIds },
  );
}
