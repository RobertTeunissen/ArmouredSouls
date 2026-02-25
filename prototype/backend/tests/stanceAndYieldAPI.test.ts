import request from 'supertest';
import prisma from '../src/lib/prisma';
import jwt from 'jsonwebtoken';
import app from './testApp';


describe('Stance and Yield Threshold API Endpoints', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testUser: any;
  let testRobot: any;
  let authToken: string;

  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup in correct order
    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.facility.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create a test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'test_hash',
        currency: 10000000,
      },
    });
    testUserIds.push(testUser.id);

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '1h' }
    );

    // Create a test robot
    testRobot = await prisma.robot.create({
      data: {
        userId: testUser.id,
        name: `Test Robot ${Date.now()}`,
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        stance: 'balanced',
        yieldThreshold: 10,
      },
    });
    testRobotIds.push(testRobot.id);
  });

  afterEach(async () => {
    // Reset for next test
    testRobot = null;
    testUser = null;
  });

  describe('PATCH /api/robots/:id/stance', () => {
    it('should update robot stance to offensive', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stance: 'offensive' });

      expect(response.status).toBe(200);
      expect(response.body.stance).toBe('offensive');
      expect(response.body.message).toContain('offensive');
    });

    it('should update robot stance to defensive', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stance: 'defensive' });

      expect(response.status).toBe(200);
      expect(response.body.stance).toBe('defensive');
    });

    it('should handle case-insensitive stance input', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stance: 'OFFENSIVE' });

      expect(response.status).toBe(200);
      expect(response.body.stance).toBe('offensive');
    });

    it('should reject invalid stance value', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stance: 'super_aggressive' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid stance');
      expect(response.body.code).toBe('INVALID_STANCE');
    });

    it('should reject missing stance value', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject non-string stance value', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stance: 123 });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent robot', async () => {
      const response = await request(app)
        .patch('/api/robots/999999/stance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ stance: 'offensive' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });

    it('should return 403 for unauthorized user', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          username: `otheruser_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 1000000,
        },
      });
      testUserIds.push(otherUser.id);

      const otherToken = jwt.sign(
        { userId: otherUser.id, username: otherUser.username },
        process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ stance: 'offensive' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Not authorized');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/stance`)
        .send({ stance: 'offensive' });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/robots/:id/yield-threshold', () => {
    it('should update yield threshold to 25', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: 25 });

      expect(response.status).toBe(200);
      expect(response.body.yieldThreshold).toBe(25);
      expect(response.body.message).toContain('25');
    });

    it('should accept 0% yield threshold', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: 0 });

      expect(response.status).toBe(200);
      expect(response.body.yieldThreshold).toBe(0);
    });

    it('should accept 50% yield threshold', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: 50 });

      expect(response.status).toBe(200);
      expect(response.body.yieldThreshold).toBe(50);
    });

    it('should handle decimal yield threshold by rounding', async () => {
      // Database stores as Int, so 12.5 becomes 12 (Math.round or floor behavior)
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: 12.5 });

      expect(response.status).toBe(200);
      // Expect integer value (database will round/truncate)
      expect(response.body.yieldThreshold).toBe(12);
    });

    it('should reject yield threshold above 50', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: 75 });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('between 0 and 50');
      expect(response.body.code).toBe('INVALID_YIELD_THRESHOLD');
    });

    it('should reject negative yield threshold', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: -5 });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_YIELD_THRESHOLD');
    });

    it('should reject non-numeric yield threshold', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: 'high' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_YIELD_THRESHOLD');
    });

    it('should reject missing yield threshold', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 404 for non-existent robot', async () => {
      const response = await request(app)
        .patch('/api/robots/999999/yield-threshold')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ yieldThreshold: 25 });

      expect(response.status).toBe(404);
    });

    it('should return 403 for unauthorized user', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          username: `otheruser2_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 1000000,
        },
      });
      testUserIds.push(otherUser.id);

      const otherToken = jwt.sign(
        { userId: otherUser.id, username: otherUser.username },
        process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ yieldThreshold: 25 });

      expect(response.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .patch(`/api/robots/${testRobot.id}/yield-threshold`)
        .send({ yieldThreshold: 25 });

      expect(response.status).toBe(401);
    });
  });
});
