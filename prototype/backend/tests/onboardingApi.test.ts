/**
 * Integration tests for onboarding API endpoints
 * 
 * Tests the full tutorial flow from step 1 to 9, skip functionality,
 * resume after logout, and reset with and without blockers.
 * 
 * Requirements: 1.1-1.6, 13.1-13.15, 14.1-14.15
 */
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import prisma from '../src/lib/prisma';
import onboardingRoutes from '../src/routes/onboarding';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/onboarding', onboardingRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Helper function to create a test user and get JWT token
async function createTestUser(username: string) {
  const user = await prisma.user.create({
    data: {
      username,
      email: `${username}@test.com`,
      passwordHash: 'test-hash',
      currency: 3000000,
      hasCompletedOnboarding: false,
      onboardingSkipped: false,
      onboardingStep: 1,
      onboardingStrategy: null,
      onboardingChoices: {},
      onboardingStartedAt: new Date(),
    },
  });

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return { user, token };
}

describe('Onboarding API Integration Tests', () => {
  let testUser: any;
  let testToken: string;

  beforeEach(async () => {
    // Clean up test data - delete in correct order to avoid foreign key violations
    // First delete scheduled matches
    const testUsers = await prisma.user.findMany({
      where: {
        username: {
          startsWith: 'onboarding_test_',
        },
      },
      include: {
        robots: true,
      },
    });

    const robotIds = testUsers.flatMap(u => u.robots.map(r => r.id));

    if (robotIds.length > 0) {
      await prisma.scheduledLeagueMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });
    }

    // Then delete users (cascade will handle robots)
    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'onboarding_test_',
        },
      },
    });

    // Create fresh test user
    const result = await createTestUser(`onboarding_test_${Date.now()}`);
    testUser = result.user;
    testToken = result.token;
  });

  afterAll(async () => {
    // Clean up all test users - delete scheduled matches first
    const testUsers = await prisma.user.findMany({
      where: {
        username: {
          startsWith: 'onboarding_test_',
        },
      },
      include: {
        robots: true,
      },
    });

    const robotIds = testUsers.flatMap(u => u.robots.map(r => r.id));

    if (robotIds.length > 0) {
      await prisma.scheduledLeagueMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });
    }

    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'onboarding_test_',
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('GET /api/onboarding/state', () => {
    it('should return tutorial state for authenticated user', async () => {
      const response = await request(app)
        .get('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentStep', 1);
      expect(response.body.data).toHaveProperty('hasCompletedOnboarding', false);
      expect(response.body.data).toHaveProperty('onboardingSkipped', false);
      expect(response.body.data).toHaveProperty('strategy', null);
      expect(response.body.data).toHaveProperty('choices');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/onboarding/state');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/onboarding/state', () => {
    it('should update tutorial step', async () => {
      const response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ step: 2 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStep).toBe(2);
    });

    it('should update roster strategy', async () => {
      const response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ strategy: '2_average' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.strategy).toBe('2_average');
    });

    it('should update player choices', async () => {
      const response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          choices: {
            rosterStrategy: '2_average',
            loadoutType: 'weapon_shield',
            preferredStance: 'defensive',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.choices).toHaveProperty('rosterStrategy', '2_average');
      expect(response.body.data.choices).toHaveProperty('loadoutType', 'weapon_shield');
      expect(response.body.data.choices).toHaveProperty('preferredStance', 'defensive');
    });

    it('should reject invalid step number', async () => {
      const response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ step: 10 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Step must be a number between 1 and 9');
    });

    it('should reject invalid strategy', async () => {
      const response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ strategy: 'invalid_strategy' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid strategy');
    });
  });

  describe('Full Tutorial Flow (Step 1 to 9)', () => {
    it('should complete full tutorial flow from step 1 to 9', async () => {
      // Step 1: Welcome
      let response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ step: 1 });
      expect(response.body.data.currentStep).toBe(1);

      // Step 2: Roster strategy selection
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          step: 2,
          strategy: '2_average',
          choices: { rosterStrategy: '2_average' },
        });
      expect(response.body.data.currentStep).toBe(2);
      expect(response.body.data.strategy).toBe('2_average');

      // Step 3: Facility timing
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ step: 3 });
      expect(response.body.data.currentStep).toBe(3);

      // Step 4: Budget allocation
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ step: 4 });
      expect(response.body.data.currentStep).toBe(4);

      // Step 5: Robot creation
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          step: 5,
          choices: { robotsCreated: [1] },
        });
      expect(response.body.data.currentStep).toBe(5);

      // Step 6: Weapon education
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          step: 6,
          choices: { loadoutType: 'weapon_shield' },
        });
      expect(response.body.data.currentStep).toBe(6);

      // Step 7: Weapon purchase
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          step: 7,
          choices: { weaponsPurchased: [1] },
        });
      expect(response.body.data.currentStep).toBe(7);

      // Step 8: Battle readiness
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ step: 8 });
      expect(response.body.data.currentStep).toBe(8);

      // Step 9: Completion
      response = await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ step: 9 });
      expect(response.body.data.currentStep).toBe(9);

      // Verify all choices were saved
      expect(response.body.data.choices.rosterStrategy).toBe('2_average');
      expect(response.body.data.choices.loadoutType).toBe('weapon_shield');
      expect(response.body.data.choices.robotsCreated).toEqual([1]);
      expect(response.body.data.choices.weaponsPurchased).toEqual([1]);
    });
  });

  describe('POST /api/onboarding/complete', () => {
    it('should mark tutorial as completed', async () => {
      const response = await request(app)
        .post('/api/onboarding/complete')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Tutorial completed');

      // Verify in database
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(user?.hasCompletedOnboarding).toBe(true);
      expect(user?.onboardingCompletedAt).not.toBeNull();
    });
  });

  describe('POST /api/onboarding/skip', () => {
    it('should skip tutorial and mark as completed', async () => {
      const response = await request(app)
        .post('/api/onboarding/skip')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Tutorial skipped');

      // Verify in database
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(user?.hasCompletedOnboarding).toBe(true);
      expect(user?.onboardingSkipped).toBe(true);
      expect(user?.onboardingCompletedAt).not.toBeNull();
    });
  });

  describe('Resume After Logout', () => {
    it('should resume from last completed step after logout', async () => {
      // Progress to step 5
      await request(app)
        .post('/api/onboarding/state')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          step: 5,
          strategy: '1_mighty',
          choices: { rosterStrategy: '1_mighty' },
        });

      // Simulate logout by creating new token (same user)
      const newToken = jwt.sign(
        { userId: testUser.id, username: testUser.username, role: testUser.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Get state with new token
      const response = await request(app)
        .get('/api/onboarding/state')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.currentStep).toBe(5);
      expect(response.body.data.strategy).toBe('1_mighty');
      expect(response.body.data.choices.rosterStrategy).toBe('1_mighty');
    });
  });

  describe('GET /api/onboarding/reset-eligibility', () => {
    it('should allow reset when no blockers exist', async () => {
      const response = await request(app)
        .get('/api/onboarding/reset-eligibility')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.canReset).toBe(true);
    });

    it('should block reset when scheduled battles exist', async () => {
      // Create a robot for the user
      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 10,
          maxShield: 10,
        },
      });

      // Create a second robot for the match
      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Robot 2',
          currentHP: 100,
          maxHP: 100,
          currentShield: 10,
          maxShield: 10,
        },
      });

      // Create a scheduled match
      await prisma.scheduledLeagueMatch.create({
        data: {
          robot1Id: robot.id,
          robot2Id: robot2.id,
          leagueType: 'bronze',
          scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
        },
      });

      const response = await request(app)
        .get('/api/onboarding/reset-eligibility')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.canReset).toBe(false);
      expect(response.body.data.reason).toContain('scheduled');
      expect(response.body.data.blockers).toContain('scheduled_matches');

      // Cleanup
      await prisma.scheduledLeagueMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: robot.id },
            { robot2Id: robot.id },
          ],
        },
      });
      await prisma.robot.deleteMany({
        where: {
          id: { in: [robot.id, robot2.id] },
        },
      });
    });
  });

  describe('POST /api/onboarding/reset-account', () => {
    it('should reset account when no blockers exist', async () => {
      // Create some data to reset
      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 10,
          maxShield: 10,
        },
      });

      // Update user credits
      await prisma.user.update({
        where: { id: testUser.id },
        data: { currency: 1000000 },
      });

      const response = await request(app)
        .post('/api/onboarding/reset-account')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          confirmation: 'RESET',
          reason: 'Testing reset functionality',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Account reset successfully');

      // Verify reset
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: { robots: true },
      });

      expect(user?.currency).toBe(3000000); // Reset to starting amount
      expect(user?.robots.length).toBe(0); // All robots deleted
      expect(user?.hasCompletedOnboarding).toBe(false);
      expect(user?.onboardingStep).toBe(1);
    });

    it('should reject reset without confirmation', async () => {
      const response = await request(app)
        .post('/api/onboarding/reset-account')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          confirmation: 'WRONG',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid confirmation');
    });

    it('should block reset when scheduled battles exist', async () => {
      // Create robots with scheduled match
      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Robot',
          currentHP: 100,
          maxHP: 100,
          currentShield: 10,
          maxShield: 10,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Robot 2',
          currentHP: 100,
          maxHP: 100,
          currentShield: 10,
          maxShield: 10,
        },
      });

      await prisma.scheduledLeagueMatch.create({
        data: {
          robot1Id: robot.id,
          robot2Id: robot2.id,
          leagueType: 'bronze',
          scheduledFor: new Date(Date.now() + 3600000),
        },
      });

      const response = await request(app)
        .post('/api/onboarding/reset-account')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          confirmation: 'RESET',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('scheduled');

      // Cleanup
      await prisma.scheduledLeagueMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: robot.id },
            { robot2Id: robot.id },
          ],
        },
      });
      await prisma.robot.deleteMany({
        where: {
          id: { in: [robot.id, robot2.id] },
        },
      });
    });
  });
});
