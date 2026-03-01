/**
 * Unit tests for RobotPerformanceService
 * 
 * Tests robot performance queries, aggregation, and ELO progression.
 * Refactored to use BattleParticipant schema (replaces old Battle-level fields).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import prisma from '../src/lib/prisma';
import { robotPerformanceService } from '../src/services/robotPerformanceService';
import { eventLogger } from '../src/services/eventLogger';

/**
 * Helper to create a battle with BattleParticipant records.
 */
async function createBattleWithParticipants(opts: {
  robot1Id: number;
  robot2Id: number;
  winnerId: number | null;
  robot1: { eloBefore: number; eloAfter: number; damageDealt: number; finalHP: number; fameAwarded: number; credits: number; destroyed?: boolean };
  robot2: { eloBefore: number; eloAfter: number; damageDealt: number; finalHP: number; fameAwarded: number; credits: number; destroyed?: boolean };
}) {
  const eloChange = Math.abs(opts.robot1.eloAfter - opts.robot1.eloBefore);
  return prisma.battle.create({
    data: {
      robot1Id: opts.robot1Id,
      robot2Id: opts.robot2Id,
      winnerId: opts.winnerId,
      battleType: 'league',
      leagueType: 'bronze',
      battleLog: { events: [] },
      durationSeconds: 30,
      robot1ELOBefore: opts.robot1.eloBefore,
      robot2ELOBefore: opts.robot2.eloBefore,
      robot1ELOAfter: opts.robot1.eloAfter,
      robot2ELOAfter: opts.robot2.eloAfter,
      eloChange,
      winnerReward: opts.winnerId ? opts.robot1Id === opts.winnerId ? opts.robot1.credits : opts.robot2.credits : 0,
      loserReward: opts.winnerId ? opts.robot1Id === opts.winnerId ? opts.robot2.credits : opts.robot1.credits : 500,
      participants: {
        create: [
          {
            robotId: opts.robot1Id,
            team: 1,
            eloBefore: opts.robot1.eloBefore,
            eloAfter: opts.robot1.eloAfter,
            damageDealt: opts.robot1.damageDealt,
            finalHP: opts.robot1.finalHP,
            fameAwarded: opts.robot1.fameAwarded,
            credits: opts.robot1.credits,
            prestigeAwarded: 0,
            streamingRevenue: 0,
            yielded: false,
            destroyed: opts.robot1.destroyed ?? false,
          },
          {
            robotId: opts.robot2Id,
            team: 2,
            eloBefore: opts.robot2.eloBefore,
            eloAfter: opts.robot2.eloAfter,
            damageDealt: opts.robot2.damageDealt,
            finalHP: opts.robot2.finalHP,
            fameAwarded: opts.robot2.fameAwarded,
            credits: opts.robot2.credits,
            prestigeAwarded: 0,
            streamingRevenue: 0,
            yielded: false,
            destroyed: opts.robot2.destroyed ?? false,
          },
        ],
      },
    },
    include: { participants: true },
  });
}

describe('RobotPerformanceService', () => {
  let testUserId: number;
  let testRobotId: number;
  let testRobot2Id: number;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        username: `test_robot_perf_${Date.now()}`,
        passwordHash: 'test',
        currency: 1000000,
      },
    });
    testUserId = user.id;

    const robot1 = await prisma.robot.create({
      data: { userId: testUserId, name: 'TestRobot1', currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20, elo: 1200 },
    });
    testRobotId = robot1.id;

    const robot2 = await prisma.robot.create({
      data: { userId: testUserId, name: 'TestRobot2', currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20, elo: 1200 },
    });
    testRobot2Id = robot2.id;
  });

  afterAll(async () => {
    await prisma.battleParticipant.deleteMany({
      where: { robotId: { in: [testRobotId, testRobot2Id] } },
    });
    await prisma.battle.deleteMany({
      where: { OR: [{ robot1Id: { in: [testRobotId, testRobot2Id] } }, { robot2Id: { in: [testRobotId, testRobot2Id] } }] },
    });
    await prisma.robot.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.auditLog.deleteMany({ where: { cycleNumber: { gte: 1000 } } });
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: { gte: 1000 } } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.battleParticipant.deleteMany({
      where: { robotId: { in: [testRobotId, testRobot2Id] } },
    });
    await prisma.battle.deleteMany({
      where: { OR: [{ robot1Id: { in: [testRobotId, testRobot2Id] } }, { robot2Id: { in: [testRobotId, testRobot2Id] } }] },
    });
    await prisma.auditLog.deleteMany({ where: { cycleNumber: { gte: 1000 } } });
    await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: { gte: 1000 } } });
  });

  describe('getRobotPerformanceSummary', () => {
    it('should return empty summary when no battles exist', async () => {
      const cycleNumber = 1000;
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleComplete(cycleNumber, 1000);

      const summary = await robotPerformanceService.getRobotPerformanceSummary(testRobotId, [cycleNumber, cycleNumber]);

      expect(summary.robotId).toBe(testRobotId);
      expect(summary.battlesParticipated).toBe(0);
      expect(summary.wins).toBe(0);
      expect(summary.losses).toBe(0);
      expect(summary.draws).toBe(0);
      expect(summary.winRate).toBe(0);
      expect(summary.damageDealt).toBe(0);
      expect(summary.damageReceived).toBe(0);
      expect(summary.totalCreditsEarned).toBe(0);
    });

    it('should aggregate battle statistics correctly', async () => {
      const cycleNumber = 1001;
      await eventLogger.logCycleStart(cycleNumber, 'manual');

      // Battle 1: testRobot wins
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      // Battle 2: testRobot2 wins (testRobot is robot2 position)
      await createBattleWithParticipants({
        robot1Id: testRobot2Id, robot2Id: testRobotId, winnerId: testRobot2Id,
        robot1: { eloBefore: 1180, eloAfter: 1200, damageDealt: 120, finalHP: 30, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1220, eloAfter: 1200, damageDealt: 70, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      await eventLogger.logCycleComplete(cycleNumber, 2000);

      const summary = await robotPerformanceService.getRobotPerformanceSummary(testRobotId, [cycleNumber, cycleNumber]);

      expect(summary.robotId).toBe(testRobotId);
      expect(summary.battlesParticipated).toBe(2);
      expect(summary.wins).toBe(1);
      expect(summary.losses).toBe(1);
      expect(summary.draws).toBe(0);
      expect(summary.winRate).toBe(50);
      expect(summary.damageDealt).toBe(170); // 100 + 70
      expect(summary.damageReceived).toBe(170); // 50 + 120
      expect(summary.totalCreditsEarned).toBe(1500); // 1000 + 500
      expect(summary.totalFameEarned).toBe(30); // 20 + 10
      expect(summary.eloChange).toBe(0); // +20 - 20
      expect(summary.eloStart).toBe(1200);
      expect(summary.eloEnd).toBe(1200);
    });

    it('should calculate win rate correctly with draws', async () => {
      const cycleNumber = 1002;
      await eventLogger.logCycleStart(cycleNumber, 'manual');

      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: null,
        robot1: { eloBefore: 1200, eloAfter: 1200, damageDealt: 90, finalHP: 10, fameAwarded: 10, credits: 500 },
        robot2: { eloBefore: 1200, eloAfter: 1200, damageDealt: 90, finalHP: 10, fameAwarded: 10, credits: 500 },
      });

      await eventLogger.logCycleComplete(cycleNumber, 1000);

      const summary = await robotPerformanceService.getRobotPerformanceSummary(testRobotId, [cycleNumber, cycleNumber]);

      expect(summary.battlesParticipated).toBe(1);
      expect(summary.wins).toBe(0);
      expect(summary.losses).toBe(0);
      expect(summary.draws).toBe(1);
      expect(summary.winRate).toBe(0);
    });

    it('should aggregate across multiple cycles', async () => {
      const cycle1 = 1003;
      const cycle2 = 1004;

      // Cycle 1: win
      await eventLogger.logCycleStart(cycle1, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle1, 1000);

      // Cycle 2: win
      await eventLogger.logCycleStart(cycle2, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1220, eloAfter: 1240, damageDealt: 100, finalHP: 60, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1180, eloAfter: 1160, damageDealt: 40, finalHP: 0, fameAwarded: 10, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle2, 1000);

      const summary = await robotPerformanceService.getRobotPerformanceSummary(testRobotId, [cycle1, cycle2]);

      expect(summary.battlesParticipated).toBe(2);
      expect(summary.wins).toBe(2);
      expect(summary.losses).toBe(0);
      expect(summary.winRate).toBe(100);
      expect(summary.damageDealt).toBe(200);
      expect(summary.damageReceived).toBe(90); // 50 + 40
      expect(summary.totalCreditsEarned).toBe(2000);
      expect(summary.eloChange).toBe(40);
      expect(summary.eloStart).toBe(1200);
      expect(summary.eloEnd).toBe(1240);
    });
  });

  describe('getELOProgression', () => {
    it('should return empty progression when no battles exist', async () => {
      const cycleNumber = 1005;
      await eventLogger.logCycleStart(cycleNumber, 'manual');
      await eventLogger.logCycleComplete(cycleNumber, 1000);

      const progression = await robotPerformanceService.getELOProgression(testRobotId, [cycleNumber, cycleNumber]);

      expect(progression.robotId).toBe(testRobotId);
      expect(progression.dataPoints).toHaveLength(0);
      expect(progression.startElo).toBe(0);
      expect(progression.endElo).toBe(0);
      expect(progression.totalChange).toBe(0);
    });

    it('should track ELO progression across cycles', async () => {
      const cycle1 = 1006;
      const cycle2 = 1007;

      // Cycle 1: Win (+20)
      await eventLogger.logCycleStart(cycle1, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle1, 1000);

      // Cycle 2: Loss (-15)
      await eventLogger.logCycleStart(cycle2, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobot2Id, robot2Id: testRobotId, winnerId: testRobot2Id,
        robot1: { eloBefore: 1180, eloAfter: 1195, damageDealt: 120, finalHP: 30, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1220, eloAfter: 1205, damageDealt: 70, finalHP: 0, fameAwarded: 10, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle2, 1000);

      const progression = await robotPerformanceService.getELOProgression(testRobotId, [cycle1, cycle2]);

      expect(progression.robotId).toBe(testRobotId);
      expect(progression.dataPoints).toHaveLength(2);
      expect(progression.startElo).toBe(1200);
      expect(progression.endElo).toBe(1205);
      expect(progression.totalChange).toBe(5); // +20 - 15

      expect(progression.dataPoints[0].cycleNumber).toBe(cycle1);
      expect(progression.dataPoints[0].elo).toBe(1220);
      expect(progression.dataPoints[0].change).toBe(20);

      expect(progression.dataPoints[1].cycleNumber).toBe(cycle2);
      expect(progression.dataPoints[1].elo).toBe(1205);
      expect(progression.dataPoints[1].change).toBe(-15);
    });

    it('should handle multiple battles in a single cycle', async () => {
      const cycleNumber = 1008;
      await eventLogger.logCycleStart(cycleNumber, 'manual');

      // Battle 1: Win (+20)
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      // Battle 2: Win (+15)
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1220, eloAfter: 1235, damageDealt: 100, finalHP: 60, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1180, eloAfter: 1165, damageDealt: 40, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      await eventLogger.logCycleComplete(cycleNumber, 2000);

      const progression = await robotPerformanceService.getELOProgression(testRobotId, [cycleNumber, cycleNumber]);

      expect(progression.dataPoints).toHaveLength(1);
      expect(progression.dataPoints[0].cycleNumber).toBe(cycleNumber);
      expect(progression.dataPoints[0].elo).toBe(1235);
      expect(progression.dataPoints[0].change).toBe(35); // 20 + 15
      expect(progression.totalChange).toBe(35);
    });
  });

  describe('getRobotMetricProgression', () => {
    it('should track ELO progression', async () => {
      const cycle1 = 2001;
      const cycle2 = 2002;

      await eventLogger.logCycleStart(cycle1, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle1, 1000);

      await eventLogger.logCycleStart(cycle2, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobot2Id, robot2Id: testRobotId, winnerId: testRobot2Id,
        robot1: { eloBefore: 1180, eloAfter: 1195, damageDealt: 120, finalHP: 30, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1220, eloAfter: 1205, damageDealt: 70, finalHP: 0, fameAwarded: 10, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle2, 1000);

      const progression = await robotPerformanceService.getRobotMetricProgression(testRobotId, 'elo', [cycle1, cycle2]);

      expect(progression.robotId).toBe(testRobotId);
      expect(progression.metric).toBe('elo');
      expect(progression.dataPoints).toHaveLength(2);
      expect(progression.startValue).toBe(1200);
      expect(progression.endValue).toBe(1205);
      expect(progression.totalChange).toBe(5);
      expect(progression.movingAverage).toBeDefined();
    });

    it('should track fame progression', async () => {
      const cycle1 = 2003;
      const cycle2 = 2004;

      await eventLogger.logCycleStart(cycle1, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 50, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 25, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle1, 1000);

      await eventLogger.logCycleStart(cycle2, 'manual');
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1220, eloAfter: 1240, damageDealt: 100, finalHP: 60, fameAwarded: 75, credits: 1000 },
        robot2: { eloBefore: 1180, eloAfter: 1160, damageDealt: 40, finalHP: 0, fameAwarded: 30, credits: 500 },
      });
      await eventLogger.logCycleComplete(cycle2, 1000);

      const progression = await robotPerformanceService.getRobotMetricProgression(testRobotId, 'fame', [cycle1, cycle2]);

      expect(progression.metric).toBe('fame');
      expect(progression.dataPoints).toHaveLength(2);
      expect(progression.dataPoints[0].value).toBe(50);
      expect(progression.dataPoints[0].change).toBe(50);
      expect(progression.dataPoints[1].value).toBe(125); // 50 + 75
      expect(progression.dataPoints[1].change).toBe(75);
      expect(progression.totalChange).toBe(125);
    });

    it('should track damage dealt progression', async () => {
      const cycleNumber = 2005;
      await eventLogger.logCycleStart(cycleNumber, 'manual');

      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 150, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1220, eloAfter: 1235, damageDealt: 200, finalHP: 60, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1180, eloAfter: 1165, damageDealt: 40, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      await eventLogger.logCycleComplete(cycleNumber, 2000);

      const progression = await robotPerformanceService.getRobotMetricProgression(testRobotId, 'damageDealt', [cycleNumber, cycleNumber]);

      expect(progression.metric).toBe('damageDealt');
      expect(progression.dataPoints).toHaveLength(1);
      expect(progression.dataPoints[0].value).toBe(350); // 150 + 200
      expect(progression.dataPoints[0].change).toBe(350);
      expect(progression.totalChange).toBe(350);
    });

    it('should track wins progression', async () => {
      const cycleNumber = 2006;
      await eventLogger.logCycleStart(cycleNumber, 'manual');

      // Win
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      // Loss
      await createBattleWithParticipants({
        robot1Id: testRobot2Id, robot2Id: testRobotId, winnerId: testRobot2Id,
        robot1: { eloBefore: 1180, eloAfter: 1195, damageDealt: 120, finalHP: 30, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1220, eloAfter: 1205, damageDealt: 70, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      // Win
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1205, eloAfter: 1220, damageDealt: 100, finalHP: 60, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1195, eloAfter: 1180, damageDealt: 40, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      await eventLogger.logCycleComplete(cycleNumber, 3000);

      const progression = await robotPerformanceService.getRobotMetricProgression(testRobotId, 'wins', [cycleNumber, cycleNumber]);

      expect(progression.metric).toBe('wins');
      expect(progression.dataPoints).toHaveLength(1);
      expect(progression.dataPoints[0].value).toBe(2);
      expect(progression.dataPoints[0].change).toBe(2);
      expect(progression.totalChange).toBe(2);
    });

    it('should track credits earned progression', async () => {
      const cycleNumber = 2007;
      await eventLogger.logCycleStart(cycleNumber, 'manual');

      // Win: 1000 credits
      await createBattleWithParticipants({
        robot1Id: testRobotId, robot2Id: testRobot2Id, winnerId: testRobotId,
        robot1: { eloBefore: 1200, eloAfter: 1220, damageDealt: 100, finalHP: 50, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1200, eloAfter: 1180, damageDealt: 50, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      // Loss: 500 credits
      await createBattleWithParticipants({
        robot1Id: testRobot2Id, robot2Id: testRobotId, winnerId: testRobot2Id,
        robot1: { eloBefore: 1180, eloAfter: 1195, damageDealt: 120, finalHP: 30, fameAwarded: 20, credits: 1000 },
        robot2: { eloBefore: 1220, eloAfter: 1205, damageDealt: 70, finalHP: 0, fameAwarded: 10, credits: 500 },
      });

      await eventLogger.logCycleComplete(cycleNumber, 2000);

      const progression = await robotPerformanceService.getRobotMetricProgression(testRobotId, 'creditsEarned', [cycleNumber, cycleNumber]);

      expect(progression.metric).toBe('creditsEarned');
      expect(progression.dataPoints).toHaveLength(1);
      expect(progression.dataPoints[0].value).toBe(1500); // 1000 + 500
      expect(progression.dataPoints[0].change).toBe(1500);
      expect(progression.totalChange).toBe(1500);
    });
  });
});
