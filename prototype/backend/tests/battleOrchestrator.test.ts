import { PrismaClient } from '@prisma/client';
import {
  calculateELOChange,
  processBattle,
  executeScheduledBattles,
} from '../src/services/battleOrchestrator';

const prisma = new PrismaClient();

describe('Battle Orchestrator', () => {
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
        username: 'battle_test_user',
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

  describe('calculateELOChange', () => {
    it('should calculate ELO changes for equal-rated players', () => {
      const { winnerChange, loserChange } = calculateELOChange(1200, 1200);
      
      expect(winnerChange).toBe(16); // K * (1 - 0.5) = 32 * 0.5 = 16
      expect(loserChange).toBe(-16); // K * (0 - 0.5) = 32 * -0.5 = -16
    });

    it('should give smaller ELO gain when favorite wins', () => {
      const { winnerChange } = calculateELOChange(1400, 1200);
      
      expect(winnerChange).toBeLessThan(16); // Less than equal match
    });

    it('should give larger ELO gain when underdog wins', () => {
      const { winnerChange } = calculateELOChange(1200, 1400);
      
      expect(winnerChange).toBeGreaterThan(16); // More than equal match
    });

    it('should calculate ELO changes for draw', () => {
      const { winnerChange, loserChange } = calculateELOChange(1200, 1200, true);
      
      expect(winnerChange).toBe(0); // Both at 0.5 expected, 0.5 actual
      expect(loserChange).toBe(0);
    });
  });

  describe('processBattle', () => {
    it('should execute a battle and create records', async () => {
      // Create two test robots
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Fighter 1',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Test Fighter 2',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
        },
      });

      // Create scheduled match
      const scheduledMatch = await prisma.scheduledMatch.create({
        data: {
          robot1Id: robot1.id,
          robot2Id: robot2.id,
          leagueType: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
        },
      });

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Verify battle was created
      expect(result.battleId).toBeGreaterThan(0);
      expect(result.winnerId).toBeDefined();

      // Verify battle record exists
      const battle = await prisma.battle.findUnique({
        where: { id: result.battleId },
      });
      expect(battle).toBeDefined();
      expect(battle?.robot1Id).toBe(robot1.id);
      expect(battle?.robot2Id).toBe(robot2.id);

      // Verify scheduled match was marked completed
      const updatedMatch = await prisma.scheduledMatch.findUnique({
        where: { id: scheduledMatch.id },
      });
      expect(updatedMatch?.status).toBe('completed');
      expect(updatedMatch?.battleId).toBe(result.battleId);

      // Verify robot stats were updated
      const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
      const updatedRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });
      
      expect(updatedRobot1?.totalBattles).toBe(1);
      expect(updatedRobot2?.totalBattles).toBe(1);
      
      // One should have won
      expect(updatedRobot1!.wins + updatedRobot2!.wins).toBe(1);
      expect(updatedRobot1!.losses + updatedRobot2!.losses).toBe(1);

      // Clean up
      await prisma.battle.delete({ where: { id: result.battleId } });
      await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
      await prisma.robot.delete({ where: { id: robot1.id } });
      await prisma.robot.delete({ where: { id: robot2.id } });
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should handle bye-robot battles correctly', async () => {
      // Create player robot
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const playerRobot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Player Robot',
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

      // Create bye-robot
      const byeUser = await prisma.user.create({
        data: {
          username: 'bye_test',
          passwordHash: 'hash',
        },
      });

      const byeWeaponInv = await prisma.weaponInventory.create({
        data: { userId: byeUser.id, weaponId: practiceSword.id },
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

      // Create scheduled bye-match
      const scheduledMatch = await prisma.scheduledMatch.create({
        data: {
          robot1Id: playerRobot.id,
          robot2Id: byeRobot.id,
          leagueType: 'bronze',
          scheduledFor: new Date(),
          status: 'scheduled',
        },
      });

      // Execute battle
      const result = await processBattle(scheduledMatch);

      // Verify player won
      expect(result.winnerId).toBe(playerRobot.id);
      expect(result.isByeMatch).toBe(true);

      // Verify player took minimal damage
      const updatedPlayer = await prisma.robot.findUnique({
        where: { id: playerRobot.id },
      });
      const damageTaken = playerRobot.currentHP - updatedPlayer!.currentHP;
      expect(damageTaken).toBeLessThan(playerRobot.maxHP * 0.15); // Less than 15% damage

      // Verify player won the battle
      expect(updatedPlayer?.wins).toBe(1);
      expect(updatedPlayer?.losses).toBe(0);

      // Clean up
      await prisma.battle.deleteMany({});
      await prisma.scheduledMatch.deleteMany({});
      await prisma.robot.delete({ where: { id: playerRobot.id } });
      await prisma.robot.delete({ where: { id: byeRobot.id } });
      await prisma.weaponInventory.deleteMany({});
      await prisma.user.delete({ where: { id: byeUser.id } });
    });
  });

  describe('executeScheduledBattles', () => {
    it('should execute multiple scheduled battles', async () => {
      // Create robots and scheduled matches
      const robots = [];
      for (let i = 0; i < 4; i++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: testUser.id, weaponId: practiceSword.id },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: testUser.id,
            name: `Batch Robot ${i}`,
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

      // Create 2 scheduled matches
      const scheduledTime = new Date();
      await prisma.scheduledMatch.createMany({
        data: [
          {
            robot1Id: robots[0].id,
            robot2Id: robots[1].id,
            leagueType: 'bronze',
            scheduledFor: scheduledTime,
            status: 'scheduled',
          },
          {
            robot1Id: robots[2].id,
            robot2Id: robots[3].id,
            leagueType: 'bronze',
            scheduledFor: scheduledTime,
            status: 'scheduled',
          },
        ],
      });

      // Execute all battles
      const summary = await executeScheduledBattles(scheduledTime);

      expect(summary.totalBattles).toBe(2);
      expect(summary.successfulBattles).toBe(2);
      expect(summary.failedBattles).toBe(0);

      // Verify all battles were created
      const battles = await prisma.battle.findMany({});
      expect(battles.length).toBe(2);

      // Verify all matches marked as completed
      const completedMatches = await prisma.scheduledMatch.findMany({
        where: { status: 'completed' },
      });
      expect(completedMatches.length).toBe(2);

      // Clean up
      await prisma.battle.deleteMany({});
      await prisma.scheduledMatch.deleteMany({});
      for (const robot of robots) {
        await prisma.robot.delete({ where: { id: robot.id } });
      }
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });
  });
});
