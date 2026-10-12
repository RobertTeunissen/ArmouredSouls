import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from '../src/routes/user';
import { createTestUser, createTestRobot, deleteTestUser } from './testHelpers';
import { errorHandler } from '../src/middleware/errorHandler';
import { getStableBattleOverlapsByUser } from '../src/services/auth/stable-battle-overlap';
import { writeStableAndRobotArchives } from '../src/services/season/seasonArchiveService';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/user', userRoutes);

// Spec #51: without the errorHandler mounted, a thrown AppError falls through
// to Express's default handler, which sends the right status with an EMPTY
// body. That is why these suites saw 400 but no `body.error` or `body.code`.
app.use(errorHandler);

describe('GET /api/user/stats - Stable Overview', () => {
  let testUser: any;
  let authToken: string;
  let robot1: any;
  let robot2: any;
  let tagTeamId: number;
  let tagTeamBattleId: number;

  beforeAll(async () => {
    await prisma.$connect();

    testUser = await createTestUser();

    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create two robots with known battle stats
    robot1 = await createTestRobot(testUser.id, 'StatsBot1');
    robot2 = await createTestRobot(testUser.id, 'StatsBot2');

    // Robot counters as the orchestrators write them: league 1v1 results plus one
    // tag-team win that BOTH partners played (each member's counter gets +1).
    // robot1: league 10 (6W 3L 1D) + the shared tag-team win
    await prisma.robot.update({
      where: { id: robot1.id },
      data: {
        totalBattles: 11,
        wins: 7,
        losses: 3,
        draws: 1,
      },
    });

    // robot2: league 8 (4W 4L 0D) + the same shared tag-team win
    await prisma.robot.update({
      where: { id: robot2.id },
      data: {
        totalBattles: 9,
        wins: 5,
        losses: 4,
        draws: 0,
      },
    });

    // The tag-team standing provides the tier. Its W/L/D are already inside the
    // robot counters above and must not be added on top of them.
    const team = await prisma.teamBattle.create({
      data: {
        stableId: testUser.id,
        teamName: `StatsTeam_${Date.now()}`,
        teamSize: 2,
        // Membership is the `members` relation with a 0-based `slotIndex`; TeamBattle
        // itself has no activeRobotId/reserveRobotId columns.
        members: {
          create: [
            { robotId: robot1.id, slotIndex: 0 },
            { robotId: robot2.id, slotIndex: 1 },
          ],
        },
      },
    });
    tagTeamId = team.id;

    await prisma.standing.create({
      data: {
        entityType: 'team',
        entityId: team.id,
        mode: 'tag_team',
        tier: 'bronze',
        leagueInstanceId: 'bronze_1',
        wins: 1,
        losses: 0,
        draws: 0,
      },
    });

    // The shared tag-team win: both partners on side 1, side 1 won.
    const battle = await prisma.battle.create({
      data: {
        battleType: 'tag_team',
        leagueType: 'bronze',
        winnerId: team.id,
        winningSide: 1,
        durationSeconds: 60,
        participants: {
          create: [
            { robotId: robot1.id, team: 1, role: 'active', credits: 0, eloBefore: 1200, eloAfter: 1216, finalHP: 50 },
            { robotId: robot2.id, team: 1, role: 'reserve', credits: 0, eloBefore: 1200, eloAfter: 1216, finalHP: 100 },
          ],
        },
      },
    });
    tagTeamBattleId = battle.id;
  });

  afterAll(async () => {
    await prisma.battle.deleteMany({ where: { id: tagTeamBattleId } });
    await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: tagTeamId } });
    await prisma.teamBattleMember.deleteMany({ where: { teamId: tagTeamId } });
    await prisma.teamBattle.deleteMany({ where: { id: tagTeamId } });
    await deleteTestUser(testUser.id);
    await prisma.$disconnect();
  });

  it('should count the shared tag team battle once in total battles', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);

    // League: 10 + 8 = 18, Tag Team: 1 (both partners, one battle), Total: 19
    expect(response.body.totalBattles).toBe(19);
  });

  it('should count the shared tag team win once in total wins', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    // League wins: 6 + 4 = 10, Tag Team wins: 1, Total: 11
    expect(response.body.wins).toBe(11);
  });

  it('should leave losses and draws as the robot counters have them', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    // League losses: 3 + 4 = 7; draws: 1 + 0 = 1. Nothing added from standings.
    expect(response.body.losses).toBe(7);
    expect(response.body.draws).toBe(1);
  });

  it('should calculate win rate over battles counted once per stable', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    // 11 wins / 19 total = 57.9%
    const expectedWinRate = Math.round((11 / 19) * 100 * 10) / 10;
    expect(response.body.winRate).toBe(expectedWinRate);
    expect(response.body.highestTagTeamLeague).toBe('bronze');
  });

  it('should require authentication', async () => {
    const response = await request(app)
      .get('/api/user/stats');

    expect(response.status).toBe(401);
  });

  // The batch variant used by the admin lists and the season archive, against a
  // real database. The unit tier only pins its SQL text; this proves the rows it
  // returns are grouped per stable and that `userId` comes back as a JS number
  // (a bigint or string would miss the Map lookup and report no overlap).
  describe('getStableBattleOverlapsByUser (batch overlap SQL)', () => {
    let otherUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeAll(async () => {
      otherUser = await createTestUser();
    });

    afterAll(async () => {
      await deleteTestUser(otherUser.id);
    });

    it('returns the shared tag-team side as a surplus of one win, keyed by the numeric user id', async () => {
      const overlaps = await getStableBattleOverlapsByUser([testUser.id, otherUser.id]);

      expect([...overlaps.keys()]).toEqual([testUser.id, otherUser.id]);
      // Two robots of one stable on side 1, side 1 won: k - 1 = 1 surplus win.
      // The map keys come from the input ids; this value comes from the SQL rows,
      // so it is non-zero only when the row `userId` matched as a JS number.
      expect(overlaps.get(testUser.id)).toEqual({ battles: 1, wins: 1, losses: 0, draws: 0 });
      // A stable that shared no side gets a zero entry.
      expect(overlaps.get(otherUser.id)).toEqual({ battles: 0, wins: 0, losses: 0, draws: 0 });
    });

    it('archives the stable total with the shared battle counted once', async () => {
      // Throwaway `completed` season; its archive rows cascade away with it.
      const season = 70_000 + Math.floor(Math.random() * 9_000);
      await prisma.season.create({ data: { seasonNumber: season, phase: 'completed', startedAt: new Date(), endedAt: new Date() } });
      try {
        await writeStableAndRobotArchives(season, 10, new Map(), new Map());

        const archive = await prisma.stableSeasonArchive.findUnique({
          where: { seasonNumber_userId: { seasonNumber: season, userId: testUser.id } },
          select: { id: true, totalBattles: true, wins: true, losses: true, draws: true },
        });
        // Robot counters sum to 20 battles / 12 wins; the shared side is 1 / 1.
        expect(archive).toMatchObject({ totalBattles: 19, wins: 11, losses: 7, draws: 1 });
        if (!archive) throw new Error('stable archive row was not written');

        // Robot archive rows keep each robot's own counters.
        const robotArchives = await prisma.robotSeasonArchive.findMany({
          where: { stableArchiveId: archive.id },
          select: { robotName: true, totalBattles: true },
        });
        const byName = new Map(robotArchives.map((r) => [r.robotName, r.totalBattles]));
        expect(byName.get(robot1.name)).toBe(11);
        expect(byName.get(robot2.name)).toBe(9);
      } finally {
        await prisma.season.deleteMany({ where: { seasonNumber: season } });
      }
    });
  });
});
