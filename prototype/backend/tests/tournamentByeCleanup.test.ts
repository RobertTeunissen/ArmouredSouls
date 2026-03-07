import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import matchesRoutes from '../src/routes/matches';
import { createTestUser, createTestRobot, deleteTestUser } from './testHelpers';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/matches', matchesRoutes);

describe('Tournament Bye Match Cleanup', () => {
  let testUser: any;
  let authToken: string;
  let robot1: any;
  let robot2: any;
  let robot3: any;
  let tournamentId: number;

  beforeAll(async () => {
    await prisma.$connect();

    testUser = await createTestUser();
    robot1 = await createTestRobot(testUser.id, `ByeTest_R1_${Date.now()}`);
    robot2 = await createTestRobot(testUser.id, `ByeTest_R2_${Date.now()}`);
    robot3 = await createTestRobot(testUser.id, `ByeTest_R3_${Date.now()}`);

    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    // Clean up in dependency order
    await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });
    await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    await deleteTestUser(testUser.id);
    await prisma.$disconnect();
  });

  it('should not return bye matches from previous rounds in upcoming matches', async () => {
    // Create a tournament at round 1
    const tournament = await prisma.tournament.create({
      data: {
        name: `Bye Cleanup Test ${Date.now()}`,
        tournamentType: 'single_elimination',
        status: 'active',
        currentRound: 1,
        maxRounds: 2,
        totalParticipants: 4,
      },
    });
    tournamentId = tournament.id;

    // Create a bye match in round 1 (auto-completed at creation)
    await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: 1,
        matchNumber: 1,
        robot1Id: robot1.id,
        robot2Id: null,
        winnerId: robot1.id,
        status: 'completed',
        isByeMatch: true,
        completedAt: new Date(),
      },
    });

    // Create a regular match in round 1 (also completed)
    await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: 1,
        matchNumber: 2,
        robot1Id: robot2.id,
        robot2Id: robot3.id,
        winnerId: robot2.id,
        status: 'completed',
        isByeMatch: false,
        completedAt: new Date(),
      },
    });

    // Create a pending match in round 2
    await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        round: 2,
        matchNumber: 1,
        robot1Id: robot1.id,
        robot2Id: robot2.id,
        status: 'pending',
        isByeMatch: false,
      },
    });

    // Verify bye match shows when tournament is on round 1
    let response = await request(app)
      .get('/api/matches/upcoming')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    const byeMatchesRound1 = response.body.matches.filter(
      (m: any) => m.isByeMatch && m.tournamentId === tournamentId
    );
    expect(byeMatchesRound1.length).toBe(1);

    // Advance tournament to round 2
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { currentRound: 2 },
    });

    // Verify bye match from round 1 no longer shows
    response = await request(app)
      .get('/api/matches/upcoming')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    const byeMatchesRound2 = response.body.matches.filter(
      (m: any) => m.isByeMatch && m.tournamentId === tournamentId
    );
    expect(byeMatchesRound2.length).toBe(0);
  });
});
