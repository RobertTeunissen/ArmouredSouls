import { Robot } from '@prisma/client';
import prisma from '../src/lib/prisma';
import {
  checkBattleReadiness,
  runMatchmaking,
  runMatchmakingForTier,
  BATTLE_READINESS_HP_THRESHOLD,
} from '../src/services/matchmakingService';


describe('Matchmaking Service', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testWeaponIds: number[] = [];
  let testWeaponInvIds: number[] = [];
  let testUser: any;
  let practiceSword: any;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `matchmaking_test_user_${Date.now()}`,
        passwordHash: 'hash',
        currency: 1000000,
      },
    });
    testUserIds.push(testUser.id);

    // Create practice sword
    practiceSword = await prisma.weapon.create({
      data: {
        name: `Test Sword ${Date.now()}`,
        weaponType: 'melee',
        baseDamage: 5,
        cooldown: 3,
        cost: 0,
        handsRequired: 'one',
        damageType: 'melee',
        loadoutType: 'single',
      },
    });
    testWeaponIds.push(practiceSword.id);
  });

  afterEach(async () => {
    // Cleanup in correct order after each test
    if (testRobotIds.length > 0) {
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    if (testWeaponInvIds.length > 0) {
      await prisma.weaponInventory.deleteMany({
        where: { id: { in: testWeaponInvIds } },
      });
    }

    if (testUserIds.length > 0) {
      // Don't delete users in afterEach - they're created in beforeAll
      // Users will be cleaned up in afterAll
    }

    // Reset tracking arrays
    testRobotIds = [];
    testWeaponInvIds = [];
  });

  afterAll(async () => {
    // Final cleanup - order matters for FK constraints
    // Clean up ALL scheduled matches, robots, weapon inventory for test users
    if (testUserIds.length > 0) {
      const robots = await prisma.robot.findMany({
        where: { userId: { in: testUserIds } },
        select: { id: true },
      });
      const robotIds = robots.map(r => r.id);

      if (robotIds.length > 0) {
        await prisma.scheduledMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
        await prisma.battleParticipant.deleteMany({
          where: { robotId: { in: robotIds } },
        });
        await prisma.battle.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
        await prisma.robot.deleteMany({
          where: { id: { in: robotIds } },
        });
      }

      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: testUserIds } },
      });
    }

    // Then weapons
    if (testWeaponIds.length > 0) {
      await prisma.weapon.deleteMany({
        where: { id: { in: testWeaponIds } },
      });
    }

    // Finally users
    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    await prisma.$disconnect();
  });

  describe('checkBattleReadiness', () => {
    it('should mark robot as ready when HP >= 75% and weapon equipped', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId: testUser.id,
          weaponId: practiceSword.id,
        },
      });
      testWeaponInvIds.push(weaponInv.id);

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: `Ready Robot ${Date.now()}`,
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          yieldThreshold: 10, // Yield at 10%, well below current 100% HP
        },
      });
      testRobotIds.push(robot.id);

      const readiness = checkBattleReadiness(robot);

      expect(readiness.isReady).toBe(true);
      expect(readiness.hpCheck).toBe(true);
      expect(readiness.weaponCheck).toBe(true);
      expect(readiness.reasons).toHaveLength(0);

      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv.id } });
    });

    it('should mark robot as not ready when HP < 75%', async () => {
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
          currentHP: 7, // 70% HP (below 75% threshold)
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          yieldThreshold: 10,
        },
      });

      const readiness = checkBattleReadiness(robot);

      expect(readiness.isReady).toBe(false);
      expect(readiness.hpCheck).toBe(false);
      expect(readiness.weaponCheck).toBe(true);
      expect(readiness.reasons.some(r => r.includes('HP too low'))).toBe(true);

      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv.id } });
    });

    it('should mark robot as not ready when HP is at or below yield threshold', async () => {
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId: testUser.id,
          weaponId: practiceSword.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Yield Threshold Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 8, // 80% HP (above 75% threshold)
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          yieldThreshold: 80, // But yield threshold is 80%, so robot would surrender immediately
        },
      });

      const readiness = checkBattleReadiness(robot);

      expect(readiness.isReady).toBe(false);
      expect(readiness.hpCheck).toBe(false); // Should fail HP check due to yield threshold
      expect(readiness.weaponCheck).toBe(true);
      expect(readiness.reasons.some(r => r.includes('yield threshold'))).toBe(true);

      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv.id } });
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

      await prisma.robot.deleteMany({ where: { id: robot.id } });
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

      await prisma.robot.deleteMany({ where: { id: robot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv1.id } });
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

      // At least 2 matches from our 4 robots (may be more if other bronze robots exist)
      expect(matchCount).toBeGreaterThanOrEqual(2);

      // Verify our robots got scheduled
      const robotIds = robots.map(r => r.id);
      const scheduledMatches = await prisma.scheduledMatch.findMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });

      expect(scheduledMatches.length).toBeGreaterThanOrEqual(2);

      // Clean up
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });
      for (const robot of robots) {
        await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
    });

    it('should create bye-match for odd number of robots', async () => {
      // Ensure a bye robot exists (matchmaking looks for robot named 'Bye Robot')
      let byeRobot = await prisma.robot.findFirst({ where: { name: 'Bye Robot' } });
      let createdByeUser = false;
      let byeUserId: number | null = null;

      if (!byeRobot) {
        const byeUser = await prisma.user.create({
          data: {
            username: `bye_test_${Date.now()}`,
            passwordHash: 'hash',
          },
        });
        byeUserId = byeUser.id;
        testUserIds.push(byeUser.id);
        createdByeUser = true;

        const byeWeaponInv = await prisma.weaponInventory.create({
          data: {
            userId: byeUser.id,
            weaponId: practiceSword.id,
          },
        });

        byeRobot = await prisma.robot.create({
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
      }

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

      // Should create at least 1 match from our 3 robots
      expect(matchCount).toBeGreaterThanOrEqual(1);

      // Check if any of our robots got a bye-match (matched against the bye robot)
      const robotIds = robots.map(r => r.id);
      const ourMatches = await prisma.scheduledMatch.findMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });

      // All our robots should be scheduled
      expect(ourMatches.length).toBeGreaterThanOrEqual(1);

      // Clean up
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: robots.map(r => r.id) } },
            { robot2Id: { in: robots.map(r => r.id) } },
            { robot1Id: byeRobot!.id },
            { robot2Id: byeRobot!.id },
          ],
        },
      });
      for (const robot of robots) {
        await prisma.robot.deleteMany({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
      if (byeUserId) {
        await prisma.weaponInventory.deleteMany({ where: { userId: byeUserId } });
      }
      if (createdByeUser && byeRobot) {
        await prisma.robot.deleteMany({ where: { id: byeRobot.id } });
      }
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

      const robotIds = robots.map(r => r.id);
      const firstMatchCount = await prisma.scheduledMatch.count({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });
      expect(firstMatchCount).toBeGreaterThanOrEqual(1);

      // Run matchmaking again - should not create duplicates
      await runMatchmakingForTier('bronze', scheduledFor);

      const secondMatchCount = await prisma.scheduledMatch.count({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });
      expect(secondMatchCount).toBe(firstMatchCount); // Same count, no duplicates

      // Clean up
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: robotIds } },
            { robot2Id: { in: robotIds } },
          ],
        },
      });
      for (const robot of robots) {
        await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
        await prisma.robot.deleteMany({ where: { id: robot.id } });
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
          leagueId: 'platinum_1',
          currentLeague: 'platinum',
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
          leagueId: 'platinum_1',
          currentLeague: 'platinum',
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
      const matchCount = await runMatchmakingForTier('platinum', scheduledFor);

      // Should be 0 matches (need at least 2 ready robots)
      expect(matchCount).toBe(0);

      // Clean up
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: readyRobot.id },
            { robot2Id: readyRobot.id },
            { robot1Id: notReadyRobot.id },
            { robot2Id: notReadyRobot.id },
          ],
        },
      });
      await prisma.robot.deleteMany({ where: { id: readyRobot.id } });
      await prisma.robot.deleteMany({ where: { id: notReadyRobot.id } });
      await prisma.weaponInventory.deleteMany({ where: { id: weaponInv1.id } });
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

      // Should create at least 1 match per tier where we have 2 robots = at least 3 matches
      // May be more if other robots exist in the database
      expect(totalMatches).toBeGreaterThanOrEqual(3);

      // Clean up
      const allRobotIds = allRobots.map(r => r.id);
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: allRobotIds } },
            { robot2Id: { in: allRobotIds } },
          ],
        },
      });
      await prisma.robot.deleteMany({ where: { id: { in: allRobotIds } } });
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });
  });
});
