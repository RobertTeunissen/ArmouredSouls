/**
 * Spec #55 task 7.3 (R9.7) — after a Season_Rollover purges
 * `user_achievements`, `reawardPreservedStateAchievements` re-awards the
 * onboarding achievement to Active_Automatons exactly like Human_Stables
 * (decided: parity; no code change). Active_Automatons are created with
 * `hasCompletedOnboarding = true` and `isGenerated = false`, so the existing
 * query already includes them.
 *
 * The sweep normally covers every surviving stable; here its user query is
 * narrowed to this suite's two fixtures so the shared database's other
 * stables are left alone. The eligibility filter itself still runs.
 */
import prisma from '../../src/lib/prisma';
import { reawardPreservedStateAchievements } from '../../src/services/achievement/preservedStateAchievements';
import { ACHIEVEMENTS } from '../../src/config/achievements';
import { createAutomatonStable, deleteAutomatonStables } from '../helpers/automatonStable';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const ONBOARDING = ACHIEVEMENTS.find((a) => a.triggerType === 'onboarding');

describe('Preserved-state achievement parity for Active_Automatons (Spec #55 task 7.3)', () => {
  let automatonUserId: number;
  let humanUserId: number;

  beforeAll(async () => {
    automatonUserId = (await createAutomatonStable({ tag: `pre_${suffix}`, balance: 3_000_000, blueprints: [] })).userId;
    humanUserId = (await prisma.user.create({
      data: {
        username: `t55pre_h_${suffix}`,
        passwordHash: 'x',
        stableName: `Pre Human ${suffix}`.slice(0, 30),
        hasCompletedOnboarding: true,
        currency: 3_000_000,
      },
    })).id;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    const ids = [automatonUserId, humanUserId];
    await prisma.userAchievement.deleteMany({ where: { userId: { in: ids } } });
    await prisma.financialLedger.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await deleteAutomatonStables([automatonUserId]);
    await prisma.user.deleteMany({ where: { id: humanUserId } });
    await prisma.$disconnect();
  });

  it('re-awards the onboarding achievement with the same rewards to both stables', async () => {
    expect(ONBOARDING).toBeDefined();
    const ids = [automatonUserId, humanUserId];
    const before = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, currency: true, prestige: true } });

    const userDelegate = prisma.user;
    const realFindMany = userDelegate.findMany.bind(userDelegate);
    const spy = jest.spyOn(userDelegate, 'findMany').mockImplementationOnce(((args: { where?: object }) =>
      realFindMany({ ...args, where: { AND: [args.where ?? {}, { id: { in: ids } }] } })) as unknown as typeof userDelegate.findMany);

    const result = await reawardPreservedStateAchievements();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();

    expect(result).toEqual({ stablesChecked: 2, achievementsAwarded: 2 });

    const unlocked = await prisma.userAchievement.findMany({
      where: { userId: { in: ids }, achievementId: ONBOARDING?.id },
      select: { userId: true },
      orderBy: { userId: 'asc' },
    });
    expect(unlocked.map((u) => u.userId)).toEqual([...ids].sort((a, b) => a - b));

    const after = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, currency: true, prestige: true } });
    const delta = (id: number) => {
      const b = before.find((u) => u.id === id);
      const a = after.find((u) => u.id === id);
      return { credits: (a?.currency ?? 0) - (b?.currency ?? 0), prestige: (a?.prestige ?? 0) - (b?.prestige ?? 0) };
    };
    expect(delta(automatonUserId)).toEqual(delta(humanUserId));
    expect(delta(automatonUserId).prestige).toBe(ONBOARDING?.rewardPrestige);
  });

  it('awards nothing on a second sweep', async () => {
    const ids = [automatonUserId, humanUserId];
    const userDelegate = prisma.user;
    const realFindMany = userDelegate.findMany.bind(userDelegate);
    const spy = jest.spyOn(userDelegate, 'findMany').mockImplementationOnce(((args: { where?: object }) =>
      realFindMany({ ...args, where: { AND: [args.where ?? {}, { id: { in: ids } }] } })) as unknown as typeof userDelegate.findMany);

    const result = await reawardPreservedStateAchievements();
    spy.mockRestore();

    expect(result).toEqual({ stablesChecked: 2, achievementsAwarded: 0 });
  });
});
