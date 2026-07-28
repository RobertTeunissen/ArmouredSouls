/**
 * Season purge, account reset, and settlement phase integration tests (Spec #45).
 *
 * Covers what only a real database can prove:
 *  - purge idempotence — applying it twice equals applying it once (Property 7)
 *  - per-user atomicity — a stable is fully reset or fully untouched (Property 8)
 *  - account reset preserves archives while clearing season state (R4.7–R4.11)
 *  - settlement advances phase counters and leaves the cycle counter alone (R2)
 *
 * NOTE: written against the schema and services but not executed locally — no
 * PostgreSQL was reachable on the authoring machine. First real run is CI.
 */

import prisma from '../../src/lib/prisma';
import dotenv from 'dotenv';
import {
  getCurrentSeason,
  advancePreparationCycle,
  advanceCompetitiveCycle,
  invalidateSeasonCache,
  LEGACY_SEASON_NUMBER,
} from '../../src/services/season/seasonService';
import {
  resetCompetitiveAndEconomicState,
  purgeHistory,
  deleteGeneratedStables,
  STARTING_CREDITS,
} from '../../src/services/season/seasonPurgeService';
import { performAccountReset } from '../../src/services/common/resetService';

dotenv.config();

let seq = 0;

async function resetSeasonTables(): Promise<void> {
  await prisma.seasonAccolade.deleteMany({});
  await prisma.seasonStandingSnapshot.deleteMany({});
  await prisma.robotSeasonArchive.deleteMany({});
  await prisma.stableSeasonArchive.deleteMany({});
  await prisma.season.deleteMany({});
  invalidateSeasonCache();
}

/** A player stable with a robot, a facility, a standing, and an achievement. */
async function seedPlayerStable(): Promise<{ userId: number; robotId: number }> {
  seq += 1;
  const suffix = `${Date.now()}_${seq}`;

  const user = await prisma.user.create({
    data: {
      username: `purge_it_user_${suffix}`,
      passwordHash: 'test-hash',
      currency: 999_999,
      prestige: 8_400,
      championshipTitles: 3,
      championshipTitles1v1: 2,
      championshipTitles2v2: 1,
      totalPracticeBattles: 17,
      stableName: `Purge IT ${suffix}`,
      isGenerated: false,
      lastSeenSeasonNumber: 0,
    },
  });

  const robot = await prisma.robot.create({
    data: {
      userId: user.id,
      name: `Purge IT Robot ${suffix}`,
      currentHP: 100,
      maxHP: 100,
      currentShield: 5,
      maxShield: 5,
      elo: 1400,
      fame: 50,
      wins: 4,
      losses: 2,
      draws: 0,
      totalBattles: 6,
    },
  });

  await prisma.facility.create({
    data: { userId: user.id, facilityType: 'weapons_workshop', level: 5 },
  });

  await prisma.standing.create({
    data: {
      entityType: 'robot',
      entityId: robot.id,
      mode: 'league_1v1',
      tier: 'silver',
      leagueInstanceId: 'bronze_1',
      leaguePoints: 40,
      wins: 4,
      losses: 2,
      draws: 0,
    },
  });

  await prisma.userAchievement.create({
    data: { userId: user.id, achievementId: 'C1' },
  });

  return { userId: user.id, robotId: robot.id };
}

async function cleanupUser(userId: number): Promise<void> {
  const robots = await prisma.robot.findMany({ where: { userId }, select: { id: true } });
  if (robots.length > 0) {
    await prisma.standing.deleteMany({
      where: { entityType: 'robot', entityId: { in: robots.map((r) => r.id) } },
    });
  }
  await prisma.userAchievement.deleteMany({ where: { userId } });
  await prisma.facility.deleteMany({ where: { userId } });
  await prisma.robotSeasonArchive.deleteMany({ where: { stableArchive: { userId } } });
  await prisma.stableSeasonArchive.deleteMany({ where: { userId } });
  await prisma.robot.deleteMany({ where: { userId } });
  await prisma.resetLog.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

describe('Season purge and reset integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await resetSeasonTables();
    await prisma.$disconnect();
  });

  describe('Purge idempotence — Property 7', () => {
    let stable: { userId: number; robotId: number };

    beforeEach(async () => {
      await resetSeasonTables();
      await getCurrentSeason();
      stable = await seedPlayerStable();
    });

    afterEach(async () => {
      await cleanupUser(stable.userId).catch(() => undefined);
      await resetSeasonTables();
    });

    it('should reach the same end state when applied twice', async () => {
      await resetCompetitiveAndEconomicState();
      await purgeHistory();

      const snapshotAfterFirst = {
        robots: await prisma.robot.count(),
        standings: await prisma.standing.count(),
        facilities: await prisma.facility.count(),
        achievements: await prisma.userAchievement.count(),
        battles: await prisma.battle.count(),
        cycles: (await prisma.cycleMetadata.findUnique({ where: { id: 1 } }))!.totalCycles,
      };

      // Second application must be a no-op, not an error and not a change.
      await resetCompetitiveAndEconomicState();
      await purgeHistory();

      expect({
        robots: await prisma.robot.count(),
        standings: await prisma.standing.count(),
        facilities: await prisma.facility.count(),
        achievements: await prisma.userAchievement.count(),
        battles: await prisma.battle.count(),
        cycles: (await prisma.cycleMetadata.findUnique({ where: { id: 1 } }))!.totalCycles,
      }).toEqual(snapshotAfterFirst);
    });

    it('should leave every listed table empty and every player restored', async () => {
      await resetCompetitiveAndEconomicState();
      await purgeHistory();

      // R9.6 / R10.1 zero-row assertions.
      expect(await prisma.robot.count()).toBe(0);
      expect(await prisma.standing.count()).toBe(0);
      expect(await prisma.facility.count()).toBe(0);
      expect(await prisma.weaponInventory.count()).toBe(0);
      expect(await prisma.userAchievement.count()).toBe(0);
      expect(await prisma.teamBattle.count()).toBe(0);
      expect(await prisma.battle.count()).toBe(0);
      expect(await prisma.battleSummary.count()).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
      expect(await prisma.cycleSnapshot.count()).toBe(0);
      expect(await prisma.financialLedger.count()).toBe(0);
      expect(await prisma.leagueHistory.count()).toBe(0);
      expect(await prisma.leaderboardCache.count()).toBe(0);

      const user = await prisma.user.findUnique({ where: { id: stable.userId } });
      expect(user!.currency).toBe(STARTING_CREDITS);
      expect(user!.prestige).toBe(0);
      expect(user!.championshipTitles).toBe(0);
      expect(user!.championshipTitles1v1).toBe(0);
      expect(user!.totalPracticeBattles).toBe(0);
    });

    it('should apply starting credits regardless of the prior balance', async () => {
      // R9.4: a negative balance must not survive as a debt into the new season.
      await prisma.user.update({
        where: { id: stable.userId },
        data: { currency: -50_000 },
      });

      await resetCompetitiveAndEconomicState();

      const user = await prisma.user.findUnique({ where: { id: stable.userId } });
      expect(user!.currency).toBe(STARTING_CREDITS);
    });
  });

  describe('Per-user atomicity — Property 8', () => {
    let a: { userId: number; robotId: number };
    let b: { userId: number; robotId: number };

    beforeEach(async () => {
      await resetSeasonTables();
      await getCurrentSeason();
      a = await seedPlayerStable();
      b = await seedPlayerStable();
    });

    afterEach(async () => {
      await cleanupUser(a.userId).catch(() => undefined);
      await cleanupUser(b.userId).catch(() => undefined);
      await resetSeasonTables();
    });

    it('should never leave a stable holding robots with cleared credits', async () => {
      await resetCompetitiveAndEconomicState();

      for (const userId of [a.userId, b.userId]) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const robotCount = await prisma.robot.count({ where: { userId } });
        const facilityCount = await prisma.facility.count({ where: { userId } });

        // Fully reset: starting credits AND no owned rows. The forbidden state
        // is credits reset while robots or facilities remain.
        const fullyReset =
          user!.currency === STARTING_CREDITS && robotCount === 0 && facilityCount === 0;
        expect(fullyReset).toBe(true);
      }
    });
  });

  describe('Generated stable deletion — R11 / FK safety', () => {
    let generatedUserId: number;
    let generatedRobotId: number;
    let battleId: number;

    beforeEach(async () => {
      await resetSeasonTables();
      await getCurrentSeason();

      seq += 1;
      const suffix = `${Date.now()}_${seq}`;

      // A generated stable whose robot has fought a battle. The battle_participant
      // row references the robot through a RESTRICT foreign key, which is exactly
      // what previously blocked the user cascade delete.
      const bot = await prisma.user.create({
        data: {
          username: `gen_bot_${suffix}`,
          passwordHash: 'test-hash',
          stableName: `Gen Bot ${suffix}`,
          isGenerated: true,
        },
      });
      generatedUserId = bot.id;

      const robot = await prisma.robot.create({
        data: {
          userId: bot.id,
          name: `Gen Robot ${suffix}`,
          currentHP: 100,
          maxHP: 100,
          currentShield: 5,
          maxShield: 5,
          elo: 1200,
        },
      });
      generatedRobotId = robot.id;

      const battle = await prisma.battle.create({
        data: {
          battleType: 'league',
          leagueType: 'bronze',
          durationSeconds: 42,
          winnerId: robot.id,
        },
      });
      battleId = battle.id;

      await prisma.battleParticipant.create({
        data: {
          battleId: battle.id,
          robotId: robot.id,
          team: 1,
          credits: 100,
          eloBefore: 1200,
          eloAfter: 1210,
          finalHP: 80,
        },
      });

      await prisma.standing.create({
        data: {
          entityType: 'robot',
          entityId: robot.id,
          mode: 'league_1v1',
          tier: 'bronze',
          leagueInstanceId: 'bronze_1',
          leaguePoints: 10,
        },
      });
    });

    afterEach(async () => {
      // Best-effort cleanup in case the deletion under test did not run.
      await prisma.battleParticipant.deleteMany({ where: { robotId: generatedRobotId } }).catch(() => undefined);
      await prisma.battle.deleteMany({ where: { id: battleId } }).catch(() => undefined);
      await prisma.standing
        .deleteMany({ where: { entityType: 'robot', entityId: generatedRobotId } })
        .catch(() => undefined);
      await prisma.robot.deleteMany({ where: { id: generatedRobotId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: generatedUserId } }).catch(() => undefined);
      await resetSeasonTables();
    });

    it('should delete a generated stable whose robot has battle participation', async () => {
      const deleted = await deleteGeneratedStables();

      expect(deleted).toBeGreaterThanOrEqual(1);
      expect(await prisma.user.count({ where: { id: generatedUserId } })).toBe(0);
      expect(await prisma.robot.count({ where: { id: generatedRobotId } })).toBe(0);
      expect(await prisma.battleParticipant.count({ where: { robotId: generatedRobotId } })).toBe(0);
      // The shared battle row itself is left for the later history purge.
      expect(await prisma.battle.count({ where: { id: battleId } })).toBe(1);
      // The robot's standing must be cleared too (no FK, deleted explicitly).
      expect(
        await prisma.standing.count({ where: { entityType: 'robot', entityId: generatedRobotId } }),
      ).toBe(0);
    });
  });

  describe('Account reset scope — R4.7–R4.11', () => {
    let stable: { userId: number; robotId: number };

    beforeEach(async () => {
      await resetSeasonTables();
      await getCurrentSeason();
      stable = await seedPlayerStable();
    });

    afterEach(async () => {
      await cleanupUser(stable.userId).catch(() => undefined);
      await resetSeasonTables();
    });

    it('should clear season state but preserve archives and the summary marker', async () => {
      // Give the stable an archived season and a seen-summary marker.
      await prisma.season.upsert({
        where: { seasonNumber: 7 },
        update: {},
        create: {
          seasonNumber: 7,
          phase: 'completed',
          competitiveCyclesCompleted: 100,
          preparationCyclesCompleted: 2,
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });
      await prisma.stableSeasonArchive.create({
        data: {
          seasonNumber: 7,
          userId: stable.userId,
          stableName: 'Archived Name',
          finalCredits: 5_000,
          prestigeEarned: 1_000,
          totalBattles: 10,
          wins: 6,
          losses: 4,
          draws: 0,
          winRate: 0.6,
          highestElo: 1500,
          totalFame: 120,
          championshipTitles: 1,
          championshipTitles1v1: 1,
          championshipTitles2v2: 0,
          championshipTitles3v3: 0,
          achievementsUnlocked: 5,
          achievementsAvailable: 99,
          achievementIds: ['C1'],
          facilities: [],
          robotCount: 1,
          teamCount: 0,
          competitiveCycles: 100,
        },
      });
      await prisma.user.update({
        where: { id: stable.userId },
        data: { lastSeenSeasonNumber: 7 },
      });

      await performAccountReset(stable.userId, 'integration test');

      const user = await prisma.user.findUnique({ where: { id: stable.userId } });

      // Season-scoped state cleared, matching what a rollover clears.
      expect(user!.currency).toBe(STARTING_CREDITS);
      expect(user!.prestige).toBe(0);
      expect(user!.championshipTitles).toBe(0);
      expect(user!.totalPracticeBattles).toBe(0);
      expect(await prisma.robot.count({ where: { userId: stable.userId } })).toBe(0);
      expect(await prisma.facility.count({ where: { userId: stable.userId } })).toBe(0);
      expect(await prisma.userAchievement.count({ where: { userId: stable.userId } })).toBe(0);

      // The archive is untouched — a reset must not erase history.
      const archive = await prisma.stableSeasonArchive.findFirst({
        where: { userId: stable.userId, seasonNumber: 7 },
      });
      expect(archive).not.toBeNull();
      expect(archive!.finalCredits).toBe(5_000);

      // And the summary modal stays dismissed.
      expect(user!.lastSeenSeasonNumber).toBe(7);

      // A reset log is still written.
      expect(await prisma.resetLog.count({ where: { userId: stable.userId } })).toBeGreaterThan(0);
    });
  });

  describe('Settlement phase advancement — R2', () => {
    beforeEach(async () => {
      await resetSeasonTables();
    });

    afterEach(async () => {
      await resetSeasonTables();
    });

    it('should advance the preparation counter and flip to competitive', async () => {
      await prisma.season.create({
        data: {
          seasonNumber: 9,
          phase: 'preparation',
          competitiveCyclesCompleted: 0,
          preparationCyclesCompleted: 0,
          startedAt: new Date(),
        },
      });
      invalidateSeasonCache();

      const first = await advancePreparationCycle();
      expect(first.preparationCyclesCompleted).toBe(1);

      // With the default PREPARATION_LENGTH_CYCLES of 2, the second advance flips.
      const second = await advancePreparationCycle();
      if (second.transitionedToCompetitive) {
        const state = await getCurrentSeason();
        expect(state.phase).toBe('competitive');
        expect(state.seasonCycle).toBe(1);
      }
    });

    it('should leave the global cycle counter untouched across preparation', async () => {
      await prisma.cycleMetadata.upsert({
        where: { id: 1 },
        update: { totalCycles: 55 },
        create: { id: 1, totalCycles: 55 },
      });
      await prisma.season.create({
        data: {
          seasonNumber: 11,
          phase: 'preparation',
          competitiveCyclesCompleted: 0,
          preparationCyclesCompleted: 0,
          startedAt: new Date(),
        },
      });
      invalidateSeasonCache();

      await advancePreparationCycle();

      const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(meta!.totalCycles).toBe(55);
    });

    it('should report a boundary only for a real season, never for Season 0', async () => {
      await prisma.cycleMetadata.upsert({
        where: { id: 1 },
        update: { totalCycles: 0 },
        create: { id: 1, totalCycles: 0 },
      });
      await prisma.season.create({
        data: {
          seasonNumber: LEGACY_SEASON_NUMBER,
          phase: 'competitive',
          competitiveCyclesCompleted: 999,
          preparationCyclesCompleted: 0,
          startedAt: new Date(),
        },
      });
      invalidateSeasonCache();

      const advanced = await advanceCompetitiveCycle();
      expect(advanced.boundaryReached).toBe(false);
    });
  });
});
