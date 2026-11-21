/**
 * One-off WimpBot conversion of three-robot AverageBot / ExpertBot generated
 * stables (generatedStableConversion.ts), against the real DB.
 */

import prisma from '../src/lib/prisma';
import { createGeneratedStables } from '../src/utils/userGeneration';
import { TIER_CONFIGS } from '../src/utils/tierConfig';
import { applyWimpBotConversion, planWimpBotConversion } from '../src/utils/generatedStableConversion';

/** Remove every auto-generated stable and what it owns (standings have no FK). */
async function cleanupAutoUsers(): Promise<void> {
  const userIds = (await prisma.user.findMany({ where: { username: { startsWith: 'auto_' } }, select: { id: true } })).map((u) => u.id);
  if (userIds.length === 0) return;
  const robotIds = (await prisma.robot.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((r) => r.id);
  const teamIds = (await prisma.teamBattle.findMany({ where: { stableId: { in: userIds } }, select: { id: true } })).map((t) => t.id);
  await prisma.standing.deleteMany({
    where: { OR: [{ entityType: 'robot', entityId: { in: robotIds } }, { entityType: 'team', entityId: { in: teamIds } }] },
  });
  await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.facility.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

/** Build stables the way the Oct 2026 generator did: three robots in every tier. */
async function createThreeRobotStables(count: number): Promise<string[]> {
  const original = TIER_CONFIGS.map((t) => t.robotCount);
  TIER_CONFIGS.forEach((t) => { t.robotCount = 3; });
  try {
    return (await createGeneratedStables(count)).usernames;
  } finally {
    TIER_CONFIGS.forEach((t, i) => { t.robotCount = original[i]; });
  }
}

const robotsOf = (usernames: string[]) =>
  prisma.robot.findMany({
    where: { user: { username: { in: usernames } } },
    include: { user: true, mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } },
    orderBy: { id: 'asc' },
  });

describe('WimpBot conversion of three-robot generated stables', () => {
  beforeAll(async () => { await prisma.$connect(); });
  beforeEach(async () => { await cleanupAutoUsers(); });
  afterAll(async () => {
    await cleanupAutoUsers();
    await prisma.$disconnect();
  });

  it('plans only the three-robot AverageBot / ExpertBot stables and writes nothing', async () => {
    await createThreeRobotStables(3); // one stable per tier, three robots each
    await createGeneratedStables(3); // correctly built: 3 / 2 / 1 robots
    const before = await prisma.robot.findMany({ select: { id: true, name: true, combatPower: true }, orderBy: { id: 'asc' } });

    const plan = await planWimpBotConversion();

    expect(plan.stables.map((s) => s.oldUsername.replace(/_\d+$/, ''))).toEqual(['auto_averagebot', 'auto_expertbot']);
    expect(plan.stables.every((s) => s.robots.length === 3)).toBe(true);
    // WimpBot numbering continues after the two existing WimpBot stables.
    expect(plan.stables.map((s) => s.newUsername)).toEqual(['auto_wimpbot_0003', 'auto_wimpbot_0004']);
    expect(await prisma.robot.findMany({ select: { id: true, name: true, combatPower: true }, orderBy: { id: 'asc' } })).toEqual(before);
    // Deterministic: planning twice gives the same plan.
    expect(await planWimpBotConversion()).toEqual(plan);
  });

  it('turns every robot into a WimpBot and keeps results, teams, standings and subscriptions', async () => {
    const usernames = await createThreeRobotStables(3);
    const sources = usernames.filter((u) => !u.startsWith('auto_wimpbot_'));
    const sourceRobots = await robotsOf(sources);
    // Give the robots a record to prove it survives.
    for (const robot of sourceRobots) {
      await prisma.robot.update({
        where: { id: robot.id },
        data: { wins: 7, losses: 2, elo: 1400, fame: 30, damageTaken: 40, currentHP: 10, battleReadiness: 20 },
      });
    }
    const teamsBefore = await prisma.teamBattle.findMany({
      where: { stableId: { in: sourceRobots.map((r) => r.userId) } },
      include: { members: true },
      orderBy: { id: 'asc' },
    });
    const standingsBefore = await prisma.standing.findMany({ orderBy: { id: 'asc' } });
    const subscriptionsBefore = await prisma.subscription.findMany({ orderBy: { id: 'asc' } });

    const plan = await planWimpBotConversion();
    expect(await applyWimpBotConversion(plan)).toBe(2);

    const after = await prisma.robot.findMany({
      where: { id: { in: sourceRobots.map((r) => r.id) } },
      include: { user: true, mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } },
      orderBy: { id: 'asc' },
    });
    const wimp = TIER_CONFIGS[0];
    for (const robot of after) {
      const old = sourceRobots.find((r) => r.id === robot.id)!;
      expect(robot.user.username).toMatch(/^auto_wimpbot_\d{4}$/);
      expect(robot.name.startsWith('WimpBot ')).toBe(true);
      expect(Number(robot.combatPower)).toBe(1);
      expect(Number(robot.formationTactics)).toBe(1);
      expect(robot).toMatchObject({
        maxHP: 55, currentHP: 55, maxShield: 4, currentShield: 4, damageTaken: 0, battleReadiness: 100,
        imageUrl: '/assets/robots/wimpbot_512x512.webp',
        wins: 7, losses: 2, elo: 1400, fame: 30,
        loadoutType: old.loadoutType, stance: old.stance, yieldThreshold: old.yieldThreshold,
        mainWeaponId: old.mainWeaponId, offhandWeaponId: old.offhandWeaponId,
      });
      expect(robot.mainWeapon!.weapon.cost).toBeLessThanOrEqual(wimp.priceTier.max);
      expect(robot.mainWeapon!.weapon.handsRequired).toBe(old.mainWeapon!.weapon.handsRequired);
      if (robot.offhandWeapon) {
        expect(robot.offhandWeapon.weapon.cost).toBeLessThanOrEqual(wimp.priceTier.max);
        expect(robot.offhandWeapon.weapon.handsRequired).toBe(old.offhandWeapon!.weapon.handsRequired);
        if (robot.loadoutType === 'dual_wield') expect(robot.offhandWeapon.weaponId).toBe(robot.mainWeapon!.weaponId);
      }
    }
    expect(new Set((await prisma.robot.findMany({ select: { name: true } })).map((r) => r.name)).size)
      .toBe(await prisma.robot.count());

    expect(await prisma.teamBattle.findMany({
      where: { id: { in: teamsBefore.map((t) => t.id) } },
      include: { members: true },
      orderBy: { id: 'asc' },
    })).toEqual(teamsBefore);
    expect(await prisma.standing.findMany({ orderBy: { id: 'asc' } })).toEqual(standingsBefore);
    expect(await prisma.subscription.findMany({ orderBy: { id: 'asc' } })).toEqual(subscriptionsBefore);
  }, 60000);

  it('is a no-op the second time', async () => {
    await createThreeRobotStables(3);
    await applyWimpBotConversion(await planWimpBotConversion());
    const plan = await planWimpBotConversion();
    expect(plan.stables).toEqual([]);
    expect(await applyWimpBotConversion(plan)).toBe(0);
  }, 60000);

  it('refuses a stale plan', async () => {
    await createThreeRobotStables(3);
    const plan = await planWimpBotConversion();
    await applyWimpBotConversion(plan);
    await expect(applyWimpBotConversion(plan)).rejects.toThrow(/changed since planning/);
  }, 60000);
});
