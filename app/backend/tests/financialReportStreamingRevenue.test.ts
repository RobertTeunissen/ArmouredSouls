/**
 * Test: Financial Report includes Streaming Revenue
 * 
 * Validates Requirement 12.1-12.7: Financial Report Integration
 * 
 * This test verifies that streaming revenue is correctly aggregated
 * and displayed in the daily financial report using BattleParticipant records.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../src/lib/prisma';
import { generateFinancialReport } from '../src/utils/economyCalculations';

describe('Financial Report - Streaming Revenue Integration', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testBattleIds: number[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    // Clean up test data between tests
    if (testBattleIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { battleId: { in: testBattleIds } },
      });
      await prisma.battle.deleteMany({
        where: { id: { in: testBattleIds } },
      });
    }
    if (testRobotIds.length > 0) {
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    testUserIds = [];
    testRobotIds = [];
    testBattleIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Helper to create a battle with participants and streaming revenue */
  async function createBattleWithStreaming(
    robot1Id: number,
    robot2Id: number,
    winnerId: number | null,
    streaming1: number,
    streaming2: number,
  ): Promise<number> {
    const battle = await prisma.battle.create({
      data: {
        robot1Id,
        robot2Id,
        winnerId,
        battleType: 'league',
        leagueType: 'bronze',
        battleLog: {},
        durationSeconds: 60,
        winnerReward: 7500,
        loserReward: 1500,
        robot1ELOBefore: 1200,
        robot2ELOBefore: 1200,
        robot1ELOAfter: 1210,
        robot2ELOAfter: 1190,
        eloChange: 10,
      },
    });
    testBattleIds.push(battle.id);

    await prisma.battleParticipant.createMany({
      data: [
        {
          battleId: battle.id,
          robotId: robot1Id,
          team: 1,
          credits: winnerId === robot1Id ? 7500 : 1500,
          streamingRevenue: streaming1,
          eloBefore: 1200,
          eloAfter: 1210,
          damageDealt: 50,
          finalHP: 80,
        },
        {
          battleId: battle.id,
          robotId: robot2Id,
          team: 2,
          credits: winnerId === robot2Id ? 7500 : 1500,
          streamingRevenue: streaming2,
          eloBefore: 1200,
          eloAfter: 1190,
          damageDealt: 30,
          finalHP: 60,
        },
      ],
    });

    return battle.id;
  }

  it('should include streaming revenue in financial report', async () => {
    const user = await prisma.user.create({
      data: {
        username: `test_streaming_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUserIds.push(user.id);

    const robot = await prisma.robot.create({
      data: {
        name: `TestRobot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: user.id,
        currentLeague: 'bronze',
        elo: 1200,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
        totalBattles: 100,
        wins: 50,
        losses: 50,
        fame: 1000,
      },
    });
    testRobotIds.push(robot.id);

    // Create a dummy opponent robot
    const opponent = await prisma.robot.create({
      data: {
        name: `Opponent_${Date.now()}`,
        userId: user.id, // same user for simplicity
        currentLeague: 'bronze',
        elo: 1200,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
      },
    });
    testRobotIds.push(opponent.id);

    // Create 3 battles with streaming revenue for the robot
    await createBattleWithStreaming(robot.id, opponent.id, robot.id, 1500, 1200);
    await createBattleWithStreaming(robot.id, opponent.id, opponent.id, 1600, 1300);
    await createBattleWithStreaming(opponent.id, robot.id, robot.id, 1400, 1700);

    const report = await generateFinancialReport(user.id, 0);

    // Both robots belong to the same user, so all streaming revenue counts
    // Robot gets: 1500 + 1600 + 1700 = 4800
    // Opponent gets: 1200 + 1300 + 1400 = 3900
    // Total: 8700
    expect(report.revenue.streaming).toBe(8700);
    expect(report.revenue.streamingBattleCount).toBe(6); // 6 participant records with streaming > 0
    expect(report.revenue.total).toBeGreaterThanOrEqual(report.revenue.streaming);
  });

  it('should show zero streaming revenue when no battles occurred', async () => {
    const user = await prisma.user.create({
      data: {
        username: `test_no_battles_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 0,
      },
    });
    testUserIds.push(user.id);

    const report = await generateFinancialReport(user.id, 0);

    expect(report.revenue.streaming).toBe(0);
    expect(report.revenue.streamingBattleCount).toBe(0);
  });

  it('should only count streaming revenue from user\'s own robots', async () => {
    const testUser = await prisma.user.create({
      data: {
        username: `test_own_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUserIds.push(testUser.id);

    const otherUser = await prisma.user.create({
      data: {
        username: `test_other_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 0,
      },
    });
    testUserIds.push(otherUser.id);

    const testRobot = await prisma.robot.create({
      data: {
        name: `TestRobot_own_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: testUser.id,
        currentLeague: 'bronze',
        elo: 1200,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
        totalBattles: 100,
        wins: 50,
        losses: 50,
        fame: 1000,
      },
    });
    testRobotIds.push(testRobot.id);

    const otherRobot = await prisma.robot.create({
      data: {
        name: `OtherRobot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: otherUser.id,
        currentLeague: 'bronze',
        elo: 1200,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
      },
    });
    testRobotIds.push(otherRobot.id);

    // Battle between the two users' robots
    await createBattleWithStreaming(testRobot.id, otherRobot.id, testRobot.id, 2000, 1800);

    const testUserReport = await generateFinancialReport(testUser.id, 0);
    const otherUserReport = await generateFinancialReport(otherUser.id, 0);

    // Test user should only get their robot's streaming (2000)
    expect(testUserReport.revenue.streaming).toBe(2000);
    expect(testUserReport.revenue.streamingBattleCount).toBe(1);

    // Other user should only get their robot's streaming (1800)
    expect(otherUserReport.revenue.streaming).toBe(1800);
    expect(otherUserReport.revenue.streamingBattleCount).toBe(1);
  });
});
