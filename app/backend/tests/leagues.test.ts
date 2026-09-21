import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import leaguesRoutes from '../src/routes/leagues';
import teamBattlesRoutes from '../src/routes/teamBattles';
import { createTestRobot, createTestUser, deleteTestUser } from './testHelpers';
import { enterRobotStanding } from './helpers/standings';
import { errorHandler } from '../src/middleware/errorHandler';

dotenv.config();


// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/leagues', leaguesRoutes);
app.use('/api/team-battles', teamBattlesRoutes);

// Spec #51: without the errorHandler mounted, a thrown AppError falls through
// to Express's default handler, which sends the right status with an EMPTY
// body. That is why these suites saw 400 but no `body.error` or `body.code`.
app.use(errorHandler);

describe('Leagues Routes', () => {
  const testUserIds: number[] = [];
  const testRobotIds: number[] = [];
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create test user
    testUser = await createTestUser();
    testUserIds.push(testUser.id);

    // Generate JWT token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterAll(async () => {
    if (testRobotIds.length > 0) {
      await prisma.standing.deleteMany({
        where: { entityType: 'robot', entityId: { in: testRobotIds } },
      });
    }
    // Cleanup
    if (testUserIds.length > 0) {
      for (const userId of testUserIds) {
        await deleteTestUser(userId);
      }
    }
    await prisma.$disconnect();
  });

  describe('GET /api/leagues/:tier/standings', () => {
    it('should get bronze league standings', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/standings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(typeof response.body.pagination.total).toBe('number');
    });

    it('should get silver league standings', async () => {
      const response = await request(app)
        .get('/api/leagues/silver/standings');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should report the canonical promotion threshold for an empty Silver instance', async () => {
      const response = await request(app)
        .get('/api/leagues/silver/standings')
        .query({ instance: `silver_empty_${Date.now()}` });

      expect(response.status).toBe(200);
      expect(response.body.zoneMeta).toMatchObject({ minLP: 50, totalEntities: 0 });
    });

    it('should order tied LP rows by entity ID consistently with promotion zones', async () => {
      const instanceId = `silver_tied_${Date.now()}`;
      const tiedRobots = await Promise.all(
        Array.from({ length: 10 }, (_, index) => createTestRobot(testUser.id, `Tied_${index}_${Date.now()}`)),
      );
      const destinationRobot = await createTestRobot(testUser.id, `Gold_${Date.now()}`);
      testRobotIds.push(...tiedRobots.map((robot) => robot.id), destinationRobot.id);

      for (const robot of [...tiedRobots].reverse()) {
        await enterRobotStanding(robot.id, 'league_1v1', {
          tier: 'silver',
          leagueInstanceId: instanceId,
          leaguePoints: 60,
          cyclesInTier: 5,
        });
      }
      await enterRobotStanding(destinationRobot.id, 'league_1v1', {
        tier: 'gold',
        leagueInstanceId: `gold_tied_${Date.now()}`,
      });

      const response = await request(app)
        .get('/api/leagues/silver/standings')
        .query({ instance: instanceId, perPage: 10 });

      const expectedIds = tiedRobots.map((robot) => robot.id).sort((left, right) => left - right);
      expect(response.status).toBe(200);
      expect(response.body.data.map((robot: { id: number }) => robot.id)).toEqual(expectedIds);
      expect(response.body.data[0]).toMatchObject({ id: expectedIds[0], zone: 'promotion' });
      expect(response.body.zoneMeta).toMatchObject({ totalInstances: 1, activeInstances: 1 });
    });

    it('should return 400 for invalid tier', async () => {
      const response = await request(app)
        .get('/api/leagues/invalid_tier/standings');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/standings')
        .query({ page: 1, perPage: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination).toHaveProperty('pageSize');
      expect(response.body.pagination.pageSize).toBe(10);
    });
  });

  describe('GET /api/team-battles league standings', () => {
    it('should report the canonical promotion threshold for an empty Silver team instance', async () => {
      const response = await request(app)
        .get('/api/team-battles/leagues/2/silver/standings')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ instance: `silver_empty_team_${Date.now()}` });

      expect(response.status).toBe(200);
      expect(response.body.zoneMeta).toMatchObject({ minLP: 50, totalEntities: 0 });
    });

    it('should report the canonical promotion threshold for an empty Silver Tag Team instance', async () => {
      const response = await request(app)
        .get('/api/team-battles/leagues/2/silver/tag-team-standings')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ instance: `silver_empty_tag_${Date.now()}` });

      expect(response.status).toBe(200);
      expect(response.body.zoneMeta).toMatchObject({ minLP: 50, totalEntities: 0 });
    });
  });

  describe('GET /api/leagues/:tier/instances', () => {
    it('should get bronze league instances', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/instances');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Each instance should have required fields
      if (response.body.length > 0) {
        const instance = response.body[0];
        expect(instance).toHaveProperty('leagueId');
        expect(instance).toHaveProperty('leagueTier');
      }
    });

    it('should return 400 for invalid tier', async () => {
      const response = await request(app)
        .get('/api/leagues/invalid_tier/instances');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
