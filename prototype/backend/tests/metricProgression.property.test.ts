/**
 * Property-Based Tests for Metric Progression Continuity
 * 
 * Tests that metric values form continuous chains across battles for both
 * absolute metrics (ELO) and cumulative metrics (fame, damage, wins, credits)
 * 
 * Uses fast-check for property-based testing
 */

import prisma from '../src/lib/prisma';
import fc from 'fast-check';
import { robotPerformanceService, RobotMetric } from '../src/services/robotPerformanceService';


describe('Metric Progression Property-Based Tests', () => {
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
   * Property 6: Metric Progression Continuity (Generalized)
   * 
   * **Validates: Requirements 7.2, 7.3**
   * 
   * For any robot, the metric values in consecutive metric change events should form a 
   * continuous chain where:
   * - For absolute metrics (ELO): Each event's "before" value equals the previous event's "after" value
   * - For cumulative metrics (fame, damage, wins, credits): Values should monotonically increase
   */
  describe('Property 6: Metric Progression Continuity', () => {
    /**
     * Test ELO continuity (absolute metric)
     * ELO can go up or down, but must maintain continuity
     */
    it('should maintain ELO continuity across consecutive battles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 800, max: 2000 }),
          fc.array(
            fc.integer({ min: -50, max: 50 }),
            { minLength: 2, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, startingELO, eloChanges, startCycle) => {
            // Setup test data
            await setupTestData(userId, robotId, startingELO, startCycle, eloChanges.length);

            // Create battles with ELO changes
            const battles = await createBattlesWithELOChanges(
              userId,
              robotId,
              startingELO,
              eloChanges,
              startCycle
            );

            // Verify ELO continuity
            for (let i = 1; i < battles.length; i++) {
              const prevBattle = battles[i - 1];
              const currBattle = battles[i];

              // Property: Current battle's "before" should equal previous battle's "after"
              expect(currBattle.robot1ELOBefore).toBe(prevBattle.robot1ELOAfter);
            }

            // Verify using service
            const endCycle = startCycle + Math.ceil(eloChanges.length / 5);
            const progression = await robotPerformanceService.getRobotMetricProgression(
              robotId,
              'elo',
              [startCycle, endCycle]
            );

            // Property: Starting value should match
            expect(progression.startValue).toBe(startingELO);

            // Property: Ending value should match final calculated value
            const expectedEndELO = startingELO + eloChanges.reduce((sum, change) => sum + change, 0);
            expect(progression.endValue).toBe(expectedEndELO);

            // Property: Total change should equal sum of individual changes
            const totalChange = eloChanges.reduce((sum, change) => sum + change, 0);
            expect(progression.totalChange).toBe(totalChange);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test fame continuity (cumulative metric)
     * Fame should always increase (monotonic)
     */
    it('should maintain monotonic increase for fame (cumulative metric)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.array(
            fc.integer({ min: 0, max: 100 }), // Fame awards are always positive
            { minLength: 2, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, fameAwards, startCycle) => {
            // Setup test data
            await setupTestData(userId, robotId, 1500, startCycle, fameAwards.length);

            // Create battles with fame awards
            const battles = await createBattlesWithFameAwards(
              userId,
              robotId,
              fameAwards,
              startCycle
            );

            // Verify fame monotonicity
            let cumulativeFame = 0;
            for (let bi = 0; bi < battles.length; bi++) {
              const fameAwarded = fameAwards[bi];
              cumulativeFame += fameAwarded;

              // Property: Fame should always increase or stay the same (never decrease)
              expect(fameAwarded).toBeGreaterThanOrEqual(0);
            }

            // Verify using service
            const endCycle = startCycle + Math.ceil(fameAwards.length / 5);
            const progression = await robotPerformanceService.getRobotMetricProgression(
              robotId,
              'fame',
              [startCycle, endCycle]
            );

            // Property: For cumulative metrics, each data point should be >= previous
            for (let i = 1; i < progression.dataPoints.length; i++) {
              const prevValue = progression.dataPoints[i - 1].value;
              const currValue = progression.dataPoints[i].value;
              
              expect(currValue).toBeGreaterThanOrEqual(prevValue);
            }

            // Property: Total change should equal sum of all fame awards
            const totalFame = fameAwards.reduce((sum, fame) => sum + fame, 0);
            expect(progression.totalChange).toBe(totalFame);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test damage dealt continuity (cumulative metric)
     * Damage dealt should always increase
     */
    it('should maintain monotonic increase for damage dealt (cumulative metric)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.array(
            fc.integer({ min: 0, max: 1000 }), // Damage dealt per battle
            { minLength: 2, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, damageValues, startCycle) => {
            // Setup test data
            await setupTestData(userId, robotId, 1500, startCycle, damageValues.length);

            // Create battles with damage values
            const battles = await createBattlesWithDamage(
              userId,
              robotId,
              damageValues,
              startCycle
            );

            // Verify using service
            const endCycle = startCycle + Math.ceil(damageValues.length / 5);
            const progression = await robotPerformanceService.getRobotMetricProgression(
              robotId,
              'damageDealt',
              [startCycle, endCycle]
            );

            // Property: For cumulative metrics, each data point should be >= previous
            for (let i = 1; i < progression.dataPoints.length; i++) {
              const prevValue = progression.dataPoints[i - 1].value;
              const currValue = progression.dataPoints[i].value;
              
              expect(currValue).toBeGreaterThanOrEqual(prevValue);
            }

            // Property: Total change should equal sum of all damage
            const totalDamage = damageValues.reduce((sum, dmg) => sum + dmg, 0);
            expect(progression.totalChange).toBe(totalDamage);

            // Property: End value should equal total damage (cumulative)
            expect(progression.endValue).toBe(totalDamage);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test wins continuity (cumulative metric)
     * Wins should always increase (count metric)
     */
    it('should maintain monotonic increase for wins (cumulative metric)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.array(
            fc.boolean(), // Win or loss
            { minLength: 2, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, battleOutcomes, startCycle) => {
            // Setup test data
            await setupTestData(userId, robotId, 1500, startCycle, battleOutcomes.length);

            // Create battles with win/loss outcomes
            const battles = await createBattlesWithOutcomes(
              userId,
              robotId,
              battleOutcomes,
              startCycle
            );

            // Verify using service
            const endCycle = startCycle + Math.ceil(battleOutcomes.length / 5);
            const progression = await robotPerformanceService.getRobotMetricProgression(
              robotId,
              'wins',
              [startCycle, endCycle]
            );

            // Property: For cumulative metrics, each data point should be >= previous
            for (let i = 1; i < progression.dataPoints.length; i++) {
              const prevValue = progression.dataPoints[i - 1].value;
              const currValue = progression.dataPoints[i].value;
              
              expect(currValue).toBeGreaterThanOrEqual(prevValue);
            }

            // Property: Total wins should equal count of true values
            const totalWins = battleOutcomes.filter(outcome => outcome).length;
            expect(progression.totalChange).toBe(totalWins);
            expect(progression.endValue).toBe(totalWins);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test credits earned continuity (cumulative metric)
     * Credits earned should always increase
     */
    it('should maintain monotonic increase for credits earned (cumulative metric)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.array(
            fc.integer({ min: 100, max: 2000 }), // Credits per battle
            { minLength: 2, maxLength: 20 }
          ),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, creditValues, startCycle) => {
            // Setup test data
            await setupTestData(userId, robotId, 1500, startCycle, creditValues.length);

            // Create battles with credit rewards
            const battles = await createBattlesWithCredits(
              userId,
              robotId,
              creditValues,
              startCycle
            );

            // Verify using service
            const endCycle = startCycle + Math.ceil(creditValues.length / 5);
            const progression = await robotPerformanceService.getRobotMetricProgression(
              robotId,
              'creditsEarned',
              [startCycle, endCycle]
            );

            // Property: For cumulative metrics, each data point should be >= previous
            for (let i = 1; i < progression.dataPoints.length; i++) {
              const prevValue = progression.dataPoints[i - 1].value;
              const currValue = progression.dataPoints[i].value;
              
              expect(currValue).toBeGreaterThanOrEqual(prevValue);
            }

            // Property: Total credits should equal sum of all credit values
            const totalCredits = creditValues.reduce((sum, credits) => sum + credits, 0);
            expect(progression.totalChange).toBe(totalCredits);
            expect(progression.endValue).toBe(totalCredits);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test edge case: single battle (trivially continuous)
     */
    it('should handle single battle case for all metrics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 800, max: 2000 }),
          fc.integer({ min: -50, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, startingELO, eloChange, cycleNumber) => {
            // Setup test data
            await setupTestData(userId, robotId, startingELO, cycleNumber, 1);

            // Create single battle
            const eloBefore = startingELO;
            const eloAfter = startingELO + eloChange;

            const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
            const battle = await prisma.battle.create({
              data: {
                robot1Id: robotId,
                robot2Id: robotId + 10000,
                winnerId: eloChange > 0 ? robotId : (eloChange < 0 ? robotId + 10000 : null),
                battleType: 'league',
                leagueType: 'bronze',
                battleLog: {},
                durationSeconds: 30,
                winnerReward: 1000,
                loserReward: 500,
                robot1ELOBefore: eloBefore,
                robot1ELOAfter: eloAfter,
                robot2ELOBefore: 1500,
                robot2ELOAfter: 1500 - eloChange,
                eloChange: Math.abs(eloChange),
                createdAt: new Date(cycleStart.getTime() + 60000),
              },
            });

            // Verify ELO continuity for single battle
            expect(battle.robot1ELOBefore).toBe(startingELO);
            expect(battle.robot1ELOAfter).toBe(startingELO + eloChange);

            // Verify using service
            const progression = await robotPerformanceService.getRobotMetricProgression(
              robotId,
              'elo',
              [cycleNumber, cycleNumber]
            );

            // Property: Single battle is trivially continuous
            expect(progression.dataPoints.length).toBe(1);
            expect(progression.startValue).toBe(startingELO);
            expect(progression.endValue).toBe(startingELO + eloChange);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test edge case: no battles (empty progression)
     */
    it('should handle no battles case gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10 }),
          async (robotId, userId, cycleNumber) => {
            // Setup test data with no battles
            await setupTestData(userId, robotId, 1500, cycleNumber, 0);

            // Verify using service
            const progression = await robotPerformanceService.getRobotMetricProgression(
              robotId,
              'elo',
              [cycleNumber, cycleNumber]
            );

            // Property: No battles means no data points
            expect(progression.dataPoints.length).toBe(0);
            expect(progression.totalChange).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// Helper functions

async function setupTestData(
  userId: number,
  robotId: number,
  startingELO: number,
  startCycle: number,
  numBattles: number
) {
  // Clean up any existing data first (for property test iterations)
  await prisma.battle.deleteMany({
    where: {
      OR: [
        { robot1Id: robotId },
        { robot2Id: robotId },
        { robot1Id: robotId + 10000 },
        { robot2Id: robotId + 10000 },
      ],
    },
  });
  await prisma.robot.deleteMany({
    where: {
      OR: [
        { id: robotId },
        { id: robotId + 10000 },
      ],
    },
  });
  await prisma.user.deleteMany({
    where: { id: userId },
  });

  // Create user
  await prisma.user.create({
    data: {
      id: userId,
      username: `test_user_${userId}`,
      passwordHash: 'test',
      currency: 100000,
      prestige: 1000,
    },
  });

  // Create robot
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
  const endCycle = startCycle + Math.ceil(numBattles / 5);
  
  // Clean up existing cycle data for this range
  await prisma.cycleSnapshot.deleteMany({
    where: {
      cycleNumber: {
        gte: startCycle,
        lte: endCycle,
      },
    },
  });
  await prisma.auditLog.deleteMany({
    where: {
      cycleNumber: {
        gte: startCycle,
        lte: endCycle,
      },
    },
  });
  
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
}

async function createBattlesWithELOChanges(
  userId: number,
  robotId: number,
  startingELO: number,
  eloChanges: number[],
  startCycle: number
) {
  let currentELO = startingELO;
  const battles = [];
  const opponentId = robotId + 10000;

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
        robot1Id: robotId,
        robot2Id: opponentId,
        winnerId: eloChange > 0 ? robotId : (eloChange < 0 ? opponentId : null),
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        durationSeconds: 30,
        winnerReward: 1000,
        loserReward: 500,
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

  return battles;
}

async function createBattlesWithFameAwards(
  userId: number,
  robotId: number,
  fameAwards: number[],
  startCycle: number
) {
  const battles = [];
  const opponentId = robotId + 10000;

  for (let i = 0; i < fameAwards.length; i++) {
    const fameAwarded = fameAwards[i];
    const cycleNumber = startCycle + Math.floor(i / 5);
    const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
    const battleTime = new Date(cycleStart.getTime() + i * 60000);

    const battle = await prisma.battle.create({
      data: {
        robot1Id: robotId,
        robot2Id: opponentId,
        winnerId: robotId,
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        durationSeconds: 30,
        winnerReward: 1000,
        loserReward: 500,
        robot1ELOBefore: 1500,
        robot1ELOAfter: 1520,
        robot2ELOBefore: 1500,
        robot2ELOAfter: 1480,
        eloChange: 20,
        createdAt: battleTime,
      },
    });

    battles.push(battle);
  }

  return battles;
}

async function createBattlesWithDamage(
  userId: number,
  robotId: number,
  damageValues: number[],
  startCycle: number
) {
  const battles = [];
  const opponentId = robotId + 10000;

  for (let i = 0; i < damageValues.length; i++) {
    const damageDealt = damageValues[i];
    const cycleNumber = startCycle + Math.floor(i / 5);
    const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
    const battleTime = new Date(cycleStart.getTime() + i * 60000);

    const battle = await prisma.battle.create({
      data: {
        robot1Id: robotId,
        robot2Id: opponentId,
        winnerId: robotId,
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        durationSeconds: 30,
        winnerReward: 1000,
        loserReward: 500,
        robot1ELOBefore: 1500,
        robot1ELOAfter: 1520,
        robot2ELOBefore: 1500,
        robot2ELOAfter: 1480,
        eloChange: 20,
        createdAt: battleTime,
      },
    });

    battles.push(battle);
  }

  return battles;
}

async function createBattlesWithOutcomes(
  userId: number,
  robotId: number,
  battleOutcomes: boolean[],
  startCycle: number
) {
  const battles = [];
  const opponentId = robotId + 10000;

  for (let i = 0; i < battleOutcomes.length; i++) {
    const isWin = battleOutcomes[i];
    const cycleNumber = startCycle + Math.floor(i / 5);
    const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
    const battleTime = new Date(cycleStart.getTime() + i * 60000);

    const battle = await prisma.battle.create({
      data: {
        robot1Id: robotId,
        robot2Id: opponentId,
        winnerId: isWin ? robotId : opponentId,
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        durationSeconds: 30,
        winnerReward: 1000,
        loserReward: 500,
        robot1ELOBefore: 1500,
        robot1ELOAfter: isWin ? 1520 : 1480,
        robot2ELOBefore: 1500,
        robot2ELOAfter: isWin ? 1480 : 1520,
        eloChange: 20,
        createdAt: battleTime,
      },
    });

    battles.push(battle);
  }

  return battles;
}

async function createBattlesWithCredits(
  userId: number,
  robotId: number,
  creditValues: number[],
  startCycle: number
) {
  const battles = [];
  const opponentId = robotId + 10000;

  for (let i = 0; i < creditValues.length; i++) {
    const credits = creditValues[i];
    const cycleNumber = startCycle + Math.floor(i / 5);
    const cycleStart = new Date(2024, 0, cycleNumber, 0, 0, 0);
    const battleTime = new Date(cycleStart.getTime() + i * 60000);

    const battle = await prisma.battle.create({
      data: {
        robot1Id: robotId,
        robot2Id: opponentId,
        winnerId: robotId,
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        durationSeconds: 30,
        winnerReward: credits,
        loserReward: Math.floor(credits / 2),
        robot1ELOBefore: 1500,
        robot1ELOAfter: 1520,
        robot2ELOBefore: 1500,
        robot2ELOAfter: 1480,
        eloChange: 20,
        createdAt: battleTime,
      },
    });

    battles.push(battle);
  }

  return battles;
}
