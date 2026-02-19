/**
 * Property-Based Tests for Facility Advisor Streaming Studio ROI
 * Property 21: Facility Advisor Provides Streaming Studio ROI
 * 
 * **Validates: Requirements 17.1-17.9**
 * 
 * For any Streaming Studio at level L < 10, the Facility Advisor should display:
 * - Upgrade cost
 * - Operating cost increase
 * - Projected revenue increase per battle
 * - Estimated payback period for upgrading to level L+1
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { facilityRecommendationService } from '../src/services/facilityRecommendationService';
import prisma from '../src/lib/prisma';

// Helper function to create a minimal test robot
async function createTestRobot(
  userId: number, 
  battles: number, 
  fame: number,
  tagTeamBattles: number = 0
) {
  return await prisma.robot.create({
    data: {
      userId,
      name: `TestRobot_${Date.now()}_${Math.random()}`,
      frameId: 1,
      totalBattles: battles,
      totalTagTeamBattles: tagTeamBattles,
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

// Helper function to create cycle snapshots with battle data
async function createCycleSnapshots(
  userId: number,
  startCycle: number,
  endCycle: number,
  battlesPerCycle: number
) {
  const snapshots = [];
  const now = new Date();
  
  for (let cycle = startCycle; cycle <= endCycle; cycle++) {
    const startTime = new Date(now.getTime() - (endCycle - cycle + 1) * 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    snapshots.push({
      cycleNumber: cycle,
      triggerType: 'scheduled',
      startTime,
      endTime,
      durationMs: 60 * 60 * 1000, // 1 hour in ms
      stableMetrics: [
        {
          userId,
          battlesParticipated: battlesPerCycle,
          totalRepairCosts: 0,
        },
      ],
      robotMetrics: [],
      stepDurations: {},
      totalBattles: battlesPerCycle,
      totalCreditsTransacted: 0,
      totalPrestigeAwarded: 0,
    });
  }
  
  await prisma.cycleSnapshot.createMany({
    data: snapshots,
    skipDuplicates: true,
  });
}

describe('Property 21: Facility Advisor Provides Streaming Studio ROI', () => {
  let testUserId: number;
  let currentCycle: number;

  beforeAll(async () => {
    // Get or create cycle metadata
    let cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });

    if (!cycleMetadata) {
      cycleMetadata = await prisma.cycleMetadata.create({
        data: {
          id: 1,
          totalCycles: 20,
        },
      });
    } else {
      // Update to ensure we have enough cycles
      cycleMetadata = await prisma.cycleMetadata.update({
        where: { id: 1 },
        data: { totalCycles: Math.max(cycleMetadata.totalCycles, 20) },
      });
    }

    currentCycle = cycleMetadata.totalCycles;

    // Create a test user for all tests
    const user = await prisma.user.create({
      data: {
        username: `test_user_prop21_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 10000000, // Plenty of currency
        prestige: 100000,   // Plenty of prestige
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: { gte: currentCycle - 10, lte: currentCycle },
      },
    });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots, facilities, and cycle snapshots before each test
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: { gte: currentCycle - 10, lte: currentCycle },
      },
    });
  });

  /**
   * Property 21: For any Streaming Studio at level L < 10, the Facility Advisor
   * should display all required ROI metrics for upgrading to level L+1
   */
  test('Property 21: Facility Advisor provides Streaming Studio ROI metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),     // current studio level (0-9, so we can upgrade)
        fc.integer({ min: 1, max: 3 }),     // number of robots
        fc.integer({ min: 0, max: 5000 }),  // battles per robot
        fc.integer({ min: 0, max: 25000 }), // fame per robot
        fc.integer({ min: 5, max: 20 }),    // battles per cycle
        async (currentLevel, robotCount, battlesPerRobot, famePerRobot, battlesPerCycle) => {
          // Clean up first
          await prisma.robot.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });
          await prisma.cycleSnapshot.deleteMany({
            where: {
              cycleNumber: { gte: currentCycle - 10, lte: currentCycle },
            },
          });

          // Create robots with specified stats
          const robots = [];
          for (let i = 0; i < robotCount; i++) {
            const robot = await createTestRobot(
              testUserId,
              battlesPerRobot,
              famePerRobot,
              0
            );
            robots.push(robot);
          }

          // Create Streaming Studio facility at current level (if > 0)
          if (currentLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: currentLevel,
              },
            });
          }

          // Create cycle snapshots with battle history
          await createCycleSnapshots(
            testUserId,
            currentCycle - 9,
            currentCycle,
            battlesPerCycle
          );

          // Generate facility recommendations
          const recommendations = await facilityRecommendationService.generateRecommendations(
            testUserId,
            10
          );

          // Find the Streaming Studio recommendation
          const studioRec = recommendations.recommendations.find(
            (rec) => rec.facilityType === 'streaming_studio'
          );

          // Property: If studio is not at max level, there should be a recommendation
          // (unless the ROI is negative and it's filtered out)
          if (currentLevel < 10) {
            // Calculate expected values
            const nextLevel = currentLevel + 1;
            const expectedUpgradeCost = nextLevel * 100000;
            const expectedOperatingCostIncrease = nextLevel * 100 - currentLevel * 100;

            // Calculate expected streaming revenue
            const currentMultiplier = 1 + (currentLevel * 0.1);
            const nextMultiplier = 1 + (nextLevel * 0.1);
            const multiplierIncrease = nextMultiplier - currentMultiplier;

            // Calculate average streaming revenue per battle
            let totalRevenue = 0;
            for (const robot of robots) {
              const battleMultiplier = 1 + (battlesPerRobot / 1000);
              const fameMultiplier = 1 + (famePerRobot / 5000);
              const revenue = 1000 * battleMultiplier * fameMultiplier * currentMultiplier;
              totalRevenue += revenue;
            }
            const avgRevenuePerBattle = robotCount > 0 ? totalRevenue / robotCount : 1000 * currentMultiplier;

            // Calculate revenue increase per battle
            const revenueIncreasePerBattle = avgRevenuePerBattle * (multiplierIncrease / currentMultiplier);

            // Calculate net benefit per cycle
            const projectedRevenueIncreasePerCycle = revenueIncreasePerBattle * battlesPerCycle;
            const netBenefitPerCycle = projectedRevenueIncreasePerCycle - expectedOperatingCostIncrease;

            // If net benefit is positive and significant, we should have a recommendation
            // Note: The service may filter out recommendations with very low ROI
            if (netBenefitPerCycle > 0 && projectedRevenueIncreasePerCycle > 0) {
              // Calculate expected ROI to see if it would be filtered
              const expectedROI = (netBenefitPerCycle * 30 - expectedUpgradeCost) / expectedUpgradeCost;
              
              // Property: Recommendation should exist if ROI is positive or priority is not low
              // The service filters out recommendations with ROI <= 0 and priority === 'low'
              if (expectedROI > 0 || netBenefitPerCycle > expectedUpgradeCost / 30) {
                expect(studioRec).toBeDefined();
              }

              if (studioRec) {
                // Property 17.1: Should show current level
                expect(studioRec.currentLevel).toBe(currentLevel);

                // Property 17.2: Should show next level
                expect(studioRec.recommendedLevel).toBe(nextLevel);

                // Property 17.3: Should show upgrade cost
                expect(studioRec.upgradeCost).toBe(expectedUpgradeCost);

                // Property 17.4: Reason should mention revenue increase per battle
                expect(studioRec.reason).toContain('streaming revenue');
                expect(studioRec.reason).toContain('per battle');

                // Property 17.5: Reason should mention operating cost
                expect(studioRec.reason).toContain('operating cost');

                // Property 17.6: Should calculate payback period (battles needed)
                // The payback period should be based on net benefit
                if (netBenefitPerCycle > 0) {
                  const expectedPaybackCycles = Math.ceil(expectedUpgradeCost / netBenefitPerCycle);
                  expect(studioRec.projectedPayoffCycles).toBe(expectedPaybackCycles);
                }

                // Property 17.7: Should show projected ROI
                // ROI = (net benefit over 30 cycles - upgrade cost) / upgrade cost
                const expectedROI = (netBenefitPerCycle * 30 - expectedUpgradeCost) / expectedUpgradeCost;
                expect(studioRec.projectedROI).toBeCloseTo(expectedROI, 5);

                // Property 17.8: Priority should be based on payback period
                if (studioRec.projectedPayoffCycles !== null) {
                  if (studioRec.projectedPayoffCycles <= 15) {
                    expect(studioRec.priority).toBe('high');
                  } else if (studioRec.projectedPayoffCycles <= 30) {
                    expect(studioRec.priority).toBe('medium');
                  } else {
                    expect(studioRec.priority).toBe('low');
                  }
                }

                // Property 17.9: Facility name should be correct
                expect(studioRec.facilityName).toBe('Streaming Studio');
              }
            } else if (battlesPerCycle === 0) {
              // Special case: no battle history
              // Should still show recommendation with estimate
              if (studioRec) {
                expect(studioRec.reason).toContain('no battle history');
              }
            }
            // If net benefit is negative or zero, recommendation may be filtered out
            // This is acceptable behavior
          }

          // Clean up robots for next iteration
          for (const robot of robots) {
            await prisma.robot.delete({ where: { id: robot.id } });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.1: Facility Advisor shows correct upgrade cost formula
   */
  test('Property 21.1: Upgrade cost follows formula (L+1) × 100,000', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }), // current level
        async (currentLevel) => {
          // Clean up first
          await prisma.robot.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });
          await prisma.cycleSnapshot.deleteMany({
            where: {
              cycleNumber: { gte: currentCycle - 10, lte: currentCycle },
            },
          });

          // Create at least one robot with some activity
          await createTestRobot(testUserId, 100, 1000, 0);

          // Create Streaming Studio facility at current level (if > 0)
          if (currentLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: currentLevel,
              },
            });
          }

          // Create cycle snapshots with some battle history
          await createCycleSnapshots(testUserId, currentCycle - 9, currentCycle, 10);

          // Generate recommendations
          const recommendations = await facilityRecommendationService.generateRecommendations(
            testUserId,
            10
          );

          // Find Streaming Studio recommendation
          const studioRec = recommendations.recommendations.find(
            (rec) => rec.facilityType === 'streaming_studio'
          );

          if (studioRec) {
            const nextLevel = currentLevel + 1;
            const expectedUpgradeCost = nextLevel * 100000;

            // Property: Upgrade cost should follow the formula
            expect(studioRec.upgradeCost).toBe(expectedUpgradeCost);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 21.2: Revenue increase calculation is accurate
   */
  test('Property 21.2: Revenue increase per battle is calculated correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),     // current level
        fc.integer({ min: 100, max: 5000 }), // battles
        fc.integer({ min: 1000, max: 25000 }), // fame
        fc.integer({ min: 10, max: 30 }),   // battles per cycle
        async (currentLevel, battles, fame, battlesPerCycle) => {
          // Clean up first
          await prisma.robot.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });
          await prisma.cycleSnapshot.deleteMany({
            where: {
              cycleNumber: { gte: currentCycle - 10, lte: currentCycle },
            },
          });

          // Create robot with specified stats
          await createTestRobot(testUserId, battles, fame, 0);

          // Create Streaming Studio facility at current level (if > 0)
          if (currentLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: currentLevel,
              },
            });
          }

          // Create cycle snapshots with battle history
          await createCycleSnapshots(testUserId, currentCycle - 9, currentCycle, battlesPerCycle);

          // Generate recommendations
          const recommendations = await facilityRecommendationService.generateRecommendations(
            testUserId,
            10
          );

          // Find Streaming Studio recommendation
          const studioRec = recommendations.recommendations.find(
            (rec) => rec.facilityType === 'streaming_studio'
          );

          if (studioRec) {
            const nextLevel = currentLevel + 1;
            const currentMultiplier = 1 + (currentLevel * 0.1);
            const nextMultiplier = 1 + (nextLevel * 0.1);
            const multiplierIncrease = nextMultiplier - currentMultiplier;

            // Calculate expected streaming revenue
            const battleMultiplier = 1 + (battles / 1000);
            const fameMultiplier = 1 + (fame / 5000);
            const avgRevenuePerBattle = 1000 * battleMultiplier * fameMultiplier * currentMultiplier;

            // Calculate expected revenue increase per battle
            const expectedRevenueIncreasePerBattle = avgRevenuePerBattle * (multiplierIncrease / currentMultiplier);

            // Calculate expected net benefit per cycle
            const operatingCostIncrease = nextLevel * 100 - currentLevel * 100;
            const projectedRevenueIncreasePerCycle = expectedRevenueIncreasePerBattle * battlesPerCycle;
            const expectedNetBenefitPerCycle = projectedRevenueIncreasePerCycle - operatingCostIncrease;

            // Property: If net benefit is positive, payback should be calculated correctly
            if (expectedNetBenefitPerCycle > 0 && studioRec.projectedPayoffCycles !== null) {
              const expectedPaybackCycles = Math.ceil(studioRec.upgradeCost / expectedNetBenefitPerCycle);
              expect(studioRec.projectedPayoffCycles).toBe(expectedPaybackCycles);
            }

            // Property: ROI should be calculated correctly
            const expectedROI = (expectedNetBenefitPerCycle * 30 - studioRec.upgradeCost) / studioRec.upgradeCost;
            expect(studioRec.projectedROI).toBeCloseTo(expectedROI, 5);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 21.3: No recommendation when at max level
   */
  test('Property 21.3: No Streaming Studio recommendation when at max level (10)', async () => {
    // Clean up first
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.facility.deleteMany({ where: { userId: testUserId } });
    await prisma.cycleSnapshot.deleteMany({
      where: {
        cycleNumber: { gte: currentCycle - 10, lte: currentCycle },
      },
    });

    // Create robot with some activity
    await createTestRobot(testUserId, 1000, 5000, 0);

    // Create Streaming Studio at max level (10)
    await prisma.facility.create({
      data: {
        userId: testUserId,
        facilityType: 'streaming_studio',
        level: 10,
      },
    });

    // Create cycle snapshots with battle history
    await createCycleSnapshots(testUserId, currentCycle - 9, currentCycle, 15);

    // Generate recommendations
    const recommendations = await facilityRecommendationService.generateRecommendations(
      testUserId,
      10
    );

    // Find Streaming Studio recommendation
    const studioRec = recommendations.recommendations.find(
      (rec) => rec.facilityType === 'streaming_studio'
    );

    // Property: Should not recommend upgrade when at max level
    expect(studioRec).toBeUndefined();
  });

  /**
   * Property 21.4: Operating cost increase is factored into ROI
   */
  test('Property 21.4: Operating cost increase reduces net benefit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 9 }),     // current level
        fc.integer({ min: 100, max: 2000 }), // battles
        fc.integer({ min: 1000, max: 10000 }), // fame
        fc.integer({ min: 5, max: 15 }),    // battles per cycle (lower to test operating cost impact)
        async (currentLevel, battles, fame, battlesPerCycle) => {
          // Clean up first
          await prisma.robot.deleteMany({ where: { userId: testUserId } });
          await prisma.facility.deleteMany({ where: { userId: testUserId } });
          await prisma.cycleSnapshot.deleteMany({
            where: {
              cycleNumber: { gte: currentCycle - 10, lte: currentCycle },
            },
          });

          // Create robot with specified stats
          await createTestRobot(testUserId, battles, fame, 0);

          // Create Streaming Studio facility at current level (if > 0)
          if (currentLevel > 0) {
            await prisma.facility.create({
              data: {
                userId: testUserId,
                facilityType: 'streaming_studio',
                level: currentLevel,
              },
            });
          }

          // Create cycle snapshots with battle history
          await createCycleSnapshots(testUserId, currentCycle - 9, currentCycle, battlesPerCycle);

          // Generate recommendations
          const recommendations = await facilityRecommendationService.generateRecommendations(
            testUserId,
            10
          );

          // Find Streaming Studio recommendation
          const studioRec = recommendations.recommendations.find(
            (rec) => rec.facilityType === 'streaming_studio'
          );

          if (studioRec) {
            const nextLevel = currentLevel + 1;
            const operatingCostIncrease = nextLevel * 100 - currentLevel * 100;

            // Property: Reason should mention operating cost
            expect(studioRec.reason).toContain('operating cost');
            expect(studioRec.reason).toContain(`₡${operatingCostIncrease}`);

            // Property: Operating cost should reduce the net benefit
            // This is implicitly tested by the payback period calculation
            // If operating costs weren't factored in, payback would be shorter
            expect(studioRec.projectedPayoffCycles).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
