import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from '../src/routes/user';
import { createTestUser, createTestRobot, deleteTestUser } from './testHelpers';
import { errorHandler } from '../src/middleware/errorHandler';

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

    // Set league battle stats on robot1
    await prisma.robot.update({
      where: { id: robot1.id },
      data: {
        totalBattles: 10,
        wins: 6,
        losses: 3,
        draws: 1,
      },
    });

    // Set league battle stats on robot2
    await prisma.robot.update({
      where: { id: robot2.id },
      data: {
        totalBattles: 8,
        wins: 4,
        losses: 4,
        draws: 0,
      },
    });

    // Tag team stats live in `standings`, keyed by TeamBattle.id under mode
    // `tag_team` — they are not columns on Robot. The fixture set only the league
    // counters and the assertions below then expected 8 tag team battles from nowhere,
    // so `getStableStats` was correctly reporting league-only totals.
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

    // 5 wins + 2 losses + 1 draw = 8 tag team battles
    await prisma.standing.create({
      data: {
        entityType: 'team',
        entityId: team.id,
        mode: 'tag_team',
        tier: 'bronze',
        leagueInstanceId: 'bronze_1',
        wins: 5,
        losses: 2,
        draws: 1,
      },
    });
  });

  afterAll(async () => {
    await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: tagTeamId } });
    await prisma.teamBattleMember.deleteMany({ where: { teamId: tagTeamId } });
    await prisma.teamBattle.deleteMany({ where: { id: tagTeamId } });
    await deleteTestUser(testUser.id);
    await prisma.$disconnect();
  });

  it('should include tag team battles in total battle count', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);

    // League: 10 + 8 = 18, Tag Team: 5 + 3 = 8, Total: 26
    expect(response.body.totalBattles).toBe(26);
  });

  it('should include tag team wins in total wins', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    // League wins: 6 + 4 = 10, Tag Team wins: 3 + 2 = 5, Total: 15
    expect(response.body.wins).toBe(15);
  });

  it('should include tag team losses in total losses', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    // League losses: 3 + 4 = 7, Tag Team losses: 1 + 1 = 2, Total: 9
    expect(response.body.losses).toBe(9);
  });

  it('should include tag team draws in total draws', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    // League draws: 1 + 0 = 1, Tag Team draws: 1 + 0 = 1, Total: 2
    expect(response.body.draws).toBe(2);
  });

  it('should calculate win rate including tag team battles', async () => {
    const response = await request(app)
      .get('/api/user/stats')
      .set('Authorization', `Bearer ${authToken}`);

    // 15 wins / 26 total = 57.7%
    const expectedWinRate = Math.round((15 / 26) * 100 * 10) / 10;
    expect(response.body.winRate).toBe(expectedWinRate);
  });

  it('should require authentication', async () => {
    const response = await request(app)
      .get('/api/user/stats');

    expect(response.status).toBe(401);
  });
});
