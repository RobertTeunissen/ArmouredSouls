import { PrismaClient } from '@prisma/client';
import {
  determinePromotions,
  determineDemotions,
  promoteRobot,
  demoteRobot,
  rebalanceLeagues,
} from '../src/services/leagueRebalancingService';

const prisma = new PrismaClient();

describe('League Rebalancing Service', () => {
  let testUser: any;
  let practiceSword: any;

  beforeAll(async () => {
    // Clean up
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.weapon.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'rebalancing_test_user',
        passwordHash: 'hash',
        currency: 1000000,
      },
    });

    // Create practice sword
    practiceSword = await prisma.weapon.create({
      data: {
        name: 'Test Sword',
        weaponType: 'melee',
        baseDamage: 5,
        cooldown: 3,
        cost: 0,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('determinePromotions', () => {
    it('should return top 10% of robots with ≥5 battles', async () => {
      // Create 20 robots in bronze league with varying league points
      const robots = [];
      for (let i = 0; i < 20; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Bronze Robot ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            leaguePoints: i * 10, // 0, 10, 20, ..., 190
            totalBattles: 10, // All have enough battles
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const toPromote = await determinePromotions('bronze');

      // Should get top 10% = 2 robots (with highest league points)
      expect(toPromote.length).toBe(2);
      expect(toPromote[0].name).toBe('Bronze Robot 19'); // 190 points
      expect(toPromote[1].name).toBe('Bronze Robot 18'); // 180 points

      // Clean up
      for (const robot of robots) {
        await prisma.robot.delete({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should skip robots with <5 battles', async () => {
      const robots = [];
      for (let i = 0; i < 20; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Bronze Robot ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            leaguePoints: i * 10,
            totalBattles: i < 10 ? 3 : 10, // First 10 have too few battles
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const toPromote = await determinePromotions('bronze');

      // Should only consider robots with ≥5 battles (last 10 robots)
      // 10% of 10 = 1 robot
      expect(toPromote.length).toBe(1);
      expect(toPromote[0].totalBattles).toBeGreaterThanOrEqual(5);

      // Clean up
      for (const robot of robots) {
        await prisma.robot.delete({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should return empty array for champion tier', async () => {
      const toPromote = await determinePromotions('champion');
      expect(toPromote).toEqual([]);
    });

    it('should return empty array when too few robots', async () => {
      // Create only 5 robots (< 10 minimum)
      const robots = [];
      for (let i = 0; i < 5; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Small League Robot ${i}`,
            leagueId: 'gold_1',
            currentLeague: 'gold',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            leaguePoints: i * 10,
            totalBattles: 10,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const toPromote = await determinePromotions('gold');
      expect(toPromote).toEqual([]);

      // Clean up
      for (const robot of robots) {
        await prisma.robot.delete({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });
  });

  describe('determineDemotions', () => {
    it('should return bottom 10% of robots with ≥5 battles', async () => {
      const robots = [];
      for (let i = 0; i < 20; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Silver Robot ${i}`,
            leagueId: 'silver_1',
            currentLeague: 'silver',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            leaguePoints: i * 10, // 0, 10, 20, ..., 190
            totalBattles: 10,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const toDemote = await determineDemotions('silver');

      // Should get bottom 10% = 2 robots (with lowest league points)
      expect(toDemote.length).toBe(2);
      expect(toDemote[0].name).toBe('Silver Robot 0'); // 0 points
      expect(toDemote[1].name).toBe('Silver Robot 1'); // 10 points

      // Clean up
      for (const robot of robots) {
        await prisma.robot.delete({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should return empty array for bronze tier', async () => {
      const toDemote = await determineDemotions('bronze');
      expect(toDemote).toEqual([]);
    });
  });

  describe('promoteRobot', () => {
    it('should move robot to next tier and reset league points', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Promotion Test Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1300,
          leaguePoints: 50,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      await promoteRobot(robot);

      const updated = await prisma.robot.findUnique({ where: { id: robot.id } });
      expect(updated?.currentLeague).toBe('silver');
      expect(updated?.leagueId).toMatch(/^silver_\d+$/);
      expect(updated?.leaguePoints).toBe(0);
      expect(updated?.elo).toBe(1300); // ELO should not change

      // Clean up
      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv.id } });
    });

    it('should throw error when trying to promote from champion', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Champion Robot',
          leagueId: 'champion_1',
          currentLeague: 'champion',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1800,
          leaguePoints: 100,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      await expect(promoteRobot(robot)).rejects.toThrow();

      // Clean up
      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv.id } });
    });
  });

  describe('demoteRobot', () => {
    it('should move robot to previous tier and reset league points', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Demotion Test Robot',
          leagueId: 'silver_1',
          currentLeague: 'silver',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1100,
          leaguePoints: 5,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      await demoteRobot(robot);

      const updated = await prisma.robot.findUnique({ where: { id: robot.id } });
      expect(updated?.currentLeague).toBe('bronze');
      expect(updated?.leagueId).toMatch(/^bronze_\d+$/);
      expect(updated?.leaguePoints).toBe(0);
      expect(updated?.elo).toBe(1100); // ELO should not change

      // Clean up
      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv.id } });
    });

    it('should throw error when trying to demote from bronze', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Bronze Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1000,
          leaguePoints: 0,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      await expect(demoteRobot(robot)).rejects.toThrow();

      // Clean up
      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv.id } });
    });
  });

  describe('rebalanceLeagues', () => {
    it('should process all tiers and return summary', async () => {
      // Create robots across multiple tiers
      const robots = [];
      
      // 20 bronze robots
      for (let i = 0; i < 20; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });
        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Bronze ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            leaguePoints: i * 10,
            totalBattles: 10,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const summary = await rebalanceLeagues();

      expect(summary.totalRobots).toBe(20);
      expect(summary.totalPromoted).toBeGreaterThan(0); // At least some promoted
      expect(summary.tierSummaries.length).toBe(6); // All 6 tiers

      // Clean up
      for (const robot of robots) {
        await prisma.robot.delete({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });
  });
});
