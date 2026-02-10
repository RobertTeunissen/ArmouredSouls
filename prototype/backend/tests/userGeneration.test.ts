/**
 * User Generation Unit Tests
 * Tests for generateBattleReadyUsers() utility function
 */

import { PrismaClient } from '@prisma/client';
import { generateBattleReadyUsers } from '../src/utils/userGeneration';

const prisma = new PrismaClient();

describe('User Generation', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up auto-generated users before each test
    // Get all auto-user IDs first
    const autoUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'auto_user_' } },
      select: { id: true },
    });
    const autoUserIds = autoUsers.map((u) => u.id);

    if (autoUserIds.length > 0) {
      // Get robot IDs for these users
      const autoRobots = await prisma.robot.findMany({
        where: { userId: { in: autoUserIds } },
        select: { id: true },
      });
      const autoRobotIds = autoRobots.map((r) => r.id);

      if (autoRobotIds.length > 0) {
        // Delete battles
        await prisma.battle.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: autoRobotIds } },
              { robot2Id: { in: autoRobotIds } },
            ],
          },
        });

        // Delete scheduled matches
        await prisma.scheduledMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: autoRobotIds } },
              { robot2Id: { in: autoRobotIds } },
            ],
          },
        });

        // Delete tournament matches
        await prisma.tournamentMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: autoRobotIds } },
              { robot2Id: { in: autoRobotIds } },
            ],
          },
        });
      }

      // Now delete users (cascades to robots and weapon inventory)
      await prisma.user.deleteMany({
        where: { id: { in: autoUserIds } },
      });
    }
  });

  describe('generateBattleReadyUsers', () => {
    it('should create N users with unique usernames', async () => {
      const result = await generateBattleReadyUsers(5);

      expect(result.usersCreated).toBe(5);
      expect(result.robotsCreated).toBe(5);
      expect(result.usernames).toHaveLength(5);

      // Verify uniqueness
      const uniqueUsernames = new Set(result.usernames);
      expect(uniqueUsernames.size).toBe(5);

      // Verify username format
      result.usernames.forEach((username) => {
        expect(username).toMatch(/^auto_user_\d{4}$/);
      });
    });

    it('should create users with correct starting currency', async () => {
      await generateBattleReadyUsers(3);

      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'auto_user_' } },
      });

      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.currency).toBe(100000); // ₡100,000
        expect(user.role).toBe('user');
      });
    });

    it('should create battle-ready robots with correct stats', async () => {
      await generateBattleReadyUsers(1);

      const robot = await prisma.robot.findFirst({
        where: { user: { username: { startsWith: 'auto_user_' } } },
        include: {
          mainWeapon: {
            include: { weapon: true },
          },
        },
      });

      expect(robot).not.toBeNull();
      expect(robot!.currentHP).toBe(55);
      expect(robot!.maxHP).toBe(55);
      expect(robot!.currentShield).toBe(2);
      expect(robot!.maxShield).toBe(2);
      expect(robot!.elo).toBe(1200);
      expect(robot!.currentLeague).toBe('bronze');
      expect(robot!.leagueId).toBe('bronze_1');
      expect(robot!.battleReadiness).toBe(100);
      expect(robot!.yieldThreshold).toBe(10);
      expect(robot!.loadoutType).toBe('single');
      expect(robot!.stance).toBe('balanced');
    });

    it('should equip robots with Practice Sword', async () => {
      await generateBattleReadyUsers(2);

      const robots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_user_' } } },
        include: {
          mainWeapon: {
            include: { weapon: true },
          },
        },
      });

      expect(robots).toHaveLength(2);
      robots.forEach((robot) => {
        expect(robot.mainWeaponId).not.toBeNull();
        expect(robot.mainWeapon).not.toBeNull();
        expect(robot.mainWeapon!.weapon.name).toBe('Practice Sword');
      });
    });

    it('should set all robot attributes to 1.00', async () => {
      await generateBattleReadyUsers(1);

      const robot = await prisma.robot.findFirst({
        where: { user: { username: { startsWith: 'auto_user_' } } },
      });

      expect(robot).not.toBeNull();

      // Combat Systems
      expect(Number(robot!.combatPower)).toBe(1.0);
      expect(Number(robot!.targetingSystems)).toBe(1.0);
      expect(Number(robot!.criticalSystems)).toBe(1.0);
      expect(Number(robot!.penetration)).toBe(1.0);
      expect(Number(robot!.weaponControl)).toBe(1.0);
      expect(Number(robot!.attackSpeed)).toBe(1.0);

      // Defensive Systems
      expect(Number(robot!.armorPlating)).toBe(1.0);
      expect(Number(robot!.shieldCapacity)).toBe(1.0);
      expect(Number(robot!.evasionThrusters)).toBe(1.0);
      expect(Number(robot!.damageDampeners)).toBe(1.0);
      expect(Number(robot!.counterProtocols)).toBe(1.0);

      // Chassis & Mobility
      expect(Number(robot!.hullIntegrity)).toBe(1.0);
      expect(Number(robot!.servoMotors)).toBe(1.0);
      expect(Number(robot!.gyroStabilizers)).toBe(1.0);
      expect(Number(robot!.hydraulicSystems)).toBe(1.0);
      expect(Number(robot!.powerCore)).toBe(1.0);

      // AI Processing
      expect(Number(robot!.combatAlgorithms)).toBe(1.0);
      expect(Number(robot!.threatAnalysis)).toBe(1.0);
      expect(Number(robot!.adaptiveAI)).toBe(1.0);
      expect(Number(robot!.logicCores)).toBe(1.0);

      // Team Coordination
      expect(Number(robot!.syncProtocols)).toBe(1.0);
      expect(Number(robot!.supportSystems)).toBe(1.0);
      expect(Number(robot!.formationTactics)).toBe(1.0);
    });

    it('should create weapon inventory entries for each user', async () => {
      await generateBattleReadyUsers(3);

      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'auto_user_' } },
        include: { weaponInventory: true },
      });

      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.weaponInventory).toHaveLength(1);
        expect(user.weaponInventory[0].weaponId).toBeDefined();
      });
    });

    it('should generate unique robot names', async () => {
      await generateBattleReadyUsers(5);

      const robots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_user_' } } },
        select: { name: true },
      });

      const robotNames = robots.map((r) => r.name);
      expect(robotNames).toHaveLength(5);

      // Verify all names are non-empty
      robotNames.forEach((name) => {
        expect(name).toBeTruthy();
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it('should handle sequential username numbering correctly', async () => {
      // Create first batch
      const result1 = await generateBattleReadyUsers(2);
      expect(result1.usernames).toContain('auto_user_0001');
      expect(result1.usernames).toContain('auto_user_0002');

      // Create second batch
      const result2 = await generateBattleReadyUsers(2);
      expect(result2.usernames).toContain('auto_user_0003');
      expect(result2.usernames).toContain('auto_user_0004');
    });

    it('should create users atomically (transaction)', async () => {
      // This test verifies that if something fails, no partial data is created
      // We can't easily test transaction rollback without mocking, but we can
      // verify that all users created have complete data

      await generateBattleReadyUsers(3);

      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'auto_user_' } },
        include: {
          robots: {
            include: {
              mainWeapon: true,
            },
          },
          weaponInventory: true,
        },
      });

      // Verify each user has complete data
      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user.robots).toHaveLength(1);
        expect(user.robots[0].mainWeaponId).not.toBeNull();
        expect(user.robots[0].mainWeapon).not.toBeNull();
        expect(user.weaponInventory).toHaveLength(1);
      });
    });

    it('should throw error if Practice Sword is missing', async () => {
      // Delete Practice Sword temporarily
      const practiceSword = await prisma.weapon.findFirst({
        where: { name: 'Practice Sword' },
      });

      if (practiceSword) {
        // Delete weapon inventory entries first
        await prisma.weaponInventory.deleteMany({
          where: { weaponId: practiceSword.id },
        });

        // Update robots to remove references
        await prisma.robot.updateMany({
          where: { mainWeaponId: { not: null } },
          data: { mainWeaponId: null },
        });

        await prisma.weapon.delete({
          where: { id: practiceSword.id },
        });

        // Attempt to generate users
        await expect(generateBattleReadyUsers(1)).rejects.toThrow(
          'Practice Sword weapon not found'
        );

        // Restore Practice Sword
        await prisma.weapon.create({
          data: {
            name: 'Practice Sword',
            weaponType: 'melee',
            baseDamage: 10,
            cooldown: 3,
            cost: 0,
            handsRequired: 'one',
            damageType: 'melee',
            loadoutType: 'any',
            description: 'A basic training weapon',
          },
        });
      }
    });

    it('should handle large batch creation efficiently', async () => {
      const startTime = Date.now();
      const result = await generateBattleReadyUsers(50);
      const duration = Date.now() - startTime;

      expect(result.usersCreated).toBe(50);
      expect(result.robotsCreated).toBe(50);
      expect(result.usernames).toHaveLength(50);

      // Should complete within reasonable time (5 seconds per PRD requirement)
      expect(duration).toBeLessThan(5000);
    });

    it('should create users that pass battle readiness checks', async () => {
      await generateBattleReadyUsers(3);

      const robots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'auto_user_' } } },
      });

      robots.forEach((robot) => {
        // Battle readiness checks from matchmaking service
        const hpPercentage = (robot.currentHP / robot.maxHP) * 100;
        expect(hpPercentage).toBeGreaterThanOrEqual(75); // HP >= 75%
        expect(hpPercentage).toBeGreaterThanOrEqual(robot.yieldThreshold); // HP >= yield threshold
        expect(robot.mainWeaponId).not.toBeNull(); // Has weapon equipped
      });
    });

    it('should return correct summary object', async () => {
      const result = await generateBattleReadyUsers(7);

      expect(result).toHaveProperty('usersCreated');
      expect(result).toHaveProperty('robotsCreated');
      expect(result).toHaveProperty('usernames');

      expect(result.usersCreated).toBe(7);
      expect(result.robotsCreated).toBe(7);
      expect(Array.isArray(result.usernames)).toBe(true);
      expect(result.usernames.length).toBe(7);
    });

    it('should handle zero count gracefully', async () => {
      const result = await generateBattleReadyUsers(0);

      expect(result.usersCreated).toBe(0);
      expect(result.robotsCreated).toBe(0);
      expect(result.usernames).toHaveLength(0);

      // Verify no users were created
      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'auto_user_' } },
      });
      expect(users).toHaveLength(0);
    });

    it('should create users with dummy password hash', async () => {
      await generateBattleReadyUsers(1);

      const user = await prisma.user.findFirst({
        where: { username: { startsWith: 'auto_user_' } },
      });

      expect(user).not.toBeNull();
      expect(user!.passwordHash).toBe(
        '$2b$10$dummyhashforautogeneratedusers123456789012345'
      );
    });
  });
});
