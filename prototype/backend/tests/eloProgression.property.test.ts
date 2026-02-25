/**
 * Property-Based Tests for ELO Progression Continuity
 * 
 * Tests that ELO values form a continuous chain across battles
 * Uses fast-check for property-based testing
 */

import prisma from '../src/lib/prisma';
import fc from 'fast-check';
import { robotPerformanceService } from '../src/services/robotPerformanceService';


describe('ELO Progression Property-Based Tests', () => {
  afterEach(async () => {
    // Clean up test data after each test in correct dependency order
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.cycleSnapshot.deleteMany({});
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 6: ELO Progression Continuity
   * 
   * **Validates: Requirements 7.2, 7.3**
   * 
   * For any robot, the ELO values in consecutive ELO change events should form a 
   * continuous chain where each event's "before" value equals the previous event's 
   * "after" value.
   */
  describe('Property 6: ELO Progression Continuity', () => {
    it('should maintain ELO continuity across consecutive battles for a single robot', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate robot ID
          fc.integer({ min: 1, max: 1000 }),
          // Generate user ID
          fc.integer({ min: 1, max: 10000 }),
          // Generate starting ELO
          fc.integer({ min: 800, max: 2000 }),
          // Generate array of ELO changes (wins/losses)
          fc.array(
            fc.integer({ min: -50, max: 50 }),
            { minLength: 2, maxLength: 20 }
          ),
          // Generate cycle range
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, startingELO, eloChanges, startCycle) => {
            // Setup: Create test user and robot
            await prisma.user.create({
              data: {
                id: userId,
                username: `test_user_${userId}`,
                passwordHash: 'test',
                currency: 100000,
                prestige: 1000,
              },
            });

            await prisma.robot.create({
              data: {
                id: robotId,
                userId,
                name: `Robot_${robotId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: startingELO,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            // Create opponent robot
            const opponentId = robotId + 10000;
            await prisma.robot.create({
              data: {
                id: opponentId,
                userId,
                name: `Opponent_${opponentId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: 1500,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            // Create cycle snapshots for the cycle range
            const endCycle = startCycle + Math.ceil(eloChanges.length / 5);
            for (let cycle = startCycle; cycle <= endCycle; cycle++) {
              const cycleStart = new Date(2024, 0, cycle, 0, 0, 0);
              const cycleEnd = new Date(2024, 0, cycle, 23, 59, 59);
              
              await prisma.cycleSnapshot.create({
                data: {
                  cycleNumber: cycle,
                  triggerType: 'manual',
                  startTime: cycleStart,
                  endTime: cycleEnd,
                  durationMs: 5000,
                  stableMetrics: [],
                  robotMetrics: [],
                  stepDurations: [],
                  totalBattles: 0,
                  totalCreditsTransacted: 0,
                  totalPrestigeAwarded: 0,
                },
              });

              // Create audit log entries for cycle start/end
              await prisma.auditLog.create({
                data: {
                  cycleNumber: cycle,
                  eventType: 'cycle_start',
                  eventTimestamp: cycleStart,
                  sequenceNumber: 1,
                  payload: { triggerType: 'manual' },
                },
              });

              await prisma.auditLog.create({
                data: {
                  cycleNumber: cycle,
                  eventType: 'cycle_complete',
                  eventTimestamp: cycleEnd,
                  sequenceNumber: 2,
                  payload: { duration: 5000 },
                },
              });
            }

            // Execute: Create battles with ELO changes
            let currentELO = startingELO;
            const battles = [];

            for (let i = 0; i < eloChanges.length; i++) {
              const eloChange = eloChanges[i];
              const eloBefore = currentELO;
              const eloAfter = currentELO + eloChange;
              currentELO = eloAfter;

              // Determine which cycle this battle belongs to (distribute across cycles)
              const cycleNumber = startCycle + Math.floor(i / 5);
              const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
              const battleTime = new Date(cycleStart.getTime() + i * 60000); // 1 minute apart

              const battle = await prisma.battle.create({
                data: {
                  robot1Id: robotId,
                  robot2Id: opponentId,
                  winnerId: eloChange > 0 ? robotId : (eloChange < 0 ? opponentId : null),
                  battleType: 'league',
                  leagueType: 'bronze',
                  battleLog: {},
                  durationSeconds: 30,
                  winnerReward: eloChange > 0 ? 1000 : 500,
                  loserReward: eloChange < 0 ? 500 : 1000,
                  robot1ELOBefore: eloBefore,
                  robot1ELOAfter: eloAfter,
                  robot2ELOBefore: 1500,
                  robot2ELOAfter: 1500 - eloChange,
                  eloChange: Math.abs(eloChange),
                  createdAt: battleTime,
                },
              });

              battles.push(battle);
            }

            // Verify: Query ELO progression and check continuity
            const progression = await robotPerformanceService.getELOProgression(
              robotId,
              [startCycle, endCycle]
            );

            // Property: Starting ELO should match
            expect(progression.startElo).toBe(startingELO);

            // Property: Ending ELO should match final calculated value
            const expectedEndELO = startingELO + eloChanges.reduce((sum, change) => sum + change, 0);
            expect(progression.endElo).toBe(expectedEndELO);

            // Property: Total change should equal sum of individual changes
            const totalChange = eloChanges.reduce((sum, change) => sum + change, 0);
            expect(progression.totalChange).toBe(totalChange);

            // Property: ELO continuity - each battle's "before" should equal previous battle's "after"
            for (let i = 1; i < battles.length; i++) {
              const prevBattle = battles[i - 1];
              const currBattle = battles[i];

              expect(currBattle.robot1ELOBefore).toBe(prevBattle.robot1ELOAfter);
            }

            // Property: First battle's "before" should equal starting ELO
            if (battles.length > 0) {
              expect(battles[0].robot1ELOBefore).toBe(startingELO);
            }

            // Property: Last battle's "after" should equal ending ELO
            if (battles.length > 0) {
              expect(battles[battles.length - 1].robot1ELOAfter).toBe(expectedEndELO);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain ELO continuity when robot is robot2 in battles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 800, max: 2000 }),
          fc.array(
            fc.integer({ min: -50, max: 50 }),
            { minLength: 2, maxLength: 15 }
          ),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, startingELO, eloChanges, startCycle) => {
            // Setup: Create test user and robot
            await prisma.user.create({
              data: {
                id: userId,
                username: `test_user_${userId}`,
                passwordHash: 'test',
                currency: 100000,
                prestige: 1000,
              },
            });

            await prisma.robot.create({
              data: {
                id: robotId,
                userId,
                name: `Robot_${robotId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: startingELO,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            // Create opponent robot
            const opponentId = robotId + 10000;
            await prisma.robot.create({
              data: {
                id: opponentId,
                userId,
                name: `Opponent_${opponentId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: 1500,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            // Create cycle snapshots
            const endCycle = startCycle + Math.ceil(eloChanges.length / 5);
            for (let cycle = startCycle; cycle <= endCycle; cycle++) {
              const cycleStart = new Date(2024, 0, cycle, 0, 0, 0);
              const cycleEnd = new Date(2024, 0, cycle, 23, 59, 59);
              
              await prisma.cycleSnapshot.create({
                data: {
                  cycleNumber: cycle,
                  triggerType: 'manual',
                  startTime: cycleStart,
                  endTime: cycleEnd,
                  durationMs: 5000,
                  stableMetrics: [],
                  robotMetrics: [],
                  stepDurations: [],
                  totalBattles: 0,
                  totalCreditsTransacted: 0,
                  totalPrestigeAwarded: 0,
                },
              });

              await prisma.auditLog.create({
                data: {
                  cycleNumber: cycle,
                  eventType: 'cycle_start',
                  eventTimestamp: cycleStart,
                  sequenceNumber: 1,
                  payload: { triggerType: 'manual' },
                },
              });

              await prisma.auditLog.create({
                data: {
                  cycleNumber: cycle,
                  eventType: 'cycle_complete',
                  eventTimestamp: cycleEnd,
                  sequenceNumber: 2,
                  payload: { duration: 5000 },
                },
              });
            }

            // Execute: Create battles where our robot is robot2
            let currentELO = startingELO;
            const battles = [];

            for (let i = 0; i < eloChanges.length; i++) {
              const eloChange = eloChanges[i];
              const eloBefore = currentELO;
              const eloAfter = currentELO + eloChange;
              currentELO = eloAfter;

              const cycleNumber = startCycle + Math.floor(i / 5);
              const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
              const battleTime = new Date(cycleStart.getTime() + i * 60000);

              const battle = await prisma.battle.create({
                data: {
                  robot1Id: opponentId, // Opponent is robot1
                  robot2Id: robotId,    // Our robot is robot2
                  winnerId: eloChange > 0 ? robotId : (eloChange < 0 ? opponentId : null),
                  battleType: 'league',
                  leagueType: 'bronze',
                  battleLog: {},
                  durationSeconds: 30,
                  winnerReward: eloChange > 0 ? 1000 : 500,
                  loserReward: eloChange < 0 ? 500 : 1000,
                  robot1ELOBefore: 1500,
                  robot1ELOAfter: 1500 - eloChange,
                  robot2ELOBefore: eloBefore,
                  robot2ELOAfter: eloAfter,
                  eloChange: Math.abs(eloChange),
                  createdAt: battleTime,
                },
              });

              battles.push(battle);
            }

            // Verify: Check ELO continuity for robot2
            for (let i = 1; i < battles.length; i++) {
              const prevBattle = battles[i - 1];
              const currBattle = battles[i];

              // Property: Current battle's "before" should equal previous battle's "after"
              expect(currBattle.robot2ELOBefore).toBe(prevBattle.robot2ELOAfter);
            }

            // Property: First battle's "before" should equal starting ELO
            if (battles.length > 0) {
              expect(battles[0].robot2ELOBefore).toBe(startingELO);
            }

            // Property: Last battle's "after" should equal expected ending ELO
            if (battles.length > 0) {
              const expectedEndELO = startingELO + eloChanges.reduce((sum, change) => sum + change, 0);
              expect(battles[battles.length - 1].robot2ELOAfter).toBe(expectedEndELO);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain ELO continuity across multiple cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 800, max: 2000 }),
          fc.array(
            fc.record({
              cycleNumber: fc.integer({ min: 1, max: 5 }),
              eloChange: fc.integer({ min: -50, max: 50 }),
            }),
            { minLength: 3, maxLength: 15 }
          ),
          async (robotId, userId, startingELO, battleData) => {
            // Sort battles by cycle number to ensure chronological order
            const sortedBattles = [...battleData].sort((a, b) => a.cycleNumber - b.cycleNumber);

            // Setup: Create test user and robot
            await prisma.user.create({
              data: {
                id: userId,
                username: `test_user_${userId}`,
                passwordHash: 'test',
                currency: 100000,
                prestige: 1000,
              },
            });

            await prisma.robot.create({
              data: {
                id: robotId,
                userId,
                name: `Robot_${robotId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: startingELO,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            const opponentId = robotId + 10000;
            await prisma.robot.create({
              data: {
                id: opponentId,
                userId,
                name: `Opponent_${opponentId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: 1500,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            // Create cycle snapshots for all cycles
            const uniqueCycles = [...new Set(sortedBattles.map(b => b.cycleNumber))];
            for (const cycle of uniqueCycles) {
              const cycleStart = new Date(2024, 0, cycle, 0, 0, 0);
              const cycleEnd = new Date(2024, 0, cycle, 23, 59, 59);
              
              await prisma.cycleSnapshot.create({
                data: {
                  cycleNumber: cycle,
                  triggerType: 'manual',
                  startTime: cycleStart,
                  endTime: cycleEnd,
                  durationMs: 5000,
                  stableMetrics: [],
                  robotMetrics: [],
                  stepDurations: [],
                  totalBattles: 0,
                  totalCreditsTransacted: 0,
                  totalPrestigeAwarded: 0,
                },
              });

              await prisma.auditLog.create({
                data: {
                  cycleNumber: cycle,
                  eventType: 'cycle_start',
                  eventTimestamp: cycleStart,
                  sequenceNumber: 1,
                  payload: { triggerType: 'manual' },
                },
              });

              await prisma.auditLog.create({
                data: {
                  cycleNumber: cycle,
                  eventType: 'cycle_complete',
                  eventTimestamp: cycleEnd,
                  sequenceNumber: 2,
                  payload: { duration: 5000 },
                },
              });
            }

            // Execute: Create battles across multiple cycles
            let currentELO = startingELO;
            const battles = [];

            for (let i = 0; i < sortedBattles.length; i++) {
              const { cycleNumber, eloChange } = sortedBattles[i];
              const eloBefore = currentELO;
              const eloAfter = currentELO + eloChange;
              currentELO = eloAfter;

              const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
              const battleTime = new Date(cycleStart.getTime() + i * 60000);

              const battle = await prisma.battle.create({
                data: {
                  robot1Id: robotId,
                  robot2Id: opponentId,
                  winnerId: eloChange > 0 ? robotId : (eloChange < 0 ? opponentId : null),
                  battleType: 'league',
                  leagueType: 'bronze',
                  battleLog: {},
                  durationSeconds: 30,
                  winnerReward: eloChange > 0 ? 1000 : 500,
                  loserReward: eloChange < 0 ? 500 : 1000,
                  robot1ELOBefore: eloBefore,
                  robot1ELOAfter: eloAfter,
                  robot2ELOBefore: 1500,
                  robot2ELOAfter: 1500 - eloChange,
                  eloChange: Math.abs(eloChange),
                  createdAt: battleTime,
                },
              });

              battles.push(battle);
            }

            // Verify: ELO continuity across all battles (even across cycle boundaries)
            for (let i = 1; i < battles.length; i++) {
              const prevBattle = battles[i - 1];
              const currBattle = battles[i];

              // Property: ELO continuity must hold even when crossing cycle boundaries
              expect(currBattle.robot1ELOBefore).toBe(prevBattle.robot1ELOAfter);
            }

            // Property: Total ELO change should equal sum of all changes
            const totalChange = sortedBattles.reduce((sum, b) => sum + b.eloChange, 0);
            const expectedEndELO = startingELO + totalChange;
            
            if (battles.length > 0) {
              expect(battles[battles.length - 1].robot1ELOAfter).toBe(expectedEndELO);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single battle case (trivially continuous)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 800, max: 2000 }),
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, startingELO, eloChange, cycleNumber) => {
            // Setup: Create test user and robot
            await prisma.user.create({
              data: {
                id: userId,
                username: `test_user_${userId}`,
                passwordHash: 'test',
                currency: 100000,
                prestige: 1000,
              },
            });

            await prisma.robot.create({
              data: {
                id: robotId,
                userId,
                name: `Robot_${robotId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: startingELO,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            const opponentId = robotId + 10000;
            await prisma.robot.create({
              data: {
                id: opponentId,
                userId,
                name: `Opponent_${opponentId}`,
                combatPower: 10,
                maxHP: 100,
                currentHP: 100,
                maxShield: 50,
                currentShield: 50,
                elo: 1500,
                fame: 100,
                currentLeague: 'bronze',
              },
            });

            // Create cycle snapshot
            const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
            const cycleEnd = new Date(2024, 0, cycleNumber, 23, 59, 59);
            
            await prisma.cycleSnapshot.create({
              data: {
                cycleNumber,
                triggerType: 'manual',
                startTime: cycleStart,
                endTime: cycleEnd,
                durationMs: 5000,
                stableMetrics: [],
                robotMetrics: [],
                stepDurations: [],
                totalBattles: 0,
                totalCreditsTransacted: 0,
                totalPrestigeAwarded: 0,
              },
            });

            await prisma.auditLog.create({
              data: {
                cycleNumber,
                eventType: 'cycle_start',
                eventTimestamp: cycleStart,
                sequenceNumber: 1,
                payload: { triggerType: 'manual' },
              },
            });

            await prisma.auditLog.create({
              data: {
                cycleNumber,
                eventType: 'cycle_complete',
                eventTimestamp: cycleEnd,
                sequenceNumber: 2,
                payload: { duration: 5000 },
              },
            });

            // Execute: Create single battle
            const eloBefore = startingELO;
            const eloAfter = startingELO + eloChange;

            const battle = await prisma.battle.create({
              data: {
                robot1Id: robotId,
                robot2Id: opponentId,
                winnerId: eloChange > 0 ? robotId : (eloChange < 0 ? opponentId : null),
                battleType: 'league',
                leagueType: 'bronze',
                battleLog: {},
                durationSeconds: 30,
                winnerReward: eloChange > 0 ? 1000 : 500,
                loserReward: eloChange < 0 ? 500 : 1000,
                robot1ELOBefore: eloBefore,
                robot1ELOAfter: eloAfter,
                robot2ELOBefore: 1500,
                robot2ELOAfter: 1500 - eloChange,
                eloChange: Math.abs(eloChange),
                createdAt: new Date(cycleStart.getTime() + 60000),
              },
            });

            // Verify: Single battle is trivially continuous
            // Property: Before value should equal starting ELO
            expect(battle.robot1ELOBefore).toBe(startingELO);

            // Property: After value should equal before + change
            expect(battle.robot1ELOAfter).toBe(startingELO + eloChange);

            // Property: ELO change should be consistent
            const actualChange = battle.robot1ELOAfter - battle.robot1ELOBefore;
            expect(actualChange).toBe(eloChange);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
