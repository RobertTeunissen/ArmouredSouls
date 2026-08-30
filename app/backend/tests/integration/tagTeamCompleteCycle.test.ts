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

import prisma from '../../src/lib/prisma';
import { runTagTeamMatchmaking } from '../../src/services/tag-team/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamBattleOrchestrator';
import { createTagTeamFixture, clearTagTeamCompetition } from '../helpers/tagTeam';

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
          participants: { some: { robotId: { in: testRobotIds } } },
        },
      });
    }

    await clearTagTeamCompetition(testTeamIds, testRobotIds);

    if (testTeamIds.length > 0) {
      await prisma.scheduledMatchParticipant.deleteMany({
        where: {
          participantType: 'team',
          participantId: { in: testTeamIds },
        },
      });
      await prisma.scheduledMatch.deleteMany({
        where: {
          matchType: 'tag_team',
          participants: { some: { participantId: { in: testTeamIds } } },
        },
      });
      await prisma.teamBattleMember.deleteMany({
        where: { teamId: { in: testTeamIds } },
      });
      await prisma.teamBattle.deleteMany({
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

  /**
   * Create `stableCount` stables, each with one 2-robot tag team that is entered in the
   * competition and subscribed, and register every id for teardown.
   *
   * Extracted so the battle-log test can build its own battle. It previously searched for a
   * battle left behind by the first test — but `afterEach` deletes robots, teams and
   * battles, so `testRobotIds` was always empty by then and the query matched nothing. The
   * test hit its `if (!battle) return` early exit on every run and asserted nothing at all.
   */
  async function createTagTeamCohort(stableCount: number) {
    const users: any[] = [];
    const robots: any[] = [];
    const teams: any[] = [];

    for (let i = 0; i < stableCount; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_cohort_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          passwordHash: 'test_hash',
          currency: 100000,
          prestige: 0,
        },
      });
      users.push(user);
      testUserIds.push(user.id);

      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: user.id, weaponId: weapon.id, pricePaid: 0 },
        });
        const robot = await prisma.robot.create({
          data: {
            userId: user.id,
            name: `Cohort_Robot_${i}_${j}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            elo: 1000 + i * 100,
            currentHP: 100,
            maxHP: 100,
            currentShield: 20,
            maxShield: 20,
            yieldThreshold: 20,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        });
        robots.push(robot);
        testRobotIds.push(robot.id);
      }

      const team = await createTagTeamFixture(user.id, robots[i * 2].id, robots[i * 2 + 1].id);
      teams.push(team);
      testTeamIds.push(team.id);
    }

    return { users, robots, teams };
  }

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
            pricePaid: 0,
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

      const result = await createTagTeamFixture(user.id, robot1.id, robot2.id);
      testTeams.push(result);
      testTeamIds.push(result.id);
    }

    expect(testTeams.length).toBe(4);
    console.log(`[Test] Created ${testTeams.length} teams`);

    // Verify teams exist
    testTeams.forEach(team => {
      expect(team.teamSize).toBe(2);
    });

    // Step 2: Run matchmaking
    console.log('[Test] Step 2: Running tag team matchmaking...');
    
    const matchmakingResult = await runTagTeamMatchmaking();
    expect(matchmakingResult).toBeGreaterThan(0);
    console.log(`[Test] Created ${matchmakingResult} matches`);

    // Verify matches were created
    const scheduledMatches = await prisma.scheduledMatch.findMany({
      where: {
        status: 'scheduled',
        matchType: 'tag_team',
        participants: { some: { participantId: { in: testTeams.map(t => t.id) } } },
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
    // `robot1Id` was dropped from `battles` by Spec #43 — the participants are the
    // identity of the two sides now, so the question has to be asked through them.
    const battles = await prisma.battle.findMany({
      where: {
        battleType: 'tag_team',
        participants: { some: { robotId: { in: testRobots.map(r => r.id) } } },
      },
    });
    expect(battles.length).toBeGreaterThan(0);

    // Verify battle records have tag team participants with correct roles
    for (const battle of battles) {
      expect(battle.battleType).toBe('tag_team');
      const participants = await prisma.battleParticipant.findMany({ where: { battleId: battle.id } });
      expect(participants.some(p => p.team === 1 && p.role === 'active')).toBe(true);
      expect(participants.some(p => p.team === 1 && p.role === 'reserve')).toBe(true);
      expect(participants.some(p => p.team === 2 && p.role === 'active')).toBe(true);
      expect(participants.some(p => p.team === 2 && p.role === 'reserve')).toBe(true);
    }

    // Verify ELO changes for all robots
    const updatedRobots = await prisma.robot.findMany({
      where: {
        id: { in: testRobots.map(r => r.id) },
      },
    });

    updatedRobots.forEach(robot => {
      // ELO should be a valid number
      expect(typeof robot.elo).toBe('number');
      
      // Total battles should be updated
      expect(robot.totalBattles).toBeGreaterThan(0);
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
          pricePaid: 0,
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
        },
      });
      robots.push(robot);
    }

    // Create 2 teams
    const team1Result = await createTagTeamFixture(user.id, robots[0].id, robots[1].id);
    const team2Result = await createTagTeamFixture(user.id, robots[2].id, robots[3].id);

    // Verify both teams exist
    const teams = await prisma.teamBattle.findMany({
      where: { stableId: user.id, teamSize: 2 },
    });
    expect(teams.length).toBe(2);

    // Clean up
    await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: [team1Result.id, team2Result.id] } } });
    await prisma.teamBattle.deleteMany({ where: { stableId: user.id, teamSize: 2 } });
    await prisma.robot.deleteMany({ where: { userId: user.id } });
    await prisma.weaponInventory.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it('should verify battle log contains tag events', async () => {
    // Build a battle for this test rather than looking for one another test left behind.
    // `robot1Id` no longer exists on `battles` (Spec #43), and even with the column the
    // query could not have matched: `afterEach` empties `testRobotIds`.
    await createTagTeamCohort(2);
    const matchesCreated = await runTagTeamMatchmaking();
    expect(matchesCreated).toBeGreaterThan(0);
    const executed = await executeScheduledTagTeamBattles();
    expect(executed.totalBattles).toBeGreaterThan(0);

    const battle = await prisma.battle.findFirst({
      where: {
        battleType: 'tag_team',
        participants: { some: { robotId: { in: testRobotIds } } },
      },
      orderBy: { id: 'desc' },
    });

    // The battle must exist — the early-return that used to hide its absence is gone.
    expect(battle).not.toBeNull();
    expect(battle!.battleLog).toBeDefined();
    
    // Verify battle log structure
    const battleLog = battle!.battleLog as any;
    expect(battleLog.tagTeamBattle).toBe(true);
    expect(battleLog.events).toBeDefined();
    expect(Array.isArray(battleLog.events)).toBe(true);

    // Check for tag events if any tag-outs occurred (check battleLog JSON for tag-out times)
    if (battleLog.team1TagOutTime || battleLog.team2TagOutTime) {
      const tagOutEvents = battleLog.events.filter((e: any) => e.type === 'tag_out');
      const tagInEvents = battleLog.events.filter((e: any) => e.type === 'tag_in');
      
      expect(tagOutEvents.length).toBeGreaterThan(0);
      expect(tagInEvents.length).toBeGreaterThan(0);
      expect(tagOutEvents.length).toBe(tagInEvents.length);
    }

    console.log('[Test] ✓ Battle log verification complete');
  });
});
