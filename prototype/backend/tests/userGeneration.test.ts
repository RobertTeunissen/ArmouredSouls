/**
 * User Generation Unit Tests
 * Tests for generateBattleReadyUsers() utility function
 * 
 * Note: generateBattleReadyUsers(cycleNumber) creates cycleNumber users.
 * Cycle N creates N users with archetype-based configurations.
 */

import prisma from '../src/lib/prisma';
import { generateBattleReadyUsers } from '../src/utils/userGeneration';


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

  async function cleanupArchetypeUsers() {
    const archetypeUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'archetype_' } },
      select: { id: true },
    });
    const userIds = archetypeUsers.map(u => u.id);
    if (userIds.length > 0) {
      const robots = await prisma.robot.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const robotIds = robots.map(r => r.id);
      if (robotIds.length > 0) {
        await prisma.tagTeam.deleteMany({
          where: { OR: [{ activeRobotId: { in: robotIds } }, { reserveRobotId: { in: robotIds } }] },
        });
        await prisma.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
        await prisma.battle.deleteMany({
          where: { OR: [{ robot1Id: { in: robotIds } }, { robot2Id: { in: robotIds } }] },
        });
        await prisma.scheduledMatch.deleteMany({
          where: { OR: [{ robot1Id: { in: robotIds } }, { robot2Id: { in: robotIds } }] },
        });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  }

  beforeEach(async () => { await cleanupArchetypeUsers(); });
  afterEach(async () => { await cleanupArchetypeUsers(); });

  describe('generateBattleReadyUsers', () => {
    // generateBattleReadyUsers(cycleNumber) creates cycleNumber users
    it('should create N users with unique usernames', async () => {
      const result = await generateBattleReadyUsers(5);
      expect(result.usersCreated).toBe(5);
      expect(result.robotsCreated).toBeGreaterThanOrEqual(5);
      expect(result.usernames).toHaveLength(5);
      const uniqueUsernames = new Set(result.usernames);
      expect(uniqueUsernames.size).toBe(5);
    });

    it('should create users with correct starting currency', async () => {
      await generateBattleReadyUsers(3);
      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'archetype_' } },
      });
      expect(users.length).toBeGreaterThanOrEqual(3);
      users.forEach((user) => {
        expect(user.currency).toBeGreaterThan(0);
        expect(user.role).toBe('user');
      });
    });

    it('should create battle-ready robots with correct stats', async () => {
      await generateBattleReadyUsers(1);
      const robot = await prisma.robot.findFirst({
        where: { user: { username: { startsWith: 'archetype_' } } },
        include: { mainWeapon: { include: { weapon: true } } },
      });
      expect(robot).not.toBeNull();
      expect(robot!.currentHP).toBeGreaterThan(0);
      expect(robot!.maxHP).toBeGreaterThan(0);
      expect(robot!.elo).toBe(1200);
      expect(robot!.currentLeague).toBe('bronze');
      expect(robot!.battleReadiness).toBe(100);
    });

    it('should equip robots with weapons', async () => {
      await generateBattleReadyUsers(2);
      const robots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'archetype_' } } },
        include: { mainWeapon: { include: { weapon: true } } },
      });
      expect(robots.length).toBeGreaterThanOrEqual(2);
      robots.forEach((robot) => {
        expect(robot.mainWeaponId).not.toBeNull();
        expect(robot.mainWeapon).not.toBeNull();
      });
    });

    it('should create weapon inventory entries for each user', async () => {
      await generateBattleReadyUsers(3);
      const users = await prisma.user.findMany({
        where: { username: { startsWith: 'archetype_' } },
        include: { weaponInventory: true },
      });
      expect(users.length).toBeGreaterThanOrEqual(3);
      users.forEach((user) => {
        expect(user.weaponInventory.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should generate unique robot names', async () => {
      await generateBattleReadyUsers(5);
      const robots = await prisma.robot.findMany({
        where: { user: { username: { startsWith: 'archetype_' } } },
        select: { name: true },
      });
      expect(robots.length).toBeGreaterThanOrEqual(5);
      const robotNames = robots.map((r) => r.name);
      robotNames.forEach((name) => {
        expect(name).toBeTruthy();
        expect(name.length).toBeGreaterThan(0);
      });
      const uniqueNames = new Set(robotNames);
      expect(uniqueNames.size).toBe(robotNames.length);
    });

    it('should return correct summary object', async () => {
      const result = await generateBattleReadyUsers(7);
      expect(result).toHaveProperty('usersCreated');
      expect(result).toHaveProperty('robotsCreated');
      expect(result).toHaveProperty('usernames');
      expect(result.usersCreated).toBe(7);
      expect(result.robotsCreated).toBeGreaterThanOrEqual(7);
      expect(Array.isArray(result.usernames)).toBe(true);
      expect(result.usernames.length).toBe(7);
    });
  });
});
