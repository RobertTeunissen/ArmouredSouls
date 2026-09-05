/**
 * Integration Test: Bye-Team Handling
 * 
 * Tests bye-team match creation and execution with odd number of teams
 * 
 * This test verifies:
 * - A bye match is created when an odd number of teams is eligible
 * - The bye match carries only the real team as a participant, flagged `isByeMatch`
 * - The bye resolves without simulating anything
 * - The bye pays the participation floor and nothing else
 *
 * Spec #49 changed what a bye pays, and the old header here claimed the opposite:
 * "Full rewards awarded for bye-team wins" and "Normal penalties applied for bye-team
 * losses". A bye now pays `getParticipationReward(tier) x teamSize` in credits and **zero**
 * prestige, fame and streaming revenue, and it cannot lose or draw because nothing is
 * simulated. Both of those lines described behaviour that had been deliberately removed.
 */

import prisma from '../../src/lib/prisma';
import { createTagTeamFixture, clearTagTeamCompetition } from '../helpers/tagTeam';
import { runTagTeamMatchmaking } from '../../src/services/tag-team/tagTeamMatchmakingService';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamBattleOrchestrator';
import { usePostCutoverFinancialRollout } from '../financialRolloutTestHelper';

usePostCutoverFinancialRollout();

describe('Tag Team Bye-Team Handling Integration Test', () => {
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
    await clearTagTeamCompetition(testTeamIds, testRobotIds);
    // Clean up in correct order
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
    }

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

    if (testTeamIds.length > 0) {
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
   * Create `stableCount` stables, each with one eligible tag team, and register the ids for
   * teardown. An odd count leaves one team unpaired, which is what produces a bye.
   *
   * Extracted because the two tests below used to operate on whatever the FIRST test had
   * left in the database. `afterEach` deletes all of it, so by the time they ran there were
   * no teams, no matches and no bye battles: the reward test executed zero battles and the
   * ELO test hit its `if (byeBattles.length === 0) return` early exit. Neither asserted
   * anything about a bye.
   */
  async function createEligibleTeams(stableCount: number) {
    const teams: any[] = [];
    for (let i = 0; i < stableCount; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_bye_user_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          passwordHash: 'test_hash',
          currency: 100000,
          prestige: 0,
        },
      });
      testUserIds.push(user.id);

      const pair: number[] = [];
      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: user.id, weaponId: weapon.id, pricePaid: 0 },
        });
        const robot = await prisma.robot.create({
          data: {
            userId: user.id,
            name: `Bye_Robot_${i}_${j}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
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
        testRobotIds.push(robot.id);
        pair.push(robot.id);
      }

      const team = await createTagTeamFixture(user.id, pair[0], pair[1]);
      teams.push(team);
      testTeamIds.push(team.id);
    }
    return teams;
  }

  it('should create bye-team match when odd number of teams eligible', async () => {
    // Step 1: Create 3 teams (odd number)
    console.log('[Test] Step 1: Creating 3 teams (odd number)...');
    
    const testUsers: any[] = [];
    const testRobots: any[] = [];
    const testTeams: any[] = [];

    // Create 3 test users (odd number for bye-team scenario)
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_bye_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
          prestige: 0,
        },
      });
      testUsers.push(user);
      testUserIds.push(user.id);

      // Create 2 robots per user
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
            name: `Bye_Robot_${i}_${j}_${Date.now()}`,
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
        testRobots.push(robot);
        testRobotIds.push(robot.id);
      }
    }
    
    for (let i = 0; i < 3; i++) {
      const user = testUsers[i];
      const robot1 = testRobots[i * 2];
      const robot2 = testRobots[i * 2 + 1];

      const result = await createTagTeamFixture(user.id, robot1.id, robot2.id);
      testTeams.push(result);
      testTeamIds.push(result.id);
    }

    expect(testTeams.length).toBe(3);
    console.log(`[Test] Created ${testTeams.length} teams`);

    // Step 2: Run matchmaking
    console.log('[Test] Step 2: Running matchmaking...');
    
    const matchmakingResult = await runTagTeamMatchmaking();
    console.log(`[Test] Created ${matchmakingResult} matches`);

    // With 3 teams, we should have matches created
    expect(matchmakingResult).toBeGreaterThan(0);

    // Step 3: Verify bye-team match was created
    console.log('[Test] Step 3: Verifying bye-team match...');
    
    // A bye match is identified by its own `isByeMatch` flag.
    //
    // `scheduleMatches` writes ONLY slot 1 for a bye — there is no participant row for the
    // absent side, so `participants: { some: { participantId: -1 } }` could never match and
    // this assertion could never have passed. The same wrong assumption was already found
    // and documented in the battle-level test below; test 1 kept it.
    const byeMatches = await prisma.scheduledMatch.findMany({
      where: {
        status: 'scheduled',
        matchType: 'tag_team',
        isByeMatch: true,
        participants: { some: { participantId: { in: testTeamIds } } },
      },
      include: { participants: true },
    });

    expect(byeMatches.length).toBeGreaterThan(0);
    console.log(`[Test] Found ${byeMatches.length} bye-team matches`);

    // Verify bye-team match structure
    const byeMatch = byeMatches[0];
    expect(byeMatch.matchType).toBe('tag_team');
    expect(byeMatch.status).toBe('scheduled');
    // Exactly one side, and it is a real team. A Bye_Placeholder is a matchmaking artefact
    // and is never persisted.
    expect(byeMatch.participants).toHaveLength(1);
    expect(byeMatch.participants[0].slot).toBe(1);
    expect(byeMatch.participants[0].participantId).toBeGreaterThan(0);
    expect(testTeamIds).toContain(byeMatch.participants[0].participantId);

    console.log('[Test] ✓ Bye-team match created successfully');
  });

  it('should execute a bye and pay the participation floor only', async () => {
    // Build the odd cohort this test needs rather than relying on another test's leftovers.
    await createEligibleTeams(3);
    expect(await runTagTeamMatchmaking()).toBeGreaterThan(0);

    console.log('[Test] Step 1: Executing bye-team battles...');

    const battleResult = await executeScheduledTagTeamBattles();
    expect(battleResult.totalBattles).toBeGreaterThan(0);
    console.log(
      `[Test] Executed ${battleResult.totalBattles} battles: ` +
      `${battleResult.wins} wins, ${battleResult.draws} draws, ${battleResult.losses} losses`
    );

    // Step 2: Verify bye-team battle was executed
    console.log('[Test] Step 2: Verifying bye-team battle execution...');
    
    // Spec #49: a bye writes NO participant row for the placeholder. Those carry
    // negative ids and `battle_participants.robotId` has a Robot foreign key, so
    // such a row cannot exist — this query used to look for one and therefore
    // could never have passed. Byes are identified by their battleLog flag.
    const allTagTeamBattles = await prisma.battle.findMany({
      where: {
        battleType: 'tag_team',
        participants: { some: { robotId: { in: testRobotIds } } },
      },
      include: { participants: true },
    });
    const byeBattles = allTagTeamBattles.filter(
      b => (b.battleLog as { isByeMatch?: boolean } | null)?.isByeMatch === true,
    );

    expect(byeBattles.length).toBeGreaterThan(0);
    console.log(`[Test] Found ${byeBattles.length} bye-team battles`);

    const byeBattle = byeBattles[0];
    const byeScheduledMatch = await prisma.scheduledMatch.findFirst({
      where: { matchType: 'tag_team', battleId: byeBattle.id },
    });
    expect(byeScheduledMatch).not.toBeNull();
    expect(byeScheduledMatch!.status).toBe('completed');
    expect(byeScheduledMatch!.cancelReason).toBeNull();

    // Verify bye-team battle structure
    expect(byeBattle.battleType).toBe('tag_team');
    // Only real robots get participant rows, never the placeholder.
    for (const p of byeBattle.participants) {
      expect(p.robotId).toBeGreaterThan(0);
      // Nothing was simulated, so every combat figure is inert.
      expect(p.damageDealt).toBe(0);
      expect(p.destroyed).toBe(false);
      expect(p.prestigeAwarded).toBe(0);
      expect(p.fameAwarded).toBe(0);
    }

    // Step 3: Verify what a bye pays — credits only.
    console.log('[Test] Step 3: Verifying rewards...');

    // Both members of the real team get a participant row; the bye side gets none.
    expect(byeBattle.participants).toHaveLength(2);

    const realParticipant = byeBattle.participants[0];
    const realRobot = await prisma.robot.findUnique({
      where: { id: realParticipant.robotId },
    });

    expect(realRobot).not.toBeNull();
    expect(realRobot!.totalBattles).toBeGreaterThan(0);

    // Spec #49: a bye pays credits and nothing else. Zero prestige, zero fame, zero
    // streaming revenue — asserted per participant rather than trusting the totals.
    const totalCredits = byeBattle.participants.reduce((sum, p) => sum + p.credits, 0);
    expect(totalCredits).toBeGreaterThan(0);
    expect(totalCredits).toBe(byeBattle.winnerReward);
    expect(byeBattle.loserReward).toBe(0);
    for (const p of byeBattle.participants) {
      expect(p.streamingRevenue).toBe(0);
      expect(p.prestigeAwarded).toBe(0);
      expect(p.fameAwarded).toBe(0);
    }

    // A bye can never draw: nothing is simulated, so there is always a declared winner.
    expect(byeBattle.winnerId).not.toBeNull();

    console.log(`[Test] ✓ Bye paid ₡${totalCredits} in credits, no prestige/fame/streaming`);
  });

  it('should move ELO but not HP for a bye', async () => {
    await createEligibleTeams(3);
    expect(await runTagTeamMatchmaking()).toBeGreaterThan(0);
    expect((await executeScheduledTagTeamBattles()).totalBattles).toBeGreaterThan(0);

    const allTagTeamBattles = await prisma.battle.findMany({
      where: {
        battleType: 'tag_team',
        participants: { some: { robotId: { in: testRobotIds } } },
      },
      include: { participants: true },
    });
    const byeBattles = allTagTeamBattles.filter(
      b => (b.battleLog as { isByeMatch?: boolean } | null)?.isByeMatch === true,
    );

    // The bye must exist. The early return that used to hide its absence is gone.
    expect(byeBattles.length).toBeGreaterThan(0);

    const byeBattle = byeBattles[0];
    const realParticipant = byeBattle.participants[0];
    const realTeamRobotId = realParticipant!.robotId;
    
    const realRobot = await prisma.robot.findUnique({
      where: { id: realTeamRobotId },
    });

    expect(realRobot).toBeDefined();

    // The ELO change should be calculated against combined ELO of 2000
    // We can't verify the exact calculation here, but we can verify
    // that the battle was executed and ELO changed
    expect(realRobot!.totalBattles).toBeGreaterThan(0);

    // Spec #49: ELO still moves for a tag team bye, but HP does not. A bye is
    // never simulated, so the participant row records the robot's HP as it was.
    expect(realParticipant.finalHP).toBe(realRobot!.currentHP);
    expect(realParticipant.eloAfter).not.toBe(realParticipant.eloBefore);

    console.log('[Test] ✓ Bye-team ELO verification complete');
  });
});
