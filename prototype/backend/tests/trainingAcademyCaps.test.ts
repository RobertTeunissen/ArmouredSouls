import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from './testApp';

const prisma = new PrismaClient();

describe('Training Academy Cap Enforcement', () => {
  let testUser: any;
  let testRobot: any;
  let authToken: string;

  beforeAll(async () => {
    // Ensure database connection
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup
    if (testRobot) {
      await prisma.robot.delete({ where: { id: testRobot.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create a test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 10000000, // Give enough currency for testing
      },
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
      { expiresIn: '1h' }
    );

    // Create a test robot with initial attributes at level 1
    testRobot = await prisma.robot.create({
      data: {
        userId: testUser.id,
        name: 'Test Robot',
        currentHP: 10,
        maxHP: 10,
        currentShield: 2,
        maxShield: 2,
      },
    });
  });

  afterEach(async () => {
    // Cleanup after each test
    if (testRobot) {
      await prisma.robot.delete({ where: { id: testRobot.id } }).catch(() => {});
    }
    if (testUser) {
      // Delete all facilities for the user
      await prisma.facility.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  describe('Test 1: Base cap of 10 without any academy', () => {
    it('should allow upgrading combatPower to level 10', async () => {
      // Upgrade combatPower from 1 to 10 (9 upgrades)
      for (let i = 0; i < 9; i++) {
        const response = await request(app)
          .put(`/api/robots/${testRobot.id}/upgrade`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ attribute: 'combatPower' });

        expect(response.status).toBe(200);
      }

      // Verify the robot is at level 10
      const robot = await prisma.robot.findUnique({
        where: { id: testRobot.id },
      });
      expect(robot?.combatPower).toBe(10);
    });

    it('should block upgrading combatPower from level 10 to level 11 without academy', async () => {
      // First upgrade to level 10
      await prisma.robot.update({
        where: { id: testRobot.id },
        data: { combatPower: new Prisma.Decimal(10) },
      });

      // Try to upgrade to level 11
      const response = await request(app)
        .put(`/api/robots/${testRobot.id}/upgrade`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ attribute: 'combatPower' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Attribute cap of 10 reached');
      expect(response.body.error).toContain('Combat Training Academy');
    });
  });

  describe('Test 2: Academy Level 1 cap (15)', () => {
    beforeEach(async () => {
      // Create Combat Training Academy at level 1
      await prisma.facility.create({
        data: {
          userId: testUser.id,
          facilityType: 'combat_training_academy',
          level: 1,
        },
      });
    });

    it('should allow upgrading combatPower to level 15 with academy level 1', async () => {
      // Update robot to level 14
      await prisma.robot.update({
        where: { id: testRobot.id },
        data: { combatPower: new Prisma.Decimal(14) },
      });

      // Try to upgrade to level 15
      const response = await request(app)
        .put(`/api/robots/${testRobot.id}/upgrade`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ attribute: 'combatPower' });

      expect(response.status).toBe(200);

      // Verify the robot is at level 15
      const robot = await prisma.robot.findUnique({
        where: { id: testRobot.id },
      });
      expect(robot?.combatPower).toBe(15);
    });

    it('should block upgrading combatPower from level 15 to level 16', async () => {
      // Update robot to level 15
      await prisma.robot.update({
        where: { id: testRobot.id },
        data: { combatPower: new Prisma.Decimal(15) },
      });

      // Try to upgrade to level 16
      const response = await request(app)
        .put(`/api/robots/${testRobot.id}/upgrade`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ attribute: 'combatPower' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Attribute cap of 15 reached');
      expect(response.body.error).toContain('Combat Training Academy');
    });
  });

  describe('Test 3: All 4 academies control their respective attributes', () => {
    it('should enforce Combat Training Academy for Combat Systems attributes', async () => {
      const combatAttributes = [
        'combatPower',
        'targetingSystems',
        'criticalSystems',
        'penetration',
        'weaponControl',
        'attackSpeed',
      ];

      for (const attribute of combatAttributes) {
        // Set attribute to level 10
        await prisma.robot.update({
          where: { id: testRobot.id },
          data: { [attribute]: 10 },
        });

        // Try to upgrade past level 10 without academy
        const response = await request(app)
          .put(`/api/robots/${testRobot.id}/upgrade`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ attribute });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Attribute cap of 10 reached');
        expect(response.body.error).toContain('Combat Training Academy');
      }
    });

    it('should enforce Defense Training Academy for Defensive Systems attributes', async () => {
      const defenseAttributes = [
        'armorPlating',
        'shieldCapacity',
        'evasionThrusters',
        'damageDampeners',
        'counterProtocols',
      ];

      for (const attribute of defenseAttributes) {
        // Set attribute to level 10
        await prisma.robot.update({
          where: { id: testRobot.id },
          data: { [attribute]: 10 },
        });

        // Try to upgrade past level 10 without academy
        const response = await request(app)
          .put(`/api/robots/${testRobot.id}/upgrade`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ attribute });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Attribute cap of 10 reached');
        expect(response.body.error).toContain('Defense Training Academy');
      }
    });

    it('should enforce Mobility Training Academy for Chassis & Mobility attributes', async () => {
      const mobilityAttributes = [
        'hullIntegrity',
        'servoMotors',
        'gyroStabilizers',
        'hydraulicSystems',
        'powerCore',
      ];

      for (const attribute of mobilityAttributes) {
        // Set attribute to level 10
        await prisma.robot.update({
          where: { id: testRobot.id },
          data: { [attribute]: 10 },
        });

        // Try to upgrade past level 10 without academy
        const response = await request(app)
          .put(`/api/robots/${testRobot.id}/upgrade`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ attribute });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Attribute cap of 10 reached');
        expect(response.body.error).toContain('Mobility Training Academy');
      }
    });

    it('should enforce AI Training Academy for AI Processing + Team attributes', async () => {
      const aiAttributes = [
        'combatAlgorithms',
        'threatAnalysis',
        'adaptiveAI',
        'logicCores',
        'syncProtocols',
        'supportSystems',
        'formationTactics',
      ];

      for (const attribute of aiAttributes) {
        // Set attribute to level 10
        await prisma.robot.update({
          where: { id: testRobot.id },
          data: { [attribute]: 10 },
        });

        // Try to upgrade past level 10 without academy
        const response = await request(app)
          .put(`/api/robots/${testRobot.id}/upgrade`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ attribute });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Attribute cap of 10 reached');
        expect(response.body.error).toContain('AI Training Academy');
      }
    });
  });

  describe('Test 4: Maximum cap of 50 at academy level 10', () => {
    beforeEach(async () => {
      // Create Combat Training Academy at level 10
      await prisma.facility.create({
        data: {
          userId: testUser.id,
          facilityType: 'combat_training_academy',
          level: 10,
        },
      });
    });

    it('should allow upgrading combatPower to level 50 with academy level 10', async () => {
      // Update robot to level 49
      await prisma.robot.update({
        where: { id: testRobot.id },
        data: { combatPower: new Prisma.Decimal(49) },
      });

      // Try to upgrade to level 50
      const response = await request(app)
        .put(`/api/robots/${testRobot.id}/upgrade`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ attribute: 'combatPower' });

      expect(response.status).toBe(200);

      // Verify the robot is at level 50
      const robot = await prisma.robot.findUnique({
        where: { id: testRobot.id },
      });
      expect(robot?.combatPower).toBe(50);
    });

    it('should block upgrading combatPower from level 50 to level 51', async () => {
      // Update robot to level 50
      await prisma.robot.update({
        where: { id: testRobot.id },
        data: { combatPower: new Prisma.Decimal(50) },
      });

      // Try to upgrade to level 51
      const response = await request(app)
        .put(`/api/robots/${testRobot.id}/upgrade`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ attribute: 'combatPower' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('maximum level');
    });
  });

  describe('Test 5: Verify cap progression mapping', () => {
    const capLevels = [
      { level: 0, cap: 10 },
      { level: 1, cap: 15 },
      { level: 2, cap: 20 },
      { level: 3, cap: 25 },
      { level: 4, cap: 30 },
      { level: 5, cap: 35 },
      { level: 6, cap: 40 },
      { level: 7, cap: 42 },
      { level: 8, cap: 45 },
      { level: 9, cap: 48 },
      { level: 10, cap: 50 },
    ];

    capLevels.forEach(({ level, cap }) => {
      it(`should enforce cap of ${cap} for academy level ${level}`, async () => {
        // Create or update academy to the specific level
        if (level > 0) {
          await prisma.facility.upsert({
            where: {
              userId_facilityType: {
                userId: testUser.id,
                facilityType: 'combat_training_academy',
              },
            },
            create: {
              userId: testUser.id,
              facilityType: 'combat_training_academy',
              level,
            },
            update: {
              level,
            },
          });
        }

        // Set robot attribute to the cap level
        await prisma.robot.update({
          where: { id: testRobot.id },
          data: { combatPower: cap },
        });

        // Try to upgrade past the cap
        const response = await request(app)
          .put(`/api/robots/${testRobot.id}/upgrade`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ attribute: 'combatPower' });

        expect(response.status).toBe(400);
        // At level 50 (max), the error message is different
        if (cap === 50) {
          expect(response.body.error).toContain('maximum level');
        } else {
          expect(response.body.error).toContain(`Attribute cap of ${cap} reached`);
        }
      });
    });
  });
});
