/**
 * User Generation Unit Tests
 * Tests for generateBattleReadyUsers() utility function
 */

import { PrismaClient } from '@prisma/client';
import { generateBattleReadyUsers } from '../src/utils/userGeneration';
import { cleanupUserTestData } from './cleanupHelper';

const prisma = new PrismaClient();

describe('User Generation', () => {
  beforeAll(async () => {
    await prisma.$connect();
    
    // Seed weapons needed by archetypes
    const weaponsToSeed = [
      { name: 'Power Sword', cost: 350000, weaponType: 'melee', handsRequired: 'one', loadoutType: 'any', baseDamage: 50, cooldown: 2, damageType: 'melee' },
      { name: 'Combat Shield', cost: 100000, weaponType: 'shield', handsRequired: 'shield', loadoutType: 'any', baseDamage: 0, cooldown: 0, damageType: 'melee' },
      { name: 'Plasma Cannon', cost: 400000, weaponType: 'energy', handsRequired: 'two', loadoutType: 'two_handed', baseDamage: 80, cooldown: 4, damageType: 'energy' },
      { name: 'Railgun', cost: 488000, weaponType: 'ballistic', handsRequired: 'two', loadoutType: 'two_handed', baseDamage: 90, cooldown: 4, damageType: 'ballistic' },
      { name: 'Heavy Hammer', cost: 450000, weaponType: 'melee', handsRequired: 'two', loadoutType: 'two_handed', baseDamage: 85, cooldown: 4, damageType: 'melee' },
      { name: 'Machine Gun', cost: 150000, weaponType: 'ballistic', handsRequired: 'one', loadoutType: 'any', baseDamage: 35, cooldown: 2, damageType: 'ballistic' },
      { name: 'Plasma Blade', cost: 269000, weaponType: 'melee', handsRequired: 'one', loadoutType: 'any', baseDamage: 45, cooldown: 2, damageType: 'melee' },
      { name: 'Plasma Rifle', cost: 275000, weaponType: 'energy', handsRequired: 'one', loadoutType: 'any', baseDamage: 42, cooldown: 2, damageType: 'energy' },
    ];
    
    // Only create weapons if they don't exist
    for (const weapon of weaponsToSeed) {
      const existing = await prisma.weapon.findFirst({ where: { name: weapon.name } });
      if (!existing) {
        await prisma.weapon.create({ data: weapon });
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up archetype users and their dependencies before each test
    const archetypeUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'archetype_' } },
      select: { id: true },
    });
    
    const userIds = archetypeUsers.map(u => u.id);
    
    if (userIds.length > 0) {
      // Get robot IDs
      const robots = await prisma.robot.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const robotIds = robots.map(r => r.id);
      
      if (robotIds.length > 0) {
        // Delete in correct order
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
        await prisma.scheduledMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
      }
      
      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.robot.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  afterEach(async () => {
    // Clean up archetype users and their dependencies after each test
    const archetypeUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'archetype_' } },
      select: { id: true },
    });
    
    const userIds = archetypeUsers.map(u => u.id);
    
    if (userIds.length > 0) {
      // Get robot IDs
      const robots = await prisma.robot.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const robotIds = robots.map(r => r.id);
      
      if (robotIds.length > 0) {
        // Delete in correct order
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
        await prisma.scheduledMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
      }
      
      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.robot.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  describe('generateBattleReadyUsers', () => {
    it('should create N users with unique usernames', async () => {
      const cycleNumber = 5;
      const result = await generateBattleReadyUsers(5, cycleNumber);

      expect(result.usersCreated).toBe(5);
      expect(result.robotsCreated).toBeGreaterThanOrEqual(5); // Some archetypes have 2 robots
      expect(result.usernames).toHaveLength(5);

      // Verify uniqueness
      const uniqueUsernames = new Set(result.usernames);
      expect(uniqueUsernames.size).toBe(5);

      // Verify username format (archetype-based)
      result.usernames.forEach((username) => {
        expect(username).toMatch(/^archetype_\w+_\d+_\d+$/);
      });
    });

    it('should create users with correct starting currency', async () => {
      const cycleNumber = 5;
      await generateBattleReadyUsers(3, cycleNumber);

      const users = await prisma.user.findMany({
        where: { username: { contains: `_${cycleNumber}_` } },
      });

      expect(users.length).toBeGreaterThanOrEqual(3);
      users.forEach((user) => {
        expect(user.currency).toBeGreaterThan(0); // Archetypes have varying currency
        expect(user.role).toBe('user');
      });
    });

    it('should create battle-ready robots with correct stats', async () => {
      const cycleNumber = 5;
      await generateBattleReadyUsers(1, cycleNumber);

      const robot = await prisma.robot.findFirst({
        where: { user: { username: { contains: `_${cycleNumber}_` } } },
        include: {
          mainWeapon: {
            include: { weapon: true },
          },
        },
      });

      expect(robot).not.toBeNull();
      expect(robot!.currentHP).toBeGreaterThan(0);
      expect(robot!.maxHP).toBeGreaterThan(0);
      expect(robot!.currentShield).toBeGreaterThanOrEqual(0);
      expect(robot!.maxShield).toBeGreaterThanOrEqual(0);
      expect(robot!.elo).toBe(1200);
      expect(robot!.currentLeague).toBe('bronze');
      expect(robot!.leagueId).toBe('bronze_1');
      expect(robot!.battleReadiness).toBe(100);
      expect(robot!.yieldThreshold).toBe(10);
      expect(robot!.loadoutType).toBeDefined();
      expect(robot!.stance).toBe('balanced');
    });

    it('should equip robots with weapons', async () => {
      const cycleNumber = 5;
      await generateBattleReadyUsers(2, cycleNumber);

      const robots = await prisma.robot.findMany({
        where: { user: { username: { contains: `_${cycleNumber}_` } } },
        include: {
          mainWeapon: {
            include: { weapon: true },
          },
        },
      });

      expect(robots.length).toBeGreaterThanOrEqual(2);
      robots.forEach((robot) => {
        expect(robot.mainWeaponId).not.toBeNull();
        expect(robot.mainWeapon).not.toBeNull();
        expect(robot.mainWeapon!.weapon.name).toBeDefined();
      });
    });

    it('should set robot attributes based on archetype', async () => {
      const cycleNumber = 5;
      await generateBattleReadyUsers(1, cycleNumber);

      const robot = await prisma.robot.findFirst({
        where: { user: { username: { contains: `_${cycleNumber}_` } } },
      });

      expect(robot).not.toBeNull();

      // Archetypes have varying attributes, just verify they're set
      expect(Number(robot!.combatPower)).toBeGreaterThan(0);
      expect(Number(robot!.targetingSystems)).toBeGreaterThan(0);
      expect(Number(robot!.hullIntegrity)).toBeGreaterThan(0);
      expect(Number(robot!.armorPlating)).toBeGreaterThan(0);
      expect(Number(robot!.shieldCapacity)).toBeGreaterThanOrEqual(0);
    });

    it('should create weapon inventory entries for each user', async () => {
      const cycleNumber = 5;
      await generateBattleReadyUsers(3, cycleNumber);

      const users = await prisma.user.findMany({
        where: { username: { contains: `_${cycleNumber}_` } },
        include: { weaponInventory: true },
      });

      expect(users.length).toBeGreaterThanOrEqual(3);
      users.forEach((user) => {
        expect(user.weaponInventory.length).toBeGreaterThanOrEqual(1);
        expect(user.weaponInventory[0].weaponId).toBeDefined();
      });
    });

    it('should generate unique robot names', async () => {
      const cycleNumber = 5;
      await generateBattleReadyUsers(5, cycleNumber);

      const robots = await prisma.robot.findMany({
        where: { user: { username: { contains: `_${cycleNumber}_` } } },
        select: { name: true },
      });

      expect(robots.length).toBeGreaterThanOrEqual(5);

      // Verify all names are non-empty and unique
      const robotNames = robots.map((r) => r.name);
      robotNames.forEach((name) => {
        expect(name).toBeTruthy();
        expect(name.length).toBeGreaterThan(0);
      });
      
      const uniqueNames = new Set(robotNames);
      expect(uniqueNames.size).toBe(robotNames.length);
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

      const cycleNumber = 5;
      await generateBattleReadyUsers(3, cycleNumber);

      const users = await prisma.user.findMany({
        where: { username: { contains: `_${cycleNumber}_` } },
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
      expect(users.length).toBeGreaterThanOrEqual(3);
      users.forEach((user) => {
        expect(user.robots.length).toBeGreaterThanOrEqual(1);
        expect(user.robots[0].mainWeaponId).not.toBeNull();
        expect(user.robots[0].mainWeapon).not.toBeNull();
        expect(user.weaponInventory.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should handle sequential username numbering correctly', async () => {
      const cycleNumber = 5;
      const result = await generateBattleReadyUsers(3, cycleNumber);

      // Verify usernames have sequential numbering
      expect(result.usernames.length).toBe(3);
      result.usernames.forEach((username, index) => {
        expect(username).toContain(`_${cycleNumber}_${index + 1}`);
      });
    });

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
