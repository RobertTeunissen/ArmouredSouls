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

  it.each(['/api/leagues/bronze/standings', '/api/leagues/bronze/instances'])(
    'refuses %s without a login',
    async (path) => {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
    },
  );

  describe('GET /api/leagues/:tier/standings', () => {
    it('should get bronze league standings', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/standings').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total');
      expect(typeof response.body.pagination.total).toBe('number');
    });

    it('should get silver league standings', async () => {
      const response = await request(app)
        .get('/api/leagues/silver/standings').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
    });

    it('should report the canonical promotion threshold for an empty Silver instance', async () => {
      const response = await request(app)
        .get('/api/leagues/silver/standings').set("Authorization", `Bearer ${authToken}`)
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
        .get('/api/leagues/silver/standings').set("Authorization", `Bearer ${authToken}`)
        .query({ instance: instanceId, perPage: 10 });

      const expectedIds = tiedRobots.map((robot) => robot.id).sort((left, right) => left - right);
      expect(response.status).toBe(200);
      expect(response.body.data.map((robot: { id: number }) => robot.id)).toEqual(expectedIds);
      expect(response.body.data[0]).toMatchObject({ id: expectedIds[0], zone: 'promotion' });
      expect(response.body.zoneMeta).toMatchObject({ totalInstances: 1, activeInstances: 1 });
    });

    it('should return 400 for invalid tier', async () => {
      const response = await request(app)
        .get('/api/leagues/invalid_tier/standings').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/leagues/bronze/standings').set("Authorization", `Bearer ${authToken}`)
        .query({ page: 1, perPage: 10 });

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination).toHaveProperty('pageSize');
      expect(response.body.pagination.pageSize).toBe(10);
    });
  });

  describe('query validation', () => {
    it.each([
      ['/api/leagues/bronze/standings', { mode: 'foo' }],
      ['/api/leagues/bronze/standings', { instance: '../bronze_1' }],
      ['/api/leagues/bronze/standings', { instance: 'Bronze 1' }],
      ['/api/leagues/bronze/standings', { perPage: 500 }],
      ['/api/leagues/bronze/standings', { page: 0 }],
      ['/api/leagues/bronze/instances', { mode: 'foo' }],
      ['/api/team-battles/leagues/2/bronze/standings', { instance: 'bronze-1;drop' }],
      ['/api/team-battles/leagues/2/bronze/tag-team-standings', { perPage: 101 }],
    ])('rejects %s with %o as 400 (it used to answer 500 for an unknown mode)', async (path, query) => {
      const response = await request(app).get(path).set('Authorization', `Bearer ${authToken}`).query(query);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it.each(['koth', 'grand_melee', 'league_1v1'])('accepts mode=%s', async (mode) => {
      const response = await request(app).get('/api/leagues/bronze/standings').set('Authorization', `Bearer ${authToken}`).query({ mode, perPage: 5 });
      expect(response.status).toBe(200);
    });
  });

  describe('row status and my-standings', () => {
    const stamp = Date.now() % 100000;
    const instanceId = `gold_my${stamp}`;
    let robots: Array<{ id: number }> = [];

    beforeAll(async () => {
      // 12 robots in one Gold instance: 1 promotion and 1 demotion place.
      // #1 qualifies (80 LP ≥ 75, 6 cycles); #12 has 2 cycles; #2 has 70 LP.
      robots = await Promise.all(
        Array.from({ length: 12 }, (_, index) => createTestRobot(testUser.id, `MyStd_${index}_${stamp}`)),
      );
      testRobotIds.push(...robots.map((robot) => robot.id));
      // Platinum must not be empty, or the 3-entity cohort rule holds the promotion.
      const resident = await createTestRobot(testUser.id, `MyStdPlat_${stamp}`);
      testRobotIds.push(resident.id);
      await enterRobotStanding(resident.id, 'league_1v1', { tier: 'platinum', leagueInstanceId: `platinum_my${stamp}` });
      for (const [index, robot] of robots.entries()) {
        await enterRobotStanding(robot.id, 'league_1v1', {
          tier: 'gold',
          leagueInstanceId: instanceId,
          leaguePoints: 80 - index * 5,
          cyclesInTier: index === 11 ? 2 : 6,
        });
      }
    });

    it('gives each standings row its rank and status', async () => {
      const response = await request(app)
        .get('/api/leagues/gold/standings').set('Authorization', `Bearer ${authToken}`)
        .query({ instance: instanceId, perPage: 100 });

      expect(response.status).toBe(200);
      const rows = response.body.data as Array<{ id: number; rank: number; status: unknown }>;
      expect(rows.map((row) => row.rank)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
      expect(rows[0].status).toEqual({ kind: 'promotes', zone: 'promotion' });
      expect(rows[1].status).toBeNull();
      expect(rows[11].status).toEqual({ kind: 'held_cycles', zone: 'demotion', cyclesToGo: 3 });
    });

    it('lists the viewer\'s entries with instance place, size and status', async () => {
      const response = await request(app).get('/api/leagues/my-standings').set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('private');
      const mine = (response.body.entries as Array<{ entityId: number; place: number; instanceSize: number; status: unknown; mode: string; minCycles: number }>)
        .filter((entry) => robots.some((robot) => robot.id === entry.entityId));
      expect(mine).toHaveLength(12);
      expect(mine[0]).toMatchObject({ mode: 'league_1v1', place: 1, instanceSize: 12, minCycles: 5, status: { kind: 'promotes' } });
      expect(mine[11]).toMatchObject({ place: 12, status: { kind: 'held_cycles', cyclesToGo: 3 } });
    });

    it('lists nothing for a stable without standings', async () => {
      const other = await createTestUser();
      testUserIds.push(other.id);
      const token = jwt.sign({ userId: other.id, username: other.username }, process.env.JWT_SECRET || 'test-secret');
      const response = await request(app).get('/api/leagues/my-standings').set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ entries: [] });
    });
  });

  describe('GET /api/team-battles league standings', () => {
    it('should report the canonical promotion threshold for an empty Silver team instance', async () => {
      const response = await request(app)
        .get('/api/team-battles/leagues/2/silver/standings')
        .set('Authorization', `Bearer ${authToken}`)
        // At most 30 characters: the length of standings.league_instance_id.
        .query({ instance: `silver_emptyteam_${Date.now() % 1e9}` });

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
        .get('/api/leagues/bronze/instances').set("Authorization", `Bearer ${authToken}`);

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
        .get('/api/leagues/invalid_tier/instances').set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});
