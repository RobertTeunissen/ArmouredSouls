/**
 * Property-Based Tests for TrendAnalysisService
 * 
 * Tests universal properties that should hold across all valid inputs
 * Uses fast-check for property-based testing
 */

import prisma from '../src/lib/prisma';
import fc from 'fast-check';
import { EventLogger, clearSequenceCache } from '../src/services/eventLogger';
import { CycleSnapshotService } from '../src/services/cycleSnapshotService';
import { trendAnalysisService } from '../src/services/trendAnalysisService';

const eventLogger = new EventLogger();
const cycleSnapshotService = new CycleSnapshotService();

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

describe('TrendAnalysisService Property-Based Tests', () => {
  afterEach(async () => {
    // Clean up after each test in correct dependency order
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
  });

  beforeEach(async () => {
    // Clear test data caches
    // Clear sequence cache
    for (let i = 1; i <= 200; i++) {
      clearSequenceCache(i);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 9: Time-Series Data Completeness
   * 
   * **Validates: Requirements 7.1, 7.3, 12.5**
   * 
   * For any metric and cycle range, the trend data should include data points 
   * for all cycles in the range where the metric changed, with no gaps or duplicates.
   */
  describe('Property 9: Time-Series Data Completeness', () => {
    it('should include data points for all cycles where stable metric changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // startCycle
          fc.integer({ min: 5, max: 15 }), // number of cycles
          fc.integer({ min: 1, max: 5 }), // userId
          async (startCycle, numCycles, userId) => {
            // Generate arrays with exact length needed
            const merchandising = Array.from({ length: numCycles }, () => 
              Math.floor(Math.random() * 10000) + 1 // 1 to 10000
            );
            const streaming = Array.from({ length: numCycles }, () => 
              Math.floor(Math.random() * 5000) + 1 // 1 to 5000
            );
            
            // Clear any existing data for these cycles
            const cycleNumbers = Array.from({ length: numCycles }, (_, i) => startCycle + i);
            await prisma.cycleSnapshot.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            await prisma.auditLog.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            cycleNumbers.forEach(c => clearSequenceCache(c));

            // Create snapshots for each cycle
            const expectedDataPoints: Array<{ cycleNumber: number; value: number }> = [];
            
            for (let i = 0; i < numCycles; i++) {
              const cycleNumber = startCycle + i;
              
              await eventLogger.logCycleStart(cycleNumber, 'manual');
              
              // Log passive income
              await eventLogger.logPassiveIncome(
                cycleNumber,
                userId,
                merchandising[i],
                streaming[i],
                1,
                100,
                10,
                500
              );
              
              await eventLogger.logCycleComplete(cycleNumber, 1000);
              await cycleSnapshotService.createSnapshot(cycleNumber);
              
              // Track expected data point (income = merchandising + streaming)
              expectedDataPoints.push({
                cycleNumber,
                value: merchandising[i] + streaming[i],
              });
            }

            // Get trend data
            const trendData = await trendAnalysisService.analyzeTrend(
              userId,
              null,
              'income',
              [startCycle, startCycle + numCycles - 1],
              false,
              false
            );

            // Property 1: Should have data points for all cycles in range
            expect(trendData.data.length).toBe(numCycles);

            // Property 2: Cycle numbers should be continuous with no gaps
            const cycleNumbersInData = trendData.data.map(d => d.cycleNumber).sort((a, b) => a - b);
            for (let i = 0; i < cycleNumbersInData.length; i++) {
              expect(cycleNumbersInData[i]).toBe(startCycle + i);
            }

            // Property 3: No duplicate cycle numbers
            const uniqueCycles = new Set(cycleNumbersInData);
            expect(uniqueCycles.size).toBe(cycleNumbersInData.length);

            // Property 4: Values should match expected values
            for (let i = 0; i < numCycles; i++) {
              const dataPoint = trendData.data.find(d => d.cycleNumber === startCycle + i);
              expect(dataPoint).toBeDefined();
              expect(dataPoint!.value).toBe(expectedDataPoints[i].value);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should include data points for all cycles where robot metric changed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // startCycle
          fc.integer({ min: 5, max: 10 }), // Reduced from 15 to 10 for performance
          fc.integer({ min: 1, max: 3 }), // userId
          fc.integer({ min: 1, max: 10 }), // robotId
          async (startCycle, numCycles, userId, robotId) => {
            // Generate arrays with exact length needed
            const eloChanges = Array.from({ length: numCycles }, () => {
              const val = Math.floor(Math.random() * 101) - 50; // -50 to 50
              return val === 0 ? 1 : val;
            });
            const damageDealt = Array.from({ length: numCycles }, () => 
              Math.floor(Math.random() * 901) + 100 // 100 to 1000
            );
            
            // Clear any existing data for these cycles
            const cycleNumbers = Array.from({ length: numCycles }, (_, i) => startCycle + i);
            await prisma.cycleSnapshot.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            await prisma.auditLog.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            await prisma.battle.deleteMany({});
            cycleNumbers.forEach(c => clearSequenceCache(c));

            // Ensure test entities exist
            const user = await ensureTestUser(userId);
            const robot1 = await ensureTestRobot(robotId, userId);
            const robot2 = await ensureTestRobot(robotId + 100, userId);

            // Create snapshots for each cycle with battles
            const expectedDataPoints: Array<{ cycleNumber: number; value: number }> = [];
            
            for (let i = 0; i < numCycles; i++) {
              const cycleNumber = startCycle + i;
              
              await eventLogger.logCycleStart(cycleNumber, 'manual');
              
              // Add a small delay to ensure unique timestamps
              await new Promise(resolve => setTimeout(resolve, 10));
              
              // Create a battle for this cycle
              await prisma.battle.create({
                data: {
                  user: { connect: { id: user.id } },
                  robot1: { connect: { id: robot1.id } },
                  robot2: { connect: { id: robot2.id } },
                  winnerId: eloChanges[i] >= 0 ? robot1.id : robot2.id,
                  robot1ELOBefore: 1500,
                  robot1ELOAfter: 1500 + eloChanges[i],
                  robot2ELOBefore: 1500,
                  robot2ELOAfter: 1500 - eloChanges[i],
                  eloChange: Math.abs(eloChanges[i]),
                  robot1DamageDealt: damageDealt[i],
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
              
              await eventLogger.logCycleComplete(cycleNumber, 1000);
              await cycleSnapshotService.createSnapshot(cycleNumber);
              
              // Track expected data point
              expectedDataPoints.push({
                cycleNumber,
                value: eloChanges[i],
              });
            }

            // Get trend data for ELO
            const trendData = await trendAnalysisService.analyzeTrend(
              null,
              robot1.id,
              'elo',
              [startCycle, startCycle + numCycles - 1],
              false,
              false
            );

            // Property 1: Should have data points for all cycles in range
            expect(trendData.data.length).toBe(numCycles);

            // Property 2: Cycle numbers should be continuous with no gaps
            const cycleNumbersInData = trendData.data.map(d => d.cycleNumber).sort((a, b) => a - b);
            for (let i = 0; i < cycleNumbersInData.length; i++) {
              expect(cycleNumbersInData[i]).toBe(startCycle + i);
            }

            // Property 3: No duplicate cycle numbers
            const uniqueCycles = new Set(cycleNumbersInData);
            expect(uniqueCycles.size).toBe(cycleNumbersInData.length);

            // Property 4: Values should match expected values
            for (let i = 0; i < numCycles; i++) {
              const dataPoint = trendData.data.find(d => d.cycleNumber === startCycle + i);
              expect(dataPoint).toBeDefined();
              expect(dataPoint!.value).toBe(expectedDataPoints[i].value);
            }
          }
        ),
        { numRuns: 20, timeout: 60000 } // Reduced runs and increased timeout for performance
      );
    });

    it('should handle cycles with no activity (zero values) correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // startCycle
          fc.integer({ min: 5, max: 10 }), // number of cycles
          fc.record({
            userId: fc.integer({ min: 1, max: 5 }),
            activeCycleIndices: fc.array(
              fc.integer({ min: 0, max: 9 }),
              { minLength: 2, maxLength: 5 }
            ),
            merchandisingValues: fc.array(
              fc.integer({ min: 100, max: 5000 }),
              { minLength: 2, maxLength: 5 }
            ),
          }),
          async (startCycle, numCycles, data) => {
            // Ensure unique active cycle indices that are within range
            const activeCycles = [...new Set(data.activeCycleIndices)]
              .filter(i => i >= 0 && i < numCycles) // Ensure indices are valid
              .sort((a, b) => a - b);
            
            if (activeCycles.length === 0) {
              // Skip if no active cycles
              return;
            }
            
            // Clear any existing data for these cycles
            const cycleNumbers = Array.from({ length: numCycles }, (_, i) => startCycle + i);
            await prisma.cycleSnapshot.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            await prisma.auditLog.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            cycleNumbers.forEach(c => clearSequenceCache(c));

            // Create snapshots for each cycle
            for (let i = 0; i < numCycles; i++) {
              const cycleNumber = startCycle + i;
              const isActiveCycle = activeCycles.includes(i);
              
              await eventLogger.logCycleStart(cycleNumber, 'manual');
              
              if (isActiveCycle) {
                // Log passive income for active cycles
                const valueIndex = activeCycles.indexOf(i);
                const merchandising = data.merchandisingValues[valueIndex] || 100;
                
                await eventLogger.logPassiveIncome(
                  cycleNumber,
                  data.userId,
                  merchandising,
                  0,
                  1,
                  100,
                  10,
                  500
                );
              }
              
              await eventLogger.logCycleComplete(cycleNumber, 1000);
              await cycleSnapshotService.createSnapshot(cycleNumber);
            }

            // Get trend data
            const trendData = await trendAnalysisService.analyzeTrend(
              data.userId,
              null,
              'income',
              [startCycle, startCycle + numCycles - 1],
              false,
              false
            );

            // Property 1: Should include data points for cycles with activity
            // Note: The service only returns data points where the user has activity
            expect(trendData.data.length).toBe(activeCycles.length);

            // Property 2: All returned cycle numbers should be in the active cycles
            const cycleNumbersInData = trendData.data.map(d => d.cycleNumber);
            for (const cycleNum of cycleNumbersInData) {
              const cycleIndex = cycleNum - startCycle;
              expect(activeCycles).toContain(cycleIndex);
            }

            // Property 3: No duplicate cycle numbers
            const uniqueCycles = new Set(cycleNumbersInData);
            expect(uniqueCycles.size).toBe(cycleNumbersInData.length);

            // Property 4: Data points should be in chronological order
            for (let i = 1; i < trendData.data.length; i++) {
              expect(trendData.data[i].cycleNumber).toBeGreaterThan(trendData.data[i - 1].cycleNumber);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should return empty array when user has no activity in any cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // startCycle
          fc.integer({ min: 3, max: 8 }), // number of cycles
          fc.integer({ min: 1, max: 5 }), // userId with no activity
          async (startCycle, numCycles, userId) => {
            // Clear any existing data for these cycles
            const cycleNumbers = Array.from({ length: numCycles }, (_, i) => startCycle + i);
            await prisma.cycleSnapshot.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            await prisma.auditLog.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            cycleNumbers.forEach(c => clearSequenceCache(c));

            // Create snapshots with no activity for this user
            for (let i = 0; i < numCycles; i++) {
              const cycleNumber = startCycle + i;
              
              await eventLogger.logCycleStart(cycleNumber, 'manual');
              await eventLogger.logCycleComplete(cycleNumber, 1000);
              await cycleSnapshotService.createSnapshot(cycleNumber);
            }

            // Get trend data
            const trendData = await trendAnalysisService.analyzeTrend(
              userId,
              null,
              'income',
              [startCycle, startCycle + numCycles - 1],
              false,
              false
            );

            // Property: Should return empty array when no activity
            expect(trendData.data).toEqual([]);
            expect(trendData.cycleRange).toEqual([startCycle, startCycle + numCycles - 1]);
            expect(trendData.metric).toBe('income');
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should maintain chronological order of data points', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // startCycle
          fc.integer({ min: 5, max: 12 }), // number of cycles
          fc.record({
            userId: fc.integer({ min: 1, max: 5 }),
            values: fc.array(
              fc.integer({ min: 1, max: 10000 }), // Avoid 0 to prevent issues
              { minLength: 5, maxLength: 12 }
            ),
          }),
          async (startCycle, numCycles, data) => {
            const values = data.values.slice(0, numCycles);
            
            // Clear any existing data for these cycles
            const cycleNumbers = Array.from({ length: numCycles }, (_, i) => startCycle + i);
            await prisma.cycleSnapshot.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            await prisma.auditLog.deleteMany({
              where: { cycleNumber: { in: cycleNumbers } }
            });
            cycleNumbers.forEach(c => clearSequenceCache(c));

            // Create snapshots in random order to test ordering
            const shuffledIndices = Array.from({ length: numCycles }, (_, i) => i)
              .sort(() => Math.random() - 0.5);
            
            for (const i of shuffledIndices) {
              const cycleNumber = startCycle + i;
              
              await eventLogger.logCycleStart(cycleNumber, 'manual');
              
              await eventLogger.logPassiveIncome(
                cycleNumber,
                data.userId,
                values[i],
                0,
                1,
                100,
                10,
                500
              );
              
              await eventLogger.logCycleComplete(cycleNumber, 1000);
              await cycleSnapshotService.createSnapshot(cycleNumber);
            }

            // Get trend data
            const trendData = await trendAnalysisService.analyzeTrend(
              data.userId,
              null,
              'income',
              [startCycle, startCycle + numCycles - 1],
              false,
              false
            );

            // Property: Data points should be in chronological order
            for (let i = 1; i < trendData.data.length; i++) {
              expect(trendData.data[i].cycleNumber).toBeGreaterThan(trendData.data[i - 1].cycleNumber);
              // Note: Timestamps may not be strictly ordered if snapshots were created out of order
              // but cycle numbers should always be ordered
            }
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});
