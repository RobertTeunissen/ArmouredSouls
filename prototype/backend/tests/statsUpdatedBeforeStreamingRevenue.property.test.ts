/**
 * Property-Based Tests for Stats Updated Before Streaming Revenue Calculation
 * Property 5: Stats Updated Before Streaming Revenue Calculation
 * 
 * **Validates: Requirements 2.8, 3.7, 3.8**
 * 
 * For any battle, when calculating streaming revenue, the robot's battle count 
 * should include the current battle, and the robot's fame should include any 
 * fame awarded from the current battle.
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { processBattle } from '../src/services/battleOrchestrator';

// Helper function to create a minimal test robot
async function createTestRobot(
  userId: number,
  name: string,
  battles: number,
  fame: number,
  league: string = 'bronze'
) {
  return await prisma.robot.create({
    data: {
      userId,
      name,
      frameId: 1,
      totalBattles: battles,
      fame,
      currentLeague: league,
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
      leagueId: `${league}_1`,
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

// Helper function to create a scheduled match
async function createScheduledMatch(
  robot1Id: number,
  robot2Id: number,
  leagueType: string = 'bronze'
) {
  return await prisma.scheduledMatch.create({
    data: {
      robot1Id,
      robot2Id,
      leagueType,
      scheduledFor: new Date(),
      status: 'scheduled',
    },
  });
}

describe('Property 5: Stats Updated Before Streaming Revenue Calculation', () => {
  let testUser1Id: number;
  let testUser2Id: number;

  beforeAll(async () => {
    // Create test users for all tests
    const user1 = await prisma.user.create({
      data: {
        username: `test_user_prop5_1_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
        prestige: 0,
      },
    });
    testUser1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        username: `test_user_prop5_2_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
        prestige: 0,
      },
    });
    testUser2Id = user2.id;
  });

  afterAll(async () => {
    // Clean up test data - delete in correct order to respect foreign keys
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ userId: testUser1Id }, { userId: testUser2Id }],
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1Id } },
          { robot2: { userId: testUser1Id } },
          { robot1: { userId: testUser2Id } },
          { robot2: { userId: testUser2Id } },
        ],
      },
    });
    await prisma.scheduledMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1Id } },
          { robot2: { userId: testUser1Id } },
          { robot1: { userId: testUser2Id } },
          { robot2: { userId: testUser2Id } },
        ],
      },
    });
    await prisma.robot.deleteMany({ where: { userId: testUser1Id } });
    await prisma.robot.deleteMany({ where: { userId: testUser2Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser1Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser2Id } });
    await prisma.user.delete({ where: { id: testUser1Id } });
    await prisma.user.delete({ where: { id: testUser2Id } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up robots, facilities, battles, scheduled matches, and audit logs before each test
    // Delete in correct order to respect foreign keys
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ userId: testUser1Id }, { userId: testUser2Id }],
      },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1Id } },
          { robot2: { userId: testUser1Id } },
          { robot1: { userId: testUser2Id } },
          { robot2: { userId: testUser2Id } },
        ],
      },
    });
    await prisma.scheduledMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUser1Id } },
          { robot2: { userId: testUser1Id } },
          { robot1: { userId: testUser2Id } },
          { robot2: { userId: testUser2Id } },
        ],
      },
    });
    await prisma.robot.deleteMany({ where: { userId: testUser1Id } });
    await prisma.robot.deleteMany({ where: { userId: testUser2Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser1Id } });
    await prisma.facility.deleteMany({ where: { userId: testUser2Id } });
  });

  /**
   * Property 5: For any battle, when calculating streaming revenue, the robot's 
   * battle count should include the current battle, and the robot's fame should 
   * include any fame awarded from the current battle.
   */
  test('Property 5: Stats updated before streaming revenue calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }),  // initial battles for robot 1
        fc.integer({ min: 0, max: 5000 }),  // initial fame for robot 1
        fc.integer({ min: 0, max: 1000 }),  // initial battles for robot 2
        fc.integer({ min: 0, max: 5000 }),  // initial fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level for user 1
        fc.integer({ min: 0, max: 10 }),    // studio level for user 2
        fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'), // league
        async (
          initialBattles1,
          initialFame1,
          initialBattles2,
          initialFame2,
          studioLevel1,
          studioLevel2,
          league
        ) => {
          // Clean up facilities first
          await prisma.facility.deleteMany({
            where: {
              userId: { in: [testUser1Id, testUser2Id] },
              facilityType: 'streaming_studio',
            },
          });

          // Create robots with initial stats
          const robot1 = await createTestRobot(
            testUser1Id,
            `TestRobot1_${Date.now()}_${Math.random()}`,
            initialBattles1,
            initialFame1,
            league
          );
          const robot2 = await createTestRobot(
            testUser2Id,
            `TestRobot2_${Date.now()}_${Math.random()}`,
            initialBattles2,
            initialFame2,
            league
          );

          // Create Streaming Studio facilities
          if (studioLevel1 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser1Id,
                facilityType: 'streaming_studio',
                level: studioLevel1,
              },
            });
          }
          if (studioLevel2 > 0) {
            await prisma.facility.create({
              data: {
                userId: testUser2Id,
                facilityType: 'streaming_studio',
                level: studioLevel2,
              },
            });
          }

          // Create scheduled match
          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id, league);

          // Process the battle (this will update stats and calculate streaming revenue)
          await processBattle(scheduledMatch);

          // Get the battle_complete event from audit log
          const battleCompleteEvent = await prisma.auditLog.findFirst({
            where: {
              eventType: 'battle_complete',
              payload: {
                path: ['robot1Id'],
                equals: robot1.id,
              },
            },
            orderBy: { id: 'desc' },
          });

          expect(battleCompleteEvent).not.toBeNull();
          const payload = battleCompleteEvent!.payload as any;

          // Get updated robot stats from database
          const updatedRobot1 = await prisma.robot.findUnique({
            where: { id: robot1.id },
            select: { totalBattles: true, fame: true },
          });
          const updatedRobot2 = await prisma.robot.findUnique({
            where: { id: robot2.id },
            select: { totalBattles: true, fame: true },
          });

          expect(updatedRobot1).not.toBeNull();
          expect(updatedRobot2).not.toBeNull();

          // Property: Battle count should have been incremented by 1 for both robots
          expect(updatedRobot1!.totalBattles).toBe(initialBattles1 + 1);
          expect(updatedRobot2!.totalBattles).toBe(initialBattles2 + 1);

          // Property: Streaming revenue calculation should use the UPDATED battle count
          // (i.e., the battle count that includes the current battle)
          if (payload.streamingRevenueDetails1) {
            const expectedBattleCount1 = initialBattles1 + 1; // Updated count
            expect(payload.streamingRevenueDetails1.robotBattles).toBe(expectedBattleCount1);

            // Verify the battle multiplier uses the updated count
            const expectedBattleMultiplier1 = 1 + (expectedBattleCount1 / 1000);
            expect(payload.streamingRevenueDetails1.battleMultiplier).toBeCloseTo(
              expectedBattleMultiplier1,
              10
            );
          }

          if (payload.streamingRevenueDetails2) {
            const expectedBattleCount2 = initialBattles2 + 1; // Updated count
            expect(payload.streamingRevenueDetails2.robotBattles).toBe(expectedBattleCount2);

            // Verify the battle multiplier uses the updated count
            const expectedBattleMultiplier2 = 1 + (expectedBattleCount2 / 1000);
            expect(payload.streamingRevenueDetails2.battleMultiplier).toBeCloseTo(
              expectedBattleMultiplier2,
              10
            );
          }

          // Property: If a robot won and earned fame, streaming revenue should use the UPDATED fame
          const winnerId = payload.winnerId;
          if (winnerId === robot1.id && payload.robot1FameAwarded > 0) {
            // Robot 1 won and earned fame
            const expectedFame1 = initialFame1 + payload.robot1FameAwarded;
            expect(updatedRobot1!.fame).toBe(expectedFame1);

            // Streaming revenue should use the updated fame
            if (payload.streamingRevenueDetails1) {
              expect(payload.streamingRevenueDetails1.robotFame).toBe(expectedFame1);

              // Verify the fame multiplier uses the updated fame
              const expectedFameMultiplier1 = 1 + (expectedFame1 / 5000);
              expect(payload.streamingRevenueDetails1.fameMultiplier).toBeCloseTo(
                expectedFameMultiplier1,
                10
              );
            }
          } else if (winnerId === robot2.id && payload.robot2FameAwarded > 0) {
            // Robot 2 won and earned fame
            const expectedFame2 = initialFame2 + payload.robot2FameAwarded;
            expect(updatedRobot2!.fame).toBe(expectedFame2);

            // Streaming revenue should use the updated fame
            if (payload.streamingRevenueDetails2) {
              expect(payload.streamingRevenueDetails2.robotFame).toBe(expectedFame2);

              // Verify the fame multiplier uses the updated fame
              const expectedFameMultiplier2 = 1 + (expectedFame2 / 5000);
              expect(payload.streamingRevenueDetails2.fameMultiplier).toBeCloseTo(
                expectedFameMultiplier2,
                10
              );
            }
          }

          // Property: Loser should use their original fame (no fame awarded)
          if (winnerId === robot1.id) {
            // Robot 2 lost, should have original fame
            expect(updatedRobot2!.fame).toBe(initialFame2);
            if (payload.streamingRevenueDetails2) {
              expect(payload.streamingRevenueDetails2.robotFame).toBe(initialFame2);
            }
          } else if (winnerId === robot2.id) {
            // Robot 1 lost, should have original fame
            expect(updatedRobot1!.fame).toBe(initialFame1);
            if (payload.streamingRevenueDetails1) {
              expect(payload.streamingRevenueDetails1.robotFame).toBe(initialFame1);
            }
          }

          // Clean up for next iteration
          await prisma.battle.deleteMany({
            where: {
              OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }],
            },
          });
          await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.1: Battle count increment is always exactly 1
   */
  test('Property 5.1: Battle count increments by exactly 1 per battle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }), // initial battles
        fc.integer({ min: 0, max: 25000 }), // initial fame
        async (initialBattles, initialFame) => {
          // Create robots
          const robot1 = await createTestRobot(
            testUser1Id,
            `TestRobot1_${Date.now()}_${Math.random()}`,
            initialBattles,
            initialFame
          );
          const robot2 = await createTestRobot(
            testUser2Id,
            `TestRobot2_${Date.now()}_${Math.random()}`,
            0,
            0
          );

          // Create scheduled match
          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);

          // Process the battle
          await processBattle(scheduledMatch);

          // Get updated robot stats
          const updatedRobot1 = await prisma.robot.findUnique({
            where: { id: robot1.id },
            select: { totalBattles: true },
          });

          // Property: Battle count should increment by exactly 1
          expect(updatedRobot1!.totalBattles).toBe(initialBattles + 1);

          // Clean up - delete battles first to respect foreign keys
          await prisma.battle.deleteMany({
            where: {
              OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }],
            },
          });
          await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5.2: Fame increment for winner is always positive (in non-bye, non-draw battles)
   */
  test('Property 5.2: Winner fame increases after battle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }), // initial fame
        fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'), // league
        async (initialFame, league) => {
          // Create robots with different combat power to ensure a winner
          const robot1 = await createTestRobot(
            testUser1Id,
            `TestRobot1_${Date.now()}_${Math.random()}`,
            0,
            initialFame,
            league
          );
          
          // Make robot1 much stronger to ensure it wins
          await prisma.robot.update({
            where: { id: robot1.id },
            data: {
              combatPower: new Prisma.Decimal(50),
              armorPlating: new Prisma.Decimal(50),
            },
          });

          const robot2 = await createTestRobot(
            testUser2Id,
            `TestRobot2_${Date.now()}_${Math.random()}`,
            0,
            0,
            league
          );

          // Create scheduled match
          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id, league);

          // Process the battle
          await processBattle(scheduledMatch);

          // Get battle result
          const battleCompleteEvent = await prisma.auditLog.findFirst({
            where: {
              eventType: 'battle_complete',
              payload: {
                path: ['robot1Id'],
                equals: robot1.id,
              },
            },
            orderBy: { id: 'desc' },
          });

          const payload = battleCompleteEvent!.payload as any;

          // Get updated robot stats
          const updatedRobot1 = await prisma.robot.findUnique({
            where: { id: robot1.id },
            select: { fame: true },
          });

          // Property: If robot1 won (not a draw), fame should have increased
          if (payload.winnerId === robot1.id && !payload.isDraw) {
            expect(updatedRobot1!.fame).toBeGreaterThan(initialFame);
            expect(payload.robot1FameAwarded).toBeGreaterThan(0);

            // Property: Streaming revenue should use the updated fame
            if (payload.streamingRevenueDetails1) {
              expect(payload.streamingRevenueDetails1.robotFame).toBe(updatedRobot1!.fame);
              expect(payload.streamingRevenueDetails1.robotFame).toBeGreaterThan(initialFame);
            }
          }

          // Clean up - delete battles first to respect foreign keys
          await prisma.battle.deleteMany({
            where: {
              OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }],
            },
          });
          await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5.3: Streaming revenue calculation order is consistent
   */
  test('Property 5.3: Stats are always updated before streaming revenue calculation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 2000 }), // initial battles
        fc.integer({ min: 0, max: 10000 }), // initial fame
        async (initialBattles, initialFame) => {
          // Create robots
          const robot1 = await createTestRobot(
            testUser1Id,
            `TestRobot1_${Date.now()}_${Math.random()}`,
            initialBattles,
            initialFame
          );
          const robot2 = await createTestRobot(
            testUser2Id,
            `TestRobot2_${Date.now()}_${Math.random()}`,
            0,
            0
          );

          // Create scheduled match
          const scheduledMatch = await createScheduledMatch(robot1.id, robot2.id);

          // Process the battle
          await processBattle(scheduledMatch);

          // Get battle event
          const battleCompleteEvent = await prisma.auditLog.findFirst({
            where: {
              eventType: 'battle_complete',
              payload: {
                path: ['robot1Id'],
                equals: robot1.id,
              },
            },
            orderBy: { id: 'desc' },
          });

          const payload = battleCompleteEvent!.payload as any;

          // Property: The battle count used in streaming revenue should be 
          // the initial count + 1 (proving stats were updated first)
          if (payload.streamingRevenueDetails1) {
            expect(payload.streamingRevenueDetails1.robotBattles).toBe(initialBattles + 1);
            
            // This proves the order is correct:
            // 1. Stats updated (totalBattles incremented)
            // 2. Streaming revenue calculated (using updated totalBattles)
            expect(payload.streamingRevenueDetails1.robotBattles).toBeGreaterThan(initialBattles);
          }

          // Clean up - delete battles first to respect foreign keys
          await prisma.battle.deleteMany({
            where: {
              OR: [{ robot1Id: robot1.id }, { robot2Id: robot1.id }, { robot1Id: robot2.id }, { robot2Id: robot2.id }],
            },
          });
          await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
          await prisma.robot.delete({ where: { id: robot1.id } });
          await prisma.robot.delete({ where: { id: robot2.id } });
        }
      ),
      { numRuns: 50 }
    );
  });
});
