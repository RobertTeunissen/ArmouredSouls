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
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    // Clean up test data between tests
    await prisma.auditLog.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } },
    });
    
    // Reset tracking arrays
    testUserIds = [];
    testRobotIds = [];
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.auditLog.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.$disconnect();
  });

  it('should include streaming revenue in financial report', async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: `test_streaming_report_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUserIds.push(user.id);

    // Create test robot
    const robot = await prisma.robot.create({
      data: {
        name: `TestRobot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: user.id,
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
    testRobotIds.push(robot.id);

    // Create battle_complete events with streaming revenue
    const cycleNumber = 10000 + Math.floor(Math.random() * 1000);
    
    // Log 3 battles with streaming revenue
    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: Date.now() + 1,
        robot1Id: robot.id,
        robot2Id: 999,
        winnerId: robot.id,
        streamingRevenue1: 1500,
        streamingRevenue2: 1200,
      },
      { userId: user.id }
    );

    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: Date.now() + 2,
        robot1Id: robot.id,
        robot2Id: 998,
        winnerId: 998,
        streamingRevenue1: 1600,
        streamingRevenue2: 1300,
      },
      { userId: user.id }
    );

    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: Date.now() + 3,
        robot1Id: 997,
        robot2Id: robot.id,
        winnerId: robot.id,
        streamingRevenue1: 1400,
        streamingRevenue2: 1700,
      },
      { userId: user.id }
    );

    // Generate financial report
    const report = await generateFinancialReport(user.id, 0);

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
        username: `test_no_battles_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 0,
      },
    });
    testUserIds.push(user.id);

    const report = await generateFinancialReport(user.id, 0);

    // Should show zero streaming revenue
    expect(report.revenue.streaming).toBe(0);
    expect(report.revenue.streamingBattleCount).toBe(0);
  });

  it('should only count streaming revenue from user\'s own robots', async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: `test_user_own_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 1000,
      },
    });
    testUserIds.push(testUser.id);

    // Create test robot
    const testRobot = await prisma.robot.create({
      data: {
        name: `TestRobot_own_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: testUser.id,
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
    testRobotIds.push(testRobot.id);

    // Create another user and robot
    const otherUser = await prisma.user.create({
      data: {
        username: `test_other_user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        passwordHash: 'hashedpassword',
        currency: 100000,
        prestige: 0,
      },
    });
    testUserIds.push(otherUser.id);

    const otherRobot = await prisma.robot.create({
      data: {
        name: `OtherRobot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: otherUser.id,
        currentLeague: 'bronze',
        elo: 1000,
        maxHP: 100,
        currentHP: 100,
        maxShield: 50,
        currentShield: 50,
      },
    });
    testRobotIds.push(otherRobot.id);

    // Log a battle between test user's robot and other user's robot
    const cycleNumber = 10000 + Math.floor(Math.random() * 1000);
    await eventLogger.logEvent(
      cycleNumber,
      EventType.BATTLE_COMPLETE,
      {
        battleId: Date.now() + 100,
        robot1Id: testRobot.id,
        robot2Id: otherRobot.id,
        winnerId: testRobot.id,
        streamingRevenue1: 2000,
        streamingRevenue2: 1800,
      },
      { userId: testUser.id }
    );

    // Generate reports for both users
    const testUserReport = await generateFinancialReport(testUser.id, 0);
    const otherUserReport = await generateFinancialReport(otherUser.id, 0);

    // Test user should only get streamingRevenue1 (2000)
    expect(testUserReport.revenue.streaming).toBeGreaterThanOrEqual(2000);

    // Other user should only get streamingRevenue2 (1800)
    expect(otherUserReport.revenue.streaming).toBe(1800);
    expect(otherUserReport.revenue.streamingBattleCount).toBe(1);
  });
});
