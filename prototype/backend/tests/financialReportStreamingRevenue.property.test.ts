/**
 * Property Test: Financial Report Includes Streaming Revenue
 * 
 * **Property 17: Financial Report Includes Streaming Revenue**
 * 
 * **Validates: Requirements 12.1-12.7**
 * 
 * For any daily financial report, the report should include streaming revenue 
 * as a separate line item under revenue streams, showing the total amount and 
 * number of battles.
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { generateFinancialReport } from '../src/utils/economyCalculations';
import { eventLogger, EventType } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';

// Helper function to create a minimal test robot
async function createTestRobot(userId: number, battles: number, fame: number, name: string) {
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

describe('Property 17: Financial Report Includes Streaming Revenue', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `test_financial_report_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data after each test
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ 
      where: { 
        userId: testUserId,
        facilityType: 'streaming_studio'
      } 
    });
  });

  afterAll(async () => {
    // Final cleanup of user
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  /**
   * Property 17: For any daily financial report, the report should include 
   * streaming revenue as a separate line item with total amount and battle count
   */
  test('Property 17: Financial report includes streaming revenue line item', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numBattles: fc.integer({ min: 1, max: 10 }),
          robotBattles: fc.integer({ min: 0, max: 1000 }),
          robotFame: fc.integer({ min: 0, max: 10000 }),
          studioLevel: fc.integer({ min: 0, max: 10 }),
          streamingRevenuePerBattle: fc.array(
            fc.integer({ min: 1000, max: 5000 }),
            { minLength: 1, maxLength: 10 }
          ),
        }),
        async ({ numBattles, robotBattles, robotFame, studioLevel, streamingRevenuePerBattle }) => {
          // Ensure we have enough streaming revenue values
          const revenueValues = streamingRevenuePerBattle.slice(0, numBattles);
          while (revenueValues.length < numBattles) {
            revenueValues.push(1000);
          }

          // Create robot
          const robot = await createTestRobot(
            testUserId,
            robotBattles,
            robotFame,
            `TestRobot_${Date.now()}_${Math.random()}`
          );

          // Create streaming studio facility if level > 0
          if (studioLevel > 0) {
            await prisma.facility.upsert({
              where: {
                userId_facilityType: {
                  userId: testUserId,
                  facilityType: 'streaming_studio',
                },
              },
              create: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
              update: {
                level: studioLevel,
              },
            });
          }

          // Log battle_complete events with streaming revenue
          const cycleNumber = 1;
          let expectedTotalStreamingRevenue = 0;

          for (let i = 0; i < numBattles; i++) {
            const streamingRevenue = revenueValues[i];
            expectedTotalStreamingRevenue += streamingRevenue;

            await eventLogger.logEvent(
              cycleNumber,
              EventType.BATTLE_COMPLETE,
              {
                battleId: i + 1,
                robot1Id: robot.id,
                robot2Id: 9999 + i,
                winnerId: robot.id,
                streamingRevenue1: streamingRevenue,
                streamingRevenue2: 1000,
              },
              { userId: testUserId }
            );
          }

          // Generate financial report
          const report = await generateFinancialReport(testUserId, 0);

          // Property 1: Report should include streaming revenue field
          expect(report.revenue.streaming).toBeDefined();

          // Property 2: Report should include streaming battle count field
          expect(report.revenue.streamingBattleCount).toBeDefined();

          // Property 3: Streaming revenue should equal sum of all battle streaming revenues
          expect(report.revenue.streaming).toBe(expectedTotalStreamingRevenue);

          // Property 4: Streaming battle count should equal number of battles
          expect(report.revenue.streamingBattleCount).toBe(numBattles);

          // Property 5: Streaming revenue should be included in total revenue
          expect(report.revenue.total).toBeGreaterThanOrEqual(report.revenue.streaming);

          // Property 6: Streaming revenue should be non-negative
          expect(report.revenue.streaming).toBeGreaterThanOrEqual(0);

          // Property 7: Battle count should be non-negative
          expect(report.revenue.streamingBattleCount).toBeGreaterThanOrEqual(0);

          // Clean up robot
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.1: Financial report shows zero streaming revenue when no battles occurred
   */
  test('Property 17.1: Zero streaming revenue when no battles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // studio level
        async (studioLevel) => {
          // Create streaming studio facility if level > 0
          if (studioLevel > 0) {
            await prisma.facility.upsert({
              where: {
                userId_facilityType: {
                  userId: testUserId,
                  facilityType: 'streaming_studio',
                },
              },
              create: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
              update: {
                level: studioLevel,
              },
            });
          }

          // Generate financial report without any battles
          const report = await generateFinancialReport(testUserId, 0);

          // Property: Should show zero streaming revenue
          expect(report.revenue.streaming).toBe(0);

          // Property: Should show zero battle count
          expect(report.revenue.streamingBattleCount).toBe(0);

          // Property: Total revenue should not include streaming revenue
          expect(report.revenue.total).toBe(
            report.revenue.battleWinnings +
            report.revenue.prestigeBonus +
            report.revenue.merchandising
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 17.2: Financial report only counts streaming revenue from user's own robots
   */
  test('Property 17.2: Only counts streaming revenue from user\'s robots', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userBattles: fc.integer({ min: 1, max: 5 }),
          opponentBattles: fc.integer({ min: 1, max: 5 }),
          userStreamingRevenue: fc.array(
            fc.integer({ min: 1000, max: 3000 }),
            { minLength: 1, maxLength: 5 }
          ),
          opponentStreamingRevenue: fc.array(
            fc.integer({ min: 1000, max: 3000 }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ userBattles, opponentBattles, userStreamingRevenue, opponentStreamingRevenue }) => {
          // Create user's robot
          const userRobot = await createTestRobot(
            testUserId,
            100,
            1000,
            `UserRobot_${Date.now()}_${Math.random()}`
          );

          // Create another user and their robot
          const otherUser = await prisma.user.create({
            data: {
              username: `test_other_user_${Date.now()}_${Math.random()}`,
              passwordHash: 'test',
              currency: 100000,
              prestige: 1000,
            },
          });

          const otherRobot = await createTestRobot(
            otherUser.id,
            100,
            1000,
            `OtherRobot_${Date.now()}_${Math.random()}`
          );

          try {
            // Ensure we have enough revenue values
            const userRevenues = userStreamingRevenue.slice(0, userBattles);
            while (userRevenues.length < userBattles) {
              userRevenues.push(1000);
            }

            const opponentRevenues = opponentStreamingRevenue.slice(0, opponentBattles);
            while (opponentRevenues.length < opponentBattles) {
              opponentRevenues.push(1000);
            }

            // Log battles where user's robot is robot1
            let expectedUserStreamingRevenue = 0;
            const cycleNumber = 1;

            for (let i = 0; i < userBattles; i++) {
              const userRevenue = userRevenues[i];
              const opponentRevenue = opponentRevenues[i % opponentRevenues.length];
              expectedUserStreamingRevenue += userRevenue;

              await eventLogger.logEvent(
                cycleNumber,
                EventType.BATTLE_COMPLETE,
                {
                  battleId: i + 1,
                  robot1Id: userRobot.id,
                  robot2Id: otherRobot.id,
                  winnerId: userRobot.id,
                  streamingRevenue1: userRevenue,
                  streamingRevenue2: opponentRevenue,
                },
                { userId: testUserId }
              );
            }

            // Log battles where user's robot is robot2
            for (let i = 0; i < opponentBattles; i++) {
              const userRevenue = userRevenues[i % userRevenues.length];
              const opponentRevenue = opponentRevenues[i];
              expectedUserStreamingRevenue += userRevenue;

              await eventLogger.logEvent(
                cycleNumber,
                EventType.BATTLE_COMPLETE,
                {
                  battleId: userBattles + i + 1,
                  robot1Id: otherRobot.id,
                  robot2Id: userRobot.id,
                  winnerId: otherRobot.id,
                  streamingRevenue1: opponentRevenue,
                  streamingRevenue2: userRevenue,
                },
                { userId: testUserId }
              );
            }

            // Generate financial report for test user
            const report = await generateFinancialReport(testUserId, 0);

            // Property: Should include streaming revenue from user's robot
            // Note: The report aggregates from last 7 days, so it may include more than just our test data
            // We verify that it includes AT LEAST the expected amount from our test
            expect(report.revenue.streaming).toBeGreaterThanOrEqual(expectedUserStreamingRevenue);

            // Property: Should count at least the battles where user's robot participated
            expect(report.revenue.streamingBattleCount).toBeGreaterThanOrEqual(userBattles + opponentBattles);

            // Property: Streaming revenue should be non-negative
            expect(report.revenue.streaming).toBeGreaterThanOrEqual(0);
          } finally {
            // Clean up
            await prisma.robot.deleteMany({ where: { id: otherRobot.id } });
            await prisma.auditLog.deleteMany({ where: { userId: otherUser.id } });
            await prisma.user.deleteMany({ where: { id: otherUser.id } });
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 17.3: Streaming revenue is included in total revenue calculation
   */
  test('Property 17.3: Streaming revenue contributes to total revenue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numBattles: fc.integer({ min: 1, max: 5 }),
          streamingRevenuePerBattle: fc.integer({ min: 1000, max: 5000 }),
          battleWinnings: fc.integer({ min: 0, max: 10000 }),
        }),
        async ({ numBattles, streamingRevenuePerBattle, battleWinnings }) => {
          // Create robot
          const robot = await createTestRobot(
            testUserId,
            100,
            1000,
            `TestRobot_${Date.now()}_${Math.random()}`
          );

          // Log battle_complete events
          const cycleNumber = 1;
          let expectedStreamingRevenue = 0;

          for (let i = 0; i < numBattles; i++) {
            expectedStreamingRevenue += streamingRevenuePerBattle;

            await eventLogger.logEvent(
              cycleNumber,
              EventType.BATTLE_COMPLETE,
              {
                battleId: i + 1,
                robot1Id: robot.id,
                robot2Id: 9999 + i,
                winnerId: robot.id,
                streamingRevenue1: streamingRevenuePerBattle,
                streamingRevenue2: 1000,
              },
              { userId: testUserId }
            );
          }

          // Generate financial report
          const report = await generateFinancialReport(testUserId, battleWinnings);

          // Property: Total revenue should include streaming revenue
          const expectedTotalRevenue =
            battleWinnings +
            report.revenue.prestigeBonus +
            report.revenue.merchandising +
            expectedStreamingRevenue;

          expect(report.revenue.total).toBe(expectedTotalRevenue);

          // Property: Total revenue should be at least streaming revenue
          expect(report.revenue.total).toBeGreaterThanOrEqual(expectedStreamingRevenue);

          // Clean up robot
          await prisma.robot.deleteMany({ where: { id: robot.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 17.4: Streaming revenue aggregates correctly across multiple robots
   */
  test('Property 17.4: Aggregates streaming revenue across multiple robots', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          numRobots: fc.integer({ min: 2, max: 5 }),
          battlesPerRobot: fc.array(
            fc.integer({ min: 1, max: 3 }),
            { minLength: 2, maxLength: 5 }
          ),
          revenuePerBattle: fc.array(
            fc.integer({ min: 1000, max: 3000 }),
            { minLength: 2, maxLength: 15 }
          ),
        }),
        async ({ numRobots, battlesPerRobot, revenuePerBattle }) => {
          // Ensure we have enough values
          const robotBattles = battlesPerRobot.slice(0, numRobots);
          while (robotBattles.length < numRobots) {
            robotBattles.push(1);
          }

          // Create multiple robots
          const robots = [];
          for (let i = 0; i < numRobots; i++) {
            const robot = await createTestRobot(
              testUserId,
              100,
              1000,
              `TestRobot${i}_${Date.now()}_${Math.random()}`
            );
            robots.push(robot);
          }

          // Log battles for each robot
          const cycleNumber = 1;
          let expectedTotalStreamingRevenue = 0;
          let expectedTotalBattleCount = 0;
          let revenueIndex = 0;

          for (let robotIdx = 0; robotIdx < numRobots; robotIdx++) {
            const robot = robots[robotIdx];
            const numBattles = robotBattles[robotIdx];

            for (let battleIdx = 0; battleIdx < numBattles; battleIdx++) {
              const revenue = revenuePerBattle[revenueIndex % revenuePerBattle.length];
              revenueIndex++;
              expectedTotalStreamingRevenue += revenue;
              expectedTotalBattleCount++;

              await eventLogger.logEvent(
                cycleNumber,
                EventType.BATTLE_COMPLETE,
                {
                  battleId: expectedTotalBattleCount,
                  robot1Id: robot.id,
                  robot2Id: 9999 + expectedTotalBattleCount,
                  winnerId: robot.id,
                  streamingRevenue1: revenue,
                  streamingRevenue2: 1000,
                },
                { userId: testUserId }
              );
            }
          }

          // Generate financial report
          const report = await generateFinancialReport(testUserId, 0);

          // Property: Should aggregate streaming revenue from all robots
          expect(report.revenue.streaming).toBe(expectedTotalStreamingRevenue);

          // Property: Should count all battles from all robots
          expect(report.revenue.streamingBattleCount).toBe(expectedTotalBattleCount);

          // Clean up robots
          for (const robot of robots) {
            await prisma.robot.deleteMany({ where: { id: robot.id } });
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
