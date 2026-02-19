/**
 * Test: Financial Report includes Streaming Revenue
 * 
 * Validates Requirement 12.1-12.7: Financial Report Integration
 * 
 * This test verifies that streaming revenue is correctly aggregated
 * and displayed in the daily financial report.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../src/lib/prisma';
import { generateFinancialReport } from '../src/utils/economyCalculations';
import { eventLogger, EventType } from '../src/services/eventLogger';

describe('Financial Report - Streaming Revenue Integration', () => {
  let testUserId: number;
  let testRobotId: number;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `test_streaming_report_${Date.now()}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUserId = user.id;

    // Create test robot
    const robot = await prisma.robot.create({
      data: {
        name: `TestRobot_${Date.now()}`,
        userId: testUserId,
        currentLeague: 'bronze',
        elo: 1000,
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
    testRobotId = robot.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testRobotId) {
      await prisma.robot.delete({ where: { id: testRobotId } });
    }
    if (testUserId) {
      await prisma.auditLog.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
  });

  it('should include streaming revenue in financial report', async () => {
    // Create battle_complete events with streaming revenue
    const cycleNumber = 1;
    
    // Log 3 battles with streaming revenue
    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: 1,
        robot1Id: testRobotId,
        robot2Id: 999,
        winnerId: testRobotId,
        streamingRevenue1: 1500,
        streamingRevenue2: 1200,
      },
      { userId: testUserId }
    );

    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: 2,
        robot1Id: testRobotId,
        robot2Id: 998,
        winnerId: 998,
        streamingRevenue1: 1600,
        streamingRevenue2: 1300,
      },
      { userId: testUserId }
    );

    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: 3,
        robot1Id: 997,
        robot2Id: testRobotId,
        winnerId: testRobotId,
        streamingRevenue1: 1400,
        streamingRevenue2: 1700,
      },
      { userId: testUserId }
    );

    // Generate financial report
    const report = await generateFinancialReport(testUserId, 0);

    // Verify streaming revenue is included
    expect(report.revenue.streaming).toBeDefined();
    expect(report.revenue.streamingBattleCount).toBeDefined();

    // Should have 3 battles worth of streaming revenue (1500 + 1600 + 1700 = 4800)
    expect(report.revenue.streaming).toBe(4800);
    expect(report.revenue.streamingBattleCount).toBe(3);

    // Verify streaming revenue is included in total revenue
    expect(report.revenue.total).toBeGreaterThanOrEqual(report.revenue.streaming);
  });

  it('should show zero streaming revenue when no battles occurred', async () => {
    // Create a new user with no battles
    const user = await prisma.user.create({
      data: {
        username: `test_no_battles_${Date.now()}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 0,
      },
    });

    try {
      const report = await generateFinancialReport(user.id, 0);

      // Should show zero streaming revenue
      expect(report.revenue.streaming).toBe(0);
      expect(report.revenue.streamingBattleCount).toBe(0);
    } finally {
      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should only count streaming revenue from user\'s own robots', async () => {
    // Create another user and robot
    const otherUser = await prisma.user.create({
      data: {
        username: `test_other_user_${Date.now()}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 0,
      },
    });

    const otherRobot = await prisma.robot.create({
      data: {
        name: `OtherRobot_${Date.now()}`,
        userId: otherUser.id,
        currentLeague: 'bronze',
        elo: 1000,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
      },
    });

    try {
      // Log a battle between test user's robot and other user's robot
      await eventLogger.logEvent(
        1,
        EventType.BATTLE_COMPLETE,
        {
          battleId: 100,
          robot1Id: testRobotId,
          robot2Id: otherRobot.id,
          winnerId: testRobotId,
          streamingRevenue1: 2000,
          streamingRevenue2: 1800,
        },
        { userId: testUserId }
      );

      // Generate reports for both users
      const testUserReport = await generateFinancialReport(testUserId, 0);
      const otherUserReport = await generateFinancialReport(otherUser.id, 0);

      // Test user should only get streamingRevenue1 (2000)
      expect(testUserReport.revenue.streaming).toBeGreaterThanOrEqual(2000);

      // Other user should only get streamingRevenue2 (1800)
      expect(otherUserReport.revenue.streaming).toBe(1800);
      expect(otherUserReport.revenue.streamingBattleCount).toBe(1);
    } finally {
      // Clean up
      await prisma.robot.delete({ where: { id: otherRobot.id } });
      await prisma.auditLog.deleteMany({ where: { userId: otherUser.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    }
  });
});
