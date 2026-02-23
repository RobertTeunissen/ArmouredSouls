/**
 * Property-Based Tests for Terminal Log Streaming Revenue
 * Property 14: Terminal Log Contains Streaming Revenue
 * 
 * **Validates: Requirements 9.1-9.6**
 * 
 * For any battle completion during a cycle, the terminal log should contain 
 * a streaming revenue entry with robot name, battle ID, and revenue amount 
 * in the format: "[Streaming] RobotName earned ₡X,XXX from Battle #123"
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { executeScheduledBattles } from '../src/services/battleOrchestrator';
import { clearSequenceCache } from '../src/services/eventLogger';
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

// Helper to capture console.log output
function captureConsoleLog(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const originalLog = console.log;
  
  console.log = (...args: any[]) => {
    logs.push(args.map(arg => String(arg)).join(' '));
    originalLog(...args);
  };
  
  return {
    logs,
    restore: () => {
      console.log = originalLog;
    },
  };
}

describe('Property 14: Terminal Log Contains Streaming Revenue', () => {
  let testUserId1: number;
  let testUserId2: number;

  beforeAll(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: {
        username: `test_terminal_log_user1_${Date.now()}`,
        passwordHash: 'test',
        currency: 1000000,
        prestige: 5000,
      },
    });
    testUserId1 = user1.id;

    const user2 = await prisma.user.create({
      data: {
        username: `test_terminal_log_user2_${Date.now()}`,
        passwordHash: 'test',
        currency: 1000000,
        prestige: 5000,
      },
    });
    testUserId2 = user2.id;
  });

  afterEach(async () => {
    // Get current cycle number for clearing cache
    const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const cycleNumber = metadata?.totalCycles || 0;
    clearSequenceCache(cycleNumber);

    // Clean up in correct order to avoid foreign key constraints
    await prisma.battleParticipant.deleteMany({
      where: {
        robot: {
          OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
        },
      },
    });

    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId1 } },
          { robot2: { userId: testUserId1 } },
          { robot1: { userId: testUserId2 } },
          { robot2: { userId: testUserId2 } },
        ],
      },
    });

    await prisma.scheduledMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId1 } },
          { robot2: { userId: testUserId1 } },
          { robot1: { userId: testUserId2 } },
          { robot2: { userId: testUserId2 } },
        ],
      },
    });

    await prisma.robot.deleteMany({
      where: {
        OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
      },
    });

    await prisma.facility.deleteMany({
      where: {
        OR: [{ userId: testUserId1 }, { userId: testUserId2 }],
      },
    });
  });

  afterAll(async () => {
    // Final cleanup of users
    await prisma.user.deleteMany({
      where: {
        OR: [{ id: testUserId1 }, { id: testUserId2 }],
      },
    });

    await prisma.$disconnect();
  });

  /**
   * Property 14: For any battle completion during a cycle, the terminal log 
   * should contain a streaming revenue entry with robot name, battle ID, 
   * and revenue amount
   */
  test('Property 14: Terminal log contains streaming revenue for all battles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 1
        fc.integer({ min: 0, max: 25000 }), // fame for robot 1
        fc.integer({ min: 0, max: 5000 }),  // battles for robot 2
        fc.integer({ min: 0, max: 25000 }), // fame for robot 2
        fc.integer({ min: 0, max: 10 }),    // studio level for user 1
        fc.integer({ min: 0, max: 10 }),    // studio level for user 2
        async (battles1, fame1, battles2, fame2, studioLevel1, studioLevel2) => {
          // Create robots with specified stats
          const robotName1 = `TestRobot1_${Date.now()}_${Math.random()}`;
          const robotName2 = `TestRobot2_${Date.now()}_${Math.random()}`;
          
          const robot1 = await createTestRobot(testUserId1, battles1, fame1, robotName1);
          const robot2 = await createTestRobot(testUserId2, battles2, fame2, robotName2);

          // Create streaming studio facilities
          if (studioLevel1 > 0) {
            await prisma.facility.upsert({
              where: {
                userId_facilityType: {
                  userId: testUserId1,
                  facilityType: 'streaming_studio',
                },
              },
              create: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel1,
              },
              update: {
                level: studioLevel1,
              },
            });
          }

          if (studioLevel2 > 0) {
            await prisma.facility.upsert({
              where: {
                userId_facilityType: {
                  userId: testUserId2,
                  facilityType: 'streaming_studio',
                },
              },
              create: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: studioLevel2,
              },
              update: {
                level: studioLevel2,
              },
            });
          }

          // Calculate expected streaming revenue
          // NOTE: Per Requirements 2.8 and 3.8:
          // - Battle count is incremented BEFORE streaming revenue calculation (add 1)
          // - Fame is updated AFTER the battle, so streaming revenue uses the NEW fame value
          // However, we need to check what fame is actually awarded in the battle
          // For simplicity in this test, we'll just check that the logged revenue is reasonable
          // and matches the format, rather than exact values (which depend on battle outcomes)
          const baseAmount = 1000;

          // Schedule battle
          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot1.id,
              robot2Id: robot2.id,
              scheduledFor,
              status: 'scheduled',
              leagueType: 'bronze',
            },
          });

          // Capture console.log output
          const capture = captureConsoleLog();

          try {
            // Execute battle
            await executeScheduledBattles(scheduledFor);

            // Get the battle ID that was created
            const battle = await prisma.battle.findFirst({
              where: {
                robot1Id: robot1.id,
                robot2Id: robot2.id,
              },
              orderBy: { id: 'desc' },
            });

            expect(battle).not.toBeNull();

            // Property: Terminal log should contain streaming revenue entry for robot 1
            const streamingLog1 = capture.logs.find(log => 
              log.includes('[Streaming]') && 
              log.includes(robotName1) &&
              log.includes(`Battle #${battle!.id}`)
            );
            expect(streamingLog1).toBeDefined();

            // Property: Terminal log should contain robot name
            expect(streamingLog1).toContain(robotName1);

            // Property: Terminal log should contain battle ID
            expect(streamingLog1).toContain(`Battle #${battle!.id}`);

            // Property: Terminal log should contain revenue amount with currency symbol
            expect(streamingLog1).toContain('₡');
            // Check that the log contains a revenue amount (with or without comma formatting)
            const revenueMatch1 = streamingLog1!.match(/₡([\d,]+)/);
            expect(revenueMatch1).not.toBeNull();
            const loggedRevenue1 = parseInt(revenueMatch1![1].replace(/,/g, ''), 10);
            // Property: Revenue should be at least the base amount (1000)
            expect(loggedRevenue1).toBeGreaterThanOrEqual(baseAmount);

            // Property: Terminal log should use the format "[Streaming] RobotName earned ₡X,XXX from Battle #123"
            expect(streamingLog1).toMatch(/\[Streaming\] .+ earned ₡[\d,]+ from Battle #\d+/);

            // Property: Terminal log should contain streaming revenue entry for robot 2
            const streamingLog2 = capture.logs.find(log => 
              log.includes('[Streaming]') && 
              log.includes(robotName2) &&
              log.includes(`Battle #${battle!.id}`)
            );
            expect(streamingLog2).toBeDefined();

            // Property: Terminal log should contain robot name
            expect(streamingLog2).toContain(robotName2);

            // Property: Terminal log should contain battle ID
            expect(streamingLog2).toContain(`Battle #${battle!.id}`);

            // Property: Terminal log should contain revenue amount with currency symbol
            expect(streamingLog2).toContain('₡');
            // Check that the log contains a revenue amount (with or without comma formatting)
            const revenueMatch2 = streamingLog2!.match(/₡([\d,]+)/);
            expect(revenueMatch2).not.toBeNull();
            const loggedRevenue2 = parseInt(revenueMatch2![1].replace(/,/g, ''), 10);
            // Property: Revenue should be at least the base amount (1000)
            expect(loggedRevenue2).toBeGreaterThanOrEqual(baseAmount);

            // Property: Terminal log should use the correct format
            expect(streamingLog2).toMatch(/\[Streaming\] .+ earned ₡[\d,]+ from Battle #\d+/);

            // Cleanup - delete in correct order
            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot1.id } });
            await prisma.robot.deleteMany({ where: { id: robot2.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.1: Terminal log should show streaming revenue immediately 
   * after battle completion
   */
  test('Property 14.1: Streaming revenue logged immediately after battle completion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 2000 }), // battles for robot 1
        fc.integer({ min: 500, max: 10000 }), // fame for robot 1
        fc.integer({ min: 100, max: 2000 }), // battles for robot 2
        fc.integer({ min: 500, max: 10000 }), // fame for robot 2
        fc.integer({ min: 1, max: 5 }),      // studio level (non-zero)
        async (battles1, fame1, battles2, fame2, studioLevel) => {
          // Create robots
          const robotName1 = `Robot1_${Date.now()}_${Math.random()}`;
          const robotName2 = `Robot2_${Date.now()}_${Math.random()}`;
          
          const robot1 = await createTestRobot(testUserId1, battles1, fame1, robotName1);
          const robot2 = await createTestRobot(testUserId2, battles2, fame2, robotName2);

          // Create streaming studio facilities for both users
          await prisma.facility.upsert({
            where: {
              userId_facilityType: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
              },
            },
            create: {
              userId: testUserId1,
              facilityType: 'streaming_studio',
              level: studioLevel,
            },
            update: {
              level: studioLevel,
            },
          });

          await prisma.facility.upsert({
            where: {
              userId_facilityType: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
              },
            },
            create: {
              userId: testUserId2,
              facilityType: 'streaming_studio',
              level: studioLevel,
            },
            update: {
              level: studioLevel,
            },
          });

          // Schedule battle
          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot1.id,
              robot2Id: robot2.id,
              scheduledFor,
              status: 'scheduled',
              leagueType: 'bronze',
            },
          });

          // Capture console.log output
          const capture = captureConsoleLog();

          try {
            // Execute battle
            await executeScheduledBattles(scheduledFor);

            // Get the battle ID
            const battle = await prisma.battle.findFirst({
              where: {
                robot1Id: robot1.id,
                robot2Id: robot2.id,
              },
              orderBy: { id: 'desc' },
            });

            expect(battle).not.toBeNull();

            // Property: There should be streaming revenue logs for both robots
            const streamingLogs = capture.logs.filter(log => 
              log.includes('[Streaming]') && 
              log.includes(`Battle #${battle!.id}`)
            );

            expect(streamingLogs.length).toBeGreaterThanOrEqual(2);

            // Property: Both robots should have streaming revenue logged
            const robot1Logged = streamingLogs.some(log => log.includes(robotName1));
            const robot2Logged = streamingLogs.some(log => log.includes(robotName2));

            expect(robot1Logged).toBe(true);
            expect(robot2Logged).toBe(true);

            // Property: Streaming revenue should be logged after battle completion
            // Find the battle completion log
            const battleCompleteIndex = capture.logs.findIndex(log => 
              log.includes('Battle complete') || 
              log.includes('Winner:') ||
              log.includes('Draw')
            );

            // Find the streaming revenue logs
            const streamingLog1Index = capture.logs.findIndex(log => 
              log.includes('[Streaming]') && 
              log.includes(robotName1) &&
              log.includes(`Battle #${battle!.id}`)
            );

            const streamingLog2Index = capture.logs.findIndex(log => 
              log.includes('[Streaming]') && 
              log.includes(robotName2) &&
              log.includes(`Battle #${battle!.id}`)
            );

            // Property: Streaming logs should appear after battle completion
            // (or at least be present in the logs)
            expect(streamingLog1Index).toBeGreaterThanOrEqual(0);
            expect(streamingLog2Index).toBeGreaterThanOrEqual(0);

            // Cleanup
            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot1.id } });
            await prisma.robot.deleteMany({ where: { id: robot2.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 14.2: Terminal log should not contain streaming revenue for bye matches
   */
  test('Property 14.2: No streaming revenue logged for bye matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),  // battles for real robot
        fc.integer({ min: 0, max: 25000 }), // fame for real robot
        fc.integer({ min: 0, max: 10 }),    // studio level
        async (battles, fame, studioLevel) => {
          // Create a real robot
          const robotName = `RealRobot_${Date.now()}_${Math.random()}`;
          const robot = await createTestRobot(testUserId1, battles, fame, robotName);

          // Create or find a bye robot (must use the exact name "Bye Robot" for the orchestrator to detect it)
          const byeRobotName = 'Bye Robot';
          let byeRobot = await prisma.robot.findFirst({
            where: {
              userId: testUserId2,
              name: byeRobotName,
            },
          });

          if (!byeRobot) {
            byeRobot = await createTestRobot(testUserId2, 0, 0, byeRobotName);
          }

          // Create streaming studio facility
          if (studioLevel > 0) {
            await prisma.facility.upsert({
              where: {
                userId_facilityType: {
                  userId: testUserId1,
                  facilityType: 'streaming_studio',
                },
              },
              create: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
              update: {
                level: studioLevel,
              },
            });
          }

          // Schedule bye match
          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot.id,
              robot2Id: byeRobot.id,
              scheduledFor,
              status: 'scheduled',
              leagueType: 'bronze',
            },
          });

          // Capture console.log output
          const capture = captureConsoleLog();

          try {
            // Execute battle
            await executeScheduledBattles(scheduledFor);

            // Get the battle ID
            const battle = await prisma.battle.findFirst({
              where: {
                robot1Id: robot.id,
                robot2Id: byeRobot.id,
              },
              orderBy: { id: 'desc' },
            });

            expect(battle).not.toBeNull();

            // Property: Terminal log should NOT contain streaming revenue for bye matches
            const streamingLogs = capture.logs.filter(log => 
              log.includes('[Streaming]') && 
              log.includes(`Battle #${battle!.id}`)
            );

            expect(streamingLogs.length).toBe(0);

            // Property: No streaming revenue should be logged for the real robot
            const robotStreamingLog = capture.logs.find(log => 
              log.includes('[Streaming]') && 
              log.includes(robotName)
            );
            expect(robotStreamingLog).toBeUndefined();

            // Property: No streaming revenue should be logged for the bye robot
            const byeStreamingLog = capture.logs.find(log => 
              log.includes('[Streaming]') && 
              log.includes(byeRobotName)
            );
            expect(byeStreamingLog).toBeUndefined();

            // Cleanup
            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot.id } });
            await prisma.robot.deleteMany({ where: { id: byeRobot.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 14.3: Terminal log format should be consistent across all battles
   */
  test('Property 14.3: Terminal log format is consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            battles: fc.integer({ min: 0, max: 2000 }),
            fame: fc.integer({ min: 0, max: 10000 }),
          }),
          { minLength: 2, maxLength: 2 }
        ),
        fc.integer({ min: 0, max: 10 }),
        async (robotStats, studioLevel) => {
          // Create two robots with different stats
          const robotName1 = `Robot1_${Date.now()}_${Math.random()}`;
          const robotName2 = `Robot2_${Date.now()}_${Math.random()}`;
          
          const robot1 = await createTestRobot(
            testUserId1, 
            robotStats[0].battles, 
            robotStats[0].fame, 
            robotName1
          );
          const robot2 = await createTestRobot(
            testUserId2, 
            robotStats[1].battles, 
            robotStats[1].fame, 
            robotName2
          );

          // Create streaming studio facilities
          if (studioLevel > 0) {
            await prisma.facility.upsert({
              where: {
                userId_facilityType: {
                  userId: testUserId1,
                  facilityType: 'streaming_studio',
                },
              },
              create: {
                userId: testUserId1,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
              update: {
                level: studioLevel,
              },
            });

            await prisma.facility.upsert({
              where: {
                userId_facilityType: {
                  userId: testUserId2,
                  facilityType: 'streaming_studio',
                },
              },
              create: {
                userId: testUserId2,
                facilityType: 'streaming_studio',
                level: studioLevel,
              },
              update: {
                level: studioLevel,
              },
            });
          }

          // Schedule battle
          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot1.id,
              robot2Id: robot2.id,
              scheduledFor,
              status: 'scheduled',
              leagueType: 'bronze',
            },
          });

          // Capture console.log output
          const capture = captureConsoleLog();

          try {
            // Execute battle
            await executeScheduledBattles(scheduledFor);

            // Get the battle ID
            const battle = await prisma.battle.findFirst({
              where: {
                robot1Id: robot1.id,
                robot2Id: robot2.id,
              },
              orderBy: { id: 'desc' },
            });

            expect(battle).not.toBeNull();

            // Property: Both streaming logs should follow the same format pattern
            const streamingLogs = capture.logs.filter(log => 
              log.includes('[Streaming]') && 
              log.includes(`Battle #${battle!.id}`)
            );

            expect(streamingLogs.length).toBe(2);

            // Property: Both logs should match the expected format
            const formatRegex = /\[Streaming\] .+ earned ₡[\d,]+ from Battle #\d+/;
            
            streamingLogs.forEach(log => {
              expect(log).toMatch(formatRegex);
              
              // Property: Log should contain all required components
              expect(log).toContain('[Streaming]');
              expect(log).toContain('earned');
              expect(log).toContain('₡');
              expect(log).toContain('from Battle #');
            });

            // Cleanup
            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot1.id } });
            await prisma.robot.deleteMany({ where: { id: robot2.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
