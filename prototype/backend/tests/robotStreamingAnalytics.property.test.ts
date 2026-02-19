/**
 * Property-Based Tests for Robot Streaming Revenue Analytics
 * Property 19: Streaming Revenue Tracked Per Robot Per Cycle
 * 
 * **Validates: Requirements 15.1-15.7, 18.1-18.7, 19.1-19.7**
 * 
 * For any robot that participates in battles during a cycle, the system should
 * track and store the total streaming revenue earned by that robot in that cycle.
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { 
  calculateStreamingRevenue,
  awardStreamingRevenue 
} from '../src/services/streamingRevenueService';
import { 
  trackStreamingRevenue,
  getRobotStreamingAnalytics 
} from '../src/services/robotAnalyticsService';
import prisma from '../src/lib/prisma';

// Helper function to create a minimal test robot
async function createTestRobot(userId: number, battles: number, fame: number) {
  return await prisma.robot.create({
    data: {
      userId,
      name: `TestRobot_${Date.now()}_${Math.random()}`,
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

describe('Property 19: Streaming Revenue Tracked Per Robot Per Cycle', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user for all tests
    const user = await prisma.user.create({
      data: {
        username: `test_user_prop19_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robotStreamingRevenue.deleteMany({
      where: {
        robot: {
          userId: testUserId,
        },
      },
    });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots, facilities, and streaming revenue records before each test
    await prisma.robotStreamingRevenue.deleteMany({
      where: {
        robot: {
          userId: testUserId,
        },
      },
    });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
  });

  /**
   * Property 19: For any robot that participates in battles during a cycle,
   * the system should track and store the total streaming revenue earned
   */
  test('Property 19: Streaming revenue tracked per robot per cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles
        fc.integer({ min: 0, max: 50000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        fc.integer({ min: 1, max: 100 }),   // cycle number
        fc.integer({ min: 1, max: 10 }),    // number of battles in cycle
        async (battles, fame, studioLevel, cycleNumber, battlesInCycle) => {
          // Clean up facility first to ensure clean state
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot with specified stats
          const robot = await createTestRobot(testUserId, battles, fame);

          // Create Streaming Studio facility only if level > 0
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Simulate multiple battles in the cycle
          let totalRevenueExpected = 0;
          for (let i = 0; i < battlesInCycle; i++) {
            // Calculate streaming revenue for this battle
            const calculation = await calculateStreamingRevenue(robot.id, testUserId, false);
            
            expect(calculation).not.toBeNull();
            
            // Award streaming revenue (which should track it)
            await awardStreamingRevenue(testUserId, calculation!, cycleNumber);
            
            totalRevenueExpected += calculation!.totalRevenue;
          }

          // Property: A record should exist for this robot and cycle
          const record = await prisma.robotStreamingRevenue.findUnique({
            where: {
              robotId_cycleNumber: {
                robotId: robot.id,
                cycleNumber,
              },
            },
          });

          expect(record).not.toBeNull();

          // Property: The record should have the correct robot ID
          expect(record!.robotId).toBe(robot.id);

          // Property: The record should have the correct cycle number
          expect(record!.cycleNumber).toBe(cycleNumber);

          // Property: The record should track the total streaming revenue
          expect(record!.streamingRevenue).toBe(totalRevenueExpected);

          // Property: The record should track the number of battles in the cycle
          expect(record!.battlesInCycle).toBe(battlesInCycle);

          // Property: The record should have a creation timestamp
          expect(record!.createdAt).toBeInstanceOf(Date);

          // Clean up robot for next iteration
          await prisma.robotStreamingRevenue.deleteMany({
            where: { robotId: robot.id },
          });
          await prisma.robot.delete({ where: { id: robot.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.1: Multiple cycles should create separate records
   */
  test('Property 19.1: Separate records for different cycles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles
        fc.integer({ min: 0, max: 25000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        fc.integer({ min: 1, max: 50 }),    // cycle1
        fc.integer({ min: 1, max: 50 }),    // cycle2
        fc.integer({ min: 1, max: 5 }),     // battles in cycle 1
        fc.integer({ min: 1, max: 5 }),     // battles in cycle 2
        async (battles, fame, studioLevel, cycle1, cycle2, battles1, battles2) => {
          // Skip if cycles are the same
          if (cycle1 === cycle2) {
            return;
          }

          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot
          const robot = await createTestRobot(testUserId, battles, fame);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Simulate battles in cycle 1
          let totalRevenueCycle1 = 0;
          for (let i = 0; i < battles1; i++) {
            const calculation = await calculateStreamingRevenue(robot.id, testUserId, false);
            await awardStreamingRevenue(testUserId, calculation!, cycle1);
            totalRevenueCycle1 += calculation!.totalRevenue;
          }

          // Simulate battles in cycle 2
          let totalRevenueCycle2 = 0;
          for (let i = 0; i < battles2; i++) {
            const calculation = await calculateStreamingRevenue(robot.id, testUserId, false);
            await awardStreamingRevenue(testUserId, calculation!, cycle2);
            totalRevenueCycle2 += calculation!.totalRevenue;
          }

          // Property: Two separate records should exist
          const record1 = await prisma.robotStreamingRevenue.findUnique({
            where: {
              robotId_cycleNumber: {
                robotId: robot.id,
                cycleNumber: cycle1,
              },
            },
          });

          const record2 = await prisma.robotStreamingRevenue.findUnique({
            where: {
              robotId_cycleNumber: {
                robotId: robot.id,
                cycleNumber: cycle2,
              },
            },
          });

          expect(record1).not.toBeNull();
          expect(record2).not.toBeNull();

          // Property: Each record should have the correct cycle number
          expect(record1!.cycleNumber).toBe(cycle1);
          expect(record2!.cycleNumber).toBe(cycle2);

          // Property: Each record should have the correct revenue
          expect(record1!.streamingRevenue).toBe(totalRevenueCycle1);
          expect(record2!.streamingRevenue).toBe(totalRevenueCycle2);

          // Property: Each record should have the correct battle count
          expect(record1!.battlesInCycle).toBe(battles1);
          expect(record2!.battlesInCycle).toBe(battles2);

          // Clean up
          await prisma.robotStreamingRevenue.deleteMany({
            where: { robotId: robot.id },
          });
          await prisma.robot.delete({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 19.2: Analytics should correctly aggregate streaming revenue
   */
  test('Property 19.2: Analytics correctly aggregate streaming revenue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles
        fc.integer({ min: 0, max: 25000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        fc.array(
          fc.record({
            cycleNumber: fc.integer({ min: 1, max: 100 }),
            battlesInCycle: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (battles, fame, studioLevel, cycles) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot
          const robot = await createTestRobot(testUserId, battles, fame);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Track expected totals
          let totalRevenueExpected = 0;
          let totalBattlesExpected = 0;
          const revenueByCycleExpected: { [key: number]: number } = {};

          // Simulate battles across multiple cycles
          for (const cycle of cycles) {
            let cycleRevenue = 0;
            for (let i = 0; i < cycle.battlesInCycle; i++) {
              const calculation = await calculateStreamingRevenue(robot.id, testUserId, false);
              await awardStreamingRevenue(testUserId, calculation!, cycle.cycleNumber);
              cycleRevenue += calculation!.totalRevenue;
              totalRevenueExpected += calculation!.totalRevenue;
              totalBattlesExpected++;
            }
            revenueByCycleExpected[cycle.cycleNumber] = 
              (revenueByCycleExpected[cycle.cycleNumber] || 0) + cycleRevenue;
          }

          // Get analytics
          const analytics = await getRobotStreamingAnalytics(robot.id);

          // Property: Analytics should have correct robot ID
          expect(analytics.robotId).toBe(robot.id);

          // Property: Total streaming revenue should match
          expect(analytics.totalStreamingRevenue).toBe(totalRevenueExpected);

          // Property: Average revenue per battle should be correct
          const expectedAverage = totalRevenueExpected / totalBattlesExpected;
          expect(analytics.averageRevenuePerBattle).toBeCloseTo(expectedAverage, 2);

          // Property: Revenue by cycle should match
          expect(analytics.revenueByCycle.length).toBeGreaterThan(0);
          
          // Verify each cycle's revenue
          for (const cycleData of analytics.revenueByCycle) {
            expect(cycleData.revenue).toBe(revenueByCycleExpected[cycleData.cycleNumber]);
          }

          // Property: Current multipliers should be calculated correctly
          const totalBattleCount = battles;
          const expectedBattleMultiplier = 1 + (totalBattleCount / 1000);
          const expectedFameMultiplier = 1 + (fame / 5000);
          const expectedStudioMultiplier = 1 + (studioLevel * 0.1);

          expect(analytics.currentBattleMultiplier).toBeCloseTo(expectedBattleMultiplier, 10);
          expect(analytics.currentFameMultiplier).toBeCloseTo(expectedFameMultiplier, 10);
          expect(analytics.currentStudioMultiplier).toBeCloseTo(expectedStudioMultiplier, 10);

          // Clean up
          await prisma.robotStreamingRevenue.deleteMany({
            where: { robotId: robot.id },
          });
          await prisma.robot.delete({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 19.3: Tracking should handle multiple robots independently
   */
  test('Property 19.3: Multiple robots tracked independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles robot 1
        fc.integer({ min: 0, max: 25000 }), // fame robot 1
        fc.integer({ min: 0, max: 5000 }),  // battles robot 2
        fc.integer({ min: 0, max: 25000 }), // fame robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level
        fc.integer({ min: 1, max: 100 }),   // cycle number
        fc.integer({ min: 1, max: 5 }),     // battles robot 1 in cycle
        fc.integer({ min: 1, max: 5 }),     // battles robot 2 in cycle
        async (battles1, fame1, battles2, fame2, studioLevel, cycleNumber, 
               battlesInCycle1, battlesInCycle2) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots
          const robot1 = await createTestRobot(testUserId, battles1, fame1);
          const robot2 = await createTestRobot(testUserId, battles2, fame2);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Simulate battles for robot 1
          let totalRevenue1 = 0;
          for (let i = 0; i < battlesInCycle1; i++) {
            const calculation = await calculateStreamingRevenue(robot1.id, testUserId, false);
            await awardStreamingRevenue(testUserId, calculation!, cycleNumber);
            totalRevenue1 += calculation!.totalRevenue;
          }

          // Simulate battles for robot 2
          let totalRevenue2 = 0;
          for (let i = 0; i < battlesInCycle2; i++) {
            const calculation = await calculateStreamingRevenue(robot2.id, testUserId, false);
            await awardStreamingRevenue(testUserId, calculation!, cycleNumber);
            totalRevenue2 += calculation!.totalRevenue;
          }

          // Property: Both robots should have separate records
          const record1 = await prisma.robotStreamingRevenue.findUnique({
            where: {
              robotId_cycleNumber: {
                robotId: robot1.id,
                cycleNumber,
              },
            },
          });

          const record2 = await prisma.robotStreamingRevenue.findUnique({
            where: {
              robotId_cycleNumber: {
                robotId: robot2.id,
                cycleNumber,
              },
            },
          });

          expect(record1).not.toBeNull();
          expect(record2).not.toBeNull();

          // Property: Each robot's record should be independent
          expect(record1!.robotId).toBe(robot1.id);
          expect(record2!.robotId).toBe(robot2.id);

          // Property: Each robot's revenue should be tracked separately
          expect(record1!.streamingRevenue).toBe(totalRevenue1);
          expect(record2!.streamingRevenue).toBe(totalRevenue2);

          // Property: Each robot's battle count should be tracked separately
          expect(record1!.battlesInCycle).toBe(battlesInCycle1);
          expect(record2!.battlesInCycle).toBe(battlesInCycle2);

          // Property: Records should not interfere with each other
          // (unless robots have identical stats, revenue should differ)
          if (battles1 !== battles2 || fame1 !== fame2 || 
              battlesInCycle1 !== battlesInCycle2) {
            // At least one of these should differ
            const differ = 
              record1!.streamingRevenue !== record2!.streamingRevenue ||
              record1!.battlesInCycle !== record2!.battlesInCycle;
            expect(differ).toBe(true);
          }

          // Clean up
          await prisma.robotStreamingRevenue.deleteMany({
            where: { robotId: { in: [robot1.id, robot2.id] } },
          });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 19.4: Unique constraint enforced on [robotId, cycleNumber]
   */
  test('Property 19.4: Unique constraint on robot and cycle combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles
        fc.integer({ min: 0, max: 25000 }), // fame
        fc.integer({ min: 1, max: 100 }),   // cycle number
        fc.integer({ min: 2, max: 5 }),     // number of battles (at least 2)
        async (battles, fame, cycleNumber, battlesInCycle) => {
          // Create robot
          const robot = await createTestRobot(testUserId, battles, fame);

          // Simulate multiple battles in the same cycle
          for (let i = 0; i < battlesInCycle; i++) {
            const calculation = await calculateStreamingRevenue(robot.id, testUserId, false);
            await awardStreamingRevenue(testUserId, calculation!, cycleNumber);
          }

          // Property: Only one record should exist for this robot and cycle
          const records = await prisma.robotStreamingRevenue.findMany({
            where: {
              robotId: robot.id,
              cycleNumber,
            },
          });

          expect(records.length).toBe(1);

          // Property: The single record should have accumulated all battles
          expect(records[0].battlesInCycle).toBe(battlesInCycle);

          // Clean up
          await prisma.robotStreamingRevenue.deleteMany({
            where: { robotId: robot.id },
          });
          await prisma.robot.delete({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});
