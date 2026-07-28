/**
 * Season Rollover Integration Tests (Spec #45).
 *
 * Covers the parts of the rollover that only a real database can prove:
 *  - the archive is written before anything is deleted (R5.1, R5.2)
 *  - the verification gate blocks the purge on a mismatch (R5.3)
 *  - the purge empties everything it claims to (R9.6, R10.1)
 *  - generated stables are deleted while their standings survive (R29.3, R29.6)
 *  - human stables and their archives are preserved (R11.1, R11.3)
 *  - Season 0 never rolls over automatically (R24.2, R24.3)
 *  - a manual rollover closes Season 0 and opens Season 1 (R24.6)
 *
 * These write and then destroy global state, so they run serially and clean up
 * the season tables between cases.
 */

import prisma from '../../src/lib/prisma';
import dotenv from 'dotenv';
import {
  getCurrentSeason,
  advanceCompetitiveCycle,
  invalidateSeasonCache,
  LEGACY_SEASON_NUMBER,
} from '../../src/services/season/seasonService';
import { verifyArchive, writeSeasonArchive } from '../../src/services/season/seasonArchiveService';
import { executeSeasonRollover } from '../../src/services/season/seasonRolloverService';

dotenv.config();

/** Remove every season row and archive so each case starts from a known state. */
async function resetSeasonTables(): Promise<void> {
  await prisma.seasonAccolade.deleteMany({});
  await prisma.seasonStandingSnapshot.deleteMany({});
  await prisma.robotSeasonArchive.deleteMany({});
  await prisma.stableSeasonArchive.deleteMany({});
  await prisma.season.deleteMany({});
  invalidateSeasonCache();
}

interface SeededStable {
  userId: number;
  robotId: number;
}

let seq = 0;

/** Create a stable with one robot and a 1v1 standing. */
async function seedStable(isGenerated: boolean): Promise<SeededStable> {
  seq += 1;
  const suffix = `${Date.now()}_${seq}`;
  const username = isGenerated ? `auto_wimpbot_it_${suffix}` : `season_it_user_${suffix}`;

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: 'test-hash',
      currency: 1_234_567,
      prestige: 4_200,
      stableName: `IT Stable ${suffix}`,
      isGenerated,
    },
  });

  const robot = await prisma.robot.create({
    data: {
      userId: user.id,
      name: `IT Robot ${suffix}`,
      currentHP: 100,
      maxHP: 100,
      currentShield: 10,
      maxShield: 10,
      elo: 1350,
      fame: 77,
      wins: 6,
      losses: 3,
      draws: 1,
      totalBattles: 10,
    },
  });

  await prisma.standing.create({
    data: {
      entityType: 'robot',
      entityId: robot.id,
      mode: 'league_1v1',
      tier: 'gold',
      leagueInstanceId: 'gold_1',
      leaguePoints: isGenerated ? 90 : 60,
      wins: 6,
      losses: 3,
      draws: 1,
    },
  });

  return { userId: user.id, robotId: robot.id };
}

async function cleanupStable(userId: number): Promise<void> {
  const robots = await prisma.robot.findMany({ where: { userId }, select: { id: true } });
  if (robots.length > 0) {
    await prisma.standing.deleteMany({
      where: { entityType: 'robot', entityId: { in: robots.map((r) => r.id) } },
    });
  }
  await prisma.stableSeasonArchive.deleteMany({ where: { userId } });
  await prisma.robot.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

describe('Season Rollover Integration', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await resetSeasonTables();
    await prisma.$disconnect();
  });

  describe('Season 0 lifecycle (R24)', () => {
    beforeEach(async () => {
      await resetSeasonTables();
    });

    it('should lazily create Season 0 with the cycle counter backfilled', async () => {
      await prisma.cycleMetadata.upsert({
        where: { id: 1 },
        update: { totalCycles: 118 },
        create: { id: 1, totalCycles: 118 },
      });
      invalidateSeasonCache();

      const state = await getCurrentSeason();

      expect(state.seasonNumber).toBe(LEGACY_SEASON_NUMBER);
      expect(state.phase).toBe('competitive');
      expect(state.isLegacy).toBe(true);
      // Cycle reads truthfully rather than restarting at 1.
      expect(state.seasonCycle).toBe(119);
      // No fixed length, so no countdown is advertised.
      expect(state.remainingCompetitiveCycles).toBe(0);
    });

    it('should create only one Season 0 when read repeatedly', async () => {
      await getCurrentSeason();
      invalidateSeasonCache();
      await getCurrentSeason();

      expect(await prisma.season.count()).toBe(1);
    });

    it('should never report a boundary for Season 0, however far past the length', async () => {
      await prisma.cycleMetadata.upsert({
        where: { id: 1 },
        update: { totalCycles: 500 },
        create: { id: 1, totalCycles: 500 },
      });
      invalidateSeasonCache();
      await getCurrentSeason();

      const advanced = await advanceCompetitiveCycle();

      expect(advanced.seasonNumber).toBe(LEGACY_SEASON_NUMBER);
      expect(advanced.competitiveCyclesCompleted).toBe(501);
      // 501 cycles is far past SEASON_LENGTH_CYCLES, and still no rollover.
      expect(advanced.boundaryReached).toBe(false);
    });
  });

  describe('Archive verification gate (R5.2, R5.3)', () => {
    let human: SeededStable;

    beforeEach(async () => {
      await resetSeasonTables();
      await getCurrentSeason();
      human = await seedStable(false);
    });

    afterEach(async () => {
      await cleanupStable(human.userId);
      await resetSeasonTables();
    });

    it('should fail verification when no archive has been written', async () => {
      const verification = await verifyArchive(LEGACY_SEASON_NUMBER);

      expect(verification.ok).toBe(false);
      expect(verification.actualStables).toBe(0);
      expect(verification.expectedStables).toBeGreaterThan(0);
    });

    it('should pass verification once the archive is written, counting humans only', async () => {
      const generated = await seedStable(true);
      try {
        await writeSeasonArchive(LEGACY_SEASON_NUMBER, 118);
        const verification = await verifyArchive(LEGACY_SEASON_NUMBER);

        expect(verification.ok).toBe(true);
        // The generated stable is excluded from both sides of the count.
        const generatedArchive = await prisma.stableSeasonArchive.findFirst({
          where: { userId: generated.userId },
        });
        expect(generatedArchive).toBeNull();
      } finally {
        await cleanupStable(generated.userId);
      }
    });
  });

  describe('Accolade capture mirrors the Hall of Records (Spec #45)', () => {
    let human: SeededStable;

    beforeEach(async () => {
      await resetSeasonTables();
      await getCurrentSeason();
      human = await seedStable(false);
      // Make this stable unambiguously #1 across the leaderboards regardless of
      // any residual rows, so rank is deterministic in a shared test database.
      await prisma.user.update({
        where: { id: human.userId },
        data: { prestige: 9_000_000, championshipTitles: 4 },
      });
      await prisma.robot.update({
        where: { id: human.robotId },
        data: { elo: 3000, fame: 900_000, kills: 777, damageDealtLifetime: 500_000 },
      });
      // Two completed 1v1 tournaments won by this robot.
      await prisma.tournament.createMany({
        data: [
          {
            name: '1v1 Tournament #1', tournamentType: 'single_elimination', participantType: 'robot',
            status: 'completed', maxRounds: 3, totalParticipants: 8, winnerId: human.robotId,
            completedAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            name: '1v1 Tournament #2', tournamentType: 'single_elimination', participantType: 'robot',
            status: 'completed', maxRounds: 3, totalParticipants: 8, winnerId: human.robotId,
            completedAt: new Date('2026-01-02T00:00:00Z'),
          },
        ],
      });
    });

    afterEach(async () => {
      await prisma.tournament.deleteMany({ where: { winnerId: human.robotId } }).catch(() => undefined);
      await cleanupStable(human.userId).catch(() => undefined);
      await resetSeasonTables();
    });

    it('should capture prestige, fame, elo, and kills with real owner attribution', async () => {
      await writeSeasonArchive(LEGACY_SEASON_NUMBER, 118);

      const mine = await prisma.seasonAccolade.findMany({
        where: { seasonNumber: LEGACY_SEASON_NUMBER, userId: human.userId },
      });
      const byCategory = (c: string) => mine.find((r) => r.category === c);

      // Final prestige standing — stable-level, the separate leaderboard page.
      const prestige = byCategory('highestPrestige');
      expect(prestige).toBeTruthy();
      expect(prestige!.subjectType).toBe('stable');
      expect(prestige!.value).toBe(9_000_000);
      expect(prestige!.isGeneratedSubject).toBe(false);

      // Championship titles captured as a stable accolade.
      expect(byCategory('mostTitles')?.value).toBe(4);

      // Career kills — robot-level, all modes (mode tag is null).
      const kills = byCategory('mostKills');
      expect(kills).toBeTruthy();
      expect(kills!.value).toBe(777);
      expect(kills!.mode).toBeNull();

      // Fame and ELO leaderboards captured too.
      expect(byCategory('highestElo')?.value).toBe(3000);
      expect(byCategory('highestFame')?.value).toBe(900_000);

      // Tournament champions: one accolade row per tournament the robot won,
      // carrying the tournament name in the value label.
      const champions = mine.filter((r) => r.category === 'tournamentChampion');
      expect(champions.length).toBe(2);
      expect(champions.every((c) => c.mode === 'tournament_1v1')).toBe(true);
      expect(champions.every((c) => c.subjectType === 'robot')).toBe(true);
      expect(champions.map((c) => c.valueLabel).sort()).toEqual([
        '1v1 Tournament #1',
        '1v1 Tournament #2',
      ]);

      // Every captured subject resolves to a real name — never the old
      // "Unknown" placeholder that the by-name lookup used to produce.
      for (const row of mine) {
        expect(row.stableName).not.toBe('Unknown');
        expect(row.subjectName).not.toBe('Unknown');
      }
    });
  });

  describe('Full rollover (R5, R9, R10, R11, R24, R29)', () => {
    let human: SeededStable;
    let generated: SeededStable;

    beforeEach(async () => {
      await resetSeasonTables();
      await getCurrentSeason();
      human = await seedStable(false);
      generated = await seedStable(true);
    });

    afterEach(async () => {
      await cleanupStable(human.userId).catch(() => undefined);
      await cleanupStable(generated.userId).catch(() => undefined);
      await resetSeasonTables();
    });

    it('should archive, purge, and open the next season', async () => {
      const result = await executeSeasonRollover({ trigger: 'admin', adminUserId: human.userId });

      // Archive written for the human stable only.
      expect(result.stablesArchived).toBeGreaterThanOrEqual(1);
      expect(result.completedSeasonNumber).toBe(LEGACY_SEASON_NUMBER);
      expect(result.newSeasonNumber).toBe(LEGACY_SEASON_NUMBER + 1);

      const archive = await prisma.stableSeasonArchive.findFirst({
        where: { seasonNumber: LEGACY_SEASON_NUMBER, userId: human.userId },
        include: { robots: true },
      });
      expect(archive).not.toBeNull();
      expect(archive!.robots.length).toBe(1);
      // Denormalized copies, not references.
      expect(archive!.robots[0].robotName).toContain('IT Robot');

      // Generated stable deleted outright.
      expect(await prisma.user.findUnique({ where: { id: generated.userId } })).toBeNull();
      expect(await prisma.user.count({ where: { isGenerated: true } })).toBe(0);

      // Human stable preserved and reset.
      const preserved = await prisma.user.findUnique({ where: { id: human.userId } });
      expect(preserved).not.toBeNull();
      expect(preserved!.currency).toBe(3_000_000);
      expect(preserved!.prestige).toBe(0);

      // Operational tables emptied.
      expect(await prisma.robot.count()).toBe(0);
      expect(await prisma.standing.count()).toBe(0);
      expect(await prisma.battle.count()).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
      expect(await prisma.leaderboardCache.count()).toBe(0);

      // Cycle counter reset and next season open in preparation.
      const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
      expect(meta!.totalCycles).toBe(0);

      const next = await getCurrentSeason();
      expect(next.seasonNumber).toBe(LEGACY_SEASON_NUMBER + 1);
      expect(next.phase).toBe('preparation');
      expect(next.seasonCycle).toBe(0);
    });

    it('should retain bot league positions in the standings snapshot', async () => {
      await executeSeasonRollover({ trigger: 'admin', adminUserId: human.userId });

      const botRows = await prisma.seasonStandingSnapshot.findMany({
        where: { seasonNumber: LEGACY_SEASON_NUMBER, isGeneratedSubject: true },
      });

      // The bot outscored the player, so its position must still be recorded
      // even though its stable no longer exists.
      expect(botRows.length).toBeGreaterThan(0);
      expect(botRows[0].entityName).toContain('IT Robot');
      expect(botRows[0].instanceRank).toBe(1);
    });

    it('should record the generated stable count before deleting them', async () => {
      await executeSeasonRollover({ trigger: 'admin', adminUserId: human.userId });

      const season = await prisma.season.findUnique({
        where: { seasonNumber: LEGACY_SEASON_NUMBER },
      });
      expect(season!.generatedStableCount).toBeGreaterThanOrEqual(1);
      expect(season!.phase).toBe('completed');
      expect(season!.endedAt).not.toBeNull();
    });

    it('should be idempotent when invoked twice for the same season', async () => {
      await executeSeasonRollover({ trigger: 'admin', adminUserId: human.userId });
      const archivesAfterFirst = await prisma.stableSeasonArchive.count({
        where: { seasonNumber: LEGACY_SEASON_NUMBER },
      });

      // A second rollover targets the NEW season, which has no data — it must
      // not duplicate or destroy the completed season's archive.
      await executeSeasonRollover({ trigger: 'admin', adminUserId: human.userId }).catch(
        () => undefined,
      );

      const archivesAfterSecond = await prisma.stableSeasonArchive.count({
        where: { seasonNumber: LEGACY_SEASON_NUMBER },
      });
      expect(archivesAfterSecond).toBe(archivesAfterFirst);
    });
  });
});
