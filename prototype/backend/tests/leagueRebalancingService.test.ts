import prisma from '../src/lib/prisma';
import {
  determinePromotions,
  determineDemotions,
  promoteRobot,
  demoteRobot,
  rebalanceLeagues,
} from '../src/services/leagueRebalancingService';


describe('League Rebalancing Service', () => {
  let testUser: any;
  let practiceSword: any;

  beforeAll(async () => {
    // Clean up in correct order
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.tagTeamMatch.deleteMany({});
    await prisma.tagTeam.deleteMany({});
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

  afterEach(async () => {
    // Clean up after each test to prevent pollution
    // Only delete robots and their dependencies, keep testUser and practiceSword
    await prisma.scheduledMatch.deleteMany({});
    await prisma.battleParticipant.deleteMany({});
    await prisma.battle.deleteMany({});
    await prisma.robot.deleteMany({});
    await prisma.weaponInventory.deleteMany({});
    await prisma.facility.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('determinePromotions', () => {
    it('should return top 10% of robots with ≥5 cycles AND ≥25 league points', async () => {
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
            leaguePoints: i * 5, // 0, 5, 10, ..., 95 (robots 5+ have ≥25 points)
            totalBattles: 10,
            cyclesInCurrentLeague: 10, // All have enough cycles in current league
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const toPromote = await determinePromotions('bronze');

      // Should get top 10% of 20 = 2 robots, but only from those with ≥25 points
      // Robots 5-19 have ≥25 points (15 robots), top 2 are robots 19 and 18
      expect(toPromote.length).toBe(2);
      expect(toPromote[0].name).toBe('Bronze Robot 19'); // 95 points
      expect(toPromote[1].name).toBe('Bronze Robot 18'); // 90 points
      expect(toPromote[0].leaguePoints).toBeGreaterThanOrEqual(25);
      expect(toPromote[1].leaguePoints).toBeGreaterThanOrEqual(25);

      // Clean up
      for (const robot of robots) {
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should skip robots with <5 cycles in current league', async () => {
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
            leaguePoints: i * 5, // 0, 5, 10, ..., 95
            totalBattles: 10,
            cyclesInCurrentLeague: i < 10 ? 3 : 10, // First 10 have too few cycles in league
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const toPromote = await determinePromotions('bronze');

      // Should only consider robots with ≥5 cycles in current league (last 10 robots)
      // 10% of 10 = 1 robot, and must have ≥25 points
      // Robots 10-19 have ≥5 cycles, robots 5-19 have ≥25 points
      // So robots 10-19 meet both criteria (10 robots), top 10% = 1 robot
      expect(toPromote.length).toBe(1);
      expect(toPromote[0].cyclesInCurrentLeague).toBeGreaterThanOrEqual(5);
      expect(toPromote[0].leaguePoints).toBeGreaterThanOrEqual(25);

      // Clean up
      for (const robot of robots) {
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should return empty array for champion tier', async () => {
      const toPromote = await determinePromotions('champion');
      expect(toPromote).toEqual([]);
    });

    it('should return empty array when no robots have ≥25 league points', async () => {
      // Create 20 robots but none with ≥25 league points
      const robots = [];
      for (let i = 0; i < 20; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Low Points Robot ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            leaguePoints: i, // 0-19 points, all below 25
            totalBattles: 10,
            cyclesInCurrentLeague: 10,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const toPromote = await determinePromotions('bronze');
      expect(toPromote).toEqual([]);

      // Clean up
      for (const robot of robots) {
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
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
            cyclesInCurrentLeague: 10,
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
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });
  });

  describe('determineDemotions', () => {
    it('should return bottom 10% of robots with ≥5 cycles in current league', async () => {
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
            cyclesInCurrentLeague: 10,
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
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should return empty array for bronze tier', async () => {
      const toDemote = await determineDemotions('bronze');
      expect(toDemote).toEqual([]);
    });
  });

  describe('promoteRobot', () => {
    it('should move robot to next tier and reset league points and cycles', async () => {
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
          cyclesInCurrentLeague: 10,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      await promoteRobot(robot);

      const updated = await prisma.robot.findUnique({ where: { id: robot.id } });
      expect(updated?.currentLeague).toBe('silver');
      expect(updated?.leagueId).toMatch(/^silver_\d+$/);
      expect(updated?.leaguePoints).toBe(0);
      expect(updated?.cyclesInCurrentLeague).toBe(0); // Should reset cycles counter
      expect(updated?.elo).toBe(1300); // ELO should not change

      // Clean up
      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv.id } });
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
      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv.id } });
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
      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv.id } });
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
      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv.id } });
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
            cyclesInCurrentLeague: 10,
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
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should not promote or demote robots multiple times in same cycle', async () => {
      // Scenario from the issue: Robot promoted from bronze to silver, 
      // then should NOT be eligible for promotion/demotion in silver tier

      const robots = [];
      
      // Create 100 bronze robots (to trigger promotion)
      for (let i = 0; i < 100; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });
        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Robot ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200 + i, // Varying ELO to create order
            leaguePoints: i * 10, // 0 to 990 points
            totalBattles: 10,
            cyclesInCurrentLeague: 10,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      // Run rebalancing
      const summary = await rebalanceLeagues();

      // 10% of 100 bronze robots = 10 promoted to silver
      expect(summary.tierSummaries[0].promoted).toBe(10);
      expect(summary.tierSummaries[0].demoted).toBe(0);

      // Silver tier should have 0 promotions and 0 demotions
      // because only 10 robots would be in silver (all just promoted)
      // and they should be excluded from processing
      expect(summary.tierSummaries[1].promoted).toBe(0);
      expect(summary.tierSummaries[1].demoted).toBe(0);

      // Verify no robot was moved twice
      // Get all robots and check their final positions
      const finalRobots = await prisma.robot.findMany({
        where: {
          id: { in: robots.map(r => r.id) },
        },
      });

      // Count robots in each tier
      const tierCounts = {
        bronze: 0,
        silver: 0,
        gold: 0,
      };

      for (const robot of finalRobots) {
        if (robot.currentLeague === 'bronze') tierCounts.bronze++;
        if (robot.currentLeague === 'silver') tierCounts.silver++;
        if (robot.currentLeague === 'gold') tierCounts.gold++;
      }

      // Expect: 90 in bronze, 10 in silver, 0 in gold
      // (not 89 in bronze, 9 in silver, 1 in gold if double promotion occurred)
      expect(tierCounts.bronze).toBe(90);
      expect(tierCounts.silver).toBe(10);
      expect(tierCounts.gold).toBe(0);

      // Clean up
      for (const robot of robots) {
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });
  });
});
