/**
 * Property-Based Tests for ComparisonService
 * 
 * Tests universal properties that should hold across all valid inputs
 * Uses fast-check for property-based testing
 */

import { PrismaClient } from '@prisma/client';
import fc from 'fast-check';
import { EventLogger, clearSequenceCache } from '../src/services/eventLogger';
import { CycleSnapshotService } from '../src/services/cycleSnapshotService';
import { ComparisonService } from '../src/services/comparisonService';

const prisma = new PrismaClient();
const eventLogger = new EventLogger();
const cycleSnapshotService = new CycleSnapshotService();
const comparisonService = new ComparisonService();

// Test data setup helpers
let testUsers: Map<number, any> = new Map();
let testRobots: Map<number, any> = new Map();

async function ensureTestUser(userId: number) {
  if (!testUsers.has(userId)) {
    const user = await prisma.user.create({
      data: {
        username: `test_user_${userId}_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUsers.set(userId, user);
  }
  return testUsers.get(userId);
}

async function ensureTestRobot(robotId: number, userId: number) {
  if (!testRobots.has(robotId)) {
    // Ensure user exists first
    const user = await ensureTestUser(userId);
    
    // Find or create a weapon
    let weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      weapon = await prisma.weapon.create({
        data: {
          name: 'Test Weapon',
          weaponType: 'melee',
          damageType: 'kinetic',
          baseDamage: 50,
          cooldown: 1000,
          cost: 1000,
          handsRequired: 'one',
          loadoutType: 'any',
        },
      });
    }
    
    // Create weapon inventory for the user
    const weaponInventory = await prisma.weaponInventory.create({
      data: {
        user: { connect: { id: user.id } },
        weapon: { connect: { id: weapon.id } },
      },
    });
    
    const robot = await prisma.robot.create({
      data: {
        name: `TestRobot${robotId}`,
        user: { connect: { id: user.id } },
        mainWeapon: { connect: { id: weaponInventory.id } },
        currentHP: 1000,
        maxHP: 1000,
        currentShield: 100,
        maxShield: 100,
        elo: 1500,
        fame: 100,
        currentLeague: 'bronze',
      },
    });
    testRobots.set(robotId, robot);
  }
  return testRobots.get(robotId);
}

describe('ComparisonService Property-Based Tests', () => {
  beforeEach(async () => {
    // Clean up before each test
    await prisma.cycleSnapshot.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Clear test data caches
    testUsers.clear();
    testRobots.clear();
    
    // Clear sequence cache
    for (let i = 1; i <= 100; i++) {
      clearSequenceCache(i);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 8: Historical Comparison Correctness
   * 
   * **Validates: Requirements 6.1, 6.3**
   * 
   * For any comparison request between two cycles, the Analytics Engine should 
   * retrieve data from exactly those two cycles and compute deltas as 
   * (current - comparison) and percentages as ((current - comparison) / comparison) × 100.
   */
  describe('Property 8: Historical Comparison Correctness', () => {
    it('should calculate deltas correctly as (current - comparison)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle
          fc.integer({ min: 51, max: 100 }), // comparisonCycle (ensure different)
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 5 }),
              currentMerchandising: fc.integer({ min: 0, max: 10000 }),
              currentStreaming: fc.integer({ min: 0, max: 5000 }),
              currentOperatingCosts: fc.integer({ min: 0, max: 3000 }),
              comparisonMerchandising: fc.integer({ min: 0, max: 10000 }),
              comparisonStreaming: fc.integer({ min: 0, max: 5000 }),
              comparisonOperatingCosts: fc.integer({ min: 0, max: 3000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (currentCycle, comparisonCycle, userData) => {
            // Clear any existing data for these cycles
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create comparison cycle snapshot
            await eventLogger.logCycleStart(comparisonCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                comparisonCycle,
                data.userId,
                data.comparisonMerchandising,
                data.comparisonStreaming,
                5,
                1000,
                50,
                200
              );
              await eventLogger.logOperatingCosts(
                comparisonCycle,
                data.userId,
                [{ facilityType: 'training_academy', level: 1, cost: data.comparisonOperatingCosts }],
                data.comparisonOperatingCosts
              );
            }
            await eventLogger.logCycleComplete(comparisonCycle, 1000);
            await cycleSnapshotService.createSnapshot(comparisonCycle);

            // Create current cycle snapshot
            await eventLogger.logCycleStart(currentCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                currentCycle,
                data.userId,
                data.currentMerchandising,
                data.currentStreaming,
                5,
                1000,
                50,
                200
              );
              await eventLogger.logOperatingCosts(
                currentCycle,
                data.userId,
                [{ facilityType: 'training_academy', level: 1, cost: data.currentOperatingCosts }],
                data.currentOperatingCosts
              );
            }
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison
            const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle);

            // Property: Deltas should be calculated as (current - comparison)
            // Aggregate expected values by userId (since snapshots aggregate)
            const aggregatedByUser = new Map<number, {
              currentMerchandising: number;
              currentStreaming: number;
              currentOperatingCosts: number;
              comparisonMerchandising: number;
              comparisonStreaming: number;
              comparisonOperatingCosts: number;
            }>();

            for (const data of userData) {
              if (!aggregatedByUser.has(data.userId)) {
                aggregatedByUser.set(data.userId, {
                  currentMerchandising: 0,
                  currentStreaming: 0,
                  currentOperatingCosts: 0,
                  comparisonMerchandising: 0,
                  comparisonStreaming: 0,
                  comparisonOperatingCosts: 0,
                });
              }
              const agg = aggregatedByUser.get(data.userId)!;
              agg.currentMerchandising += data.currentMerchandising;
              agg.currentStreaming += data.currentStreaming;
              agg.currentOperatingCosts += data.currentOperatingCosts;
              agg.comparisonMerchandising += data.comparisonMerchandising;
              agg.comparisonStreaming += data.comparisonStreaming;
              agg.comparisonOperatingCosts += data.comparisonOperatingCosts;
            }

            for (const [userId, data] of aggregatedByUser) {
              const stableComp = comparison.stableComparisons.find(s => s.userId === userId);
              expect(stableComp).toBeDefined();

              // Calculate expected deltas
              const expectedMerchandisingDelta = data.currentMerchandising - data.comparisonMerchandising;
              const expectedStreamingDelta = data.currentStreaming - data.comparisonStreaming;
              const expectedOperatingCostsDelta = data.currentOperatingCosts - data.comparisonOperatingCosts;
              const expectedNetProfitDelta = 
                (data.currentMerchandising + data.currentStreaming - data.currentOperatingCosts) -
                (data.comparisonMerchandising + data.comparisonStreaming - data.comparisonOperatingCosts);

              // Verify deltas
              expect(stableComp!.merchandisingIncome.delta).toBe(expectedMerchandisingDelta);
              expect(stableComp!.streamingIncome.delta).toBe(expectedStreamingDelta);
              expect(stableComp!.operatingCosts.delta).toBe(expectedOperatingCostsDelta);
              expect(stableComp!.netProfit.delta).toBe(expectedNetProfitDelta);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate percentage changes correctly as ((current - comparison) / comparison) × 100', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle
          fc.integer({ min: 51, max: 100 }), // comparisonCycle
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 5 }),
              currentMerchandising: fc.integer({ min: 100, max: 10000 }),
              currentStreaming: fc.integer({ min: 100, max: 5000 }),
              comparisonMerchandising: fc.integer({ min: 100, max: 10000 }),
              comparisonStreaming: fc.integer({ min: 100, max: 5000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (currentCycle, comparisonCycle, userData) => {
            // Clear any existing data for these cycles
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create comparison cycle snapshot
            await eventLogger.logCycleStart(comparisonCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                comparisonCycle,
                data.userId,
                data.comparisonMerchandising,
                data.comparisonStreaming,
                5,
                1000,
                50,
                200
              );
            }
            await eventLogger.logCycleComplete(comparisonCycle, 1000);
            await cycleSnapshotService.createSnapshot(comparisonCycle);

            // Create current cycle snapshot
            await eventLogger.logCycleStart(currentCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                currentCycle,
                data.userId,
                data.currentMerchandising,
                data.currentStreaming,
                5,
                1000,
                50,
                200
              );
            }
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison
            const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle);

            // Property: Percentage changes should be ((current - comparison) / comparison) × 100
            // Aggregate expected values by userId (since snapshots aggregate)
            const aggregatedByUser = new Map<number, {
              currentMerchandising: number;
              currentStreaming: number;
              comparisonMerchandising: number;
              comparisonStreaming: number;
            }>();

            for (const data of userData) {
              if (!aggregatedByUser.has(data.userId)) {
                aggregatedByUser.set(data.userId, {
                  currentMerchandising: 0,
                  currentStreaming: 0,
                  comparisonMerchandising: 0,
                  comparisonStreaming: 0,
                });
              }
              const agg = aggregatedByUser.get(data.userId)!;
              agg.currentMerchandising += data.currentMerchandising;
              agg.currentStreaming += data.currentStreaming;
              agg.comparisonMerchandising += data.comparisonMerchandising;
              agg.comparisonStreaming += data.comparisonStreaming;
            }

            for (const [userId, data] of aggregatedByUser) {
              const stableComp = comparison.stableComparisons.find(s => s.userId === userId);
              expect(stableComp).toBeDefined();

              // Calculate expected percentage changes
              const expectedMerchandisingPercent = 
                ((data.currentMerchandising - data.comparisonMerchandising) / data.comparisonMerchandising) * 100;
              const expectedStreamingPercent = 
                ((data.currentStreaming - data.comparisonStreaming) / data.comparisonStreaming) * 100;

              // Verify percentage changes (with tolerance for floating point)
              expect(stableComp!.merchandisingIncome.percentChange).toBeCloseTo(expectedMerchandisingPercent, 2);
              expect(stableComp!.streamingIncome.percentChange).toBeCloseTo(expectedStreamingPercent, 2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle percentage change when comparison value is zero', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle
          fc.integer({ min: 51, max: 100 }), // comparisonCycle
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 5 }),
              currentMerchandising: fc.integer({ min: 1, max: 10000 }), // Non-zero current
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (currentCycle, comparisonCycle, userData) => {
            // Clear any existing data for these cycles
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create comparison cycle snapshot with zero income
            await eventLogger.logCycleStart(comparisonCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                comparisonCycle,
                data.userId,
                0, // Zero merchandising
                0, // Zero streaming
                5,
                1000,
                50,
                200
              );
            }
            await eventLogger.logCycleComplete(comparisonCycle, 1000);
            await cycleSnapshotService.createSnapshot(comparisonCycle);

            // Create current cycle snapshot with non-zero income
            await eventLogger.logCycleStart(currentCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                currentCycle,
                data.userId,
                data.currentMerchandising,
                0,
                5,
                1000,
                50,
                200
              );
            }
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison
            const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle);

            // Property: When comparison is 0 and current is not, percentChange should be null
            // Aggregate expected values by userId (since snapshots aggregate)
            const aggregatedByUser = new Map<number, { currentMerchandising: number }>();

            for (const data of userData) {
              if (!aggregatedByUser.has(data.userId)) {
                aggregatedByUser.set(data.userId, { currentMerchandising: 0 });
              }
              const agg = aggregatedByUser.get(data.userId)!;
              agg.currentMerchandising += data.currentMerchandising;
            }

            for (const [userId, data] of aggregatedByUser) {
              const stableComp = comparison.stableComparisons.find(s => s.userId === userId);
              expect(stableComp).toBeDefined();

              expect(stableComp!.merchandisingIncome.comparison).toBe(0);
              expect(stableComp!.merchandisingIncome.current).toBe(data.currentMerchandising);
              expect(stableComp!.merchandisingIncome.percentChange).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should retrieve data from exactly the specified cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 30 }), // currentCycle
          fc.integer({ min: 31, max: 60 }), // comparisonCycle
          fc.integer({ min: 61, max: 90 }), // noiseCycle (should not affect comparison)
          fc.record({
            userId: fc.integer({ min: 1, max: 5 }),
            currentMerchandising: fc.integer({ min: 1000, max: 5000 }),
            comparisonMerchandising: fc.integer({ min: 2000, max: 6000 }),
            noiseMerchandising: fc.integer({ min: 3000, max: 7000 }),
          }),
          async (currentCycle, comparisonCycle, noiseCycle, data) => {
            // Clear any existing data
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle, noiseCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle, noiseCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);
            clearSequenceCache(noiseCycle);

            // Create noise cycle (should not affect comparison)
            await eventLogger.logCycleStart(noiseCycle, 'manual');
            await eventLogger.logPassiveIncome(
              noiseCycle,
              data.userId,
              data.noiseMerchandising,
              0,
              5,
              1000,
              50,
              200
            );
            await eventLogger.logCycleComplete(noiseCycle, 1000);
            await cycleSnapshotService.createSnapshot(noiseCycle);

            // Create comparison cycle
            await eventLogger.logCycleStart(comparisonCycle, 'manual');
            await eventLogger.logPassiveIncome(
              comparisonCycle,
              data.userId,
              data.comparisonMerchandising,
              0,
              5,
              1000,
              50,
              200
            );
            await eventLogger.logCycleComplete(comparisonCycle, 1000);
            await cycleSnapshotService.createSnapshot(comparisonCycle);

            // Create current cycle
            await eventLogger.logCycleStart(currentCycle, 'manual');
            await eventLogger.logPassiveIncome(
              currentCycle,
              data.userId,
              data.currentMerchandising,
              0,
              5,
              1000,
              50,
              200
            );
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison
            const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle);

            // Property: Comparison should use data from exactly the specified cycles
            const stableComp = comparison.stableComparisons.find(s => s.userId === data.userId);
            expect(stableComp).toBeDefined();

            // Verify current value matches current cycle (not noise cycle)
            expect(stableComp!.merchandisingIncome.current).toBe(data.currentMerchandising);
            expect(stableComp!.merchandisingIncome.current).not.toBe(data.noiseMerchandising);

            // Verify comparison value matches comparison cycle (not noise cycle)
            expect(stableComp!.merchandisingIncome.comparison).toBe(data.comparisonMerchandising);
            expect(stableComp!.merchandisingIncome.comparison).not.toBe(data.noiseMerchandising);

            // Verify delta is calculated from the correct cycles
            const expectedDelta = data.currentMerchandising - data.comparisonMerchandising;
            expect(stableComp!.merchandisingIncome.delta).toBe(expectedDelta);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate robot metric comparisons correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle
          fc.integer({ min: 51, max: 100 }), // comparisonCycle
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 3 }),
              robot1Id: fc.integer({ min: 1, max: 10 }),
              robot2Id: fc.integer({ min: 11, max: 20 }),
              currentDamageDealt: fc.integer({ min: 100, max: 1000 }),
              comparisonDamageDealt: fc.integer({ min: 100, max: 1000 }),
              currentELOChange: fc.integer({ min: -50, max: 50 }),
              comparisonELOChange: fc.integer({ min: -50, max: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (currentCycle, comparisonCycle, battleData) => {
            // Clear any existing data
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.battle.deleteMany({});
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create comparison cycle battles
            await eventLogger.logCycleStart(comparisonCycle, 'manual');
            await new Promise(resolve => setTimeout(resolve, 10));
            
            for (const battle of battleData) {
              const user = await ensureTestUser(battle.userId);
              const robot1 = await ensureTestRobot(battle.robot1Id, battle.userId);
              const robot2 = await ensureTestRobot(battle.robot2Id, battle.userId);
              
              await prisma.battle.create({
                data: {
                  user: { connect: { id: user.id } },
                  robot1: { connect: { id: robot1.id } },
                  robot2: { connect: { id: robot2.id } },
                  winnerId: robot1.id,
                  robot1ELOBefore: 1500,
                  robot1ELOAfter: 1500 + battle.comparisonELOChange,
                  robot2ELOBefore: 1500,
                  robot2ELOAfter: 1500 - battle.comparisonELOChange,
                  eloChange: Math.abs(battle.comparisonELOChange),
                  robot1DamageDealt: battle.comparisonDamageDealt,
                  robot2DamageDealt: 300,
                  robot1FinalHP: 70,
                  robot2FinalHP: 0,
                  robot1FinalShield: 0,
                  robot2FinalShield: 0,
                  winnerReward: 1000,
                  loserReward: 500,
                  robot1PrestigeAwarded: 10,
                  robot2PrestigeAwarded: 5,
                  robot1FameAwarded: 10,
                  robot2FameAwarded: 5,
                  robot1RepairCost: 100,
                  robot2RepairCost: 200,
                  battleLog: {},
                  durationSeconds: 60,
                  battleType: 'league',
                  leagueType: 'bronze',
                  robot1Yielded: false,
                  robot2Yielded: false,
                  robot1Destroyed: false,
                  robot2Destroyed: false,
                },
              });
            }
            
            await eventLogger.logCycleComplete(comparisonCycle, 1000);
            await cycleSnapshotService.createSnapshot(comparisonCycle);

            // Create current cycle battles
            await eventLogger.logCycleStart(currentCycle, 'manual');
            await new Promise(resolve => setTimeout(resolve, 10));
            
            for (const battle of battleData) {
              const user = await ensureTestUser(battle.userId);
              const robot1 = await ensureTestRobot(battle.robot1Id, battle.userId);
              const robot2 = await ensureTestRobot(battle.robot2Id, battle.userId);
              
              await prisma.battle.create({
                data: {
                  user: { connect: { id: user.id } },
                  robot1: { connect: { id: robot1.id } },
                  robot2: { connect: { id: robot2.id } },
                  winnerId: robot1.id,
                  robot1ELOBefore: 1500,
                  robot1ELOAfter: 1500 + battle.currentELOChange,
                  robot2ELOBefore: 1500,
                  robot2ELOAfter: 1500 - battle.currentELOChange,
                  eloChange: Math.abs(battle.currentELOChange),
                  robot1DamageDealt: battle.currentDamageDealt,
                  robot2DamageDealt: 300,
                  robot1FinalHP: 70,
                  robot2FinalHP: 0,
                  robot1FinalShield: 0,
                  robot2FinalShield: 0,
                  winnerReward: 1000,
                  loserReward: 500,
                  robot1PrestigeAwarded: 10,
                  robot2PrestigeAwarded: 5,
                  robot1FameAwarded: 10,
                  robot2FameAwarded: 5,
                  robot1RepairCost: 100,
                  robot2RepairCost: 200,
                  battleLog: {},
                  durationSeconds: 60,
                  battleType: 'league',
                  leagueType: 'bronze',
                  robot1Yielded: false,
                  robot2Yielded: false,
                  robot1Destroyed: false,
                  robot2Destroyed: false,
                },
              });
            }
            
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison
            const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle);

            // Property: Robot metric deltas should be calculated correctly
            // Aggregate expected values by robot (since snapshots aggregate)
            const aggregatedByRobot = new Map<number, {
              currentDamageDealt: number;
              comparisonDamageDealt: number;
              currentELOChange: number;
              comparisonELOChange: number;
            }>();

            for (const battle of battleData) {
              const robot1 = await ensureTestRobot(battle.robot1Id, battle.userId);
              
              if (!aggregatedByRobot.has(robot1.id)) {
                aggregatedByRobot.set(robot1.id, {
                  currentDamageDealt: 0,
                  comparisonDamageDealt: 0,
                  currentELOChange: 0,
                  comparisonELOChange: 0,
                });
              }
              const agg = aggregatedByRobot.get(robot1.id)!;
              agg.currentDamageDealt += battle.currentDamageDealt;
              agg.comparisonDamageDealt += battle.comparisonDamageDealt;
              agg.currentELOChange += battle.currentELOChange;
              agg.comparisonELOChange += battle.comparisonELOChange;
            }

            for (const [robotId, expected] of aggregatedByRobot) {
              const robotComp = comparison.robotComparisons.find(r => r.robotId === robotId);
              
              if (robotComp) {
                // Calculate expected deltas
                const expectedDamageDelta = expected.currentDamageDealt - expected.comparisonDamageDealt;
                const expectedELODelta = expected.currentELOChange - expected.comparisonELOChange;

                // Verify deltas
                expect(robotComp.damageDealt.delta).toBe(expectedDamageDelta);
                expect(robotComp.eloChange.delta).toBe(expectedELODelta);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Insufficient Data Handling
   * 
   * **Validates: Requirements 6.4**
   * 
   * For any comparison request where the requested historical cycle does not exist, 
   * the Analytics Engine should return a response indicating which specific comparisons 
   * are unavailable rather than failing entirely.
   */
  describe('Property 17: Insufficient Data Handling', () => {
    it('should return unavailableMetrics when comparison cycle does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle (exists)
          fc.integer({ min: 51, max: 100 }), // comparisonCycle (does not exist)
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 5 }),
              currentMerchandising: fc.integer({ min: 0, max: 10000 }),
              currentStreaming: fc.integer({ min: 0, max: 5000 }),
              currentOperatingCosts: fc.integer({ min: 0, max: 3000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (currentCycle, comparisonCycle, userData) => {
            // Clear any existing data for these cycles
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create ONLY current cycle snapshot (comparison cycle does not exist)
            await eventLogger.logCycleStart(currentCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                currentCycle,
                data.userId,
                data.currentMerchandising,
                data.currentStreaming,
                5,
                1000,
                50,
                200
              );
              await eventLogger.logOperatingCosts(
                currentCycle,
                data.userId,
                [{ facilityType: 'training_academy', level: 1, cost: data.currentOperatingCosts }],
                data.currentOperatingCosts
              );
            }
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison (comparison cycle does not exist)
            const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle);

            // Property: Should return unavailableMetrics indicator instead of failing
            expect(comparison.currentCycle).toBe(currentCycle);
            expect(comparison.comparisonCycle).toBe(comparisonCycle);
            expect(comparison.unavailableMetrics).toBeDefined();
            expect(comparison.unavailableMetrics).toContain('all');
            
            // Should return empty arrays for comparisons since comparison data is unavailable
            expect(comparison.stableComparisons).toEqual([]);
            expect(comparison.robotComparisons).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not fail when current cycle exists but comparison cycle does not', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle (exists)
          fc.integer({ min: 51, max: 100 }), // comparisonCycle (does not exist)
          fc.record({
            userId: fc.integer({ min: 1, max: 5 }),
            currentMerchandising: fc.integer({ min: 100, max: 10000 }),
            currentStreaming: fc.integer({ min: 100, max: 5000 }),
          }),
          async (currentCycle, comparisonCycle, data) => {
            // Clear any existing data for these cycles
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create ONLY current cycle snapshot
            await eventLogger.logCycleStart(currentCycle, 'manual');
            await eventLogger.logPassiveIncome(
              currentCycle,
              data.userId,
              data.currentMerchandising,
              data.currentStreaming,
              5,
              1000,
              50,
              200
            );
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Property: Should not throw an error when comparison cycle is missing
            let didThrow = false;
            let result;
            
            try {
              result = await comparisonService.compareCycles(currentCycle, comparisonCycle);
            } catch (error) {
              didThrow = true;
            }

            // Should not throw - should return gracefully with unavailableMetrics
            expect(didThrow).toBe(false);
            expect(result).toBeDefined();
            expect(result!.unavailableMetrics).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should indicate specific unavailable metrics when comparison snapshot is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle
          fc.integer({ min: 51, max: 100 }), // comparisonCycle (missing)
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 3 }),
              currentMerchandising: fc.integer({ min: 0, max: 10000 }),
              currentStreaming: fc.integer({ min: 0, max: 5000 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (currentCycle, comparisonCycle, userData) => {
            // Clear any existing data
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create only current cycle
            await eventLogger.logCycleStart(currentCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                currentCycle,
                data.userId,
                data.currentMerchandising,
                data.currentStreaming,
                5,
                1000,
                50,
                200
              );
            }
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison
            const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle);

            // Property: Should indicate which comparisons are unavailable
            expect(comparison.unavailableMetrics).toBeDefined();
            expect(Array.isArray(comparison.unavailableMetrics)).toBe(true);
            expect(comparison.unavailableMetrics!.length).toBeGreaterThan(0);
            
            // Should indicate all metrics are unavailable when comparison cycle is missing
            expect(comparison.unavailableMetrics).toContain('all');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing comparison cycle for multiple users gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // currentCycle
          fc.integer({ min: 51, max: 100 }), // comparisonCycle (missing)
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 10 }),
              currentMerchandising: fc.integer({ min: 0, max: 10000 }),
              currentStreaming: fc.integer({ min: 0, max: 5000 }),
              currentOperatingCosts: fc.integer({ min: 0, max: 3000 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (currentCycle, comparisonCycle, userData) => {
            // Clear any existing data
            await prisma.cycleSnapshot.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            await prisma.auditLog.deleteMany({
              where: {
                cycleNumber: { in: [currentCycle, comparisonCycle] }
              }
            });
            clearSequenceCache(currentCycle);
            clearSequenceCache(comparisonCycle);

            // Create current cycle with multiple users
            await eventLogger.logCycleStart(currentCycle, 'manual');
            for (const data of userData) {
              await eventLogger.logPassiveIncome(
                currentCycle,
                data.userId,
                data.currentMerchandising,
                data.currentStreaming,
                5,
                1000,
                50,
                200
              );
              await eventLogger.logOperatingCosts(
                currentCycle,
                data.userId,
                [{ facilityType: 'training_academy', level: 1, cost: data.currentOperatingCosts }],
                data.currentOperatingCosts
              );
            }
            await eventLogger.logCycleComplete(currentCycle, 1000);
            await cycleSnapshotService.createSnapshot(currentCycle);

            // Perform comparison for each user
            const uniqueUserIds = [...new Set(userData.map(d => d.userId))];
            
            for (const userId of uniqueUserIds) {
              const comparison = await comparisonService.compareCycles(currentCycle, comparisonCycle, userId);

              // Property: Should handle missing data gracefully for each user
              expect(comparison.unavailableMetrics).toBeDefined();
              expect(comparison.unavailableMetrics).toContain('all');
              expect(comparison.stableComparisons).toEqual([]);
              expect(comparison.robotComparisons).toEqual([]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
