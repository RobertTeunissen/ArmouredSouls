/**
 * Property-Based Tests for Streaming Revenue Formula
 * Property 1: Streaming Revenue Formula Correctness
 * 
 * **Validates: Requirements 1.2, 2.1, 3.1, 4.7**
 * 
 * For any robot with battle count B, fame F, and stable with Streaming Studio 
 * level S, the calculated streaming revenue should equal:
 * 1000 × (1 + B/1000) × (1 + F/5000) × (1 + S×0.1)
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { 
  calculateStreamingRevenue, 
  calculateTagTeamStreamingRevenue,
  awardStreamingRevenue 
} from '../src/services/streamingRevenueService';
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

describe('Property 1: Streaming Revenue Formula Correctness', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user for all tests
    const user = await prisma.user.create({
      data: {
        username: `test_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
  });

  /**
   * Property 1: For any robot with battle count B, fame F, and Streaming Studio 
   * level S, the calculated streaming revenue should match the formula exactly
   */
  test('Property 1: Streaming revenue formula correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles (B)
        fc.integer({ min: 0, max: 50000 }), // fame (F)
        fc.integer({ min: 0, max: 10 }),    // studio level (S)
        async (battles, fame, studioLevel) => {
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

          // Calculate streaming revenue using the service
          const result = await calculateStreamingRevenue(robot.id, testUserId, false);

          // Calculate expected values manually
          const expectedBaseAmount = 1000;
          const expectedBattleMultiplier = 1 + (battles / 1000);
          const expectedFameMultiplier = 1 + (fame / 5000);
          const expectedStudioMultiplier = 1 + (studioLevel * 1.0);
          const expectedTotalRevenue = Math.floor(
            expectedBaseAmount * 
            expectedBattleMultiplier * 
            expectedFameMultiplier * 
            expectedStudioMultiplier
          );

          // Property: Result should not be null for non-bye matches
          expect(result).not.toBeNull();

          // Property: Base amount should always be 1000
          expect(result!.baseAmount).toBe(expectedBaseAmount);

          // Property: Battle multiplier should match formula
          expect(result!.battleMultiplier).toBeCloseTo(expectedBattleMultiplier, 10);

          // Property: Fame multiplier should match formula
          expect(result!.fameMultiplier).toBeCloseTo(expectedFameMultiplier, 10);

          // Property: Studio multiplier should match formula
          expect(result!.studioMultiplier).toBeCloseTo(expectedStudioMultiplier, 10);

          // Property: Total revenue should match calculated value
          expect(result!.totalRevenue).toBe(expectedTotalRevenue);

          // Property: Robot stats should be correctly captured
          expect(result!.robotBattles).toBe(battles);
          expect(result!.robotFame).toBe(fame);
          expect(result!.studioLevel).toBe(studioLevel);

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.1: Bye matches should return null (no streaming revenue)
   */
  test('Property 1.1: Bye matches return null', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles
        fc.integer({ min: 0, max: 50000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
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

          // Calculate streaming revenue for bye match
          const result = await calculateStreamingRevenue(robot.id, testUserId, true);

          // Property: Bye matches should return null
          expect(result).toBeNull();

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.2: Edge case - Zero battles and zero fame should give base amount
   */
  test('Property 1.2: Zero battles and fame gives base amount times studio multiplier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // studio level only
        async (studioLevel) => {
          // Clean up facility first to ensure clean state
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot with zero battles and fame
          const robot = await createTestRobot(testUserId, 0, 0);

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

          // Calculate streaming revenue
          const result = await calculateStreamingRevenue(robot.id, testUserId, false);

          // Property: Battle multiplier should be 1.0
          expect(result!.battleMultiplier).toBe(1.0);

          // Property: Fame multiplier should be 1.0
          expect(result!.fameMultiplier).toBe(1.0);

          // Property: Total revenue should be base amount times studio multiplier
          const expectedRevenue = Math.floor(1000 * (1 + studioLevel * 1.0));
          expect(result!.totalRevenue).toBe(expectedRevenue);

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.3: Revenue should increase monotonically with each multiplier component
   */
  test('Property 1.3: Revenue increases with battles, fame, and studio level', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles1
        fc.integer({ min: 0, max: 25000 }), // fame1
        fc.integer({ min: 0, max: 5 }),     // studioLevel
        fc.integer({ min: 1, max: 1000 }),  // battleIncrease
        fc.integer({ min: 1, max: 5000 }),  // fameIncrease
        async (battles1, fame1, studioLevel, battleIncrease, fameIncrease) => {
          const battles2 = battles1 + battleIncrease;
          const fame2 = fame1 + fameIncrease;

          // Clean up facility first to ensure clean state
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Set studio level (same for both robots since they're in the same stable)
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Create first robot
          const robot1 = await createTestRobot(testUserId, battles1, fame1);
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId, false);

          // Create second robot with higher stats
          const robot2 = await createTestRobot(testUserId, battles2, fame2);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId, false);

          // Property: Revenue should increase when battles and fame increase
          // (studio level is the same for both since they're in the same stable)
          expect(result2!.totalRevenue).toBeGreaterThanOrEqual(result1!.totalRevenue);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 4: Battle Count Includes All Battle Types
 * **Validates: Requirements 2.7**
 * 
 * For any robot, the total battle count used in streaming revenue calculation 
 * should equal the sum of 1v1 battles + Tag Team battles + Tournament battles
 */
describe('Property 4: Battle Count Includes All Battle Types', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user for all tests
    const user = await prisma.user.create({
      data: {
        username: `test_user_prop4_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
  });

  /**
   * Property 4: The battle count used in streaming revenue calculation should
   * equal totalBattles + totalTagTeamBattles (1v1 + Tournament + Tag Team)
   */
  test('Property 4: Battle count includes all battle types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // 1v1 + tournament battles (totalBattles)
        fc.integer({ min: 0, max: 5000 }),  // tag team battles (totalTagTeamBattles)
        fc.integer({ min: 0, max: 50000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (oneVOneAndTournamentBattles, tagTeamBattles, fame, studioLevel) => {
          // Clean up facility first to ensure clean state
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot with specified battle counts
          // totalBattles includes 1v1 and tournament battles
          // totalTagTeamBattles is separate
          const robot = await createTestRobot(testUserId, oneVOneAndTournamentBattles, fame);
          
          // Update tag team battles separately
          await prisma.robot.update({
            where: { id: robot.id },
            data: {
              totalTagTeamBattles: tagTeamBattles,
            },
          });

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

          // Calculate streaming revenue using the service
          const result = await calculateStreamingRevenue(robot.id, testUserId, false);

          // Calculate expected values manually
          // According to Requirement 2.7: total battle count = 1v1 + Tag Team + Tournament
          // In the schema: totalBattles = 1v1 + Tournament, totalTagTeamBattles = Tag Team
          const expectedTotalBattles = oneVOneAndTournamentBattles + tagTeamBattles;
          const expectedBattleMultiplier = 1 + (expectedTotalBattles / 1000);
          const expectedFameMultiplier = 1 + (fame / 5000);
          const expectedStudioMultiplier = 1 + (studioLevel * 1.0);
          const expectedTotalRevenue = Math.floor(
            1000 * 
            expectedBattleMultiplier * 
            expectedFameMultiplier * 
            expectedStudioMultiplier
          );

          // Property: Result should not be null for non-bye matches
          expect(result).not.toBeNull();

          // Property: The battle count used should include ALL battle types
          // This is the key property being tested
          expect(result!.robotBattles).toBe(expectedTotalBattles);

          // Property: Battle multiplier should be calculated using total battles
          expect(result!.battleMultiplier).toBeCloseTo(expectedBattleMultiplier, 10);

          // Property: Total revenue should reflect all battle types
          expect(result!.totalRevenue).toBe(expectedTotalRevenue);

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.1: Edge case - Only 1v1 battles (no tag team)
   */
  test('Property 4.1: Battle count with only 1v1 battles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5000 }),  // 1v1 battles only
        fc.integer({ min: 0, max: 50000 }), // fame
        async (oneVOneBattles, fame) => {
          // Create robot with only 1v1 battles
          const robot = await createTestRobot(testUserId, oneVOneBattles, fame);

          // Calculate streaming revenue
          const result = await calculateStreamingRevenue(robot.id, testUserId, false);

          // Property: Battle count should equal 1v1 battles when no tag team battles
          expect(result!.robotBattles).toBe(oneVOneBattles);

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4.2: Edge case - Only tag team battles (no 1v1)
   */
  test('Property 4.2: Battle count with only tag team battles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5000 }),  // tag team battles only
        fc.integer({ min: 0, max: 50000 }), // fame
        async (tagTeamBattles, fame) => {
          // Create robot with zero 1v1 battles
          const robot = await createTestRobot(testUserId, 0, fame);
          
          // Update tag team battles
          await prisma.robot.update({
            where: { id: robot.id },
            data: {
              totalTagTeamBattles: tagTeamBattles,
            },
          });

          // Calculate streaming revenue
          const result = await calculateStreamingRevenue(robot.id, testUserId, false);

          // Property: Battle count should equal tag team battles when no 1v1 battles
          expect(result!.robotBattles).toBe(tagTeamBattles);

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4.3: Battle count affects revenue monotonically
   */
  test('Property 4.3: More battles always means more revenue (with same fame and studio)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 2500 }),  // battles1 (1v1)
        fc.integer({ min: 0, max: 2500 }),  // battles1 (tag team)
        fc.integer({ min: 1, max: 1000 }),  // battle increase
        fc.integer({ min: 0, max: 50000 }), // fame (same for both)
        fc.integer({ min: 0, max: 10 }),    // studio level (same for both)
        async (oneVOneBattles1, tagTeamBattles1, battleIncrease, fame, studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Set studio level
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Create first robot with lower battle count
          const robot1 = await createTestRobot(testUserId, oneVOneBattles1, fame);
          await prisma.robot.update({
            where: { id: robot1.id },
            data: { totalTagTeamBattles: tagTeamBattles1 },
          });
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId, false);

          // Create second robot with higher battle count
          // Add the increase to tag team battles
          const robot2 = await createTestRobot(testUserId, oneVOneBattles1, fame);
          await prisma.robot.update({
            where: { id: robot2.id },
            data: { totalTagTeamBattles: tagTeamBattles1 + battleIncrease },
          });
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId, false);

          // Property: More battles should result in higher or equal revenue
          expect(result2!.totalRevenue).toBeGreaterThanOrEqual(result1!.totalRevenue);

          // Property: Battle count should be higher for robot2
          expect(result2!.robotBattles).toBeGreaterThan(result1!.robotBattles);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 6: Studio Multiplier Applies Stable-Wide
 * **Validates: Requirements 4.8**
 * 
 * For any two robots in the same stable, when calculating streaming revenue,
 * both robots should use the same studio_multiplier value based on the 
 * stable's Streaming Studio level
 */
describe('Property 6: Studio Multiplier Applies Stable-Wide', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user for all tests
    const user = await prisma.user.create({
      data: {
        username: `test_user_prop6_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
  });

  /**
   * Property 6: For any two robots in the same stable, both should use the
   * same studio_multiplier based on the stable's Streaming Studio level
   */
  test('Property 6: Studio multiplier applies stable-wide', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles for robot 1
        fc.integer({ min: 0, max: 50000 }), // fame for robot 1
        fc.integer({ min: 0, max: 10000 }), // battles for robot 2
        fc.integer({ min: 0, max: 50000 }), // fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level (same for both)
        async (battles1, fame1, battles2, fame2, studioLevel) => {
          // Clean up facility first to ensure clean state
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots in the same stable (same userId)
          const robot1 = await createTestRobot(testUserId, battles1, fame1);
          const robot2 = await createTestRobot(testUserId, battles2, fame2);

          // Create Streaming Studio facility for the stable (only if level > 0)
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate streaming revenue for both robots
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId, false);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId, false);

          // Property: Both robots should not be null
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();

          // Property: Both robots should use the SAME studio multiplier
          // This is the key property being tested
          expect(result1!.studioMultiplier).toBe(result2!.studioMultiplier);

          // Property: Both robots should use the SAME studio level
          expect(result1!.studioLevel).toBe(studioLevel);
          expect(result2!.studioLevel).toBe(studioLevel);

          // Property: Studio multiplier should match the formula
          const expectedStudioMultiplier = 1 + (studioLevel * 1.0);
          expect(result1!.studioMultiplier).toBeCloseTo(expectedStudioMultiplier, 10);
          expect(result2!.studioMultiplier).toBeCloseTo(expectedStudioMultiplier, 10);

          // Property: Even if robots have different battles and fame,
          // they should still use the same studio multiplier
          // (battle and fame multipliers can differ, but studio must be the same)
          if (battles1 !== battles2) {
            // Battle multipliers should differ
            expect(result1!.battleMultiplier).not.toBe(result2!.battleMultiplier);
          }
          if (fame1 !== fame2) {
            // Fame multipliers should differ
            expect(result1!.fameMultiplier).not.toBe(result2!.fameMultiplier);
          }

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.1: Studio multiplier is stable-specific, not robot-specific
   */
  test('Property 6.1: Studio multiplier is determined by stable, not robot', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // studio level
        async (studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create multiple robots with varying stats
          const robot1 = await createTestRobot(testUserId, 0, 0);      // New robot
          const robot2 = await createTestRobot(testUserId, 1000, 5000); // Veteran robot
          const robot3 = await createTestRobot(testUserId, 5000, 25000); // Elite robot

          // Create Streaming Studio facility for the stable
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate streaming revenue for all robots
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId, false);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId, false);
          const result3 = await calculateStreamingRevenue(robot3.id, testUserId, false);

          // Property: All robots should use the SAME studio multiplier
          expect(result1!.studioMultiplier).toBe(result2!.studioMultiplier);
          expect(result2!.studioMultiplier).toBe(result3!.studioMultiplier);
          expect(result1!.studioMultiplier).toBe(result3!.studioMultiplier);

          // Property: All robots should use the SAME studio level
          expect(result1!.studioLevel).toBe(studioLevel);
          expect(result2!.studioLevel).toBe(studioLevel);
          expect(result3!.studioLevel).toBe(studioLevel);

          // Property: But their total revenue should differ due to different stats
          // (unless all stats are the same, which is unlikely)
          if (result1!.robotBattles !== result2!.robotBattles || 
              result1!.robotFame !== result2!.robotFame) {
            expect(result1!.totalRevenue).not.toBe(result2!.totalRevenue);
          }

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
          await prisma.robot.deleteMany({ where: { id: robot3.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6.2: Upgrading studio affects all robots in stable equally
   */
  test('Property 6.2: Studio upgrade affects all robots in stable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),     // initial studio level
        fc.integer({ min: 1, max: 5 }),     // level increase
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 0, max: 25000 }), // fame for robot 1
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 0, max: 25000 }), // fame for robot 2
        async (initialLevel, levelIncrease, battles1, fame1, battles2, fame2) => {
          // Ensure we don't exceed max level
          const newLevel = Math.min(initialLevel + levelIncrease, 10);
          
          // Skip if no actual upgrade
          if (newLevel === initialLevel) {
            return;
          }

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

          // Create initial Streaming Studio facility
          if (initialLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: initialLevel,
              },
            });
          }

          // Calculate revenue before upgrade
          const beforeResult1 = await calculateStreamingRevenue(robot1.id, testUserId, false);
          const beforeResult2 = await calculateStreamingRevenue(robot2.id, testUserId, false);

          // Property: Before upgrade, both use same studio multiplier
          expect(beforeResult1!.studioMultiplier).toBe(beforeResult2!.studioMultiplier);

          // Upgrade the studio
          if (initialLevel === 0) {
            // Create new facility
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: newLevel,
              },
            });
          } else {
            // Update existing facility
            await prisma.facility.update({
              where: {
                userId_facilityType: {
                  userId: testUserId,
                  facilityType: 'streaming_studio',
                },
              },
              data: {
                level: newLevel,
              },
            });
          }

          // Calculate revenue after upgrade
          const afterResult1 = await calculateStreamingRevenue(robot1.id, testUserId, false);
          const afterResult2 = await calculateStreamingRevenue(robot2.id, testUserId, false);

          // Property: After upgrade, both still use same studio multiplier
          expect(afterResult1!.studioMultiplier).toBe(afterResult2!.studioMultiplier);

          // Property: Studio multiplier should have increased for both robots
          expect(afterResult1!.studioMultiplier).toBeGreaterThan(beforeResult1!.studioMultiplier);
          expect(afterResult2!.studioMultiplier).toBeGreaterThan(beforeResult2!.studioMultiplier);

          // Property: The increase should be the same for both robots
          const multiplierIncrease1 = afterResult1!.studioMultiplier - beforeResult1!.studioMultiplier;
          const multiplierIncrease2 = afterResult2!.studioMultiplier - beforeResult2!.studioMultiplier;
          expect(multiplierIncrease1).toBeCloseTo(multiplierIncrease2, 10);

          // Property: Total revenue should have increased for both robots
          expect(afterResult1!.totalRevenue).toBeGreaterThan(beforeResult1!.totalRevenue);
          expect(afterResult2!.totalRevenue).toBeGreaterThan(beforeResult2!.totalRevenue);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6.3: Multiple robots in stable all use same studio multiplier
   */
  test('Property 6.3: All robots in stable use same studio multiplier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),    // studio level
        fc.integer({ min: 3, max: 5 }),     // number of robots
        async (studioLevel, numRobots) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create multiple robots with random stats
          const robots = [];
          for (let i = 0; i < numRobots; i++) {
            const battles = Math.floor(Math.random() * 10000);
            const fame = Math.floor(Math.random() * 50000);
            const robot = await createTestRobot(testUserId, battles, fame);
            robots.push(robot);
          }

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

          // Calculate streaming revenue for all robots
          const results = await Promise.all(
            robots.map(robot => calculateStreamingRevenue(robot.id, testUserId, false))
          );

          // Property: All robots should have results
          results.forEach(result => {
            expect(result).not.toBeNull();
          });

          // Property: All robots should use the SAME studio multiplier
          const firstStudioMultiplier = results[0]!.studioMultiplier;
          results.forEach(result => {
            expect(result!.studioMultiplier).toBe(firstStudioMultiplier);
          });

          // Property: All robots should use the SAME studio level
          results.forEach(result => {
            expect(result!.studioLevel).toBe(studioLevel);
          });

          // Property: Studio multiplier should match the formula
          const expectedStudioMultiplier = 1 + (studioLevel * 1.0);
          results.forEach(result => {
            expect(result!.studioMultiplier).toBeCloseTo(expectedStudioMultiplier, 10);
          });

          // Clean up robots for next iteration
          await Promise.all(robots.map(robot => prisma.robot.delete({ where: { id: robot.id } })));
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 2: Streaming Revenue Awarded to All Battle Participants
 * **Validates: Requirements 1.1, 1.6, 1.7**
 * 
 * For any completed non-bye battle (1v1, Tag Team, or Tournament), both 
 * participants should receive streaming revenue regardless of battle outcome 
 * (win, loss, or draw)
 */
describe('Property 2: Streaming Revenue Awarded to All Battle Participants', () => {
  let testUserId1: number;
  let testUserId2: number;

  beforeAll(async () => {
    // Create two test users for battles
    const user1 = await prisma.user.create({
      data: {
        username: `test_user_prop2_1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    const user2 = await prisma.user.create({
      data: {
        username: `test_user_prop2_2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId1 = user1.id;
    testUserId2 = user2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId1 } });
    await prisma.robot.deleteMany({ where: { userId: testUserId2 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId1 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId2 } });
    await prisma.user.deleteMany({ where: { id: testUserId1 } });
    await prisma.user.deleteMany({ where: { id: testUserId2 } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId1 } });
    await prisma.robot.deleteMany({ where: { userId: testUserId2 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId1 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId2 } });
  });

  /**
   * Property 2: Both participants in a non-bye battle should receive streaming revenue
   */
  test('Property 2: Both participants receive streaming revenue in non-bye battles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles for robot 1
        fc.integer({ min: 0, max: 50000 }), // fame for robot 1
        fc.integer({ min: 0, max: 10 }),    // studio level for user 1
        fc.integer({ min: 0, max: 10000 }), // battles for robot 2
        fc.integer({ min: 0, max: 50000 }), // fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level for user 2
        async (battles1, fame1, studioLevel1, battles2, fame2, studioLevel2) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots from different users (simulating a battle)
          const robot1 = await createTestRobot(testUserId1, battles1, fame1);
          const robot2 = await createTestRobot(testUserId2, battles2, fame2);

          // Create Streaming Studio facilities for both users
          if (studioLevel1 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel1,
              },
            });
          }
          if (studioLevel2 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: studioLevel2,
              },
            });
          }

          // Calculate streaming revenue for both robots (non-bye match)
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId1, false);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId2, false);

          // Property: Both participants should receive streaming revenue (not null)
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();

          // Property: Both should have positive revenue (base amount is 1000)
          expect(result1!.totalRevenue).toBeGreaterThan(0);
          expect(result2!.totalRevenue).toBeGreaterThan(0);

          // Property: Both should have base amount of 1000
          expect(result1!.baseAmount).toBe(1000);
          expect(result2!.baseAmount).toBe(1000);

          // Property: Revenue is calculated independently for each participant
          // (they can have different amounts based on their stats)
          expect(result1!.robotId).toBe(robot1.id);
          expect(result2!.robotId).toBe(robot2.id);

          // Property: Each participant's revenue reflects their own stats
          expect(result1!.robotBattles).toBe(battles1);
          expect(result1!.robotFame).toBe(fame1);
          expect(result1!.studioLevel).toBe(studioLevel1);
          
          expect(result2!.robotBattles).toBe(battles2);
          expect(result2!.robotFame).toBe(fame2);
          expect(result2!.studioLevel).toBe(studioLevel2);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.1: Winner and loser both receive streaming revenue
   * (simulated by having different stats but both getting revenue)
   */
  test('Property 2.1: Both winner and loser receive streaming revenue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles for both
        fc.integer({ min: 0, max: 25000 }), // fame for both
        fc.integer({ min: 0, max: 10 }),    // studio level for both
        async (battles, fame, studioLevel) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots with identical stats (simulating equal match)
          const robot1 = await createTestRobot(testUserId1, battles, fame);
          const robot2 = await createTestRobot(testUserId2, battles, fame);

          // Create identical Streaming Studio facilities
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate streaming revenue for both robots
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId1, false);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId2, false);

          // Property: Both participants receive streaming revenue
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();

          // Property: With identical stats, both should receive identical revenue
          expect(result1!.totalRevenue).toBe(result2!.totalRevenue);

          // Property: Both should have the same multipliers
          expect(result1!.battleMultiplier).toBeCloseTo(result2!.battleMultiplier, 10);
          expect(result1!.fameMultiplier).toBeCloseTo(result2!.fameMultiplier, 10);
          expect(result1!.studioMultiplier).toBeCloseTo(result2!.studioMultiplier, 10);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.2: Streaming revenue is independent of battle outcome
   * (both participants always get revenue, regardless of who wins)
   */
  test('Property 2.2: Streaming revenue is independent of battle outcome', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles for robot 1
        fc.integer({ min: 0, max: 50000 }), // fame for robot 1
        fc.integer({ min: 0, max: 10000 }), // battles for robot 2
        fc.integer({ min: 0, max: 50000 }), // fame for robot 2
        async (battles1, fame1, battles2, fame2) => {
          // Create two robots with potentially different stats
          const robot1 = await createTestRobot(testUserId1, battles1, fame1);
          const robot2 = await createTestRobot(testUserId2, battles2, fame2);

          // Calculate streaming revenue for both (no studio for simplicity)
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId1, false);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId2, false);

          // Property: Both participants receive streaming revenue
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();

          // Property: Revenue is based on robot stats, not battle outcome
          // Each robot's revenue is calculated independently
          const expectedRevenue1 = Math.floor(
            1000 * (1 + battles1 / 1000) * (1 + fame1 / 5000) * 1.0
          );
          const expectedRevenue2 = Math.floor(
            1000 * (1 + battles2 / 1000) * (1 + fame2 / 5000) * 1.0
          );

          expect(result1!.totalRevenue).toBe(expectedRevenue1);
          expect(result2!.totalRevenue).toBe(expectedRevenue2);

          // Property: Even if one robot is much stronger (more battles/fame),
          // the weaker robot still receives streaming revenue
          if (battles1 > battles2 || fame1 > fame2) {
            // Robot 1 is stronger, but robot 2 still gets revenue
            expect(result2!.totalRevenue).toBeGreaterThan(0);
          }
          if (battles2 > battles1 || fame2 > fame1) {
            // Robot 2 is stronger, but robot 1 still gets revenue
            expect(result1!.totalRevenue).toBeGreaterThan(0);
          }

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.3: Minimum revenue is always base amount (1000) for new robots
   */
  test('Property 2.3: New robots with no stats still receive base streaming revenue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // Just run multiple times with same params
        async () => {
          // Create two brand new robots (0 battles, 0 fame, no studio)
          const robot1 = await createTestRobot(testUserId1, 0, 0);
          const robot2 = await createTestRobot(testUserId2, 0, 0);

          // Calculate streaming revenue for both
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId1, false);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId2, false);

          // Property: Both new robots receive streaming revenue
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();

          // Property: Both receive exactly the base amount (1000)
          expect(result1!.totalRevenue).toBe(1000);
          expect(result2!.totalRevenue).toBe(1000);

          // Property: All multipliers are 1.0 for new robots
          expect(result1!.battleMultiplier).toBe(1.0);
          expect(result1!.fameMultiplier).toBe(1.0);
          expect(result1!.studioMultiplier).toBe(1.0);
          
          expect(result2!.battleMultiplier).toBe(1.0);
          expect(result2!.fameMultiplier).toBe(1.0);
          expect(result2!.studioMultiplier).toBe(1.0);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2.4: Different studio levels don't prevent both from receiving revenue
   */
  test('Property 2.4: Both participants receive revenue even with different studio levels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }),    // studio level for user 1
        fc.integer({ min: 0, max: 10 }),    // studio level for user 2
        fc.integer({ min: 0, max: 5000 }),  // battles for both
        fc.integer({ min: 0, max: 25000 }), // fame for both
        async (studioLevel1, studioLevel2, battles, fame) => {
          // Skip if studio levels are the same (not testing the property)
          if (studioLevel1 === studioLevel2) {
            return;
          }

          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots with same stats but different studio levels
          const robot1 = await createTestRobot(testUserId1, battles, fame);
          const robot2 = await createTestRobot(testUserId2, battles, fame);

          // Create different Streaming Studio facilities
          if (studioLevel1 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel1,
              },
            });
          }
          if (studioLevel2 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: studioLevel2,
              },
            });
          }

          // Calculate streaming revenue for both robots
          const result1 = await calculateStreamingRevenue(robot1.id, testUserId1, false);
          const result2 = await calculateStreamingRevenue(robot2.id, testUserId2, false);

          // Property: Both participants receive streaming revenue
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();

          // Property: Both have positive revenue
          expect(result1!.totalRevenue).toBeGreaterThan(0);
          expect(result2!.totalRevenue).toBeGreaterThan(0);

          // Property: Studio levels are different
          expect(result1!.studioLevel).toBe(studioLevel1);
          expect(result2!.studioLevel).toBe(studioLevel2);

          // Property: The participant with higher studio level gets more revenue
          // (since battles and fame are the same)
          if (studioLevel1 > studioLevel2) {
            expect(result1!.totalRevenue).toBeGreaterThan(result2!.totalRevenue);
          } else {
            expect(result2!.totalRevenue).toBeGreaterThan(result1!.totalRevenue);
          }

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: robot1.id } });
          await prisma.robot.deleteMany({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 3: No Streaming Revenue for Bye Matches
 * **Validates: Requirements 1.8**
 * 
 * For any battle where one participant is a bye-robot, no streaming revenue 
 * should be awarded to either participant
 */
describe('Property 3: No Streaming Revenue for Bye Matches', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user for all tests
    const user = await prisma.user.create({
      data: {
        username: `test_user_prop3_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
  });

  /**
   * Property 3: Bye matches should return null (no streaming revenue)
   * regardless of robot stats or studio level
   */
  test('Property 3: No streaming revenue for bye matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles
        fc.integer({ min: 0, max: 50000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
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

          // Calculate streaming revenue for bye match (isByeMatch = true)
          const result = await calculateStreamingRevenue(robot.id, testUserId, true);

          // Property: Bye matches should ALWAYS return null
          expect(result).toBeNull();

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.1: Bye matches return null even for veteran robots with high stats
   */
  test('Property 3.1: Veteran robots get no revenue from bye matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 10000 }), // high battles
        fc.integer({ min: 5000, max: 50000 }), // high fame
        fc.integer({ min: 5, max: 10 }),       // high studio level
        async (battles, fame, studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create veteran robot with high stats
          const robot = await createTestRobot(testUserId, battles, fame);

          // Create high-level Streaming Studio facility
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'streaming_studio',
              level: studioLevel,
            },
          });

          // Calculate streaming revenue for bye match
          const byeResult = await calculateStreamingRevenue(robot.id, testUserId, true);

          // Property: Even veteran robots with high stats get null for bye matches
          expect(byeResult).toBeNull();

          // For comparison: same robot in non-bye match would get revenue
          const nonByeResult = await calculateStreamingRevenue(robot.id, testUserId, false);
          expect(nonByeResult).not.toBeNull();
          expect(nonByeResult!.totalRevenue).toBeGreaterThan(1000);

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3.2: Bye match flag overrides all other factors
   */
  test('Property 3.2: Bye match flag always results in null revenue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles
        fc.integer({ min: 0, max: 50000 }), // fame
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot
          const robot = await createTestRobot(testUserId, battles, fame);

          // Create Streaming Studio facility if level > 0
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate for both bye and non-bye matches
          const byeResult = await calculateStreamingRevenue(robot.id, testUserId, true);
          const nonByeResult = await calculateStreamingRevenue(robot.id, testUserId, false);

          // Property: Bye match always returns null
          expect(byeResult).toBeNull();

          // Property: Non-bye match always returns a result
          expect(nonByeResult).not.toBeNull();

          // Property: Non-bye match always has positive revenue
          expect(nonByeResult!.totalRevenue).toBeGreaterThan(0);

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: New robots with zero stats also get null for bye matches
   */
  test('Property 3.3: New robots get null revenue from bye matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // Just run multiple times
        async () => {
          // Create brand new robot (0 battles, 0 fame, no studio)
          const robot = await createTestRobot(testUserId, 0, 0);

          // Calculate streaming revenue for bye match
          const result = await calculateStreamingRevenue(robot.id, testUserId, true);

          // Property: Even new robots get null for bye matches
          expect(result).toBeNull();

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 3.4: Bye matches with max studio level still return null
   */
  test('Property 3.4: Max studio level does not override bye match rule', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles
        fc.integer({ min: 0, max: 50000 }), // fame
        async (battles, fame) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId,
              facilityType: 'streaming_studio',
            },
          });

          // Create robot
          const robot = await createTestRobot(testUserId, battles, fame);

          // Create max level Streaming Studio (level 10)
          await prisma.facility.create({
            data: {
              userId: testUserId,
              facilityType: 'streaming_studio',
              level: 10,
            },
          });

          // Calculate streaming revenue for bye match
          const result = await calculateStreamingRevenue(robot.id, testUserId, true);

          // Property: Even with max studio level, bye matches return null
          expect(result).toBeNull();

          // Clean up robot for next iteration
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 12: Tag Team Single Payment Per Team
 * **Validates: Requirements 7.6**
 * 
 * For any Tag Team battle, each stable should receive exactly one streaming 
 * revenue payment (not one per robot)
 */
describe('Property 12: Tag Team Single Payment Per Team', () => {
  let testUser1Id: number;
  let testUser2Id: number;

  beforeAll(async () => {
    // Create two test users for Tag Team battles
    const user1 = await prisma.user.create({
      data: {
        username: `test_user_prop12_team1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUser1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        username: `test_user_prop12_team2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUser2Id = user2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUser1Id } });
    await prisma.robot.deleteMany({ where: { userId: testUser2Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser1Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser2Id } });
    await prisma.user.deleteMany({ where: { id: testUser1Id } });
    await prisma.user.deleteMany({ where: { id: testUser2Id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUser1Id } });
    await prisma.robot.deleteMany({ where: { userId: testUser2Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser1Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser2Id } });
  });

  /**
   * Property 12: For any Tag Team battle, each stable should receive exactly
   * one streaming revenue payment, not one per robot
   */
  test('Property 12: Each stable receives exactly one payment per Tag Team battle', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Team 1 robot stats
        fc.integer({ min: 0, max: 5000 }),  // team1Robot1 battles
        fc.integer({ min: 0, max: 25000 }), // team1Robot1 fame
        fc.integer({ min: 0, max: 5000 }),  // team1Robot2 battles
        fc.integer({ min: 0, max: 25000 }), // team1Robot2 fame
        // Team 2 robot stats
        fc.integer({ min: 0, max: 5000 }),  // team2Robot1 battles
        fc.integer({ min: 0, max: 25000 }), // team2Robot1 fame
        fc.integer({ min: 0, max: 5000 }),  // team2Robot2 battles
        fc.integer({ min: 0, max: 25000 }), // team2Robot2 fame
        // Studio levels
        fc.integer({ min: 0, max: 10 }),    // team1 studio level
        fc.integer({ min: 0, max: 10 }),    // team2 studio level
        async (
          team1Robot1Battles,
          team1Robot1Fame,
          team1Robot2Battles,
          team1Robot2Fame,
          team2Robot1Battles,
          team2Robot1Fame,
          team2Robot2Battles,
          team2Robot2Fame,
          team1StudioLevel,
          team2StudioLevel
        ) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: { in: [testUser1Id, testUser2Id] },
              facilityType: 'streaming_studio',
            },
          });

          // Create robots for team 1
          const team1Robot1 = await createTestRobot(testUser1Id, team1Robot1Battles, team1Robot1Fame);
          const team1Robot2 = await createTestRobot(testUser1Id, team1Robot2Battles, team1Robot2Fame);

          // Create robots for team 2
          const team2Robot1 = await createTestRobot(testUser2Id, team2Robot1Battles, team2Robot1Fame);
          const team2Robot2 = await createTestRobot(testUser2Id, team2Robot2Battles, team2Robot2Fame);

          // Create Streaming Studio facilities
          if (team1StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser1Id,
                facilityType: 'streaming_studio',
                level: team1StudioLevel,
              },
            });
          }
          if (team2StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser2Id,
                facilityType: 'streaming_studio',
                level: team2StudioLevel,
              },
            });
          }

          // Get initial balances
          const initialUser1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
          const initialUser2 = await prisma.user.findUnique({ where: { id: testUser2Id } });
          const initialBalance1 = initialUser1!.currency;
          const initialBalance2 = initialUser2!.currency;

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUser1Id,
            [team2Robot1.id, team2Robot2.id],
            testUser2Id
          );

          // Award streaming revenue to both teams
          await awardStreamingRevenue(testUser1Id, result.team1Revenue, 1);
          await awardStreamingRevenue(testUser2Id, result.team2Revenue, 1);

          // Get updated balances
          const updatedUser1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
          const updatedUser2 = await prisma.user.findUnique({ where: { id: testUser2Id } });
          const finalBalance1 = updatedUser1!.currency;
          const finalBalance2 = updatedUser2!.currency;

          // Calculate expected revenue for each team
          const team1MaxBattles = Math.max(team1Robot1Battles, team1Robot2Battles);
          const team1MaxFame = Math.max(team1Robot1Fame, team1Robot2Fame);
          const expectedTeam1Revenue = Math.floor(
            1000 * 
            (1 + team1MaxBattles / 1000) * 
            (1 + team1MaxFame / 5000) * 
            (1 + team1StudioLevel * 1.0)
          );

          const team2MaxBattles = Math.max(team2Robot1Battles, team2Robot2Battles);
          const team2MaxFame = Math.max(team2Robot1Fame, team2Robot2Fame);
          const expectedTeam2Revenue = Math.floor(
            1000 * 
            (1 + team2MaxBattles / 1000) * 
            (1 + team2MaxFame / 5000) * 
            (1 + team2StudioLevel * 1.0)
          );

          // Property: Each stable should receive exactly ONE payment
          // The balance increase should equal the calculated revenue (not 2x revenue)
          const balanceIncrease1 = finalBalance1 - initialBalance1;
          const balanceIncrease2 = finalBalance2 - initialBalance2;

          expect(balanceIncrease1).toBe(expectedTeam1Revenue);
          expect(balanceIncrease2).toBe(expectedTeam2Revenue);

          // Property: The service should return exactly one revenue calculation per team
          expect(result.team1Revenue).toBeDefined();
          expect(result.team2Revenue).toBeDefined();
          expect(result.team1Revenue.totalRevenue).toBe(expectedTeam1Revenue);
          expect(result.team2Revenue.totalRevenue).toBe(expectedTeam2Revenue);

          // Property: The revenue should be calculated using max values from the team
          expect(result.team1MaxBattlesRobot.battles).toBe(team1MaxBattles);
          expect(result.team1MaxFameRobot.fame).toBe(team1MaxFame);
          expect(result.team2MaxBattlesRobot.battles).toBe(team2MaxBattles);
          expect(result.team2MaxFameRobot.fame).toBe(team2MaxFame);

          // Property: Each team's revenue should be independent
          // (not affected by the other team's stats)
          expect(result.team1Revenue.robotBattles).toBe(team1MaxBattles);
          expect(result.team1Revenue.robotFame).toBe(team1MaxFame);
          expect(result.team2Revenue.robotBattles).toBe(team2MaxBattles);
          expect(result.team2Revenue.robotFame).toBe(team2MaxFame);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.1: Single payment even when both robots have identical stats
   */
  test('Property 12.1: Single payment even with identical robot stats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles (same for both robots)
        fc.integer({ min: 0, max: 25000 }), // fame (same for both robots)
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUser1Id,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots with IDENTICAL stats for team 1
          const team1Robot1 = await createTestRobot(testUser1Id, battles, fame);
          const team1Robot2 = await createTestRobot(testUser1Id, battles, fame);

          // Create two robots for team 2 (doesn't matter for this test)
          const team2Robot1 = await createTestRobot(testUser2Id, 100, 1000);
          const team2Robot2 = await createTestRobot(testUser2Id, 200, 2000);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser1Id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Get initial balance
          const initialUser1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
          const initialBalance1 = initialUser1!.currency;

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUser1Id,
            [team2Robot1.id, team2Robot2.id],
            testUser2Id
          );

          // Award streaming revenue to team 1
          await awardStreamingRevenue(testUser1Id, result.team1Revenue, 1);

          // Get updated balance
          const updatedUser1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
          const finalBalance1 = updatedUser1!.currency;

          // Calculate expected revenue (should be ONE payment, not two)
          const expectedRevenue = Math.floor(
            1000 * 
            (1 + battles / 1000) * 
            (1 + fame / 5000) * 
            (1 + studioLevel * 1.0)
          );

          // Property: Balance should increase by exactly ONE payment amount
          const balanceIncrease = finalBalance1 - initialBalance1;
          expect(balanceIncrease).toBe(expectedRevenue);

          // Property: Should NOT be double the revenue (not one per robot)
          expect(balanceIncrease).not.toBe(expectedRevenue * 2);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 12.2: Payment amount is based on team composition, not individual robots
   */
  test('Property 12.2: Payment uses team max values, not sum of robots', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 2500 }),  // robot1 battles
        fc.integer({ min: 100, max: 12500 }), // robot1 fame
        fc.integer({ min: 100, max: 2500 }),  // robot2 battles
        fc.integer({ min: 100, max: 12500 }), // robot2 fame
        fc.integer({ min: 0, max: 10 }),      // studio level
        async (robot1Battles, robot1Fame, robot2Battles, robot2Fame, studioLevel) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUser1Id,
              facilityType: 'streaming_studio',
            },
          });

          // Create two robots with different stats
          const team1Robot1 = await createTestRobot(testUser1Id, robot1Battles, robot1Fame);
          const team1Robot2 = await createTestRobot(testUser1Id, robot2Battles, robot2Fame);

          // Create team 2 robots (doesn't matter for this test)
          const team2Robot1 = await createTestRobot(testUser2Id, 100, 1000);
          const team2Robot2 = await createTestRobot(testUser2Id, 200, 2000);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser1Id,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Get initial balance
          const initialUser1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
          const initialBalance1 = initialUser1!.currency;

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUser1Id,
            [team2Robot1.id, team2Robot2.id],
            testUser2Id
          );

          // Award streaming revenue to team 1
          await awardStreamingRevenue(testUser1Id, result.team1Revenue, 1);

          // Get updated balance
          const updatedUser1 = await prisma.user.findUnique({ where: { id: testUser1Id } });
          const finalBalance1 = updatedUser1!.currency;

          // Calculate expected revenue using MAX values (not sum)
          const maxBattles = Math.max(robot1Battles, robot2Battles);
          const maxFame = Math.max(robot1Fame, robot2Fame);
          const expectedRevenue = Math.floor(
            1000 * 
            (1 + maxBattles / 1000) * 
            (1 + maxFame / 5000) * 
            (1 + studioLevel * 1.0)
          );

          // Calculate what revenue would be if we summed the stats (WRONG approach)
          const sumBattles = robot1Battles + robot2Battles;
          const sumFame = robot1Fame + robot2Fame;
          const wrongRevenue = Math.floor(
            1000 * 
            (1 + sumBattles / 1000) * 
            (1 + sumFame / 5000) * 
            (1 + studioLevel * 1.0)
          );

          // Property: Balance should increase by revenue calculated from MAX values
          const balanceIncrease = finalBalance1 - initialBalance1;
          expect(balanceIncrease).toBe(expectedRevenue);

          // Property: Should NOT use sum of robot stats (unless max happens to equal sum)
          if (robot1Battles !== robot2Battles || robot1Fame !== robot2Fame) {
            // If robots have different stats, max-based and sum-based will differ
            expect(balanceIncrease).not.toBe(wrongRevenue);
          }

          // Property: The result should explicitly show which robot's stats were used
          expect(result.team1MaxBattlesRobot.battles).toBe(maxBattles);
          expect(result.team1MaxFameRobot.fame).toBe(maxFame);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 10: Tag Team Uses Maximum Values
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 * 
 * For any Tag Team battle, the streaming revenue calculation for each team 
 * should use the highest battle count and highest fame from the two robots 
 * on that team
 */
describe('Property 10: Tag Team Uses Maximum Values', () => {
  let testUserId1: number;
  let testUserId2: number;

  beforeAll(async () => {
    // Create two test users for Tag Team battles
    const user1 = await prisma.user.create({
      data: {
        username: `test_user_prop10_1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    const user2 = await prisma.user.create({
      data: {
        username: `test_user_prop10_2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId1 = user1.id;
    testUserId2 = user2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId1 } });
    await prisma.robot.deleteMany({ where: { userId: testUserId2 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId1 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId2 } });
    await prisma.user.deleteMany({ where: { id: testUserId1 } });
    await prisma.user.deleteMany({ where: { id: testUserId2 } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId1 } });
    await prisma.robot.deleteMany({ where: { userId: testUserId2 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId1 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId2 } });
  });

  /**
   * Property 10: Tag Team streaming revenue should use max battles and max fame
   * from each team
   */
  test('Property 10: Tag Team uses maximum battles and fame from each team', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Team 1 robot stats
        fc.integer({ min: 0, max: 10000 }), // team1Robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team1Robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team1Robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team1Robot2 fame
        // Team 2 robot stats
        fc.integer({ min: 0, max: 10000 }), // team2Robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team2Robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team2Robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team2Robot2 fame
        // Studio levels
        fc.integer({ min: 0, max: 10 }),    // team1 studio level
        fc.integer({ min: 0, max: 10 }),    // team2 studio level
        async (
          t1r1Battles, t1r1Fame, t1r2Battles, t1r2Fame,
          t2r1Battles, t2r1Fame, t2r2Battles, t2r2Fame,
          studioLevel1, studioLevel2
        ) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create robots for team 1
          const team1Robot1 = await createTestRobot(testUserId1, t1r1Battles, t1r1Fame);
          const team1Robot2 = await createTestRobot(testUserId1, t1r2Battles, t1r2Fame);

          // Create robots for team 2
          const team2Robot1 = await createTestRobot(testUserId2, t2r1Battles, t2r1Fame);
          const team2Robot2 = await createTestRobot(testUserId2, t2r2Battles, t2r2Fame);

          // Create Streaming Studio facilities
          if (studioLevel1 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel1,
              },
            });
          }
          if (studioLevel2 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: studioLevel2,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Calculate expected max values for team 1
          const expectedTeam1MaxBattles = Math.max(t1r1Battles, t1r2Battles);
          const expectedTeam1MaxFame = Math.max(t1r1Fame, t1r2Fame);

          // Calculate expected max values for team 2
          const expectedTeam2MaxBattles = Math.max(t2r1Battles, t2r2Battles);
          const expectedTeam2MaxFame = Math.max(t2r1Fame, t2r2Fame);

          // Property: Team 1 should use max battles from its robots
          expect(result.team1MaxBattlesRobot.battles).toBe(expectedTeam1MaxBattles);

          // Property: Team 1 should use max fame from its robots
          expect(result.team1MaxFameRobot.fame).toBe(expectedTeam1MaxFame);

          // Property: Team 2 should use max battles from its robots
          expect(result.team2MaxBattlesRobot.battles).toBe(expectedTeam2MaxBattles);

          // Property: Team 2 should use max fame from its robots
          expect(result.team2MaxFameRobot.fame).toBe(expectedTeam2MaxFame);

          // Property: Team 1 revenue calculation should use max values
          expect(result.team1Revenue.robotBattles).toBe(expectedTeam1MaxBattles);
          expect(result.team1Revenue.robotFame).toBe(expectedTeam1MaxFame);

          // Property: Team 2 revenue calculation should use max values
          expect(result.team2Revenue.robotBattles).toBe(expectedTeam2MaxBattles);
          expect(result.team2Revenue.robotFame).toBe(expectedTeam2MaxFame);

          // Property: Battle multiplier should be calculated using max battles
          const expectedTeam1BattleMultiplier = 1 + (expectedTeam1MaxBattles / 1000);
          const expectedTeam2BattleMultiplier = 1 + (expectedTeam2MaxBattles / 1000);
          expect(result.team1Revenue.battleMultiplier).toBeCloseTo(expectedTeam1BattleMultiplier, 10);
          expect(result.team2Revenue.battleMultiplier).toBeCloseTo(expectedTeam2BattleMultiplier, 10);

          // Property: Fame multiplier should be calculated using max fame
          const expectedTeam1FameMultiplier = 1 + (expectedTeam1MaxFame / 5000);
          const expectedTeam2FameMultiplier = 1 + (expectedTeam2MaxFame / 5000);
          expect(result.team1Revenue.fameMultiplier).toBeCloseTo(expectedTeam1FameMultiplier, 10);
          expect(result.team2Revenue.fameMultiplier).toBeCloseTo(expectedTeam2FameMultiplier, 10);

          // Property: Studio multiplier should match the team's studio level
          const expectedTeam1StudioMultiplier = 1 + (studioLevel1 * 1.0);
          const expectedTeam2StudioMultiplier = 1 + (studioLevel2 * 1.0);
          expect(result.team1Revenue.studioMultiplier).toBeCloseTo(expectedTeam1StudioMultiplier, 10);
          expect(result.team2Revenue.studioMultiplier).toBeCloseTo(expectedTeam2StudioMultiplier, 10);

          // Property: Total revenue should match the formula with max values
          const expectedTeam1Revenue = Math.floor(
            1000 * expectedTeam1BattleMultiplier * expectedTeam1FameMultiplier * expectedTeam1StudioMultiplier
          );
          const expectedTeam2Revenue = Math.floor(
            1000 * expectedTeam2BattleMultiplier * expectedTeam2FameMultiplier * expectedTeam2StudioMultiplier
          );
          expect(result.team1Revenue.totalRevenue).toBe(expectedTeam1Revenue);
          expect(result.team2Revenue.totalRevenue).toBe(expectedTeam2Revenue);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.1: When one robot has max battles and another has max fame,
   * both values should be used
   */
  test('Property 10.1: Tag Team uses max battles from one robot and max fame from another', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }),  // battles difference
        fc.integer({ min: 1000, max: 25000 }), // fame difference
        fc.integer({ min: 0, max: 10 }),       // studio level
        async (battlesDiff, fameDiff, studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });

          // Create team where robot 1 has more battles, robot 2 has more fame
          const team1Robot1 = await createTestRobot(testUserId1, 1000 + battlesDiff, 1000);
          const team1Robot2 = await createTestRobot(testUserId1, 1000, 1000 + fameDiff);

          // Create opponent team with balanced stats
          const team2Robot1 = await createTestRobot(testUserId2, 500, 500);
          const team2Robot2 = await createTestRobot(testUserId2, 500, 500);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Property: Team 1 should use robot 1's battles (higher)
          expect(result.team1MaxBattlesRobot.battles).toBe(1000 + battlesDiff);
          expect(result.team1MaxBattlesRobot.id).toBe(team1Robot1.id);

          // Property: Team 1 should use robot 2's fame (higher)
          expect(result.team1MaxFameRobot.fame).toBe(1000 + fameDiff);
          expect(result.team1MaxFameRobot.id).toBe(team1Robot2.id);

          // Property: Revenue calculation should use both max values
          expect(result.team1Revenue.robotBattles).toBe(1000 + battlesDiff);
          expect(result.team1Revenue.robotFame).toBe(1000 + fameDiff);

          // Property: This should result in higher revenue than using either robot alone
          const robot1AloneRevenue = Math.floor(
            1000 * (1 + (1000 + battlesDiff) / 1000) * (1 + 1000 / 5000) * (1 + studioLevel * 1.0)
          );
          const robot2AloneRevenue = Math.floor(
            1000 * (1 + 1000 / 1000) * (1 + (1000 + fameDiff) / 5000) * (1 + studioLevel * 1.0)
          );
          expect(result.team1Revenue.totalRevenue).toBeGreaterThanOrEqual(robot1AloneRevenue);
          expect(result.team1Revenue.totalRevenue).toBeGreaterThanOrEqual(robot2AloneRevenue);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10.2: When both robots have equal stats, either can be used
   * (the result should be the same)
   */
  test('Property 10.2: Tag Team with equal robot stats uses either robot', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }), // battles (same for both)
        fc.integer({ min: 0, max: 50000 }), // fame (same for both)
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });

          // Create team with identical robots
          const team1Robot1 = await createTestRobot(testUserId1, battles, fame);
          const team1Robot2 = await createTestRobot(testUserId1, battles, fame);

          // Create opponent team
          const team2Robot1 = await createTestRobot(testUserId2, 500, 500);
          const team2Robot2 = await createTestRobot(testUserId2, 500, 500);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Property: Max battles should equal the shared battle count
          expect(result.team1MaxBattlesRobot.battles).toBe(battles);

          // Property: Max fame should equal the shared fame
          expect(result.team1MaxFameRobot.fame).toBe(fame);

          // Property: Revenue should be calculated correctly with shared stats
          const expectedRevenue = Math.floor(
            1000 * (1 + battles / 1000) * (1 + fame / 5000) * (1 + studioLevel * 1.0)
          );
          expect(result.team1Revenue.totalRevenue).toBe(expectedRevenue);

          // Property: The selected robot can be either one (they're equal)
          const selectedRobotIds = [team1Robot1.id, team1Robot2.id];
          expect(selectedRobotIds).toContain(result.team1MaxBattlesRobot.id);
          expect(selectedRobotIds).toContain(result.team1MaxFameRobot.id);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10.3: Max value selection is independent between teams
   */
  test('Property 10.3: Each team independently selects max values', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Team 1 stats
        fc.integer({ min: 0, max: 10000 }), // team1Robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team1Robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team1Robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team1Robot2 fame
        // Team 2 stats
        fc.integer({ min: 0, max: 10000 }), // team2Robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team2Robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team2Robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team2Robot2 fame
        async (
          t1r1Battles, t1r1Fame, t1r2Battles, t1r2Fame,
          t2r1Battles, t2r1Fame, t2r2Battles, t2r2Fame
        ) => {
          // Create robots for both teams
          const team1Robot1 = await createTestRobot(testUserId1, t1r1Battles, t1r1Fame);
          const team1Robot2 = await createTestRobot(testUserId1, t1r2Battles, t1r2Fame);
          const team2Robot1 = await createTestRobot(testUserId2, t2r1Battles, t2r1Fame);
          const team2Robot2 = await createTestRobot(testUserId2, t2r2Battles, t2r2Fame);

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Property: Team 1's max values should be independent of team 2's robots
          const expectedTeam1MaxBattles = Math.max(t1r1Battles, t1r2Battles);
          const expectedTeam1MaxFame = Math.max(t1r1Fame, t1r2Fame);
          expect(result.team1MaxBattlesRobot.battles).toBe(expectedTeam1MaxBattles);
          expect(result.team1MaxFameRobot.fame).toBe(expectedTeam1MaxFame);

          // Property: Team 2's max values should be independent of team 1's robots
          const expectedTeam2MaxBattles = Math.max(t2r1Battles, t2r2Battles);
          const expectedTeam2MaxFame = Math.max(t2r1Fame, t2r2Fame);
          expect(result.team2MaxBattlesRobot.battles).toBe(expectedTeam2MaxBattles);
          expect(result.team2MaxFameRobot.fame).toBe(expectedTeam2MaxFame);

          // Property: Team 1's revenue should not depend on team 2's robot stats
          // (only on team 1's max values and team 1's studio level)
          expect(result.team1Revenue.robotBattles).toBe(expectedTeam1MaxBattles);
          expect(result.team1Revenue.robotFame).toBe(expectedTeam1MaxFame);

          // Property: Team 2's revenue should not depend on team 1's robot stats
          expect(result.team2Revenue.robotBattles).toBe(expectedTeam2MaxBattles);
          expect(result.team2Revenue.robotFame).toBe(expectedTeam2MaxFame);

          // Property: Max battles robot should be from the correct team
          const team1RobotIds = [team1Robot1.id, team1Robot2.id];
          const team2RobotIds = [team2Robot1.id, team2Robot2.id];
          expect(team1RobotIds).toContain(result.team1MaxBattlesRobot.id);
          expect(team1RobotIds).toContain(result.team1MaxFameRobot.id);
          expect(team2RobotIds).toContain(result.team2MaxBattlesRobot.id);
          expect(team2RobotIds).toContain(result.team2MaxFameRobot.id);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.4: Tag Team revenue should be at least as high as using
   * the weaker robot's stats alone
   */
  test('Property 10.4: Tag Team revenue benefits from max value selection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // weaker robot battles
        fc.integer({ min: 0, max: 25000 }), // weaker robot fame
        fc.integer({ min: 1, max: 5000 }),  // battle increase for stronger robot
        fc.integer({ min: 1, max: 25000 }), // fame increase for stronger robot
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (weakBattles, weakFame, battleIncrease, fameIncrease, studioLevel) => {
          const strongBattles = weakBattles + battleIncrease;
          const strongFame = weakFame + fameIncrease;

          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });

          // Create team with one weak and one strong robot
          const weakRobot = await createTestRobot(testUserId1, weakBattles, weakFame);
          const strongRobot = await createTestRobot(testUserId1, strongBattles, strongFame);

          // Create opponent team
          const team2Robot1 = await createTestRobot(testUserId2, 500, 500);
          const team2Robot2 = await createTestRobot(testUserId2, 500, 500);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [weakRobot.id, strongRobot.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Calculate what revenue would be if using weak robot alone
          const weakRobotRevenue = Math.floor(
            1000 * (1 + weakBattles / 1000) * (1 + weakFame / 5000) * (1 + studioLevel * 1.0)
          );

          // Property: Tag Team revenue should be at least as high as weak robot alone
          expect(result.team1Revenue.totalRevenue).toBeGreaterThanOrEqual(weakRobotRevenue);

          // Property: Tag Team should use the stronger robot's stats (max values)
          expect(result.team1MaxBattlesRobot.battles).toBe(strongBattles);
          expect(result.team1MaxFameRobot.fame).toBe(strongFame);

          // Property: Tag Team revenue should equal using max values
          const expectedRevenue = Math.floor(
            1000 * (1 + strongBattles / 1000) * (1 + strongFame / 5000) * (1 + studioLevel * 1.0)
          );
          expect(result.team1Revenue.totalRevenue).toBe(expectedRevenue);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: weakRobot.id } });
          await prisma.robot.deleteMany({ where: { id: strongRobot.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 10.5: Tag Team with new robots (0 battles, 0 fame) should use
   * base multipliers (1.0)
   */
  test('Property 10.5: Tag Team with new robots uses base multipliers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // studio level
        async (studioLevel) => {
          // Clean up facility first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });

          // Create team with brand new robots (0 battles, 0 fame)
          const team1Robot1 = await createTestRobot(testUserId1, 0, 0);
          const team1Robot2 = await createTestRobot(testUserId1, 0, 0);

          // Create opponent team
          const team2Robot1 = await createTestRobot(testUserId2, 0, 0);
          const team2Robot2 = await createTestRobot(testUserId2, 0, 0);

          // Create Streaming Studio facility
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Property: Max battles should be 0 for both teams
          expect(result.team1MaxBattlesRobot.battles).toBe(0);
          expect(result.team2MaxBattlesRobot.battles).toBe(0);

          // Property: Max fame should be 0 for both teams
          expect(result.team1MaxFameRobot.fame).toBe(0);
          expect(result.team2MaxFameRobot.fame).toBe(0);

          // Property: Battle multiplier should be 1.0
          expect(result.team1Revenue.battleMultiplier).toBe(1.0);
          expect(result.team2Revenue.battleMultiplier).toBe(1.0);

          // Property: Fame multiplier should be 1.0
          expect(result.team1Revenue.fameMultiplier).toBe(1.0);
          expect(result.team2Revenue.fameMultiplier).toBe(1.0);

          // Property: Total revenue should be base amount times studio multiplier
          const expectedRevenue = Math.floor(1000 * (1 + studioLevel * 1.0));
          expect(result.team1Revenue.totalRevenue).toBe(expectedRevenue);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 11: Tag Team Separate Calculations
 * **Validates: Requirements 7.5**
 * 
 * For any Tag Team battle, each team should receive a separate streaming revenue 
 * calculation based on their own team's maximum values, not the opponent's values
 */
describe('Property 11: Tag Team Separate Calculations', () => {
  let testUserId1: number;
  let testUserId2: number;

  beforeAll(async () => {
    // Create two test users for Tag Team battles
    const user1 = await prisma.user.create({
      data: {
        username: `test_user_prop11_1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    const user2 = await prisma.user.create({
      data: {
        username: `test_user_prop11_2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });
    testUserId1 = user1.id;
    testUserId2 = user2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId1 } });
    await prisma.robot.deleteMany({ where: { userId: testUserId2 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId1 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId2 } });
    await prisma.user.deleteMany({ where: { id: testUserId1 } });
    await prisma.user.deleteMany({ where: { id: testUserId2 } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots and facilities before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId1 } });
    await prisma.robot.deleteMany({ where: { userId: testUserId2 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId1 } });
    await prisma.facility.deleteMany({ where: { userId: testUserId2 } });
  });

  /**
   * Property 11: Each team's streaming revenue is calculated independently
   * using their own team's maximum values, not the opponent's values
   */
  test('Property 11: Tag Team separate calculations use own team values', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Team 1 robot stats
        fc.integer({ min: 0, max: 10000 }), // team1 robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team1 robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team1 robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team1 robot2 fame
        fc.integer({ min: 0, max: 10 }),    // team1 studio level
        // Team 2 robot stats
        fc.integer({ min: 0, max: 10000 }), // team2 robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team2 robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team2 robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team2 robot2 fame
        fc.integer({ min: 0, max: 10 }),    // team2 studio level
        async (
          t1r1Battles, t1r1Fame, t1r2Battles, t1r2Fame, t1StudioLevel,
          t2r1Battles, t2r1Fame, t2r2Battles, t2r2Fame, t2StudioLevel
        ) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create robots for team 1
          const team1Robot1 = await createTestRobot(testUserId1, t1r1Battles, t1r1Fame);
          const team1Robot2 = await createTestRobot(testUserId1, t1r2Battles, t1r2Fame);

          // Create robots for team 2
          const team2Robot1 = await createTestRobot(testUserId2, t2r1Battles, t2r1Fame);
          const team2Robot2 = await createTestRobot(testUserId2, t2r2Battles, t2r2Fame);

          // Create Streaming Studio facilities for both teams
          if (t1StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: t1StudioLevel,
              },
            });
          }
          if (t2StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: t2StudioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const { calculateTagTeamStreamingRevenue } = await import('../src/services/streamingRevenueService');
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Calculate expected values for team 1
          const team1MaxBattles = Math.max(t1r1Battles, t1r2Battles);
          const team1MaxFame = Math.max(t1r1Fame, t1r2Fame);
          const expectedTeam1BattleMultiplier = 1 + (team1MaxBattles / 1000);
          const expectedTeam1FameMultiplier = 1 + (team1MaxFame / 5000);
          const expectedTeam1StudioMultiplier = 1 + (t1StudioLevel * 1.0);
          const expectedTeam1Revenue = Math.floor(
            1000 * expectedTeam1BattleMultiplier * expectedTeam1FameMultiplier * expectedTeam1StudioMultiplier
          );

          // Calculate expected values for team 2
          const team2MaxBattles = Math.max(t2r1Battles, t2r2Battles);
          const team2MaxFame = Math.max(t2r1Fame, t2r2Fame);
          const expectedTeam2BattleMultiplier = 1 + (team2MaxBattles / 1000);
          const expectedTeam2FameMultiplier = 1 + (team2MaxFame / 5000);
          const expectedTeam2StudioMultiplier = 1 + (t2StudioLevel * 1.0);
          const expectedTeam2Revenue = Math.floor(
            1000 * expectedTeam2BattleMultiplier * expectedTeam2FameMultiplier * expectedTeam2StudioMultiplier
          );

          // Property: Team 1 revenue is calculated using team 1's max values only
          expect(result.team1Revenue.robotBattles).toBe(team1MaxBattles);
          expect(result.team1Revenue.robotFame).toBe(team1MaxFame);
          expect(result.team1Revenue.studioLevel).toBe(t1StudioLevel);
          expect(result.team1Revenue.battleMultiplier).toBeCloseTo(expectedTeam1BattleMultiplier, 10);
          expect(result.team1Revenue.fameMultiplier).toBeCloseTo(expectedTeam1FameMultiplier, 10);
          expect(result.team1Revenue.studioMultiplier).toBeCloseTo(expectedTeam1StudioMultiplier, 10);
          expect(result.team1Revenue.totalRevenue).toBe(expectedTeam1Revenue);

          // Property: Team 2 revenue is calculated using team 2's max values only
          expect(result.team2Revenue.robotBattles).toBe(team2MaxBattles);
          expect(result.team2Revenue.robotFame).toBe(team2MaxFame);
          expect(result.team2Revenue.studioLevel).toBe(t2StudioLevel);
          expect(result.team2Revenue.battleMultiplier).toBeCloseTo(expectedTeam2BattleMultiplier, 10);
          expect(result.team2Revenue.fameMultiplier).toBeCloseTo(expectedTeam2FameMultiplier, 10);
          expect(result.team2Revenue.studioMultiplier).toBeCloseTo(expectedTeam2StudioMultiplier, 10);
          expect(result.team2Revenue.totalRevenue).toBe(expectedTeam2Revenue);

          // Property: Team 1's revenue uses team 1's values (not team 2's)
          // Note: Values may coincidentally be equal, but they're calculated independently
          expect(result.team1Revenue.robotBattles).toBe(team1MaxBattles);
          expect(result.team1Revenue.robotFame).toBe(team1MaxFame);
          
          // Property: Team 2's revenue uses team 2's values (not team 1's)
          // Note: Values may coincidentally be equal, but they're calculated independently
          expect(result.team2Revenue.robotBattles).toBe(team2MaxBattles);
          expect(result.team2Revenue.robotFame).toBe(team2MaxFame);

          // Property: Each team's calculation is independent
          // If team 1 has higher stats, they should get more revenue (assuming same studio)
          if (t1StudioLevel === t2StudioLevel) {
            if (team1MaxBattles > team2MaxBattles && team1MaxFame > team2MaxFame) {
              expect(result.team1Revenue.totalRevenue).toBeGreaterThan(result.team2Revenue.totalRevenue);
            } else if (team2MaxBattles > team1MaxBattles && team2MaxFame > team1MaxFame) {
              expect(result.team2Revenue.totalRevenue).toBeGreaterThan(result.team1Revenue.totalRevenue);
            }
          }

          // Property: Max values metadata is correctly identified
          expect(result.team1MaxBattlesRobot.battles).toBe(team1MaxBattles);
          expect(result.team1MaxFameRobot.fame).toBe(team1MaxFame);
          expect(result.team2MaxBattlesRobot.battles).toBe(team2MaxBattles);
          expect(result.team2MaxFameRobot.fame).toBe(team2MaxFame);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.1: Team with higher stats gets more revenue (independent calculation)
   */
  test('Property 11.1: Higher stat team gets more revenue independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // base battles
        fc.integer({ min: 0, max: 25000 }), // base fame
        fc.integer({ min: 100, max: 5000 }), // battle advantage
        fc.integer({ min: 1000, max: 25000 }), // fame advantage
        fc.integer({ min: 0, max: 10 }),    // studio level (same for both)
        async (baseBattles, baseFame, battleAdvantage, fameAdvantage, studioLevel) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create team 1 with higher stats
          const team1Robot1 = await createTestRobot(testUserId1, baseBattles + battleAdvantage, baseFame + fameAdvantage);
          const team1Robot2 = await createTestRobot(testUserId1, baseBattles, baseFame);

          // Create team 2 with lower stats
          const team2Robot1 = await createTestRobot(testUserId2, baseBattles, baseFame);
          const team2Robot2 = await createTestRobot(testUserId2, baseBattles, baseFame);

          // Create same Streaming Studio level for both teams
          if (studioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const { calculateTagTeamStreamingRevenue } = await import('../src/services/streamingRevenueService');
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Property: Team 1 should have higher revenue due to higher stats
          expect(result.team1Revenue.totalRevenue).toBeGreaterThan(result.team2Revenue.totalRevenue);

          // Property: Team 1 uses its own higher max values
          expect(result.team1Revenue.robotBattles).toBe(baseBattles + battleAdvantage);
          expect(result.team1Revenue.robotFame).toBe(baseFame + fameAdvantage);

          // Property: Team 2 uses its own lower max values
          expect(result.team2Revenue.robotBattles).toBe(baseBattles);
          expect(result.team2Revenue.robotFame).toBe(baseFame);

          // Property: Both teams use the same studio multiplier
          expect(result.team1Revenue.studioMultiplier).toBe(result.team2Revenue.studioMultiplier);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11.2: Different studio levels result in different multipliers per team
   */
  test('Property 11.2: Each team uses their own studio multiplier', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles (same for all robots)
        fc.integer({ min: 0, max: 25000 }), // fame (same for all robots)
        fc.integer({ min: 0, max: 10 }),    // team1 studio level
        fc.integer({ min: 0, max: 10 }),    // team2 studio level
        async (battles, fame, t1StudioLevel, t2StudioLevel) => {
          // Skip if studio levels are the same (not testing the property)
          if (t1StudioLevel === t2StudioLevel) {
            return;
          }

          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create robots with identical stats for both teams
          const team1Robot1 = await createTestRobot(testUserId1, battles, fame);
          const team1Robot2 = await createTestRobot(testUserId1, battles, fame);
          const team2Robot1 = await createTestRobot(testUserId2, battles, fame);
          const team2Robot2 = await createTestRobot(testUserId2, battles, fame);

          // Create different Streaming Studio levels
          if (t1StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: t1StudioLevel,
              },
            });
          }
          if (t2StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: t2StudioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const { calculateTagTeamStreamingRevenue } = await import('../src/services/streamingRevenueService');
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Property: Both teams have same battle and fame values
          expect(result.team1Revenue.robotBattles).toBe(battles);
          expect(result.team2Revenue.robotBattles).toBe(battles);
          expect(result.team1Revenue.robotFame).toBe(fame);
          expect(result.team2Revenue.robotFame).toBe(fame);

          // Property: But different studio multipliers
          expect(result.team1Revenue.studioLevel).toBe(t1StudioLevel);
          expect(result.team2Revenue.studioLevel).toBe(t2StudioLevel);
          expect(result.team1Revenue.studioMultiplier).toBeCloseTo(1 + (t1StudioLevel * 1.0), 10);
          expect(result.team2Revenue.studioMultiplier).toBeCloseTo(1 + (t2StudioLevel * 1.0), 10);

          // Property: Team with higher studio level gets more revenue
          if (t1StudioLevel > t2StudioLevel) {
            expect(result.team1Revenue.totalRevenue).toBeGreaterThan(result.team2Revenue.totalRevenue);
          } else {
            expect(result.team2Revenue.totalRevenue).toBeGreaterThan(result.team1Revenue.totalRevenue);
          }

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11.3: Swapping team compositions doesn't affect independent calculations
   */
  test('Property 11.3: Team calculations are independent of opponent composition', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Team 1 stats (fixed)
        fc.integer({ min: 0, max: 5000 }),  // team1 robot1 battles
        fc.integer({ min: 0, max: 25000 }), // team1 robot1 fame
        fc.integer({ min: 0, max: 5000 }),  // team1 robot2 battles
        fc.integer({ min: 0, max: 25000 }), // team1 robot2 fame
        fc.integer({ min: 0, max: 10 }),    // team1 studio level
        // Team 2 stats (will vary)
        fc.integer({ min: 0, max: 10000 }), // team2 robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team2 robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team2 robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team2 robot2 fame
        fc.integer({ min: 0, max: 10 }),    // team2 studio level
        async (
          t1r1Battles, t1r1Fame, t1r2Battles, t1r2Fame, t1StudioLevel,
          t2r1Battles, t2r1Fame, t2r2Battles, t2r2Fame, t2StudioLevel
        ) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create robots for team 1 (fixed stats)
          const team1Robot1 = await createTestRobot(testUserId1, t1r1Battles, t1r1Fame);
          const team1Robot2 = await createTestRobot(testUserId1, t1r2Battles, t1r2Fame);

          // Create robots for team 2 (varying stats)
          const team2Robot1 = await createTestRobot(testUserId2, t2r1Battles, t2r1Fame);
          const team2Robot2 = await createTestRobot(testUserId2, t2r2Battles, t2r2Fame);

          // Create Streaming Studio facilities
          if (t1StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: t1StudioLevel,
              },
            });
          }
          if (t2StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: t2StudioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const { calculateTagTeamStreamingRevenue } = await import('../src/services/streamingRevenueService');
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Calculate expected values for team 1 (should be independent of team 2)
          const team1MaxBattles = Math.max(t1r1Battles, t1r2Battles);
          const team1MaxFame = Math.max(t1r1Fame, t1r2Fame);
          const expectedTeam1Revenue = Math.floor(
            1000 * 
            (1 + team1MaxBattles / 1000) * 
            (1 + team1MaxFame / 5000) * 
            (1 + t1StudioLevel * 1.0)
          );

          // Property: Team 1's revenue is always the same regardless of team 2's composition
          expect(result.team1Revenue.totalRevenue).toBe(expectedTeam1Revenue);
          expect(result.team1Revenue.robotBattles).toBe(team1MaxBattles);
          expect(result.team1Revenue.robotFame).toBe(team1MaxFame);
          expect(result.team1Revenue.studioLevel).toBe(t1StudioLevel);

          // Property: Team 1's calculation does not depend on team 2's max values
          // (even if team 2 has much higher or lower stats)
          expect(result.team1Revenue.robotBattles).not.toBe(Math.max(t2r1Battles, t2r2Battles));
          expect(result.team1Revenue.robotFame).not.toBe(Math.max(t2r1Fame, t2r2Fame));

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 11.4: Both teams always receive positive revenue (separate calculations)
   */
  test('Property 11.4: Both teams receive positive revenue independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Team 1 stats
        fc.integer({ min: 0, max: 10000 }), // team1 robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team1 robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team1 robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team1 robot2 fame
        fc.integer({ min: 0, max: 10 }),    // team1 studio level
        // Team 2 stats
        fc.integer({ min: 0, max: 10000 }), // team2 robot1 battles
        fc.integer({ min: 0, max: 50000 }), // team2 robot1 fame
        fc.integer({ min: 0, max: 10000 }), // team2 robot2 battles
        fc.integer({ min: 0, max: 50000 }), // team2 robot2 fame
        fc.integer({ min: 0, max: 10 }),    // team2 studio level
        async (
          t1r1Battles, t1r1Fame, t1r2Battles, t1r2Fame, t1StudioLevel,
          t2r1Battles, t2r1Fame, t2r2Battles, t2r2Fame, t2StudioLevel
        ) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
            },
          });
          await prisma.facility.deleteMany({
            where: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
            },
          });

          // Create robots for both teams
          const team1Robot1 = await createTestRobot(testUserId1, t1r1Battles, t1r1Fame);
          const team1Robot2 = await createTestRobot(testUserId1, t1r2Battles, t1r2Fame);
          const team2Robot1 = await createTestRobot(testUserId2, t2r1Battles, t2r1Fame);
          const team2Robot2 = await createTestRobot(testUserId2, t2r2Battles, t2r2Fame);

          // Create Streaming Studio facilities
          if (t1StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: t1StudioLevel,
              },
            });
          }
          if (t2StudioLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: t2StudioLevel,
              },
            });
          }

          // Calculate Tag Team streaming revenue
          const { calculateTagTeamStreamingRevenue } = await import('../src/services/streamingRevenueService');
          const result = await calculateTagTeamStreamingRevenue(
            [team1Robot1.id, team1Robot2.id],
            testUserId1,
            [team2Robot1.id, team2Robot2.id],
            testUserId2
          );

          // Property: Both teams always receive positive revenue
          expect(result.team1Revenue.totalRevenue).toBeGreaterThan(0);
          expect(result.team2Revenue.totalRevenue).toBeGreaterThan(0);

          // Property: Minimum revenue is base amount (1000) for teams with no stats/studio
          if (t1r1Battles === 0 && t1r2Battles === 0 && t1r1Fame === 0 && t1r2Fame === 0 && t1StudioLevel === 0) {
            expect(result.team1Revenue.totalRevenue).toBe(1000);
          }
          if (t2r1Battles === 0 && t2r2Battles === 0 && t2r1Fame === 0 && t2r2Fame === 0 && t2StudioLevel === 0) {
            expect(result.team2Revenue.totalRevenue).toBe(1000);
          }

          // Property: Both teams have base amount of 1000
          expect(result.team1Revenue.baseAmount).toBe(1000);
          expect(result.team2Revenue.baseAmount).toBe(1000);

          // Clean up robots for next iteration
          await prisma.robot.deleteMany({ where: { id: team1Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team1Robot2.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot1.id } });
          await prisma.robot.deleteMany({ where: { id: team2Robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });
});
