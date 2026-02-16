/**
 * Unit Tests for ComparisonService
 * 
 * Tests specific examples and edge cases for cycle comparison functionality
 */

import { PrismaClient } from '@prisma/client';
import { EventLogger, clearSequenceCache } from '../src/services/eventLogger';
import { CycleSnapshotService } from '../src/services/cycleSnapshotService';
import { ComparisonService } from '../src/services/comparisonService';

const prisma = new PrismaClient();
const eventLogger = new EventLogger();
const cycleSnapshotService = new CycleSnapshotService();
const comparisonService = new ComparisonService();

describe('ComparisonService Unit Tests', () => {
  let testUser: any;
  let testRobot1: any;
  let testRobot2: any;

  beforeEach(async () => {
    // Clean up before each test
    await prisma.cycleSnapshot.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.scheduledMatch.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});

    // Clear sequence cache
    for (let i = 1; i <= 100; i++) {
      clearSequenceCache(i);
    }

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `test_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
        prestige: 1000,
      },
    });

    // Find or create a weapon
    let weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      weapon = await prisma.weapon.create({
        data: {
          name: 'Test Weapon',
          weaponType: 'melee',
          damageType: 'kinetic',
          baseDamage: 50,
          cooldown: 1000,
          cost: 1000,
          handsRequired: 'one',
          loadoutType: 'any',
        },
      });
    }

    // Create weapon inventory
    const weaponInventory = await prisma.weaponInventory.create({
      data: {
        user: { connect: { id: testUser.id } },
        weapon: { connect: { id: weapon.id } },
      },
    });

    // Create test robots
    testRobot1 = await prisma.robot.create({
      data: {
        name: 'TestRobot1',
        user: { connect: { id: testUser.id } },
        mainWeapon: { connect: { id: weaponInventory.id } },
        currentHP: 1000,
        maxHP: 1000,
        currentShield: 100,
        maxShield: 100,
        elo: 1500,
        fame: 100,
        currentLeague: 'bronze',
      },
    });

    testRobot2 = await prisma.robot.create({
      data: {
        name: 'TestRobot2',
        user: { connect: { id: testUser.id } },
        mainWeapon: { connect: { id: weaponInventory.id } },
        currentHP: 1000,
        maxHP: 1000,
        currentShield: 100,
        maxShield: 100,
        elo: 1500,
        fame: 100,
        currentLeague: 'bronze',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('compareCycles', () => {
    it('should compare two cycles with different income values', async () => {
      // Create cycle 1 with lower income
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logPassiveIncome(1, testUser.id, 1000, 500, 5, 1000, 50, 200);
      await eventLogger.logOperatingCosts(1, testUser.id, [{ facilityType: 'training_academy', level: 1, cost: 300 }], 300);
      await eventLogger.logCycleComplete(1, 1000);
      await cycleSnapshotService.createSnapshot(1);

      // Create cycle 2 with higher income
      await eventLogger.logCycleStart(2, 'manual');
      await eventLogger.logPassiveIncome(2, testUser.id, 2000, 1000, 5, 1000, 50, 200);
      await eventLogger.logOperatingCosts(2, testUser.id, [{ facilityType: 'training_academy', level: 1, cost: 300 }], 300);
      await eventLogger.logCycleComplete(2, 1000);
      await cycleSnapshotService.createSnapshot(2);

      // Compare cycles
      const comparison = await comparisonService.compareCycles(2, 1, testUser.id);

      expect(comparison.currentCycle).toBe(2);
      expect(comparison.comparisonCycle).toBe(1);
      expect(comparison.stableComparisons).toHaveLength(1);

      const stableComp = comparison.stableComparisons[0];
      expect(stableComp.userId).toBe(testUser.id);

      // Check merchandising comparison
      expect(stableComp.merchandisingIncome.current).toBe(2000);
      expect(stableComp.merchandisingIncome.comparison).toBe(1000);
      expect(stableComp.merchandisingIncome.delta).toBe(1000);
      expect(stableComp.merchandisingIncome.percentChange).toBe(100);

      // Check streaming comparison
      expect(stableComp.streamingIncome.current).toBe(1000);
      expect(stableComp.streamingIncome.comparison).toBe(500);
      expect(stableComp.streamingIncome.delta).toBe(500);
      expect(stableComp.streamingIncome.percentChange).toBe(100);

      // Check net profit comparison
      expect(stableComp.netProfit.current).toBe(2700); // 2000 + 1000 - 300
      expect(stableComp.netProfit.comparison).toBe(1200); // 1000 + 500 - 300
      expect(stableComp.netProfit.delta).toBe(1500);
      expect(stableComp.netProfit.percentChange).toBeCloseTo(125, 1);
    });

    it('should handle comparison when comparison cycle does not exist', async () => {
      // Create only cycle 2
      await eventLogger.logCycleStart(2, 'manual');
      await eventLogger.logPassiveIncome(2, testUser.id, 2000, 1000, 5, 1000, 50, 200);
      await eventLogger.logCycleComplete(2, 1000);
      await cycleSnapshotService.createSnapshot(2);

      // Try to compare with non-existent cycle 1
      const comparison = await comparisonService.compareCycles(2, 1, testUser.id);

      expect(comparison.currentCycle).toBe(2);
      expect(comparison.comparisonCycle).toBe(1);
      expect(comparison.unavailableMetrics).toEqual(['all']);
      expect(comparison.stableComparisons).toEqual([]);
      expect(comparison.robotComparisons).toEqual([]);
    });

    it('should throw error when current cycle does not exist', async () => {
      await expect(
        comparisonService.compareCycles(999, 1, testUser.id)
      ).rejects.toThrow('Current cycle 999 snapshot not found');
    });

    it('should compare robot metrics between cycles', async () => {
      // Create cycle 1 with battles
      await eventLogger.logCycleStart(1, 'manual');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await prisma.battle.create({
        data: {
          user: { connect: { id: testUser.id } },
          robot1: { connect: { id: testRobot1.id } },
          robot2: { connect: { id: testRobot2.id } },
          winnerId: testRobot1.id,
          robot1ELOBefore: 1500,
          robot1ELOAfter: 1520,
          robot2ELOBefore: 1500,
          robot2ELOAfter: 1480,
          eloChange: 20,
          robot1DamageDealt: 500,
          robot2DamageDealt: 300,
          robot1FinalHP: 70,
          robot2FinalHP: 0,
          robot1FinalShield: 0,
          robot2FinalShield: 0,
          winnerReward: 1000,
          loserReward: 500,
          robot1PrestigeAwarded: 10,
          robot2PrestigeAwarded: 5,
          robot1FameAwarded: 10,
          robot2FameAwarded: 5,
          robot1RepairCost: 100,
          robot2RepairCost: 200,
          battleLog: {},
          durationSeconds: 60,
          battleType: 'league',
          leagueType: 'bronze',
          robot1Yielded: false,
          robot2Yielded: false,
          robot1Destroyed: false,
          robot2Destroyed: false,
        },
      });

      await eventLogger.logCycleComplete(1, 1000);
      await cycleSnapshotService.createSnapshot(1);

      // Create cycle 2 with more battles
      await eventLogger.logCycleStart(2, 'manual');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Battle 1
      await prisma.battle.create({
        data: {
          user: { connect: { id: testUser.id } },
          robot1: { connect: { id: testRobot1.id } },
          robot2: { connect: { id: testRobot2.id } },
          winnerId: testRobot1.id,
          robot1ELOBefore: 1520,
          robot1ELOAfter: 1540,
          robot2ELOBefore: 1480,
          robot2ELOAfter: 1460,
          eloChange: 20,
          robot1DamageDealt: 600,
          robot2DamageDealt: 400,
          robot1FinalHP: 60,
          robot2FinalHP: 0,
          robot1FinalShield: 0,
          robot2FinalShield: 0,
          winnerReward: 1000,
          loserReward: 500,
          robot1PrestigeAwarded: 10,
          robot2PrestigeAwarded: 5,
          robot1FameAwarded: 10,
          robot2FameAwarded: 5,
          robot1RepairCost: 150,
          robot2RepairCost: 250,
          battleLog: {},
          durationSeconds: 60,
          battleType: 'league',
          leagueType: 'bronze',
          robot1Yielded: false,
          robot2Yielded: false,
          robot1Destroyed: false,
          robot2Destroyed: false,
        },
      });

      // Battle 2
      await prisma.battle.create({
        data: {
          user: { connect: { id: testUser.id } },
          robot1: { connect: { id: testRobot1.id } },
          robot2: { connect: { id: testRobot2.id } },
          winnerId: testRobot1.id,
          robot1ELOBefore: 1540,
          robot1ELOAfter: 1560,
          robot2ELOBefore: 1460,
          robot2ELOAfter: 1440,
          eloChange: 20,
          robot1DamageDealt: 550,
          robot2DamageDealt: 350,
          robot1FinalHP: 65,
          robot2FinalHP: 0,
          robot1FinalShield: 0,
          robot2FinalShield: 0,
          winnerReward: 1000,
          loserReward: 500,
          robot1PrestigeAwarded: 10,
          robot2PrestigeAwarded: 5,
          robot1FameAwarded: 10,
          robot2FameAwarded: 5,
          robot1RepairCost: 120,
          robot2RepairCost: 220,
          battleLog: {},
          durationSeconds: 60,
          battleType: 'league',
          leagueType: 'bronze',
          robot1Yielded: false,
          robot2Yielded: false,
          robot1Destroyed: false,
          robot2Destroyed: false,
        },
      });

      await eventLogger.logCycleComplete(2, 1000);
      await cycleSnapshotService.createSnapshot(2);

      // Compare cycles
      const comparison = await comparisonService.compareCycles(2, 1, testUser.id);

      expect(comparison.robotComparisons.length).toBeGreaterThan(0);

      // Find robot1 comparison
      const robot1Comp = comparison.robotComparisons.find(r => r.robotId === testRobot1.id);
      expect(robot1Comp).toBeDefined();

      // Robot1 had 1 battle in cycle 1, 2 battles in cycle 2
      expect(robot1Comp!.battlesParticipated.current).toBe(2);
      expect(robot1Comp!.battlesParticipated.comparison).toBe(1);
      expect(robot1Comp!.battlesParticipated.delta).toBe(1);
      expect(robot1Comp!.battlesParticipated.percentChange).toBe(100);

      // Robot1 won all battles
      expect(robot1Comp!.wins.current).toBe(2);
      expect(robot1Comp!.wins.comparison).toBe(1);
      expect(robot1Comp!.wins.delta).toBe(1);

      // Check damage dealt increased
      expect(robot1Comp!.damageDealt.current).toBe(1150); // 600 + 550
      expect(robot1Comp!.damageDealt.comparison).toBe(500);
      expect(robot1Comp!.damageDealt.delta).toBe(650);
    });

    it('should handle percentage change when comparison value is zero', async () => {
      // Create cycle 1 with zero income
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logPassiveIncome(1, testUser.id, 0, 0, 5, 1000, 50, 200);
      await eventLogger.logCycleComplete(1, 1000);
      await cycleSnapshotService.createSnapshot(1);

      // Create cycle 2 with positive income
      await eventLogger.logCycleStart(2, 'manual');
      await eventLogger.logPassiveIncome(2, testUser.id, 1000, 500, 5, 1000, 50, 200);
      await eventLogger.logCycleComplete(2, 1000);
      await cycleSnapshotService.createSnapshot(2);

      // Compare cycles
      const comparison = await comparisonService.compareCycles(2, 1, testUser.id);

      const stableComp = comparison.stableComparisons[0];

      // When comparison is 0 and current is not, percentChange should be null (infinite)
      expect(stableComp.merchandisingIncome.current).toBe(1000);
      expect(stableComp.merchandisingIncome.comparison).toBe(0);
      expect(stableComp.merchandisingIncome.delta).toBe(1000);
      expect(stableComp.merchandisingIncome.percentChange).toBeNull();
    });

    it('should handle negative deltas correctly', async () => {
      // Create cycle 1 with higher income
      await eventLogger.logCycleStart(1, 'manual');
      await eventLogger.logPassiveIncome(1, testUser.id, 2000, 1000, 5, 1000, 50, 200);
      await eventLogger.logCycleComplete(1, 1000);
      await cycleSnapshotService.createSnapshot(1);

      // Create cycle 2 with lower income
      await eventLogger.logCycleStart(2, 'manual');
      await eventLogger.logPassiveIncome(2, testUser.id, 1000, 500, 5, 1000, 50, 200);
      await eventLogger.logCycleComplete(2, 1000);
      await cycleSnapshotService.createSnapshot(2);

      // Compare cycles
      const comparison = await comparisonService.compareCycles(2, 1, testUser.id);

      const stableComp = comparison.stableComparisons[0];

      // Check negative delta
      expect(stableComp.merchandisingIncome.current).toBe(1000);
      expect(stableComp.merchandisingIncome.comparison).toBe(2000);
      expect(stableComp.merchandisingIncome.delta).toBe(-1000);
      expect(stableComp.merchandisingIncome.percentChange).toBe(-50);
    });
  });

  describe('getAvailableCycleRange', () => {
    it('should return null when no snapshots exist', async () => {
      const range = await comparisonService.getAvailableCycleRange();
      expect(range).toBeNull();
    });

    it('should return min and max cycle numbers', async () => {
      // Create snapshots for cycles 1, 3, 5
      for (const cycleNum of [1, 3, 5]) {
        await eventLogger.logCycleStart(cycleNum, 'manual');
        await eventLogger.logCycleComplete(cycleNum, 1000);
        await cycleSnapshotService.createSnapshot(cycleNum);
      }

      const range = await comparisonService.getAvailableCycleRange();
      expect(range).not.toBeNull();
      expect(range!.min).toBe(1);
      expect(range!.max).toBe(5);
    });
  });
});
