/**
 * Achievement unlock serialization (pre-existing duplicate-insert fix).
 *
 * Team tournament, KotH and Grand Melee orchestrators run
 * `checkAndAwardAchievements` for every participant in one `Promise.all`.
 * Several of those robots can belong to one stable. `checkAndAward` reads the
 * stable's unlocks once per call, so overlapping calls for the same user used
 * to insert the same `(userId, achievementId)` twice. The second insert hit
 * `user_achievements_user_id_achievement_id_key`; the P2002 was caught, but
 * Prisma logged it as `prisma:error` during every bulk cycle.
 *
 * This suite reproduces the 3v3 team-tournament pattern against the real
 * database: one stable with three robots plus a second stable with one robot,
 * all evaluated concurrently. Every attempted `user_achievements` insert must
 * succeed, each achievement unlocks once per stable, and each unlock has
 * exactly one credit mutation.
 */
import prisma, { observePrismaStatements } from '../../src/lib/prisma';
import { checkAndAwardAchievements } from '../../src/services/battle/battlePostCombat';
import { buildAchievementRewardEventId } from '../../src/services/financial/financialEventIdentity';
import { ACHIEVEMENTS } from '../../src/config/achievements';
import { createTestRobot, createTestUser, deleteTestUser } from '../testHelpers';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const INSERT_USER_ACHIEVEMENT = /insert into "public"\."user_achievements"/i;

/** Battle data shaped like `awardTeamTournamentBattleAchievements` sends it. */
const TEAM_TOURNAMENT_WIN = {
  won: true,
  destroyed: false,
  finalHpPercent: 0,
  eloChange: 0,
  opponentElo: 3000,
  yielded: false,
  opponentYielded: false,
  previousBattleLost: false,
  damageDealt: 100,
  opponentDamageDealt: 0,
  loadoutType: 'single',
  stance: 'balanced',
  yieldThreshold: 0,
  hasTuning: false,
  hasMainWeapon: true,
  battleType: 'tournament_3v3',
  battleDurationSeconds: 60,
};

interface Fixture {
  userId: number;
  robotIds: number[];
}

async function createStable(name: string, robots: number): Promise<Fixture> {
  // createTestUser sets prestige 1000, which meets user-scoped P1.
  const user = await createTestUser(`t_ach_${name}_${suffix}`);
  const robotIds: number[] = [];
  for (let i = 0; i < robots; i++) {
    const robot = await createTestRobot(user.id, `AchSer ${name}${i} ${suffix}`);
    // One win meets robot-scoped C1.
    await prisma.robot.update({ where: { id: robot.id }, data: { wins: 1 } });
    robotIds.push(robot.id);
  }
  return { userId: user.id, robotIds };
}

describe('Achievement unlock serialization for concurrent battle participants', () => {
  let stableA: Fixture;
  let stableB: Fixture;

  beforeAll(async () => {
    stableA = await createStable('a', 3);
    stableB = await createStable('b', 1);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    const ids = [stableA?.userId, stableB?.userId].filter((id): id is number => id !== undefined);
    await prisma.userAchievement.deleteMany({ where: { userId: { in: ids } } });
    await prisma.financialLedger.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    for (const id of ids) await deleteTestUser(id);
    await prisma.$disconnect();
  });

  it('attempts and unlocks each achievement once per stable, with one credit mutation per unlock', async () => {
    const ids = [stableA.userId, stableB.userId];
    const before = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, currency: true } });

    const statements: string[] = [];
    const stop = observePrismaStatements((sql) => statements.push(sql));
    try {
      await Promise.all([
        ...stableA.robotIds.map((robotId) => checkAndAwardAchievements(stableA.userId, robotId, TEAM_TOURNAMENT_WIN)),
        ...stableB.robotIds.map((robotId) => checkAndAwardAchievements(stableB.userId, robotId, TEAM_TOURNAMENT_WIN)),
      ]);
    } finally {
      stop();
    }

    const rows = await prisma.userAchievement.findMany({
      where: { userId: { in: ids } },
      select: { id: true, userId: true, achievementId: true, robotId: true },
    });

    // (a) Every attempted insert succeeded: no P2002 on this path.
    const inserts = statements.filter((sql) => INSERT_USER_ACHIEVEMENT.test(sql));
    expect(inserts.length).toBe(rows.length);

    for (const stable of [stableA, stableB]) {
      const own = rows.filter((r) => r.userId === stable.userId);

      // (b, c) Robot-scoped C1 once, credited to one of the stable's robots;
      // user-scoped P1 once, with no robot.
      const c1 = own.filter((r) => r.achievementId === 'C1');
      expect(c1).toHaveLength(1);
      expect(stable.robotIds).toContain(c1[0].robotId);
      const p1 = own.filter((r) => r.achievementId === 'P1');
      expect(p1).toHaveLength(1);
      expect(p1[0].robotId).toBeNull();

      // (d) One achievement_reward credit mutation per unlock, keyed by unlock id.
      const ledger = await prisma.financialLedger.findMany({
        where: { userId: stable.userId, transactionType: 'achievement_reward' },
        select: { financialEventId: true },
      });
      expect(ledger.map((l) => l.financialEventId).sort()).toEqual(
        own.map((r) => buildAchievementRewardEventId(r.id, stable.userId)).sort(),
      );

      // (e) Balance moved by exactly the unlocked rewards.
      const after = await prisma.user.findUniqueOrThrow({ where: { id: stable.userId }, select: { currency: true } });
      const start = before.find((u) => u.id === stable.userId)?.currency ?? 0;
      const expected = own.reduce((sum, r) => sum + (ACHIEVEMENTS.find((a) => a.id === r.achievementId)?.rewardCredits ?? 0), 0);
      expect(after.currency - start).toBe(expected);
    }

    // No achievement appears twice for one stable.
    const keys = rows.map((r) => `${r.userId}:${r.achievementId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
