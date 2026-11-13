/**
 * Season 2 achievement history queries against a real database (PR #577 review).
 *
 * - C24 "Oh My God, They Killed Kenny!" counts only 0-HP destructions: Grand
 *   Melee rows written before yields were recorded separately have
 *   `destroyed: true` for robots that yielded with HP left.
 * - E27/E28/E33 read the ledger only after the latest account reset, which
 *   keeps the ledger but deletes the unlocks.
 * - S13 counts yields forced in 1v1 battles only, now that KotH and Grand Melee
 *   record yields too.
 * - Tournament resumes rebuild battle-time max HP from the recorded build.
 */
import prisma from '../../src/lib/prisma';
import {
  countRobotOutcomes,
  getRobotOutcomeCounts,
  getAttributeUpgradeSpend,
  hasDippedBelow,
} from '../../src/services/achievement/historyTriggers';
import { checkRobotEquippedWeaponType, checkYieldsForcedCumulative } from '../../src/services/achievement/triggerQueries';
import { loadBattleTimeMaxHP } from '../../src/services/battle/combatBuildRecorder';
import { maxHPFromHullIntegrity } from '../../src/shared/utils/robotStats';
import { createTestBattle, createTestRobot, createTestUser, deleteTestUser } from '../testHelpers';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

describe('Season 2 achievement history queries (database)', () => {
  let userId: number;
  let rivalUserId: number;
  let robotId: number;
  let rivalRobotId: number;
  const battleIds: number[] = [];

  beforeAll(async () => {
    userId = (await createTestUser(`t_hist_${suffix}`)).id;
    rivalUserId = (await createTestUser(`t_hist_rival_${suffix}`)).id;
    robotId = (await createTestRobot(userId, `Hist ${suffix}`)).id;
    rivalRobotId = (await createTestRobot(rivalUserId, `HistRival ${suffix}`)).id;
  });

  afterAll(async () => {
    await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
    await prisma.financialLedger.deleteMany({ where: { userId: { in: [userId, rivalUserId] } } });
    await prisma.resetLog.deleteMany({ where: { userId } });
    await deleteTestUser(userId);
    await deleteTestUser(rivalUserId);
    await prisma.$disconnect();
  });

  const battle = async (opts: Parameters<typeof createTestBattle>[0]): Promise<number> => {
    const created = await createTestBattle(opts);
    battleIds.push(created.id);
    return created.id;
  };

  // Issue #601: S1–S3 "Equip a robot with a … weapon" read the equipped slots.
  it('finds a weapon type only in the robot\'s equipped slots, not in storage', async () => {
    const [melee, energy] = await Promise.all([
      prisma.weapon.findFirstOrThrow({ where: { weaponType: 'melee' }, select: { id: true } }),
      prisma.weapon.findFirstOrThrow({ where: { weaponType: 'energy' }, select: { id: true } }),
    ]);
    const meleeItem = await prisma.weaponInventory.create({ data: { userId, weaponId: melee.id, pricePaid: 0 } });
    const energyItem = await prisma.weaponInventory.create({ data: { userId, weaponId: energy.id, pricePaid: 0 } });
    try {
      // Both owned, neither equipped.
      await expect(checkRobotEquippedWeaponType(userId, robotId, 'melee')).resolves.toBe(false);
      await prisma.robot.update({ where: { id: robotId }, data: { offhandWeaponId: meleeItem.id } });
      await expect(checkRobotEquippedWeaponType(userId, robotId, 'melee')).resolves.toBe(true);
      await expect(checkRobotEquippedWeaponType(userId, robotId, 'energy')).resolves.toBe(false);
      await prisma.robot.update({ where: { id: robotId }, data: { mainWeaponId: energyItem.id } });
      await expect(checkRobotEquippedWeaponType(userId, robotId, 'energy')).resolves.toBe(true);
      // Another stable's id never matches.
      await expect(checkRobotEquippedWeaponType(rivalUserId, robotId, 'energy')).resolves.toBe(false);
    } finally {
      await prisma.robot.update({ where: { id: robotId }, data: { mainWeaponId: null, offhandWeaponId: null } });
      await prisma.weaponInventory.deleteMany({ where: { id: { in: [meleeItem.id, energyItem.id] } } });
    }
  });

  it('counts a destruction only when the robot ended at 0 HP', async () => {
    // A real destruction, and an old-style Grand Melee yield stored as destroyed.
    await battle({ robot1Id: robotId, robot2Id: rivalRobotId, battleType: 'grand_melee', winnerId: rivalRobotId, robot1Destroyed: true, robot1FinalHP: 0 });
    await battle({ robot1Id: robotId, robot2Id: rivalRobotId, battleType: 'grand_melee', winnerId: rivalRobotId, robot1Destroyed: true, robot1FinalHP: 300 });
    await battle({ robot1Id: robotId, robot2Id: rivalRobotId, battleType: 'koth', winnerId: rivalRobotId, robot1Yielded: true, robot1FinalHP: 250 });

    await expect(countRobotOutcomes(robotId, 'destroyed')).resolves.toBe(1);
    await expect(countRobotOutcomes(robotId, 'yielded')).resolves.toBe(1);
    const counts = await getRobotOutcomeCounts([robotId]);
    expect(counts.get(robotId)).toEqual({ yielded: 1, destroyed: 1 });
  });

  it('reads the ledger only after the latest account reset', async () => {
    const ledgerRow = (amount: number, balanceAfter: number, transactionType: string, createdAt: Date) => ({
      cycleNumber: 1, userId, transactionType, amount, balanceAfter, description: 'test', createdAt,
    });
    const beforeReset = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const resetAt = new Date(Date.now() - 60 * 60 * 1000);
    const afterReset = new Date(Date.now() - 30 * 60 * 1000);
    await prisma.financialLedger.createMany({
      data: [
        ledgerRow(-5_000_000, 50_000, 'attribute_upgrade', beforeReset),
        ledgerRow(-200_000, 2_800_000, 'attribute_upgrade', afterReset),
      ],
    });

    // Before any reset: all rows count, including the ₡50K low point.
    await expect(getAttributeUpgradeSpend(userId)).resolves.toBe(5_200_000);
    await expect(hasDippedBelow(userId, 100_000)).resolves.toBe(true);

    await prisma.resetLog.create({
      data: { userId, robotsDeleted: 0, weaponsDeleted: 0, facilitiesDeleted: 0, creditsBeforeReset: 0, resetAt },
    });

    // After the reset: only post-reset rows count.
    await expect(getAttributeUpgradeSpend(userId)).resolves.toBe(200_000);
    await expect(hasDippedBelow(userId, 100_000)).resolves.toBe(false);
  });

  it('credits forced yields from 1v1 battles only', async () => {
    const forced = (battleType: string): Promise<number> => battle({
      robot1Id: robotId, robot2Id: rivalRobotId, battleType, winnerId: robotId, robot2Yielded: true,
    });
    await forced('league_1v1');
    await forced('grand_melee');
    await forced('koth');

    await expect(checkYieldsForcedCumulative(userId, 1)).resolves.toBe(true);
    await expect(checkYieldsForcedCumulative(userId, 2)).resolves.toBe(false);
  });

  it('rebuilds battle-time max HP from the recorded build', async () => {
    const battleId = await battle({ robot1Id: robotId, robot2Id: rivalRobotId, battleType: 'tournament_1v1', winnerId: robotId });
    await prisma.battleParticipantBuild.create({
      data: {
        battleId, robotId, battleType: 'tournament_1v1',
        baseAttributes: { hullIntegrity: 10 }, tuning: { hullIntegrity: 4 },
        effectiveAttributes: { hullIntegrity: 14.5 },
        loadoutType: 'single', stance: 'balanced', yieldThreshold: 10,
      },
    });

    const maxHP = await loadBattleTimeMaxHP(battleId);
    expect(maxHP.get(robotId)).toBe(maxHPFromHullIntegrity(14.5));
    // No build for the rival: callers fall back to the stored max HP.
    expect(maxHP.has(rivalRobotId)).toBe(false);
  });
});
