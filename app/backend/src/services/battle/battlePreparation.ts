/**
 * Battle preparation steps shared by every battle orchestrator.
 *
 * Each mode loads its participants, applies the battle-time loadout fallbacks
 * decided by `combatReadiness`, and prepares the fighting robots with their
 * tuning bonuses before simulating. The order of the last two steps matters:
 * `prepareRobotForCombat` reads `loadoutType`, so fallbacks are applied first.
 *
 * @module services/battle/battlePreparation
 */

import type { Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { applyLoadoutFallbacks, type CombatEntryDecision } from './combatReadiness';
import type { RobotWithWeapons } from './combatSimulator';
import type { TuningAttributeMap } from '../../shared/types';

/**
 * Weapon relations a robot needs for combat. Spec #34: refinements are
 * included so `prepareRobotForCombat` can fold them into the weapon's
 * effective stats before the simulator reads them.
 */
export const COMBAT_ROBOT_INCLUDE = {
  mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
  offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
} satisfies Prisma.RobotInclude;

/** A robot row loaded with `COMBAT_ROBOT_INCLUDE`. */
export type CombatRobot = Prisma.RobotGetPayload<{ include: typeof COMBAT_ROBOT_INCLUDE }>;

/** Load one robot with its weapons for combat, or null when it no longer exists. */
export async function loadCombatRobot(robotId: number): Promise<CombatRobot | null> {
  return prisma.robot.findUnique({ where: { id: robotId }, include: COMBAT_ROBOT_INCLUDE });
}

/** Load several robots with their weapons for combat. Missing ids are absent from the result. */
export async function loadCombatRobots(robotIds: number[]): Promise<CombatRobot[]> {
  return prisma.robot.findMany({ where: { id: { in: robotIds } }, include: COMBAT_ROBOT_INCLUDE });
}

/**
 * Apply the in-memory loadout fallbacks (rule 6: an incomplete loadout fights
 * as single) and log one warning per robot that changed. Never persists.
 */
export function applyAndLogLoadoutFallbacks(
  robots: RobotWithWeapons[],
  decisions: CombatEntryDecision[],
  matchId: number,
): void {
  for (const robotId of applyLoadoutFallbacks(robots, decisions)) {
    const decision = decisions.find(d => d.robotId === robotId);
    logger.warn('[Battle] Loadout fallback', {
      matchId,
      robotId,
      storedLoadout: decision?.loadoutFallback?.storedLoadout,
      battleLoadout: 'single',
    });
  }
}

/**
 * Fetch tuning bonuses in one batch and prepare each robot for combat (full
 * HP, shield, tuning bonuses). Returns the tuning map for later achievement
 * context.
 */
export async function prepareRobotsWithTuning(
  robots: RobotWithWeapons[],
): Promise<Map<number, TuningAttributeMap>> {
  const tuningMap = await getTuningBonusesBatch(robots.map(robot => robot.id));
  for (const robot of robots) {
    prepareRobotForCombat(robot, tuningMap.get(robot.id) ?? {});
  }
  return tuningMap;
}
