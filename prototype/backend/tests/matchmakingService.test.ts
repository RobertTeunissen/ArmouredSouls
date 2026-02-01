import { PrismaClient, Robot } from '@prisma/client';
import {
  checkBattleReadiness,
  runMatchmaking,
  runMatchmakingForTier,
  BATTLE_READINESS_HP_THRESHOLD,
} from '../src/services/matchmakingService';

const prisma = new PrismaClient();

describe('Matchmaking Service', () => {
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
        username: 'matchmaking_test_user',
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

  describe('checkBattleReadiness', () => {
    it('should mark robot as ready when HP >= 50% and weapon equipped', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId: testUser.id,
          weaponId: practiceSword.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Ready Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      const readiness = checkBattleReadiness(robot);

      expect(readiness.isReady).toBe(true);
      expect(readiness.hpCheck).toBe(true);
      expect(readiness.weaponCheck).toBe(true);
      expect(readiness.reasons).toHaveLength(0);

      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv.id } });
    });

    it('should mark robot as not ready when HP < 50%', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId: testUser.id,
          weaponId: practiceSword.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Low HP Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 4, // 40% HP (below 50% threshold)
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      const readiness = checkBattleReadiness(robot);

      expect(readiness.isReady).toBe(false);
      expect(readiness.hpCheck).toBe(false);
      expect(readiness.weaponCheck).toBe(true);
      expect(readiness.reasons.some(r => r.includes('HP too low'))).toBe(true);

      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv.id } });
    });

    it('should mark robot as not ready when weapon not equipped', async () => {
      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'No Weapon Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          loadoutType: 'single',
          mainWeaponId: null, // No weapon
        },
      });

      const readiness = checkBattleReadiness(robot);

      expect(readiness.isReady).toBe(false);
      expect(readiness.hpCheck).toBe(true);
      expect(readiness.weaponCheck).toBe(false);
      expect(readiness.reasons).toContain('No main weapon equipped');

      await prisma.robot.delete({ where: { id: robot.id } });
    });

    it('should check dual wield loadout correctly', async () => {
      const weaponInv1 = await prisma.weaponInventory.create({
        data: {
          userId: testUser.id,
          weaponId: practiceSword.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Dual Wield Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          loadoutType: 'dual_wield',
          mainWeaponId: weaponInv1.id,
          offhandWeaponId: null, // Missing offhand
        },
      });

      const readiness = checkBattleReadiness(robot);

      expect(readiness.isReady).toBe(false);
      expect(readiness.weaponCheck).toBe(false);
      expect(readiness.reasons).toContain('No offhand weapon equipped');

      await prisma.robot.delete({ where: { id: robot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv1.id } });
    });
  });

  describe('runMatchmakingForTier', () => {
    it('should create matches for available robots', async () => {
      // Create 4 ready robots in bronze league
      const robots = [];
      for (let i = 0; i < 4; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: {
            userId: testUser.id,
            weaponId: practiceSword.id,
          },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Match Robot ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200 + i * 10,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const matchCount = await runMatchmakingForTier('bronze', scheduledFor);

      expect(matchCount).toBe(2); // 4 robots = 2 matches

      // Verify scheduled matches were created
      const scheduledMatches = await prisma.scheduledMatch.findMany({
        where: {
          status: 'scheduled',
        },
      });

      expect(scheduledMatches).toHaveLength(2);

      // Clean up
      await prisma.scheduledMatch.deleteMany({});
      for (const robot of robots) {
        await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
        await prisma.robot.delete({ where: { id: robot.id } });
      }
    });

    it('should create bye-match for odd number of robots', async () => {
      // Create bye-robot first
      const byeUser = await prisma.user.create({
        data: {
          username: 'bye_test',
          passwordHash: 'hash',
        },
      });

      const byeWeaponInv = await prisma.weaponInventory.create({
        data: {
          userId: byeUser.id,
          weaponId: practiceSword.id,
        },
      });

      const byeRobot = await prisma.robot.create({
        data: {
          userId: byeUser.id,
          name: 'Bye Robot',
          leagueId: 'bronze_bye',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1000,
          loadoutType: 'single',
          mainWeaponId: byeWeaponInv.id,
        },
      });

      // Create 3 ready robots (odd number)
      const robots = [];
      for (let i = 0; i < 3; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: {
            userId: testUser.id,
            weaponId: practiceSword.id,
          },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Odd Robot ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200 + i * 10,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const matchCount = await runMatchmakingForTier('bronze', scheduledFor);

      expect(matchCount).toBe(2); // 3 robots = 1 normal match + 1 bye-match

      // Verify bye-match was created
      const byeMatches = await prisma.scheduledMatch.findMany({
        where: {
          OR: [
            { robot1Id: byeRobot.id },
            { robot2Id: byeRobot.id },
          ],
        },
      });

      expect(byeMatches.length).toBeGreaterThan(0);

      // Clean up
      await prisma.scheduledMatch.deleteMany({});
      for (const robot of robots) {
        await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
        await prisma.robot.delete({ where: { id: robot.id } });
      }
      await prisma.robot.delete({ where: { id: byeRobot.id } });
      await prisma.weaponInventory.delete({ where: { id: byeWeaponInv.id } });
      await prisma.user.delete({ where: { id: byeUser.id } });
    });

    it('should not create duplicate matches for already scheduled robots', async () => {
      // Create 2 robots
      const robots = [];
      for (let i = 0; i < 2; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: {
            userId: testUser.id,
            weaponId: practiceSword.id,
          },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Dup Robot ${i}`,
            leagueId: 'bronze_1',
            currentLeague: 'bronze',
            currentHP: 10,
            maxHP: 10,
            currentShield: 2,
            maxShield: 2,
            elo: 1200,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
      }

      // Run matchmaking first time
      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await runMatchmakingForTier('bronze', scheduledFor);

      const firstMatchCount = await prisma.scheduledMatch.count();
      expect(firstMatchCount).toBe(1);

      // Run matchmaking again - should not create duplicates
      await runMatchmakingForTier('bronze', scheduledFor);

      const secondMatchCount = await prisma.scheduledMatch.count();
      expect(secondMatchCount).toBe(1); // Same count, no duplicates

      // Clean up
      await prisma.scheduledMatch.deleteMany({});
      for (const robot of robots) {
        await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
        await prisma.robot.delete({ where: { id: robot.id } });
      }
    });

    it('should skip robots that are not battle-ready', async () => {
      // Create 1 ready robot and 1 not-ready robot
      const weaponInv1 = await prisma.weaponInventory.create({
        data: {
          userId: testUser.id,
          weaponId: practiceSword.id,
        },
      });

      const readyRobot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Ready',
          leagueId: 'silver_1',
          currentLeague: 'silver',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
        },
      });

      const notReadyRobot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Not Ready',
          leagueId: 'silver_1',
          currentLeague: 'silver',
          currentHP: 5, // Low HP
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: null, // No weapon
        },
      });

      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const matchCount = await runMatchmakingForTier('silver', scheduledFor);

      // Should be 0 matches (need at least 2 ready robots)
      expect(matchCount).toBe(0);

      // Clean up
      await prisma.scheduledMatch.deleteMany({});
      await prisma.robot.delete({ where: { id: readyRobot.id } });
      await prisma.robot.delete({ where: { id: notReadyRobot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv1.id } });
    });
  });

  describe('runMatchmaking (all tiers)', () => {
    it('should run matchmaking across all tiers', async () => {
      // Create robots in different tiers
      const tiers = ['bronze', 'silver', 'gold'];
      const allRobots = [];

      for (const tier of tiers) {
        for (let i = 0; i < 2; i++) {
          const weaponInv = await prisma.weaponInventory.create({
            data: {
              userId: testUser.id,
              weaponId: practiceSword.id,
            },
          });

          const robot = await prisma.robot.create({
            data: {
              userId: testUser.id,
              name: `${tier} Robot ${i}`,
              leagueId: `${tier}_1`,
              currentLeague: tier,
              currentHP: 10,
              maxHP: 10,
              currentShield: 2,
              maxShield: 2,
              elo: 1200,
              loadoutType: 'single',
              mainWeaponId: weaponInv.id,
            },
          });
          allRobots.push(robot);
        }
      }

      const scheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const totalMatches = await runMatchmaking(scheduledFor);

      // Should create 1 match per tier = 3 matches
      expect(totalMatches).toBe(3);

      // Clean up
      await prisma.scheduledMatch.deleteMany({});
      for (const robot of allRobots) {
        await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
        await prisma.robot.delete({ where: { id: robot.id } });
      }
    });
  });
});
