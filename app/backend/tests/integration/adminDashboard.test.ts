/**
 * Admin dashboard queries against the database.
 *
 * - Battle activity SQL: season and last-cycle counts, walkovers (forfeit and
 *   bye), the draw rule for team battles (`winning_side`), kills (`destroyed`)
 *   and the owner filter. Scoped to this file's fixture users so other rows in
 *   the shared database do not affect the counts.
 * - `/api/admin/stats` League 1v1 tier counts respect the user filter.
 * - Human-player activity windows (last login, never logged in).
 * - KPI snapshots: upsert per (season, cycle), lookup by time across a
 *   simulated rollover where the cycle number repeats.
 */
import prisma from '../../src/lib/prisma';
import { aggregateBattles } from '../../src/services/admin/adminBattleActivityService';
import { getSystemStats } from '../../src/services/admin/adminSystemStatsService';
import { buildHumanActivityWhere } from '../../src/services/admin/adminPlayerActivityService';
import { findPreviousKpiSnapshot, recordKpiSnapshot } from '../../src/services/admin/adminKpiSnapshotService';
import { createTestRobot } from '../testHelpers';
import { enterRobotStanding } from '../helpers/standings';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Reserved season numbers for the snapshot rows of this file. */
const SNAPSHOT_SEASONS = [9_901, 9_902];

interface ParticipantFixture {
  robotId: number;
  team: number;
  destroyed?: boolean;
  forfeited?: boolean;
}

async function createBattle(opts: {
  battleType: string;
  winnerId: number | null;
  winningSide?: number | null;
  durationSeconds: number;
  createdAt: Date;
  participants: ParticipantFixture[];
}): Promise<number> {
  const battle = await prisma.battle.create({
    data: {
      battleType: opts.battleType,
      leagueType: 'bronze',
      winnerId: opts.winnerId,
      winningSide: opts.winningSide ?? null,
      durationSeconds: opts.durationSeconds,
      createdAt: opts.createdAt,
      participants: {
        create: opts.participants.map((p) => ({
          robotId: p.robotId,
          team: p.team,
          credits: 0,
          eloBefore: 1200,
          eloAfter: 1200,
          finalHP: p.destroyed ? 0 : 50,
          destroyed: p.destroyed ?? false,
          forfeited: p.forfeited ?? false,
        })),
      },
    },
  });
  return battle.id;
}

describe('Admin dashboard queries (database)', () => {
  const now = new Date();
  const window = { from: new Date(now.getTime() - HOUR), to: new Date(now.getTime() + HOUR) };
  const userIds: number[] = [];
  const robotIds: number[] = [];
  const battleIds: number[] = [];
  const scheduledMatchIds: number[] = [];
  let humanId = 0;
  let botId = 0;
  let human1 = 0;
  let human2 = 0;
  let bot1 = 0;
  let bot2 = 0;

  beforeAll(async () => {
    const human = await prisma.user.create({
      data: { username: `admdash_h_${suffix}`, passwordHash: 'x', stableType: 'human' },
    });
    const bot = await prisma.user.create({
      data: { username: `auto_wimpbot_admdash_${suffix}`, passwordHash: 'x', stableType: 'generated', isGenerated: true },
    });
    humanId = human.id;
    botId = bot.id;
    userIds.push(humanId, botId);

    human1 = (await createTestRobot(humanId)).id;
    human2 = (await createTestRobot(humanId)).id;
    bot1 = (await createTestRobot(botId)).id;
    bot2 = (await createTestRobot(botId)).id;
    robotIds.push(human1, human2, bot1, bot2);

    // 1. Fought 1v1 in the window with a kill.
    battleIds.push(await createBattle({
      battleType: 'league_1v1', winnerId: human1, durationSeconds: 40, createdAt: now,
      participants: [{ robotId: human1, team: 1 }, { robotId: bot1, team: 2, destroyed: true }],
    }));
    // 2. Team battle: the result is in winning_side, winner_id is null. Not a draw.
    battleIds.push(await createBattle({
      battleType: 'league_2v2', winnerId: null, winningSide: 1, durationSeconds: 60, createdAt: now,
      participants: [
        { robotId: human1, team: 1 }, { robotId: human2, team: 1 },
        { robotId: bot1, team: 2 }, { robotId: bot2, team: 2 },
      ],
    }));
    // 3. A real 1v1 draw in the window.
    battleIds.push(await createBattle({
      battleType: 'league_1v1', winnerId: null, durationSeconds: 120, createdAt: now,
      participants: [{ robotId: human2, team: 1 }, { robotId: bot2, team: 2 }],
    }));
    // 4. A forfeit walkover outside the window.
    battleIds.push(await createBattle({
      battleType: 'league_1v1', winnerId: human1, durationSeconds: 15, createdAt: new Date(now.getTime() - 3 * HOUR),
      participants: [{ robotId: human1, team: 1 }, { robotId: bot2, team: 2, forfeited: true }],
    }));
    // 5. A KotH between bots only.
    battleIds.push(await createBattle({
      battleType: 'koth', winnerId: bot1, durationSeconds: 90, createdAt: now,
      participants: [{ robotId: bot1, team: 1, destroyed: true }, { robotId: bot2, team: 2 }],
    }));
    // 6. A league bye in the window: one participant, flagged on the scheduling row.
    const byeBattleId = await createBattle({
      battleType: 'league_1v1', winnerId: human2, durationSeconds: 15, createdAt: now,
      participants: [{ robotId: human2, team: 1 }],
    });
    battleIds.push(byeBattleId);
    const bye = await prisma.scheduledMatch.create({
      data: {
        matchType: 'league_1v1', status: 'completed', scheduledFor: now, battleId: byeBattleId, isByeMatch: true,
      },
    });
    scheduledMatchIds.push(bye.id);

    await enterRobotStanding(human1, 'league_1v1', { tier: 'silver' });
    await enterRobotStanding(human2, 'league_1v1', { tier: 'bronze' });
    await enterRobotStanding(bot1, 'league_1v1', { tier: 'bronze' });
  });

  afterAll(async () => {
    await prisma.scheduledMatch.deleteMany({ where: { id: { in: scheduledMatchIds } } });
    await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
    await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.adminKpiSnapshot.deleteMany({ where: { seasonNumber: { in: SNAPSHOT_SEASONS } } });
  });

  describe('aggregateBattles', () => {
    it('counts season, last cycle, walkovers, draws and kills for the filtered owner', async () => {
      const rows = await aggregateBattles([humanId], window);
      const byType = new Map(rows.map((row) => [row.battleType, row]));

      expect(byType.get('league_1v1')).toEqual({
        battleType: 'league_1v1',
        season: 4,
        lastCycle: 3,
        walkovers: 2,
        fought: 2,
        draws: 1,
        kills: 1,
        avgDuration: 80,
      });
      expect(byType.get('league_2v2')).toMatchObject({ season: 1, fought: 1, draws: 0, kills: 0 });
      expect(byType.has('koth')).toBe(false);
    });

    it('includes battles of other owners only when they are in the filter', async () => {
      const rows = await aggregateBattles([botId], window);
      expect(rows.find((row) => row.battleType === 'koth')).toMatchObject({ season: 1, fought: 1, kills: 1 });
    });

    it('returns no rows for an empty filter and null last-cycle counts without a window', async () => {
      await expect(aggregateBattles([], window)).resolves.toEqual([]);

      const rows = await aggregateBattles([humanId], null);
      expect(rows.every((row) => row.lastCycle === null)).toBe(true);
    });
  });

  describe('getSystemStats', () => {
    it('restricts League 1v1 tier counts to the filtered users', async () => {
      const humanOnly = await getSystemStats({ id: { in: [humanId] } });
      const tiers = Object.fromEntries(humanOnly.robots.byTier.map((tier) => [tier.league, tier.count]));

      expect(tiers).toEqual({ silver: 1, bronze: 1 });
      expect(humanOnly.robots.total).toBe(2);
    });

    it('returns no tiers when the filter matches nobody', async () => {
      const nobody = await getSystemStats({ id: { in: [-1] } });
      expect(nobody.robots.byTier).toEqual([]);
      expect(nobody.finances.totalUsers).toBe(0);
    });
  });

  describe('human activity windows', () => {
    const activityIds: number[] = [];

    beforeAll(async () => {
      const create = (tag: string, data: { lastLoginAt: Date | null; createdAt: Date }) =>
        prisma.user.create({ data: { username: `admdash_${tag}_${suffix}`, passwordHash: 'x', stableType: 'human', ...data } });
      activityIds.push(
        (await create('active', { lastLoginAt: new Date(now.getTime() - 2 * DAY), createdAt: new Date(now.getTime() - 30 * DAY) })).id,
        (await create('lapsed', { lastLoginAt: new Date(now.getTime() - 5 * DAY), createdAt: new Date(now.getTime() - 30 * DAY) })).id,
        (await create('never', { lastLoginAt: null, createdAt: new Date(now.getTime() - 4 * DAY) })).id,
        (await create('fresh', { lastLoginAt: null, createdAt: new Date(now.getTime() - HOUR) })).id,
        (await create('prevweek', { lastLoginAt: new Date(now.getTime() - 9 * DAY), createdAt: new Date(now.getTime() - 10 * DAY) })).id,
      );
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: { in: activityIds } } });
    });

    async function count(key: keyof ReturnType<typeof buildHumanActivityWhere>): Promise<number> {
      const where = buildHumanActivityWhere(now)[key];
      return prisma.user.count({ where: { AND: [where, { id: { in: activityIds } }] } });
    }

    it('counts active, new, previous-new and inactive players', async () => {
      expect(await count('total')).toBe(5);
      expect(await count('active7d')).toBe(2); // active, lapsed
      expect(await count('new7d')).toBe(2); // never, fresh
      expect(await count('newPrevious7d')).toBe(1); // prevweek
      expect(await count('inactive3d')).toBe(3); // lapsed, never, prevweek
    });
  });

  describe('KPI snapshots', () => {
    const base = new Date('2100-01-01T00:05:00.000Z');

    it('upserts per season and cycle and finds the snapshot from about 7 days ago', async () => {
      await recordKpiSnapshot(SNAPSHOT_SEASONS[0], 1, base);
      await recordKpiSnapshot(SNAPSHOT_SEASONS[0], 1, base); // resumed settlement: same row

      expect(await prisma.adminKpiSnapshot.count({ where: { seasonNumber: SNAPSHOT_SEASONS[0] } })).toBe(1);

      const previous = await findPreviousKpiSnapshot(new Date(base.getTime() + 7 * DAY));
      expect(previous?.capturedAt.toISOString()).toBe(base.toISOString());
    });

    it('accepts the same cycle number in the next season (cycle counter resets at rollover)', async () => {
      const nextSeason = new Date(base.getTime() + 2 * DAY);
      await recordKpiSnapshot(SNAPSHOT_SEASONS[1], 1, nextSeason);

      const previous = await findPreviousKpiSnapshot(new Date(nextSeason.getTime() + 7 * DAY));
      expect(previous?.capturedAt.toISOString()).toBe(nextSeason.toISOString());
    });

    it('returns null when the nearest snapshot is more than 8 days old', async () => {
      await expect(findPreviousKpiSnapshot(new Date(base.getTime() + 30 * DAY))).resolves.toBeNull();
    });
  });
});
