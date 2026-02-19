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
    // Clean up in correct order to respect foreign key constraints
    await prisma.scheduledMatch.deleteMany({});
    await prisma.tagTeamMatch.deleteMany({}); // Delete tag team matches before tag teams
    await prisma.battle.deleteMany({});
    await prisma.tagTeam.deleteMany({}); // Delete tag teams before robots
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

    it('should increment kills when a robot destroys its opponent', async () => {
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
          name: 'Killer Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          kills: 5, // Start with 5 kills
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Victim Robot',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          kills: 3, // Start with 3 kills
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

      // Get updated robots
      const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
      const updatedRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });

      // Get battle details to check who was destroyed
      const battle = await prisma.battle.findUnique({ where: { id: result.battleId } });
      
      // Verify that the winner's kills incremented if opponent was destroyed
      if (result.winnerId === robot1.id && battle?.robot2Destroyed) {
        expect(updatedRobot1?.kills).toBe(6); // Should increment from 5 to 6
        expect(updatedRobot2?.kills).toBe(3); // Should stay at 3
      } else if (result.winnerId === robot2.id && battle?.robot1Destroyed) {
        expect(updatedRobot2?.kills).toBe(4); // Should increment from 3 to 4
        expect(updatedRobot1?.kills).toBe(5); // Should stay at 5
      } else {
        // No robot was destroyed (unlikely but possible in draws)
        // Both should maintain their original kill counts
        expect(updatedRobot1?.kills).toBe(5);
        expect(updatedRobot2?.kills).toBe(3);
      }

      // Verify one of the robots was marked as destroyed (in most cases)
      expect(battle?.robot1Destroyed || battle?.robot2Destroyed).toBeTruthy();

      // Clean up
      await prisma.battle.delete({ where: { id: result.battleId } });
      await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
      await prisma.robot.delete({ where: { id: robot1.id } });
      await prisma.robot.delete({ where: { id: robot2.id } });
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
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

  describe('Streaming Revenue Integration', () => {
    it('should calculate and award streaming revenue after battle', async () => {
      // Create test robots with some fame and battles
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Streaming Test Robot 1',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          totalBattles: 100, // 100 battles
          fame: 500, // 500 fame
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Streaming Test Robot 2',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          totalBattles: 50, // 50 battles
          fame: 250, // 250 fame
        },
      });

      // Get initial user balance
      const userBefore = await prisma.user.findUnique({ where: { id: testUser.id } });
      const initialBalance = userBefore!.currency;

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

      // Verify user balance increased (battle winnings + streaming revenue)
      const userAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(userAfter!.currency).toBeGreaterThan(initialBalance);

      // Calculate expected streaming revenue for both robots
      // Robot 1: 1000 × (1 + 101/1000) × (1 + 500/5000) × 1.0 = 1000 × 1.101 × 1.1 × 1.0 = 1211.1 = 1211
      // Robot 2: 1000 × (1 + 51/1000) × (1 + 250/5000) × 1.0 = 1000 × 1.051 × 1.05 × 1.0 = 1103.55 = 1103
      // Total streaming revenue: 1211 + 1103 = 2314

      // The balance increase should include both battle winnings and streaming revenue
      const balanceIncrease = userAfter!.currency - initialBalance;
      expect(balanceIncrease).toBeGreaterThan(2000); // Should be at least streaming revenue

      // Clean up
      await prisma.battle.delete({ where: { id: result.battleId } });
      await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
      await prisma.robot.delete({ where: { id: robot1.id } });
      await prisma.robot.delete({ where: { id: robot2.id } });
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should not award streaming revenue for bye matches', async () => {
      // Create player robot
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const playerRobot = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Bye Test Player',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          totalBattles: 100,
          fame: 500,
        },
      });

      // Create bye-robot
      const byeUser = await prisma.user.create({
        data: {
          username: 'bye_streaming_test',
          passwordHash: 'hash',
          currency: 10000,
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

      // Get initial balances
      const playerUserBefore = await prisma.user.findUnique({ where: { id: testUser.id } });
      const byeUserBefore = await prisma.user.findUnique({ where: { id: byeUser.id } });

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

      // Verify it was a bye match
      expect(result.isByeMatch).toBe(true);

      // Get final balances
      const playerUserAfter = await prisma.user.findUnique({ where: { id: testUser.id } });
      const byeUserAfter = await prisma.user.findUnique({ where: { id: byeUser.id } });

      // Calculate balance changes
      const playerBalanceChange = playerUserAfter!.currency - playerUserBefore!.currency;
      const byeBalanceChange = byeUserAfter!.currency - byeUserBefore!.currency;

      // Player should only get battle winnings (no streaming revenue)
      // Expected streaming revenue would be: 1000 × (1 + 101/1000) × (1 + 500/5000) × 1.0 = 1211
      // But since it's a bye match, no streaming revenue should be awarded
      // The balance change should be less than if streaming revenue was included
      expect(playerBalanceChange).toBeGreaterThan(0); // Should get battle winnings
      expect(playerBalanceChange).toBeLessThan(2000); // Should not include streaming revenue

      // Bye robot should get participation reward only (no streaming revenue)
      expect(byeBalanceChange).toBeGreaterThanOrEqual(0);

      // Clean up
      await prisma.battle.deleteMany({});
      await prisma.scheduledMatch.deleteMany({});
      await prisma.robot.delete({ where: { id: playerRobot.id } });
      await prisma.robot.delete({ where: { id: byeRobot.id } });
      await prisma.weaponInventory.deleteMany({});
      await prisma.user.delete({ where: { id: byeUser.id } });
    });

    it('should add streaming revenue to audit log', async () => {
      // Create test robots
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Audit Log Test 1',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          totalBattles: 100,
          fame: 500,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Audit Log Test 2',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          totalBattles: 50,
          fame: 250,
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

      // Find the battle_complete event in audit log
      const auditEvent = await prisma.auditLog.findFirst({
        where: {
          eventType: 'battle_complete',
          payload: {
            path: ['battleId'],
            equals: result.battleId,
          },
        },
      });

      expect(auditEvent).toBeDefined();

      // Verify streaming revenue is in the event payload
      const payload = auditEvent!.payload as any;
      expect(payload.streamingRevenue1).toBeDefined();
      expect(payload.streamingRevenue2).toBeDefined();
      expect(payload.streamingRevenue1).toBeGreaterThan(0);
      expect(payload.streamingRevenue2).toBeGreaterThan(0);

      // Clean up
      await prisma.auditLog.deleteMany({ where: { id: auditEvent!.id } });
      await prisma.battle.delete({ where: { id: result.battleId } });
      await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
      await prisma.robot.delete({ where: { id: robot1.id } });
      await prisma.robot.delete({ where: { id: robot2.id } });
      await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
    });

    it('should log streaming revenue to terminal', async () => {
      // Create test robots
      const weaponInv1 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });
      const weaponInv2 = await prisma.weaponInventory.create({
        data: { userId: testUser.id, weaponId: practiceSword.id },
      });

      const robot1 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Terminal Log Test 1',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv1.id,
          totalBattles: 100,
          fame: 500,
        },
      });

      const robot2 = await prisma.robot.create({
        data: {
          userId: testUser.id,
          name: 'Terminal Log Test 2',
          leagueId: 'bronze_1',
          currentLeague: 'bronze',
          currentHP: 10,
          maxHP: 10,
          currentShield: 2,
          maxShield: 2,
          elo: 1200,
          loadoutType: 'single',
          mainWeaponId: weaponInv2.id,
          totalBattles: 50,
          fame: 250,
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

      // Capture console.log output
      const originalLog = console.log;
      const logMessages: string[] = [];
      console.log = (...args: any[]) => {
        logMessages.push(args.join(' '));
        originalLog(...args);
      };

      try {
        // Execute battle
        const result = await processBattle(scheduledMatch);

        // Verify terminal log contains streaming revenue messages
        const streamingLogs = logMessages.filter(msg => msg.includes('[Streaming]'));
        expect(streamingLogs.length).toBeGreaterThanOrEqual(2); // One for each robot

        // Verify log format: "[Streaming] RobotName earned ₡X,XXX from Battle #123"
        const robot1Log = streamingLogs.find(msg => msg.includes(robot1.name));
        const robot2Log = streamingLogs.find(msg => msg.includes(robot2.name));

        expect(robot1Log).toBeDefined();
        expect(robot2Log).toBeDefined();
        expect(robot1Log).toMatch(/\[Streaming\].*earned ₡[\d,]+.*from Battle #\d+/);
        expect(robot2Log).toMatch(/\[Streaming\].*earned ₡[\d,]+.*from Battle #\d+/);

        // Clean up
        await prisma.battle.delete({ where: { id: result.battleId } });
        await prisma.scheduledMatch.delete({ where: { id: scheduledMatch.id } });
        await prisma.robot.delete({ where: { id: robot1.id } });
        await prisma.robot.delete({ where: { id: robot2.id } });
        await prisma.weaponInventory.deleteMany({ where: { userId: testUser.id } });
      } finally {
        // Restore console.log
        console.log = originalLog;
      }
    });
  });
});
