import { PrismaClient } from '@prisma/client';
import {
  rebalanceLeagues,
} from '../../src/services/leagueRebalancingService';
import {
  getLeagueInstanceStats,
  MAX_ROBOTS_PER_INSTANCE,
} from '../../src/services/leagueInstanceService';

const prisma = new PrismaClient();

/**
 * Integration test for the bronze league rebalancing bug fix.
 * 
 * This test reproduces the issue where 331 robots in Bronze 1
 * were not being rebalanced into multiple instances.
 */
describe('Bronze League Rebalancing - Integration Test', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.facility.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should correctly rebalance 331 robots from single bronze instance into multiple instances', async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: 'test_bronze_rebalance_user',
        passwordHash: 'hash',
      },
    });

    // Simulate the bug scenario: 331 robots all in bronze_1
    // These robots have been in the league for >= 5 cycles
    const robots = [];
    for (let i = 0; i < 331; i++) {
      robots.push({
        userId: user.id,
        name: `Robot ${i}`,
        leagueId: 'bronze_1',
        currentLeague: 'bronze' as const,
        leaguePoints: Math.floor(Math.random() * 100), // Random points for realistic distribution
        elo: 1000 + Math.floor(Math.random() * 500), // Random ELO
        cyclesInCurrentLeague: 10, // All have been in bronze for 10 cycles (issue scenario)
        currentHP: 10,
        maxHP: 10,
        currentShield: 2,
        maxShield: 2,
      });
    }
    await prisma.robot.createMany({ data: robots });

    // Verify initial state - all robots in one instance
    const initialStats = await getLeagueInstanceStats('bronze');
    expect(initialStats.totalRobots).toBe(331);
    expect(initialStats.instances).toHaveLength(1);
    expect(initialStats.instances[0].leagueId).toBe('bronze_1');
    expect(initialStats.instances[0].currentRobots).toBe(331);
    
    // The fix: needsRebalancing should be TRUE because instance exceeds MAX_ROBOTS_PER_INSTANCE
    expect(initialStats.needsRebalancing).toBe(true);

    // Run rebalancing - this will:
    // 1. Promote top 10% to silver (33 robots)
    // 2. Rebalance remaining 298 robots across bronze instances
    const summary = await rebalanceLeagues();

    // Verify promotions happened
    expect(summary.totalPromoted).toBe(33); // Top 10% of 331

    // Verify bronze league is now properly distributed across multiple instances
    const finalStats = await getLeagueInstanceStats('bronze');
    const remainingInBronze = 331 - 33; // 298 robots
    expect(finalStats.totalRobots).toBe(remainingInBronze);

    // With 298 robots and MAX_ROBOTS_PER_INSTANCE=100, we should have 3 instances
    const expectedInstances = Math.ceil(remainingInBronze / MAX_ROBOTS_PER_INSTANCE);
    expect(finalStats.instances).toHaveLength(expectedInstances);

    // Verify no instance exceeds the maximum
    finalStats.instances.forEach((instance) => {
      expect(instance.currentRobots).toBeLessThanOrEqual(MAX_ROBOTS_PER_INSTANCE);
    });

    // Verify robots are distributed evenly
    const robotsPerInstance = Math.ceil(remainingInBronze / expectedInstances);
    finalStats.instances.forEach((instance, index) => {
      // Last instance might have fewer robots
      if (index === finalStats.instances.length - 1) {
        expect(instance.currentRobots).toBeLessThanOrEqual(robotsPerInstance);
      } else {
        expect(instance.currentRobots).toBeCloseTo(robotsPerInstance, -1); // Within 10 robots
      }
    });

    // Verify promoted robots are now in silver league
    const silverStats = await getLeagueInstanceStats('silver');
    expect(silverStats.totalRobots).toBe(33);

    // Clean up
    await prisma.robot.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('should handle the scenario progressively over multiple cycles', async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        username: 'test_progressive_user',
        passwordHash: 'hash',
      },
    });

    // Start with 100 robots in bronze_1
    const initialRobots = [];
    for (let i = 0; i < 100; i++) {
      initialRobots.push({
        userId: user.id,
        name: `Initial Robot ${i}`,
        leagueId: 'bronze_1',
        currentLeague: 'bronze' as const,
        leaguePoints: 50,
        elo: 1200,
        cyclesInCurrentLeague: 10,
        currentHP: 10,
        maxHP: 10,
        currentShield: 2,
        maxShield: 2,
      });
    }
    await prisma.robot.createMany({ data: initialRobots });

    // Simulate more robots joining bronze over time (e.g., new players)
    // Add 250 more robots to reach 350 total
    const newRobots = [];
    for (let i = 0; i < 250; i++) {
      newRobots.push({
        userId: user.id,
        name: `New Robot ${i}`,
        leagueId: 'bronze_1',
        currentLeague: 'bronze' as const,
        leaguePoints: 25,
        elo: 1100,
        cyclesInCurrentLeague: 3, // Not eligible for promotion yet
        currentHP: 10,
        maxHP: 10,
        currentShield: 2,
        maxShield: 2,
      });
    }
    await prisma.robot.createMany({ data: newRobots });

    // Verify all 350 robots are in bronze_1
    const beforeStats = await getLeagueInstanceStats('bronze');
    expect(beforeStats.totalRobots).toBe(350);
    expect(beforeStats.instances).toHaveLength(1);
    
    // Should trigger rebalancing due to exceeding MAX_ROBOTS_PER_INSTANCE
    expect(beforeStats.needsRebalancing).toBe(true);

    // Run rebalancing
    await rebalanceLeagues();

    // Verify distribution after rebalancing
    const afterStats = await getLeagueInstanceStats('bronze');
    
    // 10 robots promoted (10% of 100 eligible), so 340 remain in bronze
    expect(afterStats.totalRobots).toBe(340);
    
    // Should be distributed across multiple instances
    expect(afterStats.instances.length).toBeGreaterThan(1);
    
    // No instance should exceed MAX_ROBOTS_PER_INSTANCE
    afterStats.instances.forEach((instance) => {
      expect(instance.currentRobots).toBeLessThanOrEqual(MAX_ROBOTS_PER_INSTANCE);
    });

    // Clean up
    await prisma.robot.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
