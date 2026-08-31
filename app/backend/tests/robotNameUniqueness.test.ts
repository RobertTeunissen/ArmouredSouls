import request from 'supertest';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import robotRoutes from '../src/routes/robots';
import { errorHandler } from '../src/middleware/errorHandler';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/robots', robotRoutes);

// Spec #51: without the errorHandler mounted, a thrown AppError falls through
// to Express's default handler, which sends the right status with an EMPTY
// body. That is why these suites saw 400 but no `body.error` or `body.code`.
app.use(errorHandler);

describe('Robot Name Uniqueness', () => {
  const testUserIds: number[] = [];
  const testRobotIds: number[] = [];
  const testFacilityIds: number[] = [];
  let testUser: any;
  let authToken: string;
  const testUsername = `testuser_${Date.now()}`;
  const testPassword = 'testpass123';

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create a test user with sufficient currency for robot creation
    const passwordHash = await bcrypt.hash(testPassword, 10);
    testUser = await prisma.user.create({
      data: {
        username: testUsername,
        passwordHash,
        role: 'user',
        currency: 10000000, // 10 million credits - enough for multiple robots
        prestige: 0,
      },
    });
    testUserIds.push(testUser.id);

    // Create a roster expansion facility to allow multiple robots (level 5 = 6 robots)
    const facility = await prisma.facility.create({
      data: {
        userId: testUser.id,
        facilityType: 'roster_expansion',
        level: 5,
      },
    });
    testFacilityIds.push(facility.id);

    // Generate JWT token for authentication
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username, role: testUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  });

  afterAll(async () => {
    // Cleanup in correct order
    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          participants: { some: { robotId: { in: testRobotIds } } },
        },
      });
      await prisma.scheduledMatchParticipant.deleteMany({
        where: { participantId: { in: testRobotIds } },
      });
      await prisma.scheduledMatch.deleteMany({
        where: {
          participants: { some: { participantId: { in: testRobotIds } } },
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
    }

    if (testFacilityIds.length > 0) {
      await prisma.facility.deleteMany({
        where: { id: { in: testFacilityIds } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }
    
    await prisma.$disconnect();
  });

  describe('POST /api/robots - Duplicate name validation', () => {
    const robotName = 'TestBot_Unique';

    afterEach(async () => {
      // Clean up robots created in each test
      const robots = await prisma.robot.findMany({
        where: {
          userId: testUser.id,
          name: robotName,
        },
      });
      
      const robotIds = robots.map(r => r.id);
      if (robotIds.length > 0) {
        testRobotIds.push(...robotIds);
        await prisma.robot.deleteMany({
          where: { id: { in: robotIds } },
        });
      }
    });

    it('should successfully create a robot with a unique name', async () => {
      const response = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: robotName });

      expect(response.status).toBe(201);
      expect(response.body.robot.name).toBe(robotName);
      expect(response.body.robot.userId).toBe(testUser.id);
      expect(response.body.message).toBe('Robot created successfully');
      
      if (response.body.robot?.id) {
        testRobotIds.push(response.body.robot.id);
      }
    });

    it('should reject creating a robot with a duplicate name for the same user', async () => {
      // First robot creation - should succeed
      const firstResponse = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: robotName });

      expect(firstResponse.status).toBe(201);
      if (firstResponse.body.robot?.id) {
        testRobotIds.push(firstResponse.body.robot.id);
      }

      // Second robot creation with same name - should fail
      const secondResponse = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: robotName });

      expect(secondResponse.status).toBe(400);
      // Robot names are globally unique, and the message says so rather than implying
      // the clash is with one of your own robots. Migration
      // 20260402101920_global_unique_robot_names dropped `robots_user_id_name_key` and
      // created `robots_name_key`, so this is a database constraint, not a preference.
      expect(secondResponse.body.error).toBe(
        'A robot with this name already exists. Please choose a different name.',
      );
    });

    // Inverted. Robot names are unique across the whole game, not per stable:
    // migration 20260402101920_global_unique_robot_names dropped the per-user index
    // `robots_user_id_name_key` and replaced it with the global `robots_name_key`.
    // This asserted the pre-migration behaviour and could not have passed against the
    // current schema at all — the insert would violate the unique index.
    it('should reject a name already taken by another user', async () => {
      // Create second test user
      const secondUsername = `testuser2_${Date.now()}`;
      const secondPasswordHash = await bcrypt.hash(testPassword, 10);
      const secondUser = await prisma.user.create({
        data: {
          username: secondUsername,
          passwordHash: secondPasswordHash,
          role: 'user',
          currency: 10000000,
          prestige: 0,
        },
      });
      testUserIds.push(secondUser.id);

      // Create roster expansion facility for second user
      const facility = await prisma.facility.create({
        data: {
          userId: secondUser.id,
          facilityType: 'roster_expansion',
          level: 5,
        },
      });
      testFacilityIds.push(facility.id);

      // Generate token for second user
      const secondAuthToken = jwt.sign(
        { userId: secondUser.id, username: secondUser.username, role: secondUser.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // First user creates a robot
      const firstResponse = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: robotName });

      expect(firstResponse.status).toBe(201);
      if (firstResponse.body.robot?.id) {
        testRobotIds.push(firstResponse.body.robot.id);
      }

      // Second user creates a robot with the same name — rejected, because the name is
      // taken globally.
      const secondResponse = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${secondAuthToken}`)
        .send({ name: robotName });

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.code).toBe('ROBOT_NAME_TAKEN');
    });

    it('should handle case-sensitive name validation correctly', async () => {
      // Clean up any existing robots first
      const existingRobots = await prisma.robot.findMany({
        where: {
          userId: testUser.id,
          name: { in: ['TestBot', 'testbot'] },
        },
      });
      
      const existingIds = existingRobots.map(r => r.id);
      if (existingIds.length > 0) {
        await prisma.robot.deleteMany({
          where: { id: { in: existingIds } },
        });
      }

      // Create first robot
      const response1 = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'TestBot' });

      if (response1.status !== 201) {
        console.error('First creation error:', response1.body);
      }
      expect(response1.status).toBe(201);
      if (response1.body.robot?.id) {
        testRobotIds.push(response1.body.robot.id);
      }

      // Try with different case - should succeed (database is case-sensitive by default)
      const response2 = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'testbot' });

      if (response2.status !== 201) {
        console.error('Second creation error:', response2.body);
      }

      // PostgreSQL default behavior is case-sensitive for text fields
      expect(response2.status).toBe(201);
      if (response2.body.robot?.id) {
        testRobotIds.push(response2.body.robot.id);
      }

      // Cleanup
      const robots = await prisma.robot.findMany({
        where: {
          userId: testUser.id,
          name: { in: ['TestBot', 'testbot'] },
        },
      });
      
      const robotIds = robots.map(r => r.id);
      if (robotIds.length > 0) {
        await prisma.robot.deleteMany({
          where: { id: { in: robotIds } },
        });
      }
    });
  });

  describe('POST /api/robots - Name validation', () => {
    it('should reject empty robot names', async () => {
      const response = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '' });

      expect(response.status).toBe(400);
      // An empty string trips both the length and the charset rule, and `error` joins
      // every failing issue. Asserted as a substring so adding a rule to the schema
      // does not break this.
      expect(response.body.error).toContain('Robot name must be between 1 and 50 characters');
    });

    it('should reject robot names longer than 50 characters', async () => {
      const longName = 'a'.repeat(51);
      const response = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: longName });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Robot name must be between 1 and 50 characters');
    });

    it('should accept robot names at the 50 character boundary', async () => {
      const maxLengthName = 'a'.repeat(50);
      
      const response = await request(app)
        .post('/api/robots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: maxLengthName });

      if (response.status !== 201) {
        console.error('Response error:', response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body.robot.name).toBe(maxLengthName);

      // Cleanup
      if (response.body.robot?.id) {
        testRobotIds.push(response.body.robot.id);
        await prisma.robot.deleteMany({ where: { id: response.body.robot.id } });
      }
    });
  });
});
