import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from '../src/routes/user';
import { createTestUser, createTestRobot, deleteTestUser } from './testHelpers';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/user', userRoutes);

describe('GET /api/user/stats - Stable Overview', () => {
  let testUser: any;
  let authToken: string;
  let robot1: any;
  let robot2: any;

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
        totalTagTeamBattles: 5,
        totalTagTeamWins: 3,
        totalTagTeamLosses: 1,
        totalTagTeamDraws: 1,
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
        totalTagTeamBattles: 3,
        totalTagTeamWins: 2,
        totalTagTeamLosses: 1,
        totalTagTeamDraws: 0,
      },
    });
  });

  afterAll(async () => {
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
