/**
 * Property-Based Tests for Battle Log Streaming Revenue Display
 * Property 13: Battle Log Contains Streaming Revenue Data
 * 
 * **Validates: Requirements 8.1-8.8**
 * 
 * For any battle log display, the output should contain the streaming revenue 
 * amount retrieved from BattleParticipant records.
 * 
 * Note: The API endpoint reads streamingRevenue from BattleParticipant records.
 * Detailed breakdown (multipliers) is not stored or returned by the API.
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import matchesRoutes from '../src/routes/matches';
import jwt from 'jsonwebtoken';

// Create test app
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/matches', matchesRoutes);

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Helper function to create a minimal test robot
async function createTestRobot(userId: number, name: string, battles: number, fame: number) {
  return await prisma.robot.create({
    data: {
      userId,
      name,
      frameId: 1,
      totalBattles: battles,
      fame,
      combatPower: new Prisma.Decimal(10),
      targetingSystems: new Prisma.Decimal(10),
      criticalSystems: new Prisma.Decimal(10),
      penetration: new Prisma.Decimal(10),
      weaponControl: new Prisma.Decimal(10),
      attackSpeed: new Prisma.Decimal(10),
      armorPlating: new Prisma.Decimal(10),
      shieldCapacity: new Prisma.Decimal(10),
      evasionThrusters: new Prisma.Decimal(10),
      damageDampeners: new Prisma.Decimal(10),
      counterProtocols: new Prisma.Decimal(10),
      hullIntegrity: new Prisma.Decimal(10),
      servoMotors: new Prisma.Decimal(10),
      gyroStabilizers: new Prisma.Decimal(10),
      hydraulicSystems: new Prisma.Decimal(10),
      powerCore: new Prisma.Decimal(10),
      combatAlgorithms: new Prisma.Decimal(10),
      threatAnalysis: new Prisma.Decimal(10),
      adaptiveAI: new Prisma.Decimal(10),
      logicCores: new Prisma.Decimal(10),
      syncProtocols: new Prisma.Decimal(10),
      supportSystems: new Prisma.Decimal(10),
      formationTactics: new Prisma.Decimal(10),
      currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20, damageTaken: 0,
      elo: 1200, wins: 0, draws: 0, losses: 0,
      damageDealtLifetime: 0, damageTakenLifetime: 0, kills: 0,
      currentLeague: 'bronze', leagueId: 'bronze_1', leaguePoints: 0, cyclesInCurrentLeague: 0,
      repairCost: 0, battleReadiness: 100, totalRepairsPaid: 0,
      yieldThreshold: 10, loadoutType: 'single', stance: 'balanced', mainWeaponId: null,
    },
  });
}

/**
 * Helper to create a battle with BattleParticipant records containing streaming revenue.
 * The API endpoint reads streamingRevenue from BattleParticipant, not from AuditLog.
 */
async function createBattleWithStreamingRevenue(
  robot1Id: number,
  robot2Id: number,
  winnerId: number | null,
  streamingRevenue1: number,
  streamingRevenue2: number,
) {
  const battle = await prisma.battle.create({
    data: {
      robot1Id,
      robot2Id,
      winnerId,
      robot1ELOBefore: 1200,
      robot1ELOAfter: 1210,
      robot2ELOBefore: 1200,
      robot2ELOAfter: 1190,
      winnerReward: 1000,
      loserReward: 500,
      durationSeconds: 30,
      battleType: 'league',
      leagueType: 'bronze',
      battleLog: { events: [] },
      eloChange: 10,
    },
  });

  // Create BattleParticipant records — this is where the API reads streamingRevenue from
  await prisma.battleParticipant.create({
    data: {
      battleId: battle.id,
      robotId: robot1Id,
      team: 1,
      credits: winnerId === robot1Id ? 1000 : 500,
      streamingRevenue: streamingRevenue1,
      eloBefore: 1200,
      eloAfter: winnerId === robot1Id ? 1210 : 1190,
      damageDealt: 50,
      finalHP: winnerId === robot1Id ? 60 : 0,
      yielded: false,
      destroyed: winnerId !== robot1Id && winnerId !== null,
    },
  });

  await prisma.battleParticipant.create({
    data: {
      battleId: battle.id,
      robotId: robot2Id,
      team: 2,
      credits: winnerId === robot2Id ? 1000 : 500,
      streamingRevenue: streamingRevenue2,
      eloBefore: 1200,
      eloAfter: winnerId === robot2Id ? 1210 : 1190,
      damageDealt: 40,
      finalHP: winnerId === robot2Id ? 60 : 0,
      yielded: false,
      destroyed: winnerId !== robot2Id && winnerId !== null,
    },
  });

  return battle;
}

describe('Property 13: Battle Log Contains Streaming Revenue Data', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        username: `test_user_battlelog_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });

    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    await prisma.battleParticipant.deleteMany({
      where: { robot: { userId: testUser.id } },
    });
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({ where: { userId: testUser.id } });
    await prisma.facility.deleteMany({ where: { userId: testUser.id } });
  });

  afterEach(async () => {
    await prisma.battleParticipant.deleteMany({
      where: { robot: { userId: testUser.id } },
    });
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({ where: { userId: testUser.id } });
    await prisma.facility.deleteMany({ where: { userId: testUser.id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});
    await prisma.$disconnect();
  });

  /**
   * Property 13: For any battle log, the API response should contain the
   * streaming revenue amount for each robot, read from BattleParticipant records.
   */
  test('Property 13: Battle log contains streaming revenue data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 0, max: 25000 }), // fame for robot 1
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 0, max: 25000 }), // fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level
        fc.constantFrom('robot1', 'robot2', null), // winner
        async (battles1, fame1, battles2, fame2, studioLevel, winner) => {
          const robot1 = await createTestRobot(testUser.id, `Robot1_${Date.now()}`, battles1, fame1);
          const robot2 = await createTestRobot(testUser.id, `Robot2_${Date.now()}`, battles2, fame2);

          // Calculate expected streaming revenue using the formula
          const baseAmount = 1000;
          const studioMultiplier = 1 + (studioLevel * 1.0);
          const totalRevenue1 = Math.floor(
            baseAmount * (1 + battles1 / 1000) * (1 + fame1 / 5000) * studioMultiplier
          );
          const totalRevenue2 = Math.floor(
            baseAmount * (1 + battles2 / 1000) * (1 + fame2 / 5000) * studioMultiplier
          );

          const winnerId = winner === 'robot1' ? robot1.id : winner === 'robot2' ? robot2.id : null;

          const battle = await createBattleWithStreamingRevenue(
            robot1.id, robot2.id, winnerId, totalRevenue1, totalRevenue2,
          );

          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);

          const battleLog = response.body;

          // Property: Both robots should be present
          expect(battleLog.robot1).toBeDefined();
          expect(battleLog.robot2).toBeDefined();

          // Property: Streaming revenue should match what was stored in BattleParticipant
          expect(battleLog.robot1.streamingRevenue).toBe(totalRevenue1);
          expect(battleLog.robot2.streamingRevenue).toBe(totalRevenue2);

          // Clean up for next iteration
          await prisma.battleParticipant.deleteMany({ where: { battleId: battle.id } });
          await prisma.battle.deleteMany({ where: { id: battle.id } });
          await prisma.robot.deleteMany({ where: { id: { in: [robot1.id, robot2.id] } } });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 13.1: Both winner and loser should have streaming revenue
   */
  test('Property 13.1: Battle log contains streaming revenue for both winner and loser', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 500, max: 25000 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 500, max: 25000 }),
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom('robot1', 'robot2'),
        async (battles1, fame1, battles2, fame2, studioLevel, winner) => {
          const robot1 = await createTestRobot(testUser.id, `Winner_${Date.now()}`, battles1, fame1);
          const robot2 = await createTestRobot(testUser.id, `Loser_${Date.now()}`, battles2, fame2);

          const baseAmount = 1000;
          const studioMultiplier = 1 + (studioLevel * 1.0);
          const totalRevenue1 = Math.floor(
            baseAmount * (1 + battles1 / 1000) * (1 + fame1 / 5000) * studioMultiplier
          );
          const totalRevenue2 = Math.floor(
            baseAmount * (1 + battles2 / 1000) * (1 + fame2 / 5000) * studioMultiplier
          );

          const winnerId = winner === 'robot1' ? robot1.id : robot2.id;

          const battle = await createBattleWithStreamingRevenue(
            robot1.id, robot2.id, winnerId, totalRevenue1, totalRevenue2,
          );

          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);
          const battleLog = response.body;

          // Property: Both winner and loser should have positive streaming revenue
          expect(battleLog.robot1.streamingRevenue).toBeGreaterThan(0);
          expect(battleLog.robot2.streamingRevenue).toBeGreaterThan(0);

          // Property: Revenue should match stored values
          expect(battleLog.robot1.streamingRevenue).toBe(totalRevenue1);
          expect(battleLog.robot2.streamingRevenue).toBe(totalRevenue2);

          // Clean up
          await prisma.battleParticipant.deleteMany({ where: { battleId: battle.id } });
          await prisma.battle.deleteMany({ where: { id: battle.id } });
          await prisma.robot.deleteMany({ where: { id: { in: [robot1.id, robot2.id] } } });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 13.2: Draws should also have streaming revenue
   */
  test('Property 13.2: Battle log contains streaming revenue for draws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 25000 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 25000 }),
        fc.integer({ min: 0, max: 10 }),
        async (battles1, fame1, battles2, fame2, studioLevel) => {
          const robot1 = await createTestRobot(testUser.id, `Draw1_${Date.now()}`, battles1, fame1);
          const robot2 = await createTestRobot(testUser.id, `Draw2_${Date.now()}`, battles2, fame2);

          const baseAmount = 1000;
          const studioMultiplier = 1 + (studioLevel * 1.0);
          const totalRevenue1 = Math.floor(
            baseAmount * (1 + battles1 / 1000) * (1 + fame1 / 5000) * studioMultiplier
          );
          const totalRevenue2 = Math.floor(
            baseAmount * (1 + battles2 / 1000) * (1 + fame2 / 5000) * studioMultiplier
          );

          const battle = await createBattleWithStreamingRevenue(
            robot1.id, robot2.id, null, totalRevenue1, totalRevenue2,
          );

          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);
          const battleLog = response.body;

          // Property: Draw
          expect(battleLog.winner).toBeNull();

          // Property: Both robots should have streaming revenue even in a draw
          expect(battleLog.robot1.streamingRevenue).toBe(totalRevenue1);
          expect(battleLog.robot2.streamingRevenue).toBe(totalRevenue2);

          // Clean up
          await prisma.battleParticipant.deleteMany({ where: { battleId: battle.id } });
          await prisma.battle.deleteMany({ where: { id: battle.id } });
          await prisma.robot.deleteMany({ where: { id: { in: [robot1.id, robot2.id] } } });
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 13.3: Zero battles and fame should show base amount
   */
  test('Property 13.3: Battle log shows base amount for robots with zero battles and fame', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),
        async (studioLevel) => {
          const robot1 = await createTestRobot(testUser.id, `Zero1_${Date.now()}`, 0, 0);
          const robot2 = await createTestRobot(testUser.id, `Zero2_${Date.now()}`, 0, 0);

          const baseAmount = 1000;
          const studioMultiplier = 1 + (studioLevel * 1.0);
          const expectedRevenue = Math.floor(baseAmount * studioMultiplier);

          const battle = await createBattleWithStreamingRevenue(
            robot1.id, robot2.id, robot1.id, expectedRevenue, expectedRevenue,
          );

          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);
          const battleLog = response.body;

          // Property: Revenue should be base amount × studio multiplier
          expect(battleLog.robot1.streamingRevenue).toBe(expectedRevenue);
          expect(battleLog.robot2.streamingRevenue).toBe(expectedRevenue);

          // Clean up
          await prisma.battleParticipant.deleteMany({ where: { battleId: battle.id } });
          await prisma.battle.deleteMany({ where: { id: battle.id } });
          await prisma.robot.deleteMany({ where: { id: { in: [robot1.id, robot2.id] } } });
        }
      ),
      { numRuns: 10 }
    );
  });
});
