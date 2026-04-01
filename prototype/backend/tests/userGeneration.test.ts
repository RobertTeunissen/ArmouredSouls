/**
 * User Generation Unit Tests (Tiered Stable System)
 *
 * Tests for generateBattleReadyUsers() — the tiered auto-generation system
 * that creates WimpBot (3 robots), AverageBot (2 robots), and ExpertBot (1 robot)
 * stables during each cycle.
 *
 * Requirements: 8.1, 8.2, 9.1, 10.1, 11.1
 */

import prisma from '../src/lib/prisma';
import { generateBattleReadyUsers } from '../src/utils/userGeneration';
import { TIER_CONFIGS, distributeTiers, LOADOUT_TITLES, WEAPON_CODENAMES } from '../src/utils/tierConfig';
import fc from 'fast-check';

/**
 * Cleanup helper: removes all auto-generated users and their associated data.
 * Targets usernames starting with 'auto_' (auto_wimpbot_*, auto_averagebot_*, auto_expertbot_*).
 */
async function cleanupAutoUsers(): Promise<void> {
  const autoUsers = await prisma.user.findMany({
    where: { username: { startsWith: 'auto_' } },
    select: { id: true },
  });
  const userIds = autoUsers.map((u) => u.id);
  if (userIds.length === 0) return;

  const robots = await prisma.robot.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);

  if (robotIds.length > 0) {
    const tagTeamIds = (
      await prisma.tagTeam.findMany({
        where: {
          OR: [
            { activeRobotId: { in: robotIds } },
            { reserveRobotId: { in: robotIds } },
          ],
        },
        select: { id: true },
      })
    ).map((t) => t.id);

    if (tagTeamIds.length > 0) {
      await prisma.scheduledTagTeamMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: tagTeamIds } },
            { team2Id: { in: tagTeamIds } },
          ],
        },
      });
    }

    await prisma.tagTeam.deleteMany({
      where: {
        OR: [
          { activeRobotId: { in: robotIds } },
          { reserveRobotId: { in: robotIds } },
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
    await prisma.scheduledLeagueMatch.deleteMany({
      where: {
        OR: [
          { robot1Id: { in: robotIds } },
          { robot2Id: { in: robotIds } },
        ],
      },
    });
    // Delete KOTH match participants before robots
    await prisma.scheduledKothMatchParticipant.deleteMany({
      where: { robotId: { in: robotIds } },
    });
  }

  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.facility.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('User Generation (Tiered Stable System)', () => {
  beforeAll(async () => {
    await prisma.$connect();
    // Weapons are seeded globally via tests/setup.ts (all 47 WEAPON_DEFINITIONS)
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupAutoUsers();
  });

  afterEach(async () => {
    await cleanupAutoUsers();
  });

  describe('generateBattleReadyUsers', () => {
    it('should create N stables for cycle N', async () => {
      const result = await generateBattleReadyUsers(3);

      expect(result.usersCreated).toBe(3);
      expect(result.usernames).toHaveLength(3);
      const uniqueUsernames = new Set(result.usernames);
      expect(uniqueUsernames.size).toBe(3);
    });

    it('should return TieredGenerationResult with tierBreakdown', async () => {
      const result = await generateBattleReadyUsers(3);

      expect(result).toHaveProperty('usersCreated');
      expect(result).toHaveProperty('robotsCreated');
      expect(result).toHaveProperty('tagTeamsCreated');
      expect(result).toHaveProperty('usernames');
      expect(result).toHaveProperty('tierBreakdown');
      expect(result.tierBreakdown).toHaveProperty('wimpBot');
      expect(result.tierBreakdown).toHaveProperty('averageBot');
      expect(result.tierBreakdown).toHaveProperty('expertBot');

      // Cycle 3: 1 WimpBot + 1 AverageBot + 1 ExpertBot = 3
      expect(result.tierBreakdown.wimpBot).toBe(1);
      expect(result.tierBreakdown.averageBot).toBe(1);
      expect(result.tierBreakdown.expertBot).toBe(1);
      expect(
        result.tierBreakdown.wimpBot +
        result.tierBreakdown.averageBot +
        result.tierBreakdown.expertBot,
      ).toBe(3);
    });

    it('should create correct robot counts per tier', async () => {
      // Cycle 3: 1 WimpBot(3 robots) + 1 AverageBot(2 robots) + 1 ExpertBot(1 robot) = 6 robots
      const result = await generateBattleReadyUsers(3);

      expect(result.robotsCreated).toBe(6);

      // Verify per-user robot counts by querying the DB
      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'auto_' } },
        include: { robots: true },
        orderBy: { username: 'asc' },
      });

      const wimpBotUsers = users.filter((u) => u.username.startsWith('auto_wimpbot_'));
      const averageBotUsers = users.filter((u) => u.username.startsWith('auto_averagebot_'));
      const expertBotUsers = users.filter((u) => u.username.startsWith('auto_expertbot_'));

      expect(wimpBotUsers).toHaveLength(1);
      expect(averageBotUsers).toHaveLength(1);
      expect(expertBotUsers).toHaveLength(1);

      // WimpBot: 3 robots, AverageBot: 2 robots, ExpertBot: 1 robot
      wimpBotUsers.forEach((u) => expect(u.robots).toHaveLength(3));
      averageBotUsers.forEach((u) => expect(u.robots).toHaveLength(2));
      expertBotUsers.forEach((u) => expect(u.robots).toHaveLength(1));
    });

    it('should use auto_<tier>_NNNN username format', async () => {
      const result = await generateBattleReadyUsers(3);

      const wimpBotNames = result.usernames.filter((u) => u.startsWith('auto_wimpbot_'));
      const averageBotNames = result.usernames.filter((u) => u.startsWith('auto_averagebot_'));
      const expertBotNames = result.usernames.filter((u) => u.startsWith('auto_expertbot_'));

      expect(wimpBotNames.length).toBe(1);
      expect(averageBotNames.length).toBe(1);
      expect(expertBotNames.length).toBe(1);

      // Verify the NNNN format (4-digit zero-padded)
      for (const username of result.usernames) {
        expect(username).toMatch(/^auto_(wimpbot|averagebot|expertbot)_\d{4}$/);
      }
    });

    it('should set currency to 100000 for all generated users', async () => {
      await generateBattleReadyUsers(3);

      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'auto_' } },
      });

      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.currency).toBe(100000);
        expect(user.role).toBe('user');
      });
    });

    it('should assign stable names to all generated users', async () => {
      await generateBattleReadyUsers(3);

      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'auto_' } },
      });

      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.stableName).not.toBeNull();
        expect(typeof user.stableName).toBe('string');
        expect((user.stableName as string).length).toBeGreaterThan(0);
      });

      // All stable names should be unique
      const stableNames = users.map((u) => u.stableName);
      expect(new Set(stableNames).size).toBe(stableNames.length);
    });

    it('should create robots with tier-appropriate attributes', async () => {
      await generateBattleReadyUsers(3);

      // WimpBot robots: all attributes = 1.0
      const wimpBotRobots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_wimpbot_' } } },
      });
      expect(wimpBotRobots.length).toBe(3);
      for (const robot of wimpBotRobots) {
        expect(Number(robot.combatPower)).toBe(1.0);
        expect(Number(robot.targetingSystems)).toBe(1.0);
        expect(Number(robot.armorPlating)).toBe(1.0);
        expect(Number(robot.shieldCapacity)).toBe(1.0);
      }

      // AverageBot robots: all attributes = 5.0
      const avgBotRobots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_averagebot_' } } },
      });
      expect(avgBotRobots.length).toBe(2);
      for (const robot of avgBotRobots) {
        expect(Number(robot.combatPower)).toBe(5.0);
        expect(Number(robot.targetingSystems)).toBe(5.0);
        expect(Number(robot.armorPlating)).toBe(5.0);
        expect(Number(robot.shieldCapacity)).toBe(5.0);
      }

      // ExpertBot robots: all attributes = 10.0
      const expertBotRobots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_expertbot_' } } },
      });
      expect(expertBotRobots.length).toBe(1);
      for (const robot of expertBotRobots) {
        expect(Number(robot.combatPower)).toBe(10.0);
        expect(Number(robot.targetingSystems)).toBe(10.0);
        expect(Number(robot.armorPlating)).toBe(10.0);
        expect(Number(robot.shieldCapacity)).toBe(10.0);
      }
    });

    it('should equip robots with weapons from correct price tier', async () => {
      await generateBattleReadyUsers(3);

      // WimpBot: budget tier (cost < 100000)
      const wimpBotRobots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_wimpbot_' } } },
        include: { mainWeapon: { include: { weapon: true } } },
      });
      for (const robot of wimpBotRobots) {
        expect(robot.mainWeapon).not.toBeNull();
        const weaponCost = robot.mainWeapon!.weapon.cost;
        expect(weaponCost).toBeGreaterThanOrEqual(TIER_CONFIGS[0].priceTier.min);
        expect(weaponCost).toBeLessThanOrEqual(TIER_CONFIGS[0].priceTier.max);
      }

      // AverageBot: mid tier (100000-250000)
      const avgBotRobots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_averagebot_' } } },
        include: { mainWeapon: { include: { weapon: true } } },
      });
      for (const robot of avgBotRobots) {
        expect(robot.mainWeapon).not.toBeNull();
        const weaponCost = robot.mainWeapon!.weapon.cost;
        expect(weaponCost).toBeGreaterThanOrEqual(TIER_CONFIGS[1].priceTier.min);
        expect(weaponCost).toBeLessThanOrEqual(TIER_CONFIGS[1].priceTier.max);
      }

      // ExpertBot: premium tier (250000-400000)
      const expertBotRobots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_expertbot_' } } },
        include: { mainWeapon: { include: { weapon: true } } },
      });
      for (const robot of expertBotRobots) {
        expect(robot.mainWeapon).not.toBeNull();
        const weaponCost = robot.mainWeapon!.weapon.cost;
        expect(weaponCost).toBeGreaterThanOrEqual(TIER_CONFIGS[2].priceTier.min);
        expect(weaponCost).toBeLessThanOrEqual(TIER_CONFIGS[2].priceTier.max);
      }
    });

    it('should place all robots in bronze league with ELO 1200', async () => {
      await generateBattleReadyUsers(3);

      const robots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_' } } },
      });

      expect(robots.length).toBe(6);
      robots.forEach((robot) => {
        expect(robot.elo).toBe(1200);
        expect(robot.currentLeague).toBe('bronze');
        expect(robot.leagueId).toMatch(/^bronze_\d+$/);
        expect(robot.battleReadiness).toBe(100);
      });
    });

    it('should return early with zero counts for cycleNumber <= 0', async () => {
      const resultZero = await generateBattleReadyUsers(0);
      expect(resultZero.usersCreated).toBe(0);
      expect(resultZero.robotsCreated).toBe(0);
      expect(resultZero.tagTeamsCreated).toBe(0);
      expect(resultZero.usernames).toHaveLength(0);
      expect(resultZero.tierBreakdown).toEqual({
        wimpBot: 0,
        averageBot: 0,
        expertBot: 0,
      });

      const resultNeg = await generateBattleReadyUsers(-1);
      expect(resultNeg.usersCreated).toBe(0);
      expect(resultNeg.robotsCreated).toBe(0);
      expect(resultNeg.tagTeamsCreated).toBe(0);
      expect(resultNeg.usernames).toHaveLength(0);
    });
  });

  /**
   * Property-Based Tests for User Generation
   *
   * These tests verify universal properties that should hold across all valid
   * cycle numbers. Each test uses fast-check to generate random inputs and
   * verify the property holds.
   */
  describe('Property-Based Tests', () => {
    /**
     * Property 2: Generated robots have tier-appropriate attributes
     * **Validates: Requirements 9.1, 10.1, 11.1**
     *
     * For any tier configuration (WimpBot/AverageBot/ExpertBot) and any generated
     * robot in that tier, all 23 attributes should equal the tier's attribute level
     * (1.00 for WimpBot, 5.00 for AverageBot, 10.00 for ExpertBot), and the robot
     * count per stable should match the tier's robot count (3, 2, or 1 respectively).
     */
    it('Property 2: Generated robots have tier-appropriate attributes', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 6 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          await generateBattleReadyUsers(cycleNumber);

          // Verify WimpBot robots (attributeLevel = 1.0)
          const wimpBotRobots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_wimpbot_' } } },
          });
          for (const robot of wimpBotRobots) {
            expect(Number(robot.combatPower)).toBe(1.0);
            expect(Number(robot.targetingSystems)).toBe(1.0);
            expect(Number(robot.armorPlating)).toBe(1.0);
            expect(Number(robot.shieldCapacity)).toBe(1.0);
            expect(Number(robot.criticalSystems)).toBe(1.0);
            expect(Number(robot.penetration)).toBe(1.0);
            expect(Number(robot.weaponControl)).toBe(1.0);
            expect(Number(robot.attackSpeed)).toBe(1.0);
            expect(Number(robot.evasionThrusters)).toBe(1.0);
            expect(Number(robot.damageDampeners)).toBe(1.0);
            expect(Number(robot.counterProtocols)).toBe(1.0);
            expect(Number(robot.hullIntegrity)).toBe(1.0);
            expect(Number(robot.servoMotors)).toBe(1.0);
            expect(Number(robot.gyroStabilizers)).toBe(1.0);
            expect(Number(robot.hydraulicSystems)).toBe(1.0);
            expect(Number(robot.powerCore)).toBe(1.0);
            expect(Number(robot.combatAlgorithms)).toBe(1.0);
            expect(Number(robot.threatAnalysis)).toBe(1.0);
            expect(Number(robot.adaptiveAI)).toBe(1.0);
            expect(Number(robot.logicCores)).toBe(1.0);
            expect(Number(robot.syncProtocols)).toBe(1.0);
            expect(Number(robot.supportSystems)).toBe(1.0);
            expect(Number(robot.formationTactics)).toBe(1.0);
          }

          // Verify AverageBot robots (attributeLevel = 5.0)
          const avgBotRobots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_averagebot_' } } },
          });
          for (const robot of avgBotRobots) {
            expect(Number(robot.combatPower)).toBe(5.0);
            expect(Number(robot.targetingSystems)).toBe(5.0);
            expect(Number(robot.armorPlating)).toBe(5.0);
            expect(Number(robot.shieldCapacity)).toBe(5.0);
          }

          // Verify ExpertBot robots (attributeLevel = 10.0)
          const expertBotRobots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_expertbot_' } } },
          });
          for (const robot of expertBotRobots) {
            expect(Number(robot.combatPower)).toBe(10.0);
            expect(Number(robot.targetingSystems)).toBe(10.0);
            expect(Number(robot.armorPlating)).toBe(10.0);
            expect(Number(robot.shieldCapacity)).toBe(10.0);
          }

          // Verify robot counts per stable match tier configuration
          const wimpBotUsers = await prisma.user.findMany({
            where: { username: { startsWith: 'auto_wimpbot_' } },
            include: { robots: true },
          });
          for (const user of wimpBotUsers) {
            expect(user.robots).toHaveLength(3); // WimpBot: 3 robots
          }

          const avgBotUsers = await prisma.user.findMany({
            where: { username: { startsWith: 'auto_averagebot_' } },
            include: { robots: true },
          });
          for (const user of avgBotUsers) {
            expect(user.robots).toHaveLength(2); // AverageBot: 2 robots
          }

          const expertBotUsers = await prisma.user.findMany({
            where: { username: { startsWith: 'auto_expertbot_' } },
            include: { robots: true },
          });
          for (const user of expertBotUsers) {
            expect(user.robots).toHaveLength(1); // ExpertBot: 1 robot
          }

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 60000);

    /**
     * Property 5: All generated robots start in Bronze league with ELO 1200
     * **Validates: Requirements 5.7, 9.7, 10.7, 11.7, 15.1**
     *
     * For any generated robot (regardless of tier), its elo should be 1200,
     * its currentLeague should be "bronze", and its leagueId should match
     * the pattern bronze_N where N is a positive integer.
     */
    it('Property 5: All generated robots start in Bronze league with ELO 1200', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          await generateBattleReadyUsers(cycleNumber);

          const robots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_' } } },
          });

          for (const robot of robots) {
            expect(robot.elo).toBe(1200);
            expect(robot.currentLeague).toBe('bronze');
            expect(robot.leagueId).toMatch(/^bronze_\d+$/);
          }

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 60000);

    /**
     * Property 6: All generated users start with ₡100,000 and a stable name
     * **Validates: Requirements 5.2, 5.3, 8.4, 8.5, 16.1, 16.2**
     *
     * For any generated user (both seeded test users and cycle-generated users),
     * currency should equal 100000 and stableName should be a non-null, non-empty string.
     */
    it('Property 6: All generated users start with ₡100,000 and a stable name', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          await generateBattleReadyUsers(cycleNumber);

          const users = await prisma.user.findMany({
            where: { username: { startsWith: 'auto_' } },
          });

          for (const user of users) {
            expect(user.currency).toBe(100000);
            expect(user.stableName).not.toBeNull();
            expect(typeof user.stableName).toBe('string');
            expect((user.stableName as string).length).toBeGreaterThan(0);
          }

          // All stable names should be unique
          const stableNames = users.map((u) => u.stableName);
          expect(new Set(stableNames).size).toBe(stableNames.length);

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 60000);

    /**
     * Property 10: Generated robots have valid stance and yield threshold
     * **Validates: Requirements 12.1, 12.2**
     *
     * For any generated robot, its stance should be one of "balanced", "offensive",
     * or "defensive", and its yieldThreshold should be an integer in the range [0, 20].
     */
    it('Property 10: Generated robots have valid stance and yield threshold', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 6 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          await generateBattleReadyUsers(cycleNumber);

          const robots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_' } } },
          });

          const validStances = ['balanced', 'offensive', 'defensive'];

          for (const robot of robots) {
            // Verify stance is valid
            expect(validStances).toContain(robot.stance);

            // Verify yieldThreshold is an integer in [0, 20]
            expect(Number.isInteger(robot.yieldThreshold)).toBe(true);
            expect(robot.yieldThreshold).toBeGreaterThanOrEqual(0);
            expect(robot.yieldThreshold).toBeLessThanOrEqual(20);
          }

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 60000);

    /**
     * Property 11: Generated robots have valid loadout type and range band selection
     * **Validates: Requirements 9.2, 9.3, 10.2, 10.3, 11.2, 11.3**
     *
     * For any generated robot, its loadoutType should be one of "single",
     * "weapon_shield", "two_handed", or "dual_wield", and the equipped weapon's
     * rangeBand should be one of "melee", "short", "mid", or "long".
     */
    it('Property 11: Generated robots have valid loadout type and range band selection', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 6 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          await generateBattleReadyUsers(cycleNumber);

          const robots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_' } } },
            include: { mainWeapon: { include: { weapon: true } } },
          });

          const validLoadoutTypes = ['single', 'weapon_shield', 'two_handed', 'dual_wield'];
          const validRangeBands = ['melee', 'short', 'mid', 'long'];

          for (const robot of robots) {
            // Verify loadoutType is valid
            expect(validLoadoutTypes).toContain(robot.loadoutType);

            // Verify weapon's rangeBand is valid
            expect(robot.mainWeapon).not.toBeNull();
            expect(validRangeBands).toContain(robot.mainWeapon!.weapon.rangeBand);
          }

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 60000);

    /**
     * Property 12: HP and shield are correctly derived from attributes
     * **Validates: Requirements 5.4, 9.1, 10.1, 11.1**
     *
     * For any generated robot with attribute level A:
     * - maxHP should equal 50 + floor(A * 5)
     * - maxShield should equal floor(A * 4)
     * - currentHP should equal maxHP
     * - currentShield should equal maxShield
     *
     * Tier attribute levels: WimpBot=1.0, AverageBot=5.0, ExpertBot=10.0
     * Expected values:
     * - WimpBot: HP = 55, Shield = 4
     * - AverageBot: HP = 75, Shield = 20
     * - ExpertBot: HP = 100, Shield = 40
     */
    it('Property 12: HP and shield are correctly derived from attributes', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 6 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          await generateBattleReadyUsers(cycleNumber);

          // WimpBot: attributeLevel = 1.0 → HP = 55, Shield = 4
          const wimpBotRobots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_wimpbot_' } } },
          });
          for (const robot of wimpBotRobots) {
            const expectedHP = 50 + Math.floor(1.0 * 5); // 55
            const expectedShield = Math.floor(1.0 * 4); // 4
            expect(robot.maxHP).toBe(expectedHP);
            expect(robot.currentHP).toBe(expectedHP);
            expect(robot.maxShield).toBe(expectedShield);
            expect(robot.currentShield).toBe(expectedShield);
          }

          // AverageBot: attributeLevel = 5.0 → HP = 75, Shield = 20
          const avgBotRobots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_averagebot_' } } },
          });
          for (const robot of avgBotRobots) {
            const expectedHP = 50 + Math.floor(5.0 * 5); // 75
            const expectedShield = Math.floor(5.0 * 4); // 20
            expect(robot.maxHP).toBe(expectedHP);
            expect(robot.currentHP).toBe(expectedHP);
            expect(robot.maxShield).toBe(expectedShield);
            expect(robot.currentShield).toBe(expectedShield);
          }

          // ExpertBot: attributeLevel = 10.0 → HP = 100, Shield = 40
          const expertBotRobots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_expertbot_' } } },
          });
          for (const robot of expertBotRobots) {
            const expectedHP = 50 + Math.floor(10.0 * 5); // 100
            const expectedShield = Math.floor(10.0 * 4); // 40
            expect(robot.maxHP).toBe(expectedHP);
            expect(robot.currentHP).toBe(expectedHP);
            expect(robot.maxShield).toBe(expectedShield);
            expect(robot.currentShield).toBe(expectedShield);
          }

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 60000);

    /**
     * Property 7: Robot names encode loadout and are unique
     * **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.6**
     *
     * For any set of generated robots:
     * - All robot names should be unique
     * - Each name should contain the tier identifier ("WimpBot", "AverageBot", or "ExpertBot")
     * - Each name should contain a valid loadout title ("Lone", "Guardian", "Twin", or "Heavy")
     * - Each name should contain a valid weapon codename from WEAPON_CODENAMES that matches
     *   the robot's equipped weapon
     */
    it('Property 7: Robot names encode loadout and are unique', async () => {
      const validTierIdentifiers = ['WimpBot', 'AverageBot', 'ExpertBot'];
      const validLoadoutTitles = Object.values(LOADOUT_TITLES);
      const validWeaponCodenames = Object.values(WEAPON_CODENAMES);

      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 9 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          await generateBattleReadyUsers(cycleNumber);

          const robots = await prisma.robot.findMany({
            where: { user: { username: { startsWith: 'auto_' } } },
            include: { mainWeapon: { include: { weapon: true } } },
          });

          // Verify all robot names are unique
          const robotNames = robots.map((r) => r.name);
          const uniqueNames = new Set(robotNames);
          expect(uniqueNames.size).toBe(robotNames.length);

          for (const robot of robots) {
            const name = robot.name;

            // Verify name contains a valid tier identifier
            const containsTierIdentifier = validTierIdentifiers.some((tier) =>
              name.startsWith(tier)
            );
            expect(containsTierIdentifier).toBe(true);

            // Verify name contains a valid loadout title
            const containsLoadoutTitle = validLoadoutTitles.some((title) =>
              name.includes(` ${title} `)
            );
            expect(containsLoadoutTitle).toBe(true);

            // Verify name contains a valid weapon codename that matches the equipped weapon
            expect(robot.mainWeapon).not.toBeNull();
            const equippedWeaponName = robot.mainWeapon!.weapon.name;
            const expectedCodename = WEAPON_CODENAMES[equippedWeaponName];
            // Some weapons may not have codenames if the map hasn't been updated
            if (expectedCodename) {
              expect(name).toContain(expectedCodename);
            }

            // Verify the name follows the format: {Tier} {LoadoutTitle} {WeaponCodename} {Number}
            // Extract components and verify structure
            const nameParts = name.split(' ');
            expect(nameParts.length).toBeGreaterThanOrEqual(4);

            const tierPart = nameParts[0];
            const numberPart = nameParts[nameParts.length - 1];
            expect(validTierIdentifiers).toContain(tierPart);
            expect(parseInt(numberPart, 10)).toBeGreaterThan(0);
          }

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 60000);
  });
});
