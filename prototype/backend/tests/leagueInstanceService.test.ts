import { PrismaClient } from '@prisma/client';
import {
  getInstancesForTier,
  getLeagueInstanceStats,
  assignLeagueInstance,
  rebalanceInstances,
  getRobotsInInstance,
  moveRobotToInstance,
  MAX_ROBOTS_PER_INSTANCE,
  REBALANCE_THRESHOLD,
} from '../src/services/leagueInstanceService';

const prisma = new PrismaClient();

describe('League Instance Service', () => {
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

  describe('getInstancesForTier', () => {
    it('should return empty array for tier with no robots', async () => {
      const instances = await getInstancesForTier('silver');
      expect(instances).toEqual([]);
    });

    it('should return instances sorted by instance number', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          username: 'test_instance_user',
          passwordHash: 'hash',
        },
      });

      // Create robots in different instances
      await prisma.robot.createMany({
        data: [
          { userId: user.id, name: 'Robot 1', leagueId: 'bronze_2', currentLeague: 'bronze', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot 2', leagueId: 'bronze_1', currentLeague: 'bronze', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot 3', leagueId: 'bronze_2', currentLeague: 'bronze', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
        ],
      });

      const instances = await getInstancesForTier('bronze');
      
      expect(instances).toHaveLength(2);
      expect(instances[0].instanceNumber).toBe(1);
      expect(instances[1].instanceNumber).toBe(2);
      expect(instances[0].currentRobots).toBe(1);
      expect(instances[1].currentRobots).toBe(2);

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should exclude bye-robot from instance counts', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_bye_user',
          passwordHash: 'hash',
        },
      });

      // Create normal robot and bye-robot
      await prisma.robot.createMany({
        data: [
          { userId: user.id, name: 'Normal Robot', leagueId: 'bronze_1', currentLeague: 'bronze', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Bye Robot', leagueId: 'bronze_bye', currentLeague: 'bronze', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
        ],
      });

      const instances = await getInstancesForTier('bronze');
      
      // Should only count the normal robot, not the bye-robot
      expect(instances).toHaveLength(1);
      expect(instances[0].currentRobots).toBe(1);

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('getLeagueInstanceStats', () => {
    it('should calculate correct statistics', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_stats_user',
          passwordHash: 'hash',
        },
      });

      // Create robots across multiple instances
      const robots = [];
      for (let i = 0; i < 150; i++) {
        const instanceNum = i < 50 ? 1 : i < 100 ? 2 : 3;
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          leagueId: `bronze_${instanceNum}`,
          currentLeague: 'bronze' as const,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });

      const stats = await getLeagueInstanceStats('bronze');
      
      expect(stats.totalRobots).toBe(150);
      expect(stats.instances).toHaveLength(3);
      expect(stats.averagePerInstance).toBe(50);
      expect(stats.needsRebalancing).toBe(false); // All instances have exactly 50 robots

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should detect when rebalancing is needed', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_rebalance_user',
          passwordHash: 'hash',
        },
      });

      // Create imbalanced instances
      const robots = [];
      for (let i = 0; i < 100; i++) {
        const instanceNum = i < 80 ? 1 : 2; // 80 in instance 1, 20 in instance 2
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          leagueId: `bronze_${instanceNum}`,
          currentLeague: 'bronze' as const,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });

      const stats = await getLeagueInstanceStats('bronze');
      
      expect(stats.totalRobots).toBe(100);
      expect(stats.averagePerInstance).toBe(50);
      expect(stats.needsRebalancing).toBe(true); // Deviation of 30 > threshold of 20

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should detect rebalancing needed when single instance exceeds MAX_ROBOTS_PER_INSTANCE', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_oversized_user',
          passwordHash: 'hash',
        },
      });

      // Create a single oversized instance (like the bug scenario: 331 robots in bronze_1)
      const robots = [];
      for (let i = 0; i < 331; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          leagueId: 'bronze_1',
          currentLeague: 'bronze' as const,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });

      const stats = await getLeagueInstanceStats('bronze');
      
      expect(stats.totalRobots).toBe(331);
      expect(stats.instances).toHaveLength(1);
      expect(stats.instances[0].currentRobots).toBe(331);
      expect(stats.averagePerInstance).toBe(331);
      // Even though deviation from average is 0, rebalancing should be triggered
      // because the instance exceeds MAX_ROBOTS_PER_INSTANCE (100)
      expect(stats.needsRebalancing).toBe(true);

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('assignLeagueInstance', () => {
    it('should create first instance when none exist', async () => {
      const leagueId = await assignLeagueInstance('diamond');
      expect(leagueId).toBe('diamond_1');
    });

    it('should assign to instance with most free spots', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_assign_user',
          passwordHash: 'hash',
        },
      });

      // Create instances with different occupancy
      const robots = [];
      for (let i = 0; i < 70; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          leagueId: i < 50 ? 'silver_1' : 'silver_2', // 50 in instance 1, 20 in instance 2
          currentLeague: 'silver' as const,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });

      const assignedLeagueId = await assignLeagueInstance('silver');
      expect(assignedLeagueId).toBe('silver_2'); // Instance 2 has more free spots (80 vs 50)

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should create new instance when all are full', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_full_user',
          passwordHash: 'hash',
        },
      });

      // Fill up instances
      const robots = [];
      for (let i = 0; i < MAX_ROBOTS_PER_INSTANCE * 2; i++) {
        const instanceNum = i < MAX_ROBOTS_PER_INSTANCE ? 1 : 2;
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          leagueId: `gold_${instanceNum}`,
          currentLeague: 'gold' as const,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });

      const assignedLeagueId = await assignLeagueInstance('gold');
      expect(assignedLeagueId).toBe('gold_3'); // Should create third instance

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('rebalanceInstances', () => {
    it('should not rebalance when instances are balanced', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_no_rebalance_user',
          passwordHash: 'hash',
        },
      });

      // Create balanced instances
      const robots = [];
      for (let i = 0; i < 100; i++) {
        const instanceNum = i < 50 ? 1 : 2;
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          leagueId: `platinum_${instanceNum}`,
          currentLeague: 'platinum' as const,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });

      await rebalanceInstances('platinum');

      // Verify no changes
      const instances = await getInstancesForTier('platinum');
      expect(instances[0].currentRobots).toBe(50);
      expect(instances[1].currentRobots).toBe(50);

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('should rebalance when imbalance exceeds threshold', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_rebal_user',
          passwordHash: 'hash',
        },
      });

      // Create imbalanced instances (80 vs 20)
      const robots = [];
      for (let i = 0; i < 100; i++) {
        const instanceNum = i < 80 ? 1 : 2;
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          leagueId: `champion_${instanceNum}`,
          currentLeague: 'champion' as const,
          leaguePoints: 100 - i, // Different points for ordering
          elo: 1200 + i,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });

      await rebalanceInstances('champion');

      // Verify rebalancing occurred while respecting MAX_ROBOTS_PER_INSTANCE
      const instances = await getInstancesForTier('champion');
      const totalRobots = instances.reduce(
        (sum, instance) => sum + instance.currentRobots,
        0,
      );
      expect(totalRobots).toBe(100);
      
      // With 100 robots and MAX_ROBOTS_PER_INSTANCE=100, should have exactly 1 instance
      expect(instances).toHaveLength(1);
      expect(instances[0].currentRobots).toBe(100);
      
      // Verify no instance exceeds the limit
      instances.forEach((instance) => {
        expect(instance.currentRobots).toBeLessThanOrEqual(100);
      });

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('getRobotsInInstance', () => {
    it('should return robots in correct order', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_order_user',
          passwordHash: 'hash',
        },
      });

      // Create robots with different league points and ELO
      await prisma.robot.createMany({
        data: [
          { userId: user.id, name: 'Robot A', leagueId: 'bronze_1', currentLeague: 'bronze', leaguePoints: 10, elo: 1200, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot B', leagueId: 'bronze_1', currentLeague: 'bronze', leaguePoints: 20, elo: 1100, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot C', leagueId: 'bronze_1', currentLeague: 'bronze', leaguePoints: 20, elo: 1300, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
        ],
      });

      const robots = await getRobotsInInstance('bronze_1');
      
      expect(robots).toHaveLength(3);
      // Should be ordered by league points DESC, then ELO DESC
      expect(robots[0].name).toBe('Robot C'); // 20 points, 1300 ELO
      expect(robots[1].name).toBe('Robot B'); // 20 points, 1100 ELO
      expect(robots[2].name).toBe('Robot A'); // 10 points, 1200 ELO

      // Clean up
      await prisma.robot.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe('moveRobotToInstance', () => {
    it('should move robot to appropriate instance in new tier', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_move_user',
          passwordHash: 'hash',
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: user.id,
          name: 'Moving Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        },
      });

      await moveRobotToInstance(robot.id, 'silver');

      const updated = await prisma.robot.findUnique({ where: { id: robot.id } });
      expect(updated?.currentLeague).toBe('silver');
      expect(updated?.leagueId).toBe('silver_1');

      // Clean up
      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.user.delete({ where: { id: user.id } });
    });
  });
});
