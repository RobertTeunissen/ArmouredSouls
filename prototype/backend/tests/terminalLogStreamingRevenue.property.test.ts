/**
 * Property-Based Tests for Terminal Log Streaming Revenue
 * Property 14: Terminal Log Contains Streaming Revenue
 * 
 * **Validates: Requirements 9.1-9.6**
 * 
 * For any battle completion during a cycle, the terminal log should contain 
 * a streaming revenue entry with robot name, battle ID, and revenue amount 
 * in the format: "[Streaming] RobotName earned ₡X,XXX from Battle #123"
 * 
 * Note: The battle orchestrator uses winston logger.info() for streaming revenue
 * logs. We intercept winston's Console transport to capture output.
 */

import fc from 'fast-check';
import { Prisma } from '@prisma/client';
import { executeScheduledBattles } from '../src/services/battleOrchestrator';
import { clearSequenceCache } from '../src/services/eventLogger';
import prisma from '../src/lib/prisma';
import logger from '../src/config/logger';
import Transport from 'winston-transport';

// Helper function to create a minimal test robot
async function createTestRobot(userId: number, battles: number, fame: number, name: string) {
  return await prisma.robot.create({
    data: {
      userId, name, frameId: 1, totalBattles: battles, fame,
      combatPower: new Prisma.Decimal(10), targetingSystems: new Prisma.Decimal(10),
      criticalSystems: new Prisma.Decimal(10), penetration: new Prisma.Decimal(10),
      weaponControl: new Prisma.Decimal(10), attackSpeed: new Prisma.Decimal(10),
      armorPlating: new Prisma.Decimal(10), shieldCapacity: new Prisma.Decimal(10),
      evasionThrusters: new Prisma.Decimal(10), damageDampeners: new Prisma.Decimal(10),
      counterProtocols: new Prisma.Decimal(10),
      hullIntegrity: new Prisma.Decimal(10), servoMotors: new Prisma.Decimal(10),
      gyroStabilizers: new Prisma.Decimal(10), hydraulicSystems: new Prisma.Decimal(10),
      powerCore: new Prisma.Decimal(10),
      combatAlgorithms: new Prisma.Decimal(10), threatAnalysis: new Prisma.Decimal(10),
      adaptiveAI: new Prisma.Decimal(10), logicCores: new Prisma.Decimal(10),
      syncProtocols: new Prisma.Decimal(10), supportSystems: new Prisma.Decimal(10),
      formationTactics: new Prisma.Decimal(10),
      currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20, damageTaken: 0,
      elo: 1200, wins: 0, draws: 0, losses: 0,
      damageDealtLifetime: 0, damageTakenLifetime: 0, kills: 0,
      currentLeague: 'bronze', leagueId: 'bronze_1', leaguePoints: 0, cyclesInCurrentLeague: 0,
      repairCost: 0, battleReadiness: 100, totalRepairsPaid: 0,
      yieldThreshold: 10, loadoutType: 'single', stance: 'balanced', mainWeaponId: null,
    },
  });
}

/**
 * Capture winston log output by adding a custom transport.
 * Returns captured messages and a cleanup function.
 */
function captureWinstonLogs(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];

  class CaptureTransport extends Transport {
    log(info: any, callback: () => void) {
      logs.push(info.message || String(info));
      callback();
    }
  }

  const captureTransport = new CaptureTransport();
  logger.add(captureTransport);

  return {
    logs,
    restore: () => {
      logger.remove(captureTransport);
    },
  };
}

describe('Property 14: Terminal Log Contains Streaming Revenue', () => {
  let testUserId1: number;
  let testUserId2: number;

  beforeAll(async () => {
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
    const metadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    const cycleNumber = metadata?.totalCycles || 0;
    clearSequenceCache(cycleNumber);

    await prisma.battleParticipant.deleteMany({
      where: { robot: { OR: [{ userId: testUserId1 }, { userId: testUserId2 }] } },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId1 } }, { robot2: { userId: testUserId1 } },
          { robot1: { userId: testUserId2 } }, { robot2: { userId: testUserId2 } },
        ],
      },
    });
    await prisma.scheduledMatch.deleteMany({
      where: {
        OR: [
          { robot1: { userId: testUserId1 } }, { robot2: { userId: testUserId1 } },
          { robot1: { userId: testUserId2 } }, { robot2: { userId: testUserId2 } },
        ],
      },
    });
    await prisma.robot.deleteMany({
      where: { OR: [{ userId: testUserId1 }, { userId: testUserId2 }] },
    });
    await prisma.facility.deleteMany({
      where: { OR: [{ userId: testUserId1 }, { userId: testUserId2 }] },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { OR: [{ id: testUserId1 }, { id: testUserId2 }] },
    });
    await prisma.$disconnect();
  });

  /**
   * Property 14: Terminal log contains streaming revenue for all battles
   */
  test('Property 14: Terminal log contains streaming revenue for all battles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 25000 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 25000 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        async (battles1, fame1, battles2, fame2, studioLevel1, studioLevel2) => {
          const robotName1 = `TestRobot1_${Date.now()}_${Math.random()}`;
          const robotName2 = `TestRobot2_${Date.now()}_${Math.random()}`;

          const robot1 = await createTestRobot(testUserId1, battles1, fame1, robotName1);
          const robot2 = await createTestRobot(testUserId2, battles2, fame2, robotName2);

          if (studioLevel1 > 0) {
            await prisma.facility.upsert({
              where: { userId_facilityType: { userId: testUserId1, facilityType: 'streaming_studio' } },
              create: { userId: testUserId1, facilityType: 'streaming_studio', level: studioLevel1 },
              update: { level: studioLevel1 },
            });
          }
          if (studioLevel2 > 0) {
            await prisma.facility.upsert({
              where: { userId_facilityType: { userId: testUserId2, facilityType: 'streaming_studio' } },
              create: { userId: testUserId2, facilityType: 'streaming_studio', level: studioLevel2 },
              update: { level: studioLevel2 },
            });
          }

          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot1.id, robot2Id: robot2.id,
              scheduledFor, status: 'scheduled', leagueType: 'bronze',
            },
          });

          const capture = captureWinstonLogs();

          try {
            await executeScheduledBattles(scheduledFor);

            const battle = await prisma.battle.findFirst({
              where: { robot1Id: robot1.id, robot2Id: robot2.id },
              orderBy: { id: 'desc' },
            });
            expect(battle).not.toBeNull();

            // Property: Log should contain streaming revenue entry for robot 1
            const streamingLog1 = capture.logs.find(log =>
              log.includes('[Streaming]') &&
              log.includes(robotName1) &&
              log.includes(`Battle #${battle!.id}`)
            );
            expect(streamingLog1).toBeDefined();
            expect(streamingLog1).toContain('₡');
            expect(streamingLog1).toMatch(/\[Streaming\] .+ earned ₡[\d,]+ from Battle #\d+/);

            // Property: Log should contain streaming revenue entry for robot 2
            const streamingLog2 = capture.logs.find(log =>
              log.includes('[Streaming]') &&
              log.includes(robotName2) &&
              log.includes(`Battle #${battle!.id}`)
            );
            expect(streamingLog2).toBeDefined();
            expect(streamingLog2).toContain('₡');
            expect(streamingLog2).toMatch(/\[Streaming\] .+ earned ₡[\d,]+ from Battle #\d+/);

            // Property: Revenue should be at least the base amount (1000)
            const revenueMatch1 = streamingLog1!.match(/₡([\d,]+)/);
            expect(revenueMatch1).not.toBeNull();
            const loggedRevenue1 = parseInt(revenueMatch1![1].replace(/,/g, ''), 10);
            expect(loggedRevenue1).toBeGreaterThanOrEqual(1000);

            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot1.id } });
            await prisma.robot.deleteMany({ where: { id: robot2.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 14.1: Streaming revenue logged immediately after battle completion
   */
  test('Property 14.1: Streaming revenue logged immediately after battle completion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 500, max: 10000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 500, max: 10000 }),
        fc.integer({ min: 1, max: 5 }),
        async (battles1, fame1, battles2, fame2, studioLevel) => {
          const robotName1 = `Robot1_${Date.now()}_${Math.random()}`;
          const robotName2 = `Robot2_${Date.now()}_${Math.random()}`;

          const robot1 = await createTestRobot(testUserId1, battles1, fame1, robotName1);
          const robot2 = await createTestRobot(testUserId2, battles2, fame2, robotName2);

          await prisma.facility.upsert({
            where: { userId_facilityType: { userId: testUserId1, facilityType: 'streaming_studio' } },
            create: { userId: testUserId1, facilityType: 'streaming_studio', level: studioLevel },
            update: { level: studioLevel },
          });
          await prisma.facility.upsert({
            where: { userId_facilityType: { userId: testUserId2, facilityType: 'streaming_studio' } },
            create: { userId: testUserId2, facilityType: 'streaming_studio', level: studioLevel },
            update: { level: studioLevel },
          });

          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot1.id, robot2Id: robot2.id,
              scheduledFor, status: 'scheduled', leagueType: 'bronze',
            },
          });

          const capture = captureWinstonLogs();

          try {
            await executeScheduledBattles(scheduledFor);

            const battle = await prisma.battle.findFirst({
              where: { robot1Id: robot1.id, robot2Id: robot2.id },
              orderBy: { id: 'desc' },
            });
            expect(battle).not.toBeNull();

            // Property: Both robots should have streaming revenue logged
            const streamingLogs = capture.logs.filter(log =>
              log.includes('[Streaming]') &&
              log.includes(`Battle #${battle!.id}`)
            );
            expect(streamingLogs.length).toBeGreaterThanOrEqual(2);

            const robot1Logged = streamingLogs.some(log => log.includes(robotName1));
            const robot2Logged = streamingLogs.some(log => log.includes(robotName2));
            expect(robot1Logged).toBe(true);
            expect(robot2Logged).toBe(true);

            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot1.id } });
            await prisma.robot.deleteMany({ where: { id: robot2.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 14.2: No streaming revenue logged for bye matches
   */
  test('Property 14.2: No streaming revenue logged for bye matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 25000 }),
        fc.integer({ min: 0, max: 10 }),
        async (battles, fame, studioLevel) => {
          const robotName = `RealRobot_${Date.now()}_${Math.random()}`;
          const robot = await createTestRobot(testUserId1, battles, fame, robotName);

          const byeRobotName = 'Bye Robot';
          let byeRobot = await prisma.robot.findFirst({
            where: { userId: testUserId2, name: byeRobotName },
          });
          if (!byeRobot) {
            byeRobot = await createTestRobot(testUserId2, 0, 0, byeRobotName);
          }

          if (studioLevel > 0) {
            await prisma.facility.upsert({
              where: { userId_facilityType: { userId: testUserId1, facilityType: 'streaming_studio' } },
              create: { userId: testUserId1, facilityType: 'streaming_studio', level: studioLevel },
              update: { level: studioLevel },
            });
          }

          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot.id, robot2Id: byeRobot.id,
              scheduledFor, status: 'scheduled', leagueType: 'bronze',
            },
          });

          const capture = captureWinstonLogs();

          try {
            await executeScheduledBattles(scheduledFor);

            const battle = await prisma.battle.findFirst({
              where: { robot1Id: robot.id, robot2Id: byeRobot.id },
              orderBy: { id: 'desc' },
            });
            expect(battle).not.toBeNull();

            // Property: No streaming revenue should be logged for bye matches
            const streamingLogs = capture.logs.filter(log =>
              log.includes('[Streaming]') &&
              log.includes(`Battle #${battle!.id}`)
            );
            expect(streamingLogs.length).toBe(0);

            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot.id } });
            await prisma.robot.deleteMany({ where: { id: byeRobot.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 14.3: Terminal log format is consistent
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
          const robotName1 = `Robot1_${Date.now()}_${Math.random()}`;
          const robotName2 = `Robot2_${Date.now()}_${Math.random()}`;

          const robot1 = await createTestRobot(testUserId1, robotStats[0].battles, robotStats[0].fame, robotName1);
          const robot2 = await createTestRobot(testUserId2, robotStats[1].battles, robotStats[1].fame, robotName2);

          if (studioLevel > 0) {
            await prisma.facility.upsert({
              where: { userId_facilityType: { userId: testUserId1, facilityType: 'streaming_studio' } },
              create: { userId: testUserId1, facilityType: 'streaming_studio', level: studioLevel },
              update: { level: studioLevel },
            });
            await prisma.facility.upsert({
              where: { userId_facilityType: { userId: testUserId2, facilityType: 'streaming_studio' } },
              create: { userId: testUserId2, facilityType: 'streaming_studio', level: studioLevel },
              update: { level: studioLevel },
            });
          }

          const scheduledFor = new Date();
          const match = await prisma.scheduledMatch.create({
            data: {
              robot1Id: robot1.id, robot2Id: robot2.id,
              scheduledFor, status: 'scheduled', leagueType: 'bronze',
            },
          });

          const capture = captureWinstonLogs();

          try {
            await executeScheduledBattles(scheduledFor);

            const battle = await prisma.battle.findFirst({
              where: { robot1Id: robot1.id, robot2Id: robot2.id },
              orderBy: { id: 'desc' },
            });
            expect(battle).not.toBeNull();

            const streamingLogs = capture.logs.filter(log =>
              log.includes('[Streaming]') &&
              log.includes(`Battle #${battle!.id}`)
            );
            expect(streamingLogs.length).toBe(2);

            const formatRegex = /\[Streaming\] .+ earned ₡[\d,]+ from Battle #\d+/;
            streamingLogs.forEach(log => {
              expect(log).toMatch(formatRegex);
              expect(log).toContain('[Streaming]');
              expect(log).toContain('earned');
              expect(log).toContain('₡');
              expect(log).toContain('from Battle #');
            });

            await prisma.battle.deleteMany({ where: { id: battle!.id } });
            await prisma.scheduledMatch.deleteMany({ where: { id: match.id } });
            await prisma.robot.deleteMany({ where: { id: robot1.id } });
            await prisma.robot.deleteMany({ where: { id: robot2.id } });
          } finally {
            capture.restore();
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
