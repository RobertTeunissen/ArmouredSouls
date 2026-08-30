import prisma from '../src/lib/prisma';
import {
  getInstancesForTier,
  getLeagueInstanceStats,
  assignLeagueInstance,
  rebalanceInstances,
  getRobotsInInstance,
  moveRobotToInstance,
  MAX_ROBOTS_PER_INSTANCE,
} from '../src/services/league/leagueInstanceService';
import { enterRobotStanding, enterRobotStandings } from './helpers/standings';

/**
 * Every fixture here places its robots in `standings`.
 *
 * `leagueInstanceService` reads tier, instance and LP from `standings` — Spec #40 moved
 * all three off the Robot model, and Spec #43 migrated the reads. These fixtures created
 * robots and computed an `instanceNum` that was then never used, because the column it
 * used to write is gone. The service consequently saw an empty competition and every
 * assertion read "Received: 0".
 */
async function placeRobots(
  userId: number,
  tier: string,
  /** Instance number for the robot at each index, in creation order. */
  instanceFor: (index: number) => number,
  options: { leaguePointsFor?: (index: number) => number } = {},
): Promise<void> {
  const robots = await prisma.robot.findMany({
    where: { userId },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  // Group by instance and by LP so each distinct combination is one bulk insert.
  const groups = new Map<string, { tierInstance: number; leaguePoints: number; ids: number[] }>();
  robots.forEach((robot, index) => {
    const tierInstance = instanceFor(index);
    const leaguePoints = options.leaguePointsFor?.(index) ?? 0;
    const key = `${tierInstance}:${leaguePoints}`;
    const group = groups.get(key) ?? { tierInstance, leaguePoints, ids: [] };
    group.ids.push(robot.id);
    groups.set(key, group);
  });

  for (const group of groups.values()) {
    await enterRobotStandings(group.ids, 'league_1v1', {
      tier,
      leagueInstanceId: `${tier}_${group.tierInstance}`,
      leaguePoints: group.leaguePoints,
    });
  }
}

/**
 * `standings` rows are polymorphic (`entityType` + `entityId`) and so have no foreign key
 * to `robots`. Deleting robots therefore leaves the standing rows behind, and because
 * several tests here share the `bronze` tier, an uncleared row from an earlier test lands
 * in a later test's instance counts. Every teardown clears standings for that reason.
 */
async function clearCompetition(): Promise<void> {
  await prisma.standing.deleteMany({});
  await prisma.scheduledMatch.deleteMany({});
  await prisma.battle.deleteMany({});
  await prisma.robot.deleteMany({});
  await prisma.weaponInventory.deleteMany({});
  await prisma.facility.deleteMany({});
  await prisma.user.deleteMany({});
}

describe('League Instance Service', () => {
  beforeAll(async () => {
    await clearCompetition();
    await prisma.weapon.deleteMany({});
  });

  afterEach(async () => {
    await clearCompetition();
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
      const user = await prisma.user.create({
        data: {
          username: 'test_instance_user',
          passwordHash: 'hash',
        },
      });

      await prisma.robot.createMany({
        data: [
          { userId: user.id, name: 'Robot 1', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot 2', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot 3', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
        ],
      });
      // 1 robot in bronze_1, 2 in bronze_2.
      await placeRobots(user.id, 'bronze', (index) => (index === 0 ? 1 : 2));

      const instances = await getInstancesForTier('bronze');

      expect(instances).toHaveLength(2);
      expect(instances[0].instanceNumber).toBe(1);
      expect(instances[1].instanceNumber).toBe(2);
      expect(instances[0].currentRobots).toBe(1);
      expect(instances[1].currentRobots).toBe(2);
    });

    /**
     * Formerly "should exclude bye-robot from instance counts". There is no persistent
     * Bye Robot to exclude any more — Spec #41 made it an in-memory sentinel with a
     * negative id, created by `createByeRobot` per match and never written to the
     * database. The invariant that survives is the one that made the exclusion
     * unnecessary: an instance counts entities that hold a standing, and a Bye_Placeholder
     * holds none.
     */
    it('should count only entities that hold a standing', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_bye_user',
          passwordHash: 'hash',
        },
      });

      const competing = await prisma.robot.create({
        data: { userId: user.id, name: 'Normal Robot', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
      });
      // A roster robot that has not entered the 1v1 league.
      await prisma.robot.create({
        data: { userId: user.id, name: 'Unentered Robot', currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
      });

      await enterRobotStanding(competing.id, 'league_1v1', { tier: 'bronze' });

      const instances = await getInstancesForTier('bronze');

      expect(instances).toHaveLength(1);
      expect(instances[0].currentRobots).toBe(1);
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

      const robots = [];
      for (let i = 0; i < 150; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });
      await placeRobots(user.id, 'bronze', (index) => (index < 50 ? 1 : index < 100 ? 2 : 3));

      const stats = await getLeagueInstanceStats('bronze');

      expect(stats.totalRobots).toBe(150);
      expect(stats.instances).toHaveLength(3);
      expect(stats.averagePerInstance).toBe(50);
      expect(stats.needsRebalancing).toBe(false); // All instances have exactly 50 robots
    });

    it('should detect when rebalancing is needed', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_rebalance_user',
          passwordHash: 'hash',
        },
      });

      const robots = [];
      for (let i = 0; i < 100; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });
      // 80 in instance 1, 20 in instance 2.
      await placeRobots(user.id, 'bronze', (index) => (index < 80 ? 1 : 2));

      const stats = await getLeagueInstanceStats('bronze');

      expect(stats.totalRobots).toBe(100);
      expect(stats.averagePerInstance).toBe(50);
      // Deviation of 30 exceeds REBALANCE_THRESHOLD (20), so rebalancing is needed
      expect(stats.needsRebalancing).toBe(true);
    });

    it('should detect rebalancing needed when single instance exceeds MAX_ROBOTS_PER_INSTANCE', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_oversized_user',
          passwordHash: 'hash',
        },
      });

      // A single oversized instance (like the bug scenario: 331 robots in bronze_1)
      const robots = [];
      for (let i = 0; i < 331; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });
      await placeRobots(user.id, 'bronze', () => 1);

      const stats = await getLeagueInstanceStats('bronze');

      expect(stats.totalRobots).toBe(331);
      expect(stats.instances).toHaveLength(1);
      expect(stats.instances[0].currentRobots).toBe(331);
      expect(stats.averagePerInstance).toBe(331);
      // Even though deviation from average is 0, rebalancing should be triggered
      // because the instance exceeds MAX_ROBOTS_PER_INSTANCE (100)
      expect(stats.needsRebalancing).toBe(true);
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

      const robots = [];
      for (let i = 0; i < 70; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });
      // 50 in instance 1, 20 in instance 2.
      await placeRobots(user.id, 'silver', (index) => (index < 50 ? 1 : 2));

      const assignedLeagueId = await assignLeagueInstance('silver');
      expect(assignedLeagueId).toBe('silver_2'); // Instance 2 has more free spots (80 vs 50)
    });

    /**
     * Formerly "should create new instance when all are full", expecting `gold_3`.
     * `assignLeagueInstance` deliberately never creates an instance — commit 178f8fd2,
     * "assignLeagueInstance should never create new instances, only rebalancing does".
     * The overflow is what `getLeagueInstanceStats().needsRebalancing` reports, and
     * `rebalanceInstances` is what splits the tier on the next cycle.
     */
    it('should still assign to the least-full instance when every instance is full', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_full_user',
          passwordHash: 'hash',
        },
      });

      const robots = [];
      for (let i = 0; i < MAX_ROBOTS_PER_INSTANCE * 2; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });
      await placeRobots(user.id, 'gold', (index) => (index < MAX_ROBOTS_PER_INSTANCE ? 1 : 2));

      const assignedLeagueId = await assignLeagueInstance('gold');
      expect(assignedLeagueId).toBe('gold_1');
    });
  });

  describe('rebalanceInstances', () => {
    /**
     * The fixture was 100 robots split 50/50, which under always-redistribute
     * (commit bfdc627a) collapses to a single instance of 100 because
     * `ceil(100 / MAX_ROBOTS_PER_INSTANCE)` is 1 — the assertion was left behind when
     * that commit updated only the sibling test in this block. 160 robots split 80/80 is
     * the balanced case for a two-instance tier, which is what this test means to cover.
     *
     * "Balanced" is a statement about the instance sizes, not about the rows: round-robin
     * reassigns by LP rank, so robots do move between instances even here. The sizes are
     * the observable contract.
     */
    it('should keep the instance sizes even when the tier is already balanced', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_no_rebalance_user',
          passwordHash: 'hash',
        },
      });

      const robots = [];
      for (let i = 0; i < 160; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });
      await placeRobots(user.id, 'platinum', (index) => (index < 80 ? 1 : 2));

      await rebalanceInstances('platinum');

      const instances = await getInstancesForTier('platinum');
      expect(instances).toHaveLength(2);
      expect(instances[0].currentRobots).toBe(80);
      expect(instances[1].currentRobots).toBe(80);
    });

    it('should redistribute imbalanced instances evenly', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'test_rebal_user',
          passwordHash: 'hash',
        },
      });

      const robots = [];
      for (let i = 0; i < 160; i++) {
        robots.push({
          userId: user.id,
          name: `Robot ${i}`,
          elo: 1200 + i,
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        });
      }
      await prisma.robot.createMany({ data: robots });
      // 150 in instance 1, 10 in instance 2, with distinct LP so the round-robin
      // redistribution has a deterministic input order.
      await placeRobots(user.id, 'champion', (index) => (index < 150 ? 1 : 2), {
        leaguePointsFor: (index) => 160 - index,
      });

      await rebalanceInstances('champion');

      // 160 robots → ceil(160/100) = 2 instances, 80 each
      const instances = await getInstancesForTier('champion');
      expect(instances).toHaveLength(2);
      expect(instances[0].currentRobots).toBe(80);
      expect(instances[1].currentRobots).toBe(80);
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

      await prisma.robot.createMany({
        data: [
          { userId: user.id, name: 'Robot A', elo: 1200, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot B', elo: 1100, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
          { userId: user.id, name: 'Robot C', elo: 1300, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2 },
        ],
      });
      // A: 10 LP, B and C: 20 LP each — so LP alone does not settle B against C.
      await placeRobots(user.id, 'bronze', () => 1, {
        leaguePointsFor: (index) => (index === 0 ? 10 : 20),
      });

      const robots = await getRobotsInInstance('bronze_1');

      expect(robots).toHaveLength(3);
      // Should be ordered by league points DESC, then ELO DESC
      expect(robots[0].name).toBe('Robot C'); // 20 points, 1300 ELO
      expect(robots[1].name).toBe('Robot B'); // 20 points, 1100 ELO
      expect(robots[2].name).toBe('Robot A'); // 10 points, 1200 ELO
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
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
        },
      });
      await enterRobotStanding(robot.id, 'league_1v1', { tier: 'bronze', leaguePoints: 12 });

      await moveRobotToInstance(robot.id, 'silver');

      // The move is a standings write — tier and instance live there, not on Robot.
      const standing = await prisma.standing.findUnique({
        where: {
          entityType_entityId_mode: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1' },
        },
      });
      expect(standing).not.toBeNull();
      expect(standing?.tier).toBe('silver');
      expect(standing?.leagueInstanceId).toBe('silver_1');
      expect(standing?.leaguePoints).toBe(12); // LP is carried, not reset, by an instance move
    });
  });
});
