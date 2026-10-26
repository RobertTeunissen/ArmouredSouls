/**
 * Records the battle-time build of every robot that fought a battle
 * (`battle_participant_builds`): base attributes, tuning, the effective values
 * the simulator used, both weapons with their refinements, loadout, stance and
 * yield threshold. The robot rows change after the battle; this does not.
 *
 * The build is captured by `prepareRobotForCombat` (the one step every mode
 * passes through) and written here by each orchestrator right after it creates
 * the battle. It only feeds admin analysis, so a failed write is logged and
 * never fails the battle. Byes and forfeiters are never prepared, so they have
 * no build row.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import type { Prisma } from '../../../generated/prisma';
import { getCombatBuild } from '../../utils/robotCalculations';
import type { CombatBuildSnapshot } from '../../types/combatBuildTypes';

type Db = typeof prisma | Prisma.TransactionClient;

export function buildRow(battleId: number, battleType: string, robotId: number, build: CombatBuildSnapshot): Prisma.BattleParticipantBuildCreateManyInput {
  return {
    battleId,
    robotId,
    battleType,
    baseAttributes: build.baseAttributes as Prisma.InputJsonValue,
    tuning: build.tuning as Prisma.InputJsonValue,
    effectiveAttributes: build.effectiveAttributes as Prisma.InputJsonValue,
    mainWeaponId: build.mainWeapon?.weaponId ?? null,
    mainRefinements: build.mainWeapon ? (build.mainWeapon.refinements as unknown as Prisma.InputJsonValue) : undefined,
    offhandWeaponId: build.offhandWeapon?.weaponId ?? null,
    offhandRefinements: build.offhandWeapon ? (build.offhandWeapon.refinements as unknown as Prisma.InputJsonValue) : undefined,
    loadoutType: build.loadoutType,
    stance: build.stance,
    yieldThreshold: build.yieldThreshold,
  };
}

/**
 * Write the builds of `robots` (prepared robot objects) for one battle.
 * Robots without a captured build (never prepared) are skipped. Never throws.
 */
export async function recordCombatBuilds(
  battleId: number,
  battleType: string,
  robots: ReadonlyArray<{ id: number }>,
  db: Db = prisma,
): Promise<number> {
  try {
    const rows: Prisma.BattleParticipantBuildCreateManyInput[] = [];
    const seen = new Set<number>();
    for (const robot of robots) {
      if (seen.has(robot.id)) continue;
      const build = getCombatBuild(robot);
      if (!build) continue;
      seen.add(robot.id);
      rows.push(buildRow(battleId, battleType, robot.id, build));
    }
    if (rows.length === 0) return 0;
    const result = await db.battleParticipantBuild.createMany({ data: rows, skipDuplicates: true });
    return result.count;
  } catch (error) {
    logger.error(`[CombatBuild] Could not record builds for battle ${battleId}: ${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}
