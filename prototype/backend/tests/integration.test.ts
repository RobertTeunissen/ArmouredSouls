/**
 * Integration Test: Complete Daily Cycle
 * Tests the full matchmaking system from end to end
 */

import { PrismaClient } from '@prisma/client';
import { executeScheduledBattles } from '../src/services/battleOrchestrator';
import { runMatchmaking } from '../src/services/matchmakingService';
import { rebalanceLeagues } from '../src/services/leagueRebalancingService';

const prisma = new PrismaClient();

describe('Integration Test: Complete Daily Cycle', () => {
  beforeAll(async () => {
    // Ensure database is seeded with test data
    const robotCount = await prisma.robot.count();
    if (robotCount < 10) {
      console.warn('Warning: Database should have at least 10 robots for integration testing');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should execute complete daily cycle successfully', async () => {
    // Step 1: Clear existing scheduled matches
    await prisma.scheduledMatch.deleteMany({
      where: { status: 'scheduled' },
    });

    // Step 2: Get initial robot stats
    const initialRobots = await prisma.robot.findMany({
      where: {
        currentHP: { gte: 75 }, // Battle-ready robots
      },
      select: {
        id: true,
        name: true,
        elo: true,
        currentHP: true,
        leaguePoints: true,
        totalBattles: true,
      },
      take: 10,
    });

    expect(initialRobots.length).toBeGreaterThan(0);
    console.log(`Starting with ${initialRobots.length} battle-ready robots`);

    // Step 3: Run matchmaking
    console.log('\n--- Step 1: Matchmaking ---');
    const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const matchesCreated = await runMatchmaking(scheduledFor);

    expect(matchesCreated).toBeGreaterThan(0);
    console.log(`Matches created: ${matchesCreated}`);

    // Verify scheduled matches were created
    const scheduledMatches = await prisma.scheduledMatch.findMany({
      where: { status: 'scheduled' },
    });
    expect(scheduledMatches.length).toBeGreaterThan(0);

    // Step 4: Execute battles
    console.log('\n--- Step 2: Battle Execution ---');
    const battleResult = await executeScheduledBattles(scheduledFor);

    expect(battleResult.totalBattles).toBeGreaterThan(0);
    expect(battleResult.successfulBattles).toBeGreaterThan(0);
    expect(battleResult.failedBattles).toBe(0);
    console.log(`Battles executed: ${battleResult.successfulBattles}/${battleResult.totalBattles}`);

    // Verify battles were created
    const battles = await prisma.battle.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // Last minute
        },
      },
    });
    expect(battles.length).toBeGreaterThan(0);

    // Verify scheduled matches were marked completed
    const completedMatches = await prisma.scheduledMatch.findMany({
      where: {
        status: 'completed',
        battleId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(completedMatches.length).toBeGreaterThan(0);

    // Step 5: Verify robot stats were updated
    console.log('\n--- Step 3: Verify Stat Updates ---');
    const updatedRobots = await prisma.robot.findMany({
      where: {
        id: { in: initialRobots.map(r => r.id) },
      },
      select: {
        id: true,
        name: true,
        elo: true,
        currentHP: true,
        leaguePoints: true,
        totalBattles: true,
        wins: true,
        losses: true,
      },
    });

    // At least one robot should have updated stats
    const robotsWithUpdatedBattles = updatedRobots.filter(
      (robot, index) => robot.totalBattles > initialRobots[index].totalBattles
    );
    expect(robotsWithUpdatedBattles.length).toBeGreaterThan(0);
    console.log(`${robotsWithUpdatedBattles.length} robots participated in battles`);

    // Verify ELO changes
    const robotsWithELOChange = updatedRobots.filter(
      (robot, index) => robot.elo !== initialRobots[index].elo
    );
    expect(robotsWithELOChange.length).toBeGreaterThan(0);
    console.log(`${robotsWithELOChange.length} robots had ELO changes`);

    // Verify HP changes
    const robotsWithHPChange = updatedRobots.filter(
      (robot, index) => robot.currentHP < initialRobots[index].currentHP
    );
    expect(robotsWithHPChange.length).toBeGreaterThan(0);
    console.log(`${robotsWithHPChange.length} robots took damage`);

    // Step 6: Run league rebalancing (if enough battles)
    console.log('\n--- Step 4: League Rebalancing ---');
    
    // Check if any tier has enough robots with enough battles
    const eligibleRobots = await prisma.robot.count({
      where: {
        totalBattles: { gte: 5 },
      },
    });

    if (eligibleRobots >= 10) {
      const rebalanceResult = await rebalanceLeagues();
      console.log(`Promotions: ${rebalanceResult.totalPromoted}`);
      console.log(`Demotions: ${rebalanceResult.totalDemoted}`);
      
      // Rebalancing should complete without errors
      expect(rebalanceResult).toBeDefined();
    } else {
      console.log('Skipping rebalancing - insufficient battle history');
    }

    // Step 7: Verify battle logs are generated
    console.log('\n--- Step 5: Verify Battle Logs ---');
    const battleWithLog = await prisma.battle.findFirst({
      where: {
        battleLog: { not: null },
      },
    });

    expect(battleWithLog).toBeDefined();
    expect(battleWithLog?.battleLog).toBeDefined();
    
    const battleLog = battleWithLog?.battleLog as any;
    expect(battleLog.events).toBeDefined();
    expect(Array.isArray(battleLog.events)).toBe(true);
    expect(battleLog.events.length).toBeGreaterThan(0);
    console.log(`Battle log has ${battleLog.events.length} events`);

    // Verify battle log structure
    const hasStartEvent = battleLog.events.some((e: any) => e.type === 'battle_start');
    const hasEndEvent = battleLog.events.some((e: any) => e.type === 'battle_end');
    const hasELOEvents = battleLog.events.some((e: any) => e.type === 'elo_change');

    expect(hasStartEvent).toBe(true);
    expect(hasEndEvent).toBe(true);
    expect(hasELOEvents).toBe(true);

    console.log('\n✅ Complete daily cycle test passed!');
  }, 60000); // 60 second timeout

  it('should handle odd number of robots with bye-robot', async () => {
    // Clear scheduled matches
    await prisma.scheduledMatch.deleteMany({
      where: { status: 'scheduled' },
    });

    // Get bye-robot
    const byeRobot = await prisma.robot.findFirst({
      where: { name: 'Bye Robot' },
    });

    if (!byeRobot) {
      console.log('Bye Robot not found, skipping test');
      return;
    }

    // Run matchmaking
    const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const matchesCreated = await runMatchmaking(scheduledFor);

    // Check if any matches involve bye-robot
    const byeMatches = await prisma.scheduledMatch.findMany({
      where: {
        OR: [
          { robot1Id: byeRobot.id },
          { robot2Id: byeRobot.id },
        ],
        status: 'scheduled',
      },
    });

    if (byeMatches.length > 0) {
      console.log(`${byeMatches.length} bye-robot matches created`);

      // Execute battles
      const battleResult = await executeScheduledBattles(scheduledFor);

      // Find bye-robot battles
      const byeBattles = await prisma.battle.findMany({
        where: {
          OR: [
            { robot1Id: byeRobot.id },
            { robot2Id: byeRobot.id },
          ],
          createdAt: {
            gte: new Date(Date.now() - 60 * 1000),
          },
        },
      });

      // Verify bye-robot battles result in player wins
      byeBattles.forEach(battle => {
        const playerWon = battle.winnerId !== byeRobot.id;
        expect(playerWon).toBe(true);
        console.log(`Bye-robot battle: Player won ✓`);
      });
    } else {
      console.log('No bye-robot matches needed (even number of robots)');
    }
  }, 30000);

  it('should handle edge case: no battle-ready robots', async () => {
    // This test verifies the system handles robots below battle readiness gracefully
    const matchesCreated = await runMatchmaking(new Date());
    
    // Should complete without errors even if no matches created
    expect(matchesCreated).toBeGreaterThanOrEqual(0);
  });

  it('should maintain data consistency after cycle', async () => {
    // Verify all completed scheduled matches have corresponding battles
    const completedMatches = await prisma.scheduledMatch.findMany({
      where: {
        status: 'completed',
        battleId: null, // Should not exist - all completed matches should have battleId
      },
    });

    expect(completedMatches.length).toBe(0);

    // Verify all battles have valid participants
    const invalidBattles = await prisma.battle.findMany({
      where: {
        OR: [
          { robot1Id: null },
          { robot2Id: null },
        ],
      },
    });

    expect(invalidBattles.length).toBe(0);
  });
});
