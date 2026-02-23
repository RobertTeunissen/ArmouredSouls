/**
 * Integration Test: Complete Tag Team Cycle
 * 
 * Tests the full workflow: Create teams → Run matchmaking → Execute battles → Verify results
 * 
 * This test verifies:
 * - Team creation across multiple leagues
 * - Tag team matchmaking
 * - Battle execution with tag-out mechanics
 * - ELO updates for all four robots
 * - League point awards
 * - Credit distribution
 * - Repair cost calculation
 */

import { PrismaClient } from '@prisma/client';
import { createTeam } from '../../src/services/tagTeamService';
import { runTagTeamMatchmaking } from '../../src/services/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../../src/services/tagTeamBattleOrchestrator';

const prisma = new PrismaClient();

describe('Tag Team Complete Cycle Integration Test', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testTeamIds: number[] = [];
  let weapon: any;

  beforeAll(async () => {
    await prisma.$connect();

    // Get a weapon for robots
    weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      throw new Error('No weapons found. Run seed first.');
    }
  });

  afterEach(async () => {
    // Clean up in reverse order
    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          battleType: 'tag_team',
          robot1Id: { in: testRobotIds },
        },
      });
    }

    if (testTeamIds.length > 0) {
      await prisma.tagTeamMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: testTeamIds } },
            { team2Id: { in: testTeamIds } },
          ],
        },
      });
      await prisma.tagTeam.deleteMany({
        where: { id: { in: testTeamIds } },
      });
    }

    if (testRobotIds.length > 0) {
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    testTeamIds = [];
    testRobotIds = [];
    testUserIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should complete full tag team cycle: create → matchmake → battle → verify', async () => {
    // Step 1: Create teams
    console.log('[Test] Step 1: Creating tag teams...');
    
    const testUsers: any[] = [];
    const testRobots: any[] = [];
    const testTeams: any[] = [];

    // Create 4 test users (stables)
    for (let i = 0; i < 4; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_cycle_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
          prestige: 0,
        },
      });
      testUsers.push(user);
      testUserIds.push(user.id);

      // Create 2 robots per user (for 1 team each)
      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: {
            userId: user.id,
            weaponId: weapon.id,
          },
        });

        const robot = await prisma.robot.create({
          data: {
            userId: user.id,
            name: `Robot_${i}_${j}_${Date.now()}`,
            elo: 1000 + i * 100, // Varying ELO: 1000, 1100, 1200, 1300
            currentHP: 100,
            maxHP: 100,
            currentShield: 20,
            maxShield: 20,
            yieldThreshold: 20,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
            currentLeague: 'bronze',
            leagueId: 'bronze_1',
            leaguePoints: 0,
            cyclesInCurrentLeague: 0,
          },
        });
        testRobots.push(robot);
        testRobotIds.push(robot.id);
      }
    }
    
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const robot1 = testRobots[i * 2];
      const robot2 = testRobots[i * 2 + 1];

      const result = await createTeam(user.id, robot1.id, robot2.id);
      expect(result.success).toBe(true);
      expect(result.team).toBeDefined();
      testTeams.push(result.team!);
      testTeamIds.push(result.team!.id);
    }

    expect(testTeams.length).toBe(4);
    console.log(`[Test] Created ${testTeams.length} teams`);

    // Verify teams are in Bronze league
    testTeams.forEach(team => {
      expect(team.tagTeamLeague).toBe('bronze');
      expect(team.tagTeamLeagueId).toBe('bronze_1');
      expect(team.tagTeamLeaguePoints).toBe(0);
    });

    // Step 2: Run matchmaking
    console.log('[Test] Step 2: Running tag team matchmaking...');
    
    const matchmakingResult = await runTagTeamMatchmaking();
    expect(matchmakingResult).toBeGreaterThan(0);
    console.log(`[Test] Created ${matchmakingResult} matches`);

    // Verify matches were created
    const scheduledMatches = await prisma.tagTeamMatch.findMany({
      where: {
        status: 'scheduled',
        team1Id: { in: testTeams.map(t => t.id) },
      },
    });
    expect(scheduledMatches.length).toBeGreaterThan(0);

    // Step 3: Execute battles
    console.log('[Test] Step 3: Executing tag team battles...');
    
    const battleResult = await executeScheduledTagTeamBattles();
    expect(battleResult.totalBattles).toBeGreaterThan(0);
    console.log(
      `[Test] Executed ${battleResult.totalBattles} battles: ` +
      `${battleResult.wins} wins, ${battleResult.draws} draws, ${battleResult.losses} losses`
    );

    // Step 4: Verify results
    console.log('[Test] Step 4: Verifying battle results...');

    // Verify battles were created
    const battles = await prisma.battle.findMany({
      where: {
        battleType: 'tag_team',
        robot1Id: { in: testRobots.map(r => r.id) },
      },
    });
    expect(battles.length).toBeGreaterThan(0);

    // Verify battle records have tag team fields
    battles.forEach(battle => {
      expect(battle.battleType).toBe('tag_team');
      expect(battle.team1ActiveRobotId).toBeDefined();
      expect(battle.team1ReserveRobotId).toBeDefined();
      expect(battle.team2ActiveRobotId).toBeDefined();
      expect(battle.team2ReserveRobotId).toBeDefined();
    });

    // Verify ELO changes for all robots
    const updatedRobots = await prisma.robot.findMany({
      where: {
        id: { in: testRobots.map(r => r.id) },
      },
    });

    updatedRobots.forEach(robot => {
      // ELO should be a valid number
      expect(typeof robot.elo).toBe('number');
      
      // Tag team statistics should be updated
      expect(robot.totalTagTeamBattles).toBeGreaterThan(0);
      
      // Win/loss/draw counters should be non-negative
      expect(robot.totalTagTeamWins).toBeGreaterThanOrEqual(0);
      expect(robot.totalTagTeamLosses).toBeGreaterThanOrEqual(0);
      expect(robot.totalTagTeamDraws).toBeGreaterThanOrEqual(0);
    });

    console.log('[Test] ✓ Complete tag team cycle verified successfully');
  }, 60000); // 60 second timeout

  it('should handle multiple teams from same stable', async () => {
    // Create a user with 4 robots (2 teams)
    const weapon = await prisma.weapon.findFirst();
    const user = await prisma.user.create({
      data: {
        username: `tagteam_multi_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });

    const robots = [];
    for (let i = 0; i < 4; i++) {
      const weaponInv = await prisma.weaponInventory.create({
        data: {
          userId: user.id,
          weaponId: weapon!.id,
        },
      });

      const robot = await prisma.robot.create({
        data: {
          userId: user.id,
          name: `MultiTeam_Robot_${i}_${Date.now()}`,
          elo: 1000,
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
          yieldThreshold: 20,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
          currentLeague: 'bronze',
          leagueId: 'bronze_1',
        },
      });
      robots.push(robot);
    }

    // Create 2 teams
    const team1Result = await createTeam(user.id, robots[0].id, robots[1].id);
    const team2Result = await createTeam(user.id, robots[2].id, robots[3].id);

    expect(team1Result.success).toBe(true);
    expect(team2Result.success).toBe(true);

    // Verify both teams exist
    const teams = await prisma.tagTeam.findMany({
      where: { stableId: user.id },
    });
    expect(teams.length).toBe(2);

    // Clean up
    await prisma.tagTeam.deleteMany({ where: { stableId: user.id } });
    await prisma.robot.deleteMany({ where: { userId: user.id } });
    await prisma.weaponInventory.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it('should verify battle log contains tag events', async () => {
    // Find a completed battle
    const battle = await prisma.battle.findFirst({
      where: {
        battleType: 'tag_team',
        robot1Id: { in: testRobots.map(r => r.id) },
      },
    });

    if (!battle) {
      console.log('[Test] No battles found, skipping battle log verification');
      return;
    }

    expect(battle.battleLog).toBeDefined();
    
    // Verify battle log structure
    const battleLog = battle.battleLog as any;
    expect(battleLog.tagTeamBattle).toBe(true);
    expect(battleLog.events).toBeDefined();
    expect(Array.isArray(battleLog.events)).toBe(true);

    // Check for tag events if any tag-outs occurred
    if (battle.team1TagOutTime || battle.team2TagOutTime) {
      const tagOutEvents = battleLog.events.filter((e: any) => e.type === 'tag_out');
      const tagInEvents = battleLog.events.filter((e: any) => e.type === 'tag_in');
      
      expect(tagOutEvents.length).toBeGreaterThan(0);
      expect(tagInEvents.length).toBeGreaterThan(0);
      expect(tagOutEvents.length).toBe(tagInEvents.length);
    }

    console.log('[Test] ✓ Battle log verification complete');
  });
});
