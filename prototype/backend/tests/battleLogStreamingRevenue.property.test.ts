/**
 * Property-Based Tests for Battle Log Streaming Revenue Display
 * Property 13: Battle Log Contains Streaming Revenue Data
 * 
 * **Validates: Requirements 8.1-8.8**
 * 
 * For any battle log display, the output should contain the streaming revenue 
 * amount, base amount (1000), battle multiplier, fame multiplier, and studio multiplier
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
      // Combat Systems
      combatPower: new Prisma.Decimal(10),
      targetingSystems: new Prisma.Decimal(10),
      criticalSystems: new Prisma.Decimal(10),
      penetration: new Prisma.Decimal(10),
      weaponControl: new Prisma.Decimal(10),
      attackSpeed: new Prisma.Decimal(10),
      // Defensive Systems
      armorPlating: new Prisma.Decimal(10),
      shieldCapacity: new Prisma.Decimal(10),
      evasionThrusters: new Prisma.Decimal(10),
      damageDampeners: new Prisma.Decimal(10),
      counterProtocols: new Prisma.Decimal(10),
      // Chassis & Mobility
      hullIntegrity: new Prisma.Decimal(10),
      servoMotors: new Prisma.Decimal(10),
      gyroStabilizers: new Prisma.Decimal(10),
      hydraulicSystems: new Prisma.Decimal(10),
      powerCore: new Prisma.Decimal(10),
      // AI Processing
      combatAlgorithms: new Prisma.Decimal(10),
      threatAnalysis: new Prisma.Decimal(10),
      adaptiveAI: new Prisma.Decimal(10),
      logicCores: new Prisma.Decimal(10),
      // Team Coordination
      syncProtocols: new Prisma.Decimal(10),
      supportSystems: new Prisma.Decimal(10),
      formationTactics: new Prisma.Decimal(10),
      // Combat State
      currentHP: 100,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      damageTaken: 0,
      // Performance
      elo: 1200,
      wins: 0,
      draws: 0,
      losses: 0,
      damageDealtLifetime: 0,
      damageTakenLifetime: 0,
      kills: 0,
      // League & Fame
      currentLeague: 'bronze',
      leagueId: 'bronze_1',
      leaguePoints: 0,
      cyclesInCurrentLeague: 0,
      // Economic
      repairCost: 0,
      battleReadiness: 100,
      totalRepairsPaid: 0,
      // Configuration
      yieldThreshold: 10,
      loadoutType: 'single',
      stance: 'balanced',
      mainWeaponId: null,
    },
  });
}

// Helper function to create a battle with streaming revenue data
async function createBattleWithStreamingRevenue(
  robot1Id: number,
  robot2Id: number,
  winnerId: number | null,
  streamingRevenue1: number,
  streamingRevenue2: number,
  streamingRevenueDetails1: any,
  streamingRevenueDetails2: any,
  userId: number
) {
  // Create battle
  const battle = await prisma.battle.create({
    data: {
      userId,
      robot1Id,
      robot2Id,
      winnerId,
      robot1ELOBefore: 1200,
      robot1ELOAfter: 1210,
      robot2ELOBefore: 1200,
      robot2ELOAfter: 1190,
      robot1FinalHP: 50,
      robot2FinalHP: 0,
      robot1FinalShield: 0,
      robot2FinalShield: 0,
      robot1DamageDealt: 100,
      robot2DamageDealt: 50,
      winnerReward: 1000,
      loserReward: 500,
      durationSeconds: 30,
      battleType: 'league',
      leagueType: 'bronze',
      battleLog: { events: [] },
      robot1PrestigeAwarded: 10,
      robot2PrestigeAwarded: 5,
      robot1FameAwarded: 20,
      robot2FameAwarded: 10,
      eloChange: 10,
      robot1Destroyed: false,
      robot2Destroyed: true,
      robot1Yielded: false,
      robot2Yielded: false,
      robot1RepairCost: 0,
      robot2RepairCost: 0,
    },
  });

  // Get next sequence number for audit log
  const lastLog = await prisma.auditLog.findFirst({
    where: { cycleNumber: 1 },
    orderBy: { sequenceNumber: 'desc' },
  });
  const sequenceNumber = (lastLog?.sequenceNumber || 0) + 1;

  // Create audit log entry with streaming revenue data
  await prisma.auditLog.create({
    data: {
      userId: null,
      cycleNumber: 1,
      sequenceNumber,
      eventType: 'battle_complete',
      eventTimestamp: new Date(),
      payload: {
        battleId: battle.id,
        streamingRevenue1,
        streamingRevenue2,
        streamingRevenueDetails1,
        streamingRevenueDetails2,
      },
    },
  });

  return battle;
}

describe('Property 13: Battle Log Contains Streaming Revenue Data', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create a test user for all tests
    testUser = await prisma.user.create({
      data: {
        username: `test_user_battlelog_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({ where: { eventType: 'battle_complete' } });
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({ where: { userId: testUser.id } });
    await prisma.facility.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up battles, robots, and facilities before each test
    await prisma.auditLog.deleteMany({ where: { eventType: 'battle_complete' } });
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({ where: { userId: testUser.id } });
    await prisma.facility.deleteMany({ where: { userId: testUser.id } });
  });

  /**
   * Property 13: For any battle log display, the output should contain the 
   * streaming revenue amount, base amount (1000), battle multiplier, fame 
   * multiplier, and studio multiplier
   */
  test('Property 13: Battle log contains all streaming revenue data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 0, max: 25000 }), // fame for robot 1
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 0, max: 25000 }), // fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level
        fc.constantFrom('robot1', 'robot2', null), // winner
        async (battles1, fame1, battles2, fame2, studioLevel, winner) => {
          // Clean up facility first to ensure clean state
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots with specified stats
          const robot1 = await createTestRobot(testUser.id, `Robot1_${Date.now()}`, battles1, fame1);
          const robot2 = await createTestRobot(testUser.id, `Robot2_${Date.now()}`, battles2, fame2);

          // Create Streaming Studio facility only if level > 0
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser.id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate expected streaming revenue values
          const baseAmount = 1000;
          const battleMultiplier1 = 1 + (battles1 / 1000);
          const fameMultiplier1 = 1 + (fame1 / 5000);
          const studioMultiplier = 1 + (studioLevel * 1.0);
          const totalRevenue1 = Math.floor(
            baseAmount * battleMultiplier1 * fameMultiplier1 * studioMultiplier
          );

          const battleMultiplier2 = 1 + (battles2 / 1000);
          const fameMultiplier2 = 1 + (fame2 / 5000);
          const totalRevenue2 = Math.floor(
            baseAmount * battleMultiplier2 * fameMultiplier2 * studioMultiplier
          );

          // Create streaming revenue details
          const streamingRevenueDetails1 = {
            baseAmount,
            battleMultiplier: battleMultiplier1,
            fameMultiplier: fameMultiplier1,
            studioMultiplier,
            robotBattles: battles1,
            robotFame: fame1,
            studioLevel,
          };

          const streamingRevenueDetails2 = {
            baseAmount,
            battleMultiplier: battleMultiplier2,
            fameMultiplier: fameMultiplier2,
            studioMultiplier,
            robotBattles: battles2,
            robotFame: fame2,
            studioLevel,
          };

          // Determine winner ID
          const winnerId = winner === 'robot1' ? robot1.id : winner === 'robot2' ? robot2.id : null;

          // Create battle with streaming revenue data
          const battle = await createBattleWithStreamingRevenue(
            robot1.id,
            robot2.id,
            winnerId,
            totalRevenue1,
            totalRevenue2,
            streamingRevenueDetails1,
            streamingRevenueDetails2,
            testUser.id
          );

          // Fetch battle log via API
          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          // Property: API should return 200 OK
          expect(response.status).toBe(200);

          const battleLog = response.body;

          // Property: Battle log should contain robot1 data
          expect(battleLog.robot1).toBeDefined();
          expect(battleLog.robot2).toBeDefined();

          // Property: Robot1 should have streaming revenue amount
          expect(battleLog.robot1.streamingRevenue).toBeDefined();
          expect(battleLog.robot1.streamingRevenue).toBe(totalRevenue1);

          // Property: Robot1 should have streaming revenue details
          expect(battleLog.robot1.streamingRevenueDetails).toBeDefined();
          expect(battleLog.robot1.streamingRevenueDetails).not.toBeNull();

          // Property: Robot1 streaming revenue details should contain base amount (1000)
          expect(battleLog.robot1.streamingRevenueDetails.baseAmount).toBe(1000);

          // Property: Robot1 streaming revenue details should contain battle multiplier
          expect(battleLog.robot1.streamingRevenueDetails.battleMultiplier).toBeDefined();
          expect(battleLog.robot1.streamingRevenueDetails.battleMultiplier).toBeCloseTo(battleMultiplier1, 10);

          // Property: Robot1 streaming revenue details should contain fame multiplier
          expect(battleLog.robot1.streamingRevenueDetails.fameMultiplier).toBeDefined();
          expect(battleLog.robot1.streamingRevenueDetails.fameMultiplier).toBeCloseTo(fameMultiplier1, 10);

          // Property: Robot1 streaming revenue details should contain studio multiplier
          expect(battleLog.robot1.streamingRevenueDetails.studioMultiplier).toBeDefined();
          expect(battleLog.robot1.streamingRevenueDetails.studioMultiplier).toBeCloseTo(studioMultiplier, 10);

          // Property: Robot1 streaming revenue details should contain robot battles
          expect(battleLog.robot1.streamingRevenueDetails.robotBattles).toBe(battles1);

          // Property: Robot1 streaming revenue details should contain robot fame
          expect(battleLog.robot1.streamingRevenueDetails.robotFame).toBe(fame1);

          // Property: Robot1 streaming revenue details should contain studio level
          expect(battleLog.robot1.streamingRevenueDetails.studioLevel).toBe(studioLevel);

          // Property: Robot2 should have streaming revenue amount
          expect(battleLog.robot2.streamingRevenue).toBeDefined();
          expect(battleLog.robot2.streamingRevenue).toBe(totalRevenue2);

          // Property: Robot2 should have streaming revenue details
          expect(battleLog.robot2.streamingRevenueDetails).toBeDefined();
          expect(battleLog.robot2.streamingRevenueDetails).not.toBeNull();

          // Property: Robot2 streaming revenue details should contain base amount (1000)
          expect(battleLog.robot2.streamingRevenueDetails.baseAmount).toBe(1000);

          // Property: Robot2 streaming revenue details should contain battle multiplier
          expect(battleLog.robot2.streamingRevenueDetails.battleMultiplier).toBeDefined();
          expect(battleLog.robot2.streamingRevenueDetails.battleMultiplier).toBeCloseTo(battleMultiplier2, 10);

          // Property: Robot2 streaming revenue details should contain fame multiplier
          expect(battleLog.robot2.streamingRevenueDetails.fameMultiplier).toBeDefined();
          expect(battleLog.robot2.streamingRevenueDetails.fameMultiplier).toBeCloseTo(fameMultiplier2, 10);

          // Property: Robot2 streaming revenue details should contain studio multiplier
          expect(battleLog.robot2.streamingRevenueDetails.studioMultiplier).toBeDefined();
          expect(battleLog.robot2.streamingRevenueDetails.studioMultiplier).toBeCloseTo(studioMultiplier, 10);

          // Property: Robot2 streaming revenue details should contain robot battles
          expect(battleLog.robot2.streamingRevenueDetails.robotBattles).toBe(battles2);

          // Property: Robot2 streaming revenue details should contain robot fame
          expect(battleLog.robot2.streamingRevenueDetails.robotFame).toBe(fame2);

          // Property: Robot2 streaming revenue details should contain studio level
          expect(battleLog.robot2.streamingRevenueDetails.studioLevel).toBe(studioLevel);

          // Clean up battle and robots for next iteration
          await prisma.auditLog.deleteMany({ where: { eventType: 'battle_complete' } });
          await prisma.battle.delete({ where: { id: battle.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.1: Battle log should contain streaming revenue for both winner and loser
   */
  test('Property 13.1: Battle log contains streaming revenue for both winner and loser', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 500, max: 25000 }), // fame for robot 1
        fc.integer({ min: 100, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 500, max: 25000 }), // fame for robot 2
        fc.integer({ min: 1, max: 10 }),      // studio level (non-zero)
        fc.constantFrom('robot1', 'robot2'),  // winner (no draws)
        async (battles1, fame1, battles2, fame2, studioLevel, winner) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots
          const robot1 = await createTestRobot(testUser.id, `Winner_${Date.now()}`, battles1, fame1);
          const robot2 = await createTestRobot(testUser.id, `Loser_${Date.now()}`, battles2, fame2);

          // Create Streaming Studio facility
          await prisma.facility.create({
            data: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
              level: studioLevel,
            },
          });

          // Calculate expected streaming revenue
          const baseAmount = 1000;
          const studioMultiplier = 1 + (studioLevel * 1.0);
          
          const totalRevenue1 = Math.floor(
            baseAmount * (1 + battles1 / 1000) * (1 + fame1 / 5000) * studioMultiplier
          );
          const totalRevenue2 = Math.floor(
            baseAmount * (1 + battles2 / 1000) * (1 + fame2 / 5000) * studioMultiplier
          );

          const streamingRevenueDetails1 = {
            baseAmount,
            battleMultiplier: 1 + (battles1 / 1000),
            fameMultiplier: 1 + (fame1 / 5000),
            studioMultiplier,
            robotBattles: battles1,
            robotFame: fame1,
            studioLevel,
          };

          const streamingRevenueDetails2 = {
            baseAmount,
            battleMultiplier: 1 + (battles2 / 1000),
            fameMultiplier: 1 + (fame2 / 5000),
            studioMultiplier,
            robotBattles: battles2,
            robotFame: fame2,
            studioLevel,
          };

          // Determine winner ID
          const winnerId = winner === 'robot1' ? robot1.id : robot2.id;

          // Create battle
          const battle = await createBattleWithStreamingRevenue(
            robot1.id,
            robot2.id,
            winnerId,
            totalRevenue1,
            totalRevenue2,
            streamingRevenueDetails1,
            streamingRevenueDetails2,
            testUser.id
          );

          // Fetch battle log
          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);

          const battleLog = response.body;

          // Property: Both winner and loser should have streaming revenue
          expect(battleLog.robot1.streamingRevenue).toBeGreaterThan(0);
          expect(battleLog.robot2.streamingRevenue).toBeGreaterThan(0);

          // Property: Both should have complete streaming revenue details
          expect(battleLog.robot1.streamingRevenueDetails).not.toBeNull();
          expect(battleLog.robot2.streamingRevenueDetails).not.toBeNull();

          // Property: Streaming revenue should be independent of battle outcome
          // (both winner and loser get streaming revenue based on their own stats)
          if (winner === 'robot1') {
            expect(battleLog.robot1.streamingRevenue).toBe(totalRevenue1);
            expect(battleLog.robot2.streamingRevenue).toBe(totalRevenue2);
          } else {
            expect(battleLog.robot1.streamingRevenue).toBe(totalRevenue1);
            expect(battleLog.robot2.streamingRevenue).toBe(totalRevenue2);
          }

          // Clean up
          await prisma.auditLog.deleteMany({ where: { eventType: 'battle_complete' } });
          await prisma.battle.delete({ where: { id: battle.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 13.2: Battle log should contain streaming revenue for draws
   */
  test('Property 13.2: Battle log contains streaming revenue for draws', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 0, max: 25000 }), // fame for robot 1
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 0, max: 25000 }), // fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles1, fame1, battles2, fame2, studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots
          const robot1 = await createTestRobot(testUser.id, `Draw1_${Date.now()}`, battles1, fame1);
          const robot2 = await createTestRobot(testUser.id, `Draw2_${Date.now()}`, battles2, fame2);

          // Create Streaming Studio facility only if level > 0
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser.id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate expected streaming revenue
          const baseAmount = 1000;
          const studioMultiplier = 1 + (studioLevel * 1.0);
          
          const totalRevenue1 = Math.floor(
            baseAmount * (1 + battles1 / 1000) * (1 + fame1 / 5000) * studioMultiplier
          );
          const totalRevenue2 = Math.floor(
            baseAmount * (1 + battles2 / 1000) * (1 + fame2 / 5000) * studioMultiplier
          );

          const streamingRevenueDetails1 = {
            baseAmount,
            battleMultiplier: 1 + (battles1 / 1000),
            fameMultiplier: 1 + (fame1 / 5000),
            studioMultiplier,
            robotBattles: battles1,
            robotFame: fame1,
            studioLevel,
          };

          const streamingRevenueDetails2 = {
            baseAmount,
            battleMultiplier: 1 + (battles2 / 1000),
            fameMultiplier: 1 + (fame2 / 5000),
            studioMultiplier,
            robotBattles: battles2,
            robotFame: fame2,
            studioLevel,
          };

          // Create battle with draw (winnerId = null)
          const battle = await createBattleWithStreamingRevenue(
            robot1.id,
            robot2.id,
            null, // Draw
            totalRevenue1,
            totalRevenue2,
            streamingRevenueDetails1,
            streamingRevenueDetails2,
            testUser.id
          );

          // Fetch battle log
          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);

          const battleLog = response.body;

          // Property: Battle should be a draw
          expect(battleLog.winner).toBeNull();

          // Property: Both robots should have streaming revenue even in a draw
          expect(battleLog.robot1.streamingRevenue).toBeDefined();
          expect(battleLog.robot2.streamingRevenue).toBeDefined();
          expect(battleLog.robot1.streamingRevenue).toBe(totalRevenue1);
          expect(battleLog.robot2.streamingRevenue).toBe(totalRevenue2);

          // Property: Both should have complete streaming revenue details
          expect(battleLog.robot1.streamingRevenueDetails).not.toBeNull();
          expect(battleLog.robot2.streamingRevenueDetails).not.toBeNull();

          // Clean up
          await prisma.auditLog.deleteMany({ where: { eventType: 'battle_complete' } });
          await prisma.battle.delete({ where: { id: battle.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 13.3: Edge case - Zero battles and fame should show base amount
   */
  test('Property 13.3: Battle log shows base amount for robots with zero battles and fame', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // studio level only
        async (studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUser.id,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots with zero battles and fame
          const robot1 = await createTestRobot(testUser.id, `Zero1_${Date.now()}`, 0, 0);
          const robot2 = await createTestRobot(testUser.id, `Zero2_${Date.now()}`, 0, 0);

          // Create Streaming Studio facility only if level > 0
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser.id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate expected streaming revenue
          const baseAmount = 1000;
          const studioMultiplier = 1 + (studioLevel * 1.0);
          const expectedRevenue = Math.floor(baseAmount * studioMultiplier);

          const streamingRevenueDetails = {
            baseAmount,
            battleMultiplier: 1.0,
            fameMultiplier: 1.0,
            studioMultiplier,
            robotBattles: 0,
            robotFame: 0,
            studioLevel,
          };

          // Create battle
          const battle = await createBattleWithStreamingRevenue(
            robot1.id,
            robot2.id,
            robot1.id,
            expectedRevenue,
            expectedRevenue,
            streamingRevenueDetails,
            streamingRevenueDetails,
            testUser.id
          );

          // Fetch battle log
          const response = await request(app)
            .get(`/api/matches/battles/${battle.id}/log`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(response.status).toBe(200);

          const battleLog = response.body;

          // Property: Battle multiplier should be 1.0 for zero battles
          expect(battleLog.robot1.streamingRevenueDetails.battleMultiplier).toBe(1.0);
          expect(battleLog.robot2.streamingRevenueDetails.battleMultiplier).toBe(1.0);

          // Property: Fame multiplier should be 1.0 for zero fame
          expect(battleLog.robot1.streamingRevenueDetails.fameMultiplier).toBe(1.0);
          expect(battleLog.robot2.streamingRevenueDetails.fameMultiplier).toBe(1.0);

          // Property: Total revenue should be base amount times studio multiplier
          expect(battleLog.robot1.streamingRevenue).toBe(expectedRevenue);
          expect(battleLog.robot2.streamingRevenue).toBe(expectedRevenue);

          // Clean up
          await prisma.auditLog.deleteMany({ where: { eventType: 'battle_complete' } });
          await prisma.battle.delete({ where: { id: battle.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});
