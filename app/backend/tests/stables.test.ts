import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import stablesRoutes from '../src/routes/stables';
import authRoutes from '../src/routes/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { SENSITIVE_ROBOT_FIELDS } from '../src/routes/robots';

dotenv.config();

// Create test app with error handler for proper error responses
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/stables', stablesRoutes);
app.use(errorHandler);

describe('Stables API - GET /api/stables/:userId', () => {
  let testUserIds: number[] = [];
  let authToken: string;
  let testUser: any;
  let viewerUser: any;
  const testPassword = 'testpass123';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Create the target user (the stable we'll view)
    const targetUsername = `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    testUser = await prisma.user.create({
      data: {
        username: targetUsername,
        stableName: `IFS_${Math.random().toString(36).substring(2, 8)}`,
        passwordHash,
        role: 'user',
        currency: 50000,
        prestige: 6000,
        championshipTitles: 2,
      },
    });
    testUserIds.push(testUser.id);

    // Create a viewer user (the one making the request)
    const viewerUsername = `sv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    viewerUser = await prisma.user.create({
      data: {
        username: viewerUsername,
        passwordHash,
        role: 'user',
        currency: 10000,
        prestige: 0,
      },
    });
    testUserIds.push(viewerUser.id);

    // Login as viewer to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: viewerUsername, password: testPassword });
    authToken = loginResponse.body.token;
  });

  afterEach(async () => {
    if (testUserIds.length > 0) {
      const robots = await prisma.robot.findMany({
        where: { userId: { in: testUserIds } },
        select: { id: true },
      });
      const robotIds = robots.map((r) => r.id);

      if (robotIds.length > 0) {
        await prisma.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
        await prisma.battle.deleteMany({
          where: { OR: [{ robot1Id: { in: robotIds } }, { robot2Id: { in: robotIds } }] },
        });
        await prisma.scheduledLeagueMatch.deleteMany({
          where: { OR: [{ robot1Id: { in: robotIds } }, { robot2Id: { in: robotIds } }] },
        });
      }

      await prisma.weaponInventory.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.facility.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.robot.deleteMany({ where: { userId: { in: testUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
    testUserIds = [];
  });

  // Requirement 5.2: 404 for non-existent user
  it('should return 404 for non-existent user', async () => {
    const response = await request(app)
      .get('/api/stables/999999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('User not found');
  });

  // Requirement 1.2, 5.1: 401 for unauthenticated request
  it('should return 401 for unauthenticated request', async () => {
    const response = await request(app)
      .get(`/api/stables/${testUser.id}`);

    expect(response.status).toBe(401);
  });

  it('should return 401 for invalid token', async () => {
    const response = await request(app)
      .get(`/api/stables/${testUser.id}`)
      .set('Authorization', 'Bearer invalid-token-here');

    expect(response.status).toBe(401);
  });

  // Requirement 5.4: 400 for invalid userId
  describe('invalid userId parameter validation', () => {
    it('should return 400 for negative userId', async () => {
      const response = await request(app)
        .get('/api/stables/-1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for zero userId', async () => {
      const response = await request(app)
        .get('/api/stables/0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for float userId', async () => {
      const response = await request(app)
        .get('/api/stables/1.5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for non-numeric userId', async () => {
      const response = await request(app)
        .get('/api/stables/abc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  // Requirement 1.1, 4.1: Correct response shape for user with robots and facilities
  it('should return correct response shape for a user with robots and facilities', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    // Create robots for the target user
    await prisma.robot.create({
      data: {
        name: `Alpha Bot ${suffix}`,
        userId: testUser.id,
        elo: 1500,
        wins: 10,
        losses: 3,
        draws: 2,
        totalBattles: 15,
        fame: 200,
        kills: 5,
        damageDealtLifetime: 5000,
        damageTakenLifetime: 3000,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        combatPower: 8,
        targetingSystems: 7,
        criticalSystems: 6,
        penetration: 5,
        weaponControl: 5,
        attackSpeed: 5,
        armorPlating: 5,
        shieldCapacity: 5,
        evasionThrusters: 5,
        damageDampeners: 5,
        counterProtocols: 5,
        hullIntegrity: 5,
        servoMotors: 5,
        gyroStabilizers: 5,
        hydraulicSystems: 5,
        powerCore: 5,
        combatAlgorithms: 5,
        threatAnalysis: 5,
        adaptiveAI: 5,
        logicCores: 5,
        syncProtocols: 5,
        supportSystems: 5,
        formationTactics: 5,
      },
    });

    await prisma.robot.create({
      data: {
        name: `Beta Bot ${suffix}`,
        userId: testUser.id,
        elo: 1300,
        wins: 5,
        losses: 5,
        draws: 0,
        totalBattles: 10,
        fame: 100,
        kills: 2,
        damageDealtLifetime: 2000,
        damageTakenLifetime: 2500,
        currentHP: 80,
        maxHP: 100,
        currentShield: 5,
        maxShield: 10,
        combatPower: 5,
        targetingSystems: 5,
        criticalSystems: 5,
        penetration: 5,
        weaponControl: 5,
        attackSpeed: 5,
        armorPlating: 5,
        shieldCapacity: 5,
        evasionThrusters: 5,
        damageDampeners: 5,
        counterProtocols: 5,
        hullIntegrity: 5,
        servoMotors: 5,
        gyroStabilizers: 5,
        hydraulicSystems: 5,
        powerCore: 5,
        combatAlgorithms: 5,
        threatAnalysis: 5,
        adaptiveAI: 5,
        logicCores: 5,
        syncProtocols: 5,
        supportSystems: 5,
        formationTactics: 5,
      },
    });

    // Create a facility for the target user
    await prisma.facility.create({
      data: {
        userId: testUser.id,
        facilityType: 'repair_bay',
        level: 3,
        maxLevel: 10,
      },
    });

    const response = await request(app)
      .get(`/api/stables/${testUser.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);

    // Verify top-level response shape
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('robots');
    expect(response.body).toHaveProperty('facilities');
    expect(response.body).toHaveProperty('stats');

    // Verify user shape
    const { user } = response.body;
    expect(user.id).toBe(testUser.id);
    expect(user.username).toBe(testUser.username);
    expect(user.stableName).toBe(testUser.stableName);
    expect(user.prestige).toBe(6000);
    expect(user.prestigeRank).toBe('Veteran');
    expect(user.championshipTitles).toBe(2);

    // Verify robots array
    expect(response.body.robots).toHaveLength(2);
    // Sorted by ELO desc
    expect(response.body.robots[0].elo).toBeGreaterThanOrEqual(response.body.robots[1].elo);

    // Verify stats
    const { stats } = response.body;
    expect(stats.totalBattles).toBe(25);
    expect(stats.totalWins).toBe(15);
    expect(stats.totalLosses).toBe(8);
    expect(stats.totalDraws).toBe(2);
    expect(stats.highestElo).toBe(1500);
    expect(stats.activeRobots).toBe(2);
    expect(stats.winRate).toBe(60);

    // Verify facilities
    expect(response.body.facilities).toHaveLength(1);
    expect(response.body.facilities[0]).toEqual({
      type: 'repair_bay',
      name: 'Repair Bay',
      level: 3,
      maxLevel: 10,
    });
  });

  // Requirement 8.4: Empty robots array for user with no robots
  it('should return empty robots array for user with no robots', async () => {
    const response = await request(app)
      .get(`/api/stables/${testUser.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.robots).toEqual([]);
    expect(response.body.stats.totalBattles).toBe(0);
    expect(response.body.stats.totalWins).toBe(0);
    expect(response.body.stats.totalLosses).toBe(0);
    expect(response.body.stats.totalDraws).toBe(0);
    expect(response.body.stats.highestElo).toBe(0);
    expect(response.body.stats.activeRobots).toBe(0);
    expect(response.body.stats.winRate).toBe(0);
  });

  // Requirement 2.1: Bye Robot is excluded from response
  it('should exclude Bye Robot from response', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Create a normal robot for the test user
    await prisma.robot.create({
      data: {
        name: `Normal Bot ${suffix}`,
        userId: testUser.id,
        elo: 1200,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        combatPower: 5, targetingSystems: 5, criticalSystems: 5, penetration: 5,
        weaponControl: 5, attackSpeed: 5, armorPlating: 5, shieldCapacity: 5,
        evasionThrusters: 5, damageDampeners: 5, counterProtocols: 5,
        hullIntegrity: 5, servoMotors: 5, gyroStabilizers: 5, hydraulicSystems: 5,
        powerCore: 5, combatAlgorithms: 5, threatAnalysis: 5, adaptiveAI: 5,
        logicCores: 5, syncProtocols: 5, supportSystems: 5, formationTactics: 5,
      },
    });

    // Temporarily reassign the existing Bye Robot to our test user
    const byeRobot = await prisma.robot.findUnique({ where: { name: 'Bye Robot' } });
    let originalByeRobotUserId: number | null = null;
    if (byeRobot) {
      originalByeRobotUserId = byeRobot.userId;
      await prisma.robot.update({
        where: { id: byeRobot.id },
        data: { userId: testUser.id },
      });
    }

    try {
      const response = await request(app)
        .get(`/api/stables/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Only the normal robot should appear; Bye Robot is excluded by the route
      expect(response.body.robots).toHaveLength(1);
      expect(response.body.robots[0].name).toBe(`Normal Bot ${suffix}`);
      const robotNames = response.body.robots.map((r: any) => r.name);
      expect(robotNames).not.toContain('Bye Robot');
    } finally {
      // Restore Bye Robot to its original owner
      if (byeRobot && originalByeRobotUserId !== null) {
        await prisma.robot.update({
          where: { id: byeRobot.id },
          data: { userId: originalByeRobotUserId },
        });
      }
    }
  });

  // Requirement 2.1, 2.5: No sensitive robot fields in response
  it('should not include any sensitive robot fields in the response', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await prisma.robot.create({
      data: {
        name: `Sensitive Test Bot ${suffix}`,
        userId: testUser.id,
        elo: 1400,
        currentHP: 95,
        maxHP: 100,
        currentShield: 8,
        maxShield: 10,
        combatPower: 12, targetingSystems: 11, criticalSystems: 10, penetration: 9,
        weaponControl: 8, attackSpeed: 7, armorPlating: 6, shieldCapacity: 5,
        evasionThrusters: 4, damageDampeners: 3, counterProtocols: 2,
        hullIntegrity: 5, servoMotors: 5, gyroStabilizers: 5, hydraulicSystems: 5,
        powerCore: 5, combatAlgorithms: 5, threatAnalysis: 5, adaptiveAI: 5,
        logicCores: 5, syncProtocols: 5, supportSystems: 5, formationTactics: 5,
        stance: 'aggressive',
        yieldThreshold: 20,
        loadoutType: 'dual_wield',
      },
    });

    const response = await request(app)
      .get(`/api/stables/${testUser.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.robots).toHaveLength(1);

    const robot = response.body.robots[0];
    for (const field of SENSITIVE_ROBOT_FIELDS) {
      expect(robot).not.toHaveProperty(field);
    }
  });

  // Requirement 1.4: Owner viewing own stable gets identical response to another viewer
  it('should return identical response when owner views own stable vs another viewer', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    // Create a robot for the target user
    await prisma.robot.create({
      data: {
        name: `Owner Test Bot ${suffix}`,
        userId: testUser.id,
        elo: 1350,
        wins: 7,
        losses: 3,
        draws: 1,
        totalBattles: 11,
        fame: 150,
        kills: 3,
        currentHP: 100,
        maxHP: 100,
        currentShield: 10,
        maxShield: 10,
        combatPower: 5, targetingSystems: 5, criticalSystems: 5, penetration: 5,
        weaponControl: 5, attackSpeed: 5, armorPlating: 5, shieldCapacity: 5,
        evasionThrusters: 5, damageDampeners: 5, counterProtocols: 5,
        hullIntegrity: 5, servoMotors: 5, gyroStabilizers: 5, hydraulicSystems: 5,
        powerCore: 5, combatAlgorithms: 5, threatAnalysis: 5, adaptiveAI: 5,
        logicCores: 5, syncProtocols: 5, supportSystems: 5, formationTactics: 5,
      },
    });

    // Get response as another viewer
    const viewerResponse = await request(app)
      .get(`/api/stables/${testUser.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    // Login as the target user (owner)
    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: testPassword });
    const ownerToken = ownerLogin.body.token;

    // Get response as owner
    const ownerResponse = await request(app)
      .get(`/api/stables/${testUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(viewerResponse.status).toBe(200);
    expect(ownerResponse.status).toBe(200);

    // Both responses should be identical
    expect(ownerResponse.body).toEqual(viewerResponse.body);
  });
});
