/**
 * Property-Based Tests for CycleSnapshotService
 * 
 * Tests universal properties that should hold across all valid inputs
 * Uses fast-check for property-based testing
 */

import { PrismaClient } from '@prisma/client';
import fc from 'fast-check';
import { EventLogger, EventType, clearSequenceCache } from '../src/services/eventLogger';
import { CycleSnapshotService } from '../src/services/cycleSnapshotService';

const prisma = new PrismaClient();
const eventLogger = new EventLogger();
const cycleSnapshotService = new CycleSnapshotService();

// Test data setup helpers
let testUsers: Map<number, any> = new Map();
let testRobots: Map<number, any> = new Map();
let robotIdMapping: Map<number, number> = new Map(); // Maps test robot ID to actual DB robot ID

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
      // Create a basic weapon for testing
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
    robotIdMapping.set(robotId, robot.id); // Track the mapping
  }
  return testRobots.get(robotId);
}

describe('CycleSnapshotService Property-Based Tests', () => {
  beforeEach(async () => {
    // Clean up before each test (order matters due to foreign keys)
    await prisma.cycleSnapshot.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});
    // Don't delete weapons - they're seed data
    
    // Clear test data caches
    testUsers.clear();
    testRobots.clear();
    robotIdMapping.clear();
    
    // Clear sequence cache
    for (let i = 1; i <= 100; i++) {
      clearSequenceCache(i);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 4: Cycle Snapshot Consistency
   * 
   * **Validates: Requirements 10.1, 10.5**
   * 
   * For any completed cycle, the cycle snapshot's aggregated metrics should match 
   * the sum of individual event values from the audit log for that cycle.
   */
  describe('Property 4: Cycle Snapshot Consistency', () => {
    it('should aggregate stable metrics correctly from audit log events', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 10 }),
              merchandising: fc.integer({ min: 0, max: 5000 }),
              streaming: fc.integer({ min: 0, max: 3000 }),
              operatingCosts: fc.integer({ min: 0, max: 2000 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (cycleNumber, userIncomeData) => {
            // Clear any existing data for this cycle
            await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber } });
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            await prisma.battle.deleteMany({});
            clearSequenceCache(cycleNumber);

            // Log cycle start and end events
            const cycleStartTime = new Date();
            await eventLogger.logCycleStart(cycleNumber, 'manual');
            
            // Log passive income and operating costs for each user
            for (const data of userIncomeData) {
              await eventLogger.logPassiveIncome(
                cycleNumber,
                data.userId,
                data.merchandising,
                data.streaming,
                5, // facilityLevel
                1000, // prestige
                50, // totalBattles
                200 // totalFame
              );
              
              await eventLogger.logOperatingCosts(
                cycleNumber,
                data.userId,
                [{ facilityType: 'training_academy', level: 1, cost: data.operatingCosts }],
                data.operatingCosts
              );
            }
            
            // Log cycle complete
            const cycleEndTime = new Date();
            const duration = cycleEndTime.getTime() - cycleStartTime.getTime();
            await eventLogger.logCycleComplete(cycleNumber, duration);

            // Create snapshot
            const snapshot = await cycleSnapshotService.createSnapshot(cycleNumber);

            // Verify snapshot consistency
            expect(snapshot).toBeDefined();
            expect(snapshot.cycleNumber).toBe(cycleNumber);

            // Group user data by userId to calculate expected values
            const expectedMetrics = new Map<number, {
              merchandising: number;
              streaming: number;
              operatingCosts: number;
              netProfit: number;
            }>();

            for (const data of userIncomeData) {
              if (!expectedMetrics.has(data.userId)) {
                expectedMetrics.set(data.userId, {
                  merchandising: 0,
                  streaming: 0,
                  operatingCosts: 0,
                  netProfit: 0,
                });
              }
              const metrics = expectedMetrics.get(data.userId)!;
              metrics.merchandising += data.merchandising;
              metrics.streaming += data.streaming;
              metrics.operatingCosts += data.operatingCosts;
              metrics.netProfit += data.merchandising + data.streaming - data.operatingCosts;
            }

            // Property: Snapshot stable metrics should match aggregated event data
            for (const [userId, expected] of expectedMetrics) {
              const stableMetric = snapshot.stableMetrics.find(m => m.userId === userId);
              expect(stableMetric).toBeDefined();
              
              expect(stableMetric!.merchandisingIncome).toBe(expected.merchandising);
              expect(stableMetric!.streamingIncome).toBe(expected.streaming);
              expect(stableMetric!.operatingCosts).toBe(expected.operatingCosts);
              expect(stableMetric!.netProfit).toBe(expected.netProfit);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should aggregate robot metrics correctly from battle data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              robot1Id: fc.integer({ min: 1, max: 20 }),
              robot2Id: fc.integer({ min: 21, max: 40 }), // Ensure different from robot1
              userId: fc.integer({ min: 1, max: 10 }),
              robot1DamageDealt: fc.integer({ min: 0, max: 1000 }),
              robot2DamageDealt: fc.integer({ min: 0, max: 1000 }),
              robot1ELOBefore: fc.integer({ min: 1000, max: 2000 }),
              robot1ELOChange: fc.integer({ min: -50, max: 50 }),
              robot2ELOBefore: fc.integer({ min: 1000, max: 2000 }),
              robot2ELOChange: fc.integer({ min: -50, max: 50 }),
              robot1FameAwarded: fc.integer({ min: 0, max: 100 }),
              robot2FameAwarded: fc.integer({ min: 0, max: 100 }),
              winnerIndex: fc.integer({ min: 0, max: 2 }), // 0=robot1, 1=robot2, 2=draw
              winnerReward: fc.integer({ min: 100, max: 1000 }),
              loserReward: fc.integer({ min: 50, max: 500 }),
              robot1RepairCost: fc.integer({ min: 0, max: 500 }),
              robot2RepairCost: fc.integer({ min: 0, max: 500 }),
              robot1PrestigeAwarded: fc.integer({ min: 0, max: 50 }),
              robot2PrestigeAwarded: fc.integer({ min: 0, max: 50 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (cycleNumber, battles) => {
            // Clear any existing data for this cycle
            await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber } });
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            await prisma.battle.deleteMany({});
            clearSequenceCache(cycleNumber);

            // Log cycle start
            const cycleStartTime = new Date();
            await eventLogger.logCycleStart(cycleNumber, 'manual');

            // Small delay to ensure battles are created after cycle start
            await new Promise(resolve => setTimeout(resolve, 10));

            // Create battles in database
            const createdBattles = [];
            for (const battle of battles) {
              // Ensure user and robots exist
              const user = await ensureTestUser(battle.userId);
              const robot1 = await ensureTestRobot(battle.robot1Id, battle.userId);
              const robot2 = await ensureTestRobot(battle.robot2Id, battle.userId);
              
              const winnerId = battle.winnerIndex === 0 ? robot1.id : 
                              battle.winnerIndex === 1 ? robot2.id : null;
              
              const createdBattle = await prisma.battle.create({
                data: {
                  user: { connect: { id: user.id } },
                  robot1: { connect: { id: robot1.id } },
                  robot2: { connect: { id: robot2.id } },
                  winnerId,
                  robot1ELOBefore: battle.robot1ELOBefore,
                  robot1ELOAfter: battle.robot1ELOBefore + battle.robot1ELOChange,
                  robot2ELOBefore: battle.robot2ELOBefore,
                  robot2ELOAfter: battle.robot2ELOBefore + battle.robot2ELOChange,
                  eloChange: Math.abs(battle.robot1ELOChange),
                  robot1DamageDealt: battle.robot1DamageDealt,
                  robot2DamageDealt: battle.robot2DamageDealt,
                  robot1FinalHP: 100 - battle.robot2DamageDealt,
                  robot2FinalHP: 100 - battle.robot1DamageDealt,
                  robot1FinalShield: 0,
                  robot2FinalShield: 0,
                  winnerReward: battle.winnerReward,
                  loserReward: battle.loserReward,
                  robot1PrestigeAwarded: battle.robot1PrestigeAwarded,
                  robot2PrestigeAwarded: battle.robot2PrestigeAwarded,
                  robot1FameAwarded: battle.robot1FameAwarded,
                  robot2FameAwarded: battle.robot2FameAwarded,
                  robot1RepairCost: battle.robot1RepairCost,
                  robot2RepairCost: battle.robot2RepairCost,
                  battleLog: {},
                  durationSeconds: 60,
                  battleType: 'league',
                  leagueType: 'bronze',
                  robot1Yielded: false,
                  robot2Yielded: false,
                  robot1Destroyed: false,
                  robot2Destroyed: false,
                  // Don't set createdAt - let it default to now()
                },
              });
              createdBattles.push(createdBattle);
            }

            // Log cycle complete
            const cycleEndTime = new Date();
            const duration = cycleEndTime.getTime() - cycleStartTime.getTime();
            await eventLogger.logCycleComplete(cycleNumber, duration);

            // Create snapshot
            const snapshot = await cycleSnapshotService.createSnapshot(cycleNumber);

            // Calculate expected robot metrics
            const expectedRobotMetrics = new Map<number, {
              battlesParticipated: number;
              wins: number;
              losses: number;
              draws: number;
              damageDealt: number;
              damageReceived: number;
              creditsEarned: number;
              eloChange: number;
              fameChange: number;
            }>();

            const initMetric = () => ({
              battlesParticipated: 0,
              wins: 0,
              losses: 0,
              draws: 0,
              damageDealt: 0,
              damageReceived: 0,
              creditsEarned: 0,
              eloChange: 0,
              fameChange: 0,
            });

            for (const createdBattle of createdBattles) {
              // Robot 1 metrics
              if (!expectedRobotMetrics.has(createdBattle.robot1Id)) {
                expectedRobotMetrics.set(createdBattle.robot1Id, initMetric());
              }
              const robot1Metric = expectedRobotMetrics.get(createdBattle.robot1Id)!;
              robot1Metric.battlesParticipated++;
              robot1Metric.damageDealt += createdBattle.robot1DamageDealt;
              robot1Metric.damageReceived += createdBattle.robot2DamageDealt;
              robot1Metric.eloChange += createdBattle.robot1ELOAfter - createdBattle.robot1ELOBefore;
              robot1Metric.fameChange += createdBattle.robot1FameAwarded;
              
              if (createdBattle.winnerId === createdBattle.robot1Id) {
                robot1Metric.wins++;
                robot1Metric.creditsEarned += createdBattle.winnerReward || 0;
              } else if (createdBattle.winnerId === null) {
                robot1Metric.draws++;
                robot1Metric.creditsEarned += createdBattle.loserReward || 0;
              } else {
                robot1Metric.losses++;
                robot1Metric.creditsEarned += createdBattle.loserReward || 0;
              }

              // Robot 2 metrics
              if (!expectedRobotMetrics.has(createdBattle.robot2Id)) {
                expectedRobotMetrics.set(createdBattle.robot2Id, initMetric());
              }
              const robot2Metric = expectedRobotMetrics.get(createdBattle.robot2Id)!;
              robot2Metric.battlesParticipated++;
              robot2Metric.damageDealt += createdBattle.robot2DamageDealt;
              robot2Metric.damageReceived += createdBattle.robot1DamageDealt;
              robot2Metric.eloChange += createdBattle.robot2ELOAfter - createdBattle.robot2ELOBefore;
              robot2Metric.fameChange += createdBattle.robot2FameAwarded;
              
              if (createdBattle.winnerId === createdBattle.robot2Id) {
                robot2Metric.wins++;
                robot2Metric.creditsEarned += createdBattle.winnerReward || 0;
              } else if (createdBattle.winnerId === null) {
                robot2Metric.draws++;
                robot2Metric.creditsEarned += createdBattle.loserReward || 0;
              } else {
                robot2Metric.losses++;
                robot2Metric.creditsEarned += createdBattle.loserReward || 0;
              }
            }

            // Property: Snapshot robot metrics should match aggregated battle data
            for (const [robotId, expected] of expectedRobotMetrics) {
              const robotMetric = snapshot.robotMetrics.find(m => m.robotId === robotId);
              expect(robotMetric).toBeDefined();
              
              expect(robotMetric!.battlesParticipated).toBe(expected.battlesParticipated);
              expect(robotMetric!.wins).toBe(expected.wins);
              expect(robotMetric!.losses).toBe(expected.losses);
              expect(robotMetric!.draws).toBe(expected.draws);
              expect(robotMetric!.damageDealt).toBe(expected.damageDealt);
              expect(robotMetric!.damageReceived).toBe(expected.damageReceived);
              expect(robotMetric!.creditsEarned).toBe(expected.creditsEarned);
              expect(robotMetric!.eloChange).toBe(expected.eloChange);
              expect(robotMetric!.fameChange).toBe(expected.fameChange);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should aggregate step durations correctly from cycle step events', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              stepName: fc.constantFrom(
                'repair_robots',
                'execute_battles',
                'process_tournaments',
                'calculate_income',
                'apply_costs',
                'update_leagues',
                'refresh_matchmaking',
                'cleanup'
              ),
              duration: fc.integer({ min: 100, max: 5000 }),
            }),
            { minLength: 3, maxLength: 8 }
          ),
          async (cycleNumber, steps) => {
            // Clear any existing data for this cycle
            await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber } });
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            await prisma.battle.deleteMany({});
            clearSequenceCache(cycleNumber);

            // Log cycle start
            const cycleStartTime = new Date();
            await eventLogger.logCycleStart(cycleNumber, 'manual');

            // Log step completions
            let stepNumber = 1;
            for (const step of steps) {
              await eventLogger.logCycleStepComplete(
                cycleNumber,
                step.stepName,
                stepNumber++,
                step.duration,
                { status: 'completed' }
              );
            }

            // Log cycle complete
            const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
            await eventLogger.logCycleComplete(cycleNumber, totalDuration);

            // Create snapshot
            const snapshot = await cycleSnapshotService.createSnapshot(cycleNumber);

            // Property: Snapshot step durations should match logged step events
            // The snapshot returns all step events in order, including duplicates
            expect(snapshot.stepDurations.length).toBe(steps.length);

            for (let i = 0; i < steps.length; i++) {
              expect(snapshot.stepDurations[i].stepName).toBe(steps[i].stepName);
              expect(snapshot.stepDurations[i].duration).toBe(steps[i].duration);
            }

            // Property: Sum of step durations should approximately equal total cycle duration
            const sumOfStepDurations = snapshot.stepDurations.reduce((sum, s) => sum + s.duration, 0);
            expect(sumOfStepDurations).toBe(totalDuration);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency between stable metrics and battle data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 5 }),
              robot1Id: fc.integer({ min: 1, max: 10 }),
              robot2Id: fc.integer({ min: 11, max: 20 }),
              winnerReward: fc.integer({ min: 100, max: 1000 }),
              loserReward: fc.integer({ min: 50, max: 500 }),
              robot1RepairCost: fc.integer({ min: 0, max: 300 }),
              robot2RepairCost: fc.integer({ min: 0, max: 300 }),
              robot1PrestigeAwarded: fc.integer({ min: 0, max: 50 }),
              robot2PrestigeAwarded: fc.integer({ min: 0, max: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (cycleNumber, battles) => {
            // Clear any existing data for this cycle
            await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber } });
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            await prisma.battle.deleteMany({});
            clearSequenceCache(cycleNumber);

            // Log cycle start
            const cycleStartTime = new Date();
            await eventLogger.logCycleStart(cycleNumber, 'manual');

            // Small delay to ensure battles are created after cycle start
            await new Promise(resolve => setTimeout(resolve, 10));

            // Create battles
            for (const battle of battles) {
              // Ensure user and robots exist
              const user = await ensureTestUser(battle.userId);
              const robot1 = await ensureTestRobot(battle.robot1Id, battle.userId);
              const robot2 = await ensureTestRobot(battle.robot2Id, battle.userId);
              
              await prisma.battle.create({
                data: {
                  user: { connect: { id: user.id } },
                  robot1: { connect: { id: robot1.id } },
                  robot2: { connect: { id: robot2.id } },
                  winnerId: robot1.id, // Robot 1 always wins for simplicity
                  robot1ELOBefore: 1500,
                  robot1ELOAfter: 1520,
                  robot2ELOBefore: 1500,
                  robot2ELOAfter: 1480,
                  eloChange: 20,
                  robot1DamageDealt: 500,
                  robot2DamageDealt: 300,
                  robot1FinalHP: 70,
                  robot2FinalHP: 0,
                  robot1FinalShield: 0,
                  robot2FinalShield: 0,
                  winnerReward: battle.winnerReward,
                  loserReward: battle.loserReward,
                  robot1PrestigeAwarded: battle.robot1PrestigeAwarded,
                  robot2PrestigeAwarded: battle.robot2PrestigeAwarded,
                  robot1FameAwarded: 10,
                  robot2FameAwarded: 5,
                  robot1RepairCost: battle.robot1RepairCost,
                  robot2RepairCost: battle.robot2RepairCost,
                  battleLog: {},
                  durationSeconds: 60,
                  battleType: 'league',
                  leagueType: 'bronze',
                  robot1Yielded: false,
                  robot2Yielded: false,
                  robot1Destroyed: false,
                  robot2Destroyed: false,
                  // Don't set createdAt - let it default to now()
                },
              });
            }

            // Log cycle complete
            const cycleEndTime = new Date();
            const duration = cycleEndTime.getTime() - cycleStartTime.getTime();
            await eventLogger.logCycleComplete(cycleNumber, duration);

            // Create snapshot
            const snapshot = await cycleSnapshotService.createSnapshot(cycleNumber);

            // Calculate expected stable metrics from battles
            const expectedStableMetrics = new Map<number, {
              battlesParticipated: number;
              totalCreditsEarned: number;
              totalPrestigeEarned: number;
              totalRepairCosts: number;
            }>();

            // Get actual user IDs from created battles
            const actualUserIds = new Set<number>();
            const createdBattlesFromDB = await prisma.battle.findMany({
              where: {
                createdAt: {
                  gte: await cycleSnapshotService['getCycleStartTime'](cycleNumber),
                  lte: await cycleSnapshotService['getCycleEndTime'](cycleNumber),
                },
              },
            });

            for (const battle of createdBattlesFromDB) {
              actualUserIds.add(battle.userId);
              
              if (!expectedStableMetrics.has(battle.userId)) {
                expectedStableMetrics.set(battle.userId, {
                  battlesParticipated: 0,
                  totalCreditsEarned: 0,
                  totalPrestigeEarned: 0,
                  totalRepairCosts: 0,
                });
              }
              const metrics = expectedStableMetrics.get(battle.userId)!;
              metrics.battlesParticipated++;
              metrics.totalCreditsEarned += (battle.winnerReward || 0) + (battle.loserReward || 0);
              metrics.totalPrestigeEarned += battle.robot1PrestigeAwarded + battle.robot2PrestigeAwarded;
              metrics.totalRepairCosts += (battle.robot1RepairCost || 0) + (battle.robot2RepairCost || 0);
            }

            // Property: Snapshot stable metrics should match calculated values
            for (const [userId, expected] of expectedStableMetrics) {
              const stableMetric = snapshot.stableMetrics.find(m => m.userId === userId);
              expect(stableMetric).toBeDefined();
              
              expect(stableMetric!.battlesParticipated).toBe(expected.battlesParticipated);
              expect(stableMetric!.totalCreditsEarned).toBe(expected.totalCreditsEarned);
              expect(stableMetric!.totalPrestigeEarned).toBe(expected.totalPrestigeEarned);
              expect(stableMetric!.totalRepairCosts).toBe(expected.totalRepairCosts);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should correctly calculate net profit including passive income and costs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.record({
            userId: fc.integer({ min: 1, max: 10 }),
            merchandising: fc.integer({ min: 0, max: 5000 }),
            streaming: fc.integer({ min: 0, max: 3000 }),
            operatingCosts: fc.integer({ min: 0, max: 2000 }),
            battleCredits: fc.integer({ min: 0, max: 10000 }),
            repairCosts: fc.integer({ min: 0, max: 5000 }),
          }),
          async (cycleNumber, data) => {
            // Clear any existing data for this cycle
            await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber } });
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            await prisma.battle.deleteMany({});
            clearSequenceCache(cycleNumber);

            // Log cycle start
            const cycleStartTime = new Date();
            await eventLogger.logCycleStart(cycleNumber, 'manual');

            // Small delay to ensure battles are created after cycle start
            await new Promise(resolve => setTimeout(resolve, 10));

            // Ensure user and robots exist
            const user = await ensureTestUser(data.userId);
            const robot1 = await ensureTestRobot(1, data.userId);
            const robot2 = await ensureTestRobot(2, data.userId);

            // Create a battle to generate credits and repair costs
            await prisma.battle.create({
              data: {
                user: { connect: { id: user.id } },
                robot1: { connect: { id: robot1.id } },
                robot2: { connect: { id: robot2.id } },
                winnerId: robot1.id,
                robot1ELOBefore: 1500,
                robot1ELOAfter: 1520,
                robot2ELOBefore: 1500,
                robot2ELOAfter: 1480,
                eloChange: 20,
                robot1DamageDealt: 500,
                robot2DamageDealt: 300,
                robot1FinalHP: 70,
                robot2FinalHP: 0,
                robot1FinalShield: 0,
                robot2FinalShield: 0,
                winnerReward: data.battleCredits,
                loserReward: 0,
                robot1PrestigeAwarded: 10,
                robot2PrestigeAwarded: 5,
                robot1FameAwarded: 10,
                robot2FameAwarded: 5,
                robot1RepairCost: data.repairCosts,
                robot2RepairCost: 0,
                battleLog: {},
                durationSeconds: 60,
                battleType: 'league',
                leagueType: 'bronze',
                robot1Yielded: false,
                robot2Yielded: false,
                robot1Destroyed: false,
                robot2Destroyed: false,
                // Don't set createdAt - let it default to now()
              },
            });

            // Small delay before logging passive income/costs
            await new Promise(resolve => setTimeout(resolve, 10));

            // Log passive income
            await eventLogger.logPassiveIncome(
              cycleNumber,
              user.id,
              data.merchandising,
              data.streaming,
              5,
              1000,
              50,
              200
            );

            // Log operating costs
            await eventLogger.logOperatingCosts(
              cycleNumber,
              user.id,
              [{ facilityType: 'training_academy', level: 1, cost: data.operatingCosts }],
              data.operatingCosts
            );

            // Log cycle complete
            const cycleEndTime = new Date();
            const duration = cycleEndTime.getTime() - cycleStartTime.getTime();
            await eventLogger.logCycleComplete(cycleNumber, duration);

            // Create snapshot
            const snapshot = await cycleSnapshotService.createSnapshot(cycleNumber);

            // Calculate expected net profit
            const expectedNetProfit = 
              data.battleCredits +
              data.merchandising +
              data.streaming -
              data.repairCosts -
              data.operatingCosts;

            // Property: Net profit should equal income minus expenses
            const stableMetric = snapshot.stableMetrics.find(m => m.userId === user.id);
            expect(stableMetric).toBeDefined();
            expect(stableMetric!.netProfit).toBe(expectedNetProfit);
            
            // Verify individual components
            expect(stableMetric!.totalCreditsEarned).toBe(data.battleCredits);
            expect(stableMetric!.merchandisingIncome).toBe(data.merchandising);
            expect(stableMetric!.streamingIncome).toBe(data.streaming);
            expect(stableMetric!.totalRepairCosts).toBe(data.repairCosts);
            expect(stableMetric!.operatingCosts).toBe(data.operatingCosts);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cycles with no battles gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // cycleNumber
          fc.array(
            fc.record({
              userId: fc.integer({ min: 1, max: 10 }),
              merchandising: fc.integer({ min: 0, max: 5000 }),
              streaming: fc.integer({ min: 0, max: 3000 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (cycleNumber, users) => {
            // Clear any existing data for this cycle
            await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber } });
            await prisma.auditLog.deleteMany({ where: { cycleNumber } });
            await prisma.battle.deleteMany({});
            clearSequenceCache(cycleNumber);

            // Log cycle start
            await eventLogger.logCycleStart(cycleNumber, 'manual');

            // Log only passive income (no battles)
            for (const user of users) {
              await eventLogger.logPassiveIncome(
                cycleNumber,
                user.userId,
                user.merchandising,
                user.streaming,
                5,
                1000,
                50,
                200
              );
            }

            // Log cycle complete
            await eventLogger.logCycleComplete(cycleNumber, 1000);

            // Create snapshot
            const snapshot = await cycleSnapshotService.createSnapshot(cycleNumber);

            // Property: Snapshot should be created successfully with no battles
            expect(snapshot).toBeDefined();
            expect(snapshot.robotMetrics).toEqual([]);
            
            // Property: Stable metrics should still be calculated correctly
            // Aggregate expected values by userId (in case of duplicates)
            const expectedByUser = new Map<number, { merchandising: number; streaming: number }>();
            for (const user of users) {
              if (!expectedByUser.has(user.userId)) {
                expectedByUser.set(user.userId, { merchandising: 0, streaming: 0 });
              }
              const expected = expectedByUser.get(user.userId)!;
              expected.merchandising += user.merchandising;
              expected.streaming += user.streaming;
            }
            
            for (const [userId, expected] of expectedByUser) {
              const stableMetric = snapshot.stableMetrics.find(m => m.userId === userId);
              expect(stableMetric).toBeDefined();
              expect(stableMetric!.merchandisingIncome).toBe(expected.merchandising);
              expect(stableMetric!.streamingIncome).toBe(expected.streaming);
              expect(stableMetric!.battlesParticipated).toBe(0);
              expect(stableMetric!.totalCreditsEarned).toBe(0);
              expect(stableMetric!.totalRepairCosts).toBe(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
