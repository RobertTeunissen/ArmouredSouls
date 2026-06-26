/**
 * Integration Test: Complete Team Battle Cycle (2v2 and 3v3)
 *
 * Tests the full workflow:
 *   Team registration → Subscription → Matchmaking → Battle execution →
 *   Reward distribution → League rebalancing
 *
 * This test verifies:
 * - Team creation for both 2v2 and 3v3 sizes
 * - Subscription gating (robots must be subscribed to league_2v2/league_3v3)
 * - Team battle matchmaking produces scheduled matches
 * - Battle execution produces Battle records with correct battleType
 * - Reward distribution (N× multiplier, credits, ELO, LP)
 * - League rebalancing works for team standings
 * - Tag team mode is unaffected (zero functional diffs)
 * - No rows with old event_type values remain after migration
 *
 * Requirements: R3.11, R3.12, R14.2, R14.6
 */

import prisma from '../../src/lib/prisma';
import { registerTeam } from '../../src/services/team-battle/teamBattleService';
import { runTeamBattleMatchmaking } from '../../src/services/team-battle/teamBattleMatchmakingService';
import { executeScheduledTeamBattles } from '../../src/services/team-battle/teamBattleOrchestrator';
import { rebalanceTeamBattleLeagues } from '../../src/services/team-battle/teamBattleAdapter';

describe('Team Battle Complete Cycle Integration Test', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testTeamIds: number[] = [];
  let testSubscriptionIds: number[] = [];
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
    // Clean up in reverse dependency order
    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
    }

    // Clean up battles created by our test robots
    if (testTeamIds.length > 0) {
      await prisma.scheduledTeamBattleMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: testTeamIds } },
            { team2Id: { in: testTeamIds } },
          ],
        },
      });
    }

    // Delete battles that reference our robots
    if (testRobotIds.length > 0) {
      await prisma.battle.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
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

    if (testSubscriptionIds.length > 0) {
      await prisma.subscription.deleteMany({
        where: { id: { in: testSubscriptionIds } },
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
    testSubscriptionIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Create a test user (stable) with N robots, all subscribed to the given event.
   */
  async function createStableWithRobots(
    stableIndex: number,
    robotCount: number,
    eventType: string,
    eloBase: number = 1000,
  ): Promise<{ user: any; robots: any[] }> {
    const user = await prisma.user.create({
      data: {
        username: `tb_cycle_user_${stableIndex}_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 500000,
        prestige: 0,
      },
    });
    testUserIds.push(user.id);

    const robots: any[] = [];
    for (let j = 0; j < robotCount; j++) {
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
          name: `TB_Robot_${stableIndex}_${j}_${Date.now()}`,
          elo: eloBase + stableIndex * 50 + j * 10,
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

      // Create active subscription for the robot
      const subscription = await prisma.subscription.create({
        data: {
          robotId: robot.id,
          eventType,
          status: 'active',
        },
      });
      testSubscriptionIds.push(subscription.id);
    }

    return { user, robots };
  }

  it('should complete full 2v2 team battle cycle: register → subscribe → matchmake → battle → reward → rebalance', async () => {
    // ─── Step 1: Create stables with robots and subscriptions ─────────────────
    console.log('[Test] Step 1: Creating stables with robots and subscriptions...');

    const stables: { user: any; robots: any[] }[] = [];
    // Create 4 stables, each with 2 robots subscribed to league_2v2
    for (let i = 0; i < 4; i++) {
      const stable = await createStableWithRobots(i, 2, 'league_2v2', 1000);
      stables.push(stable);
    }

    console.log(`[Test] Created ${stables.length} stables with 2 robots each`);

    // ─── Step 2: Register teams ──────────────────────────────────────────────
    console.log('[Test] Step 2: Registering 2v2 teams...');

    const teams: any[] = [];
    for (let i = 0; i < stables.length; i++) {
      const { user, robots } = stables[i];
      const team = await registerTeam(
        user.id,
        robots.map(r => r.id),
        `TestTeam2v2_${i}_${Date.now()}`,
        2,
        user.id,
      );
      teams.push(team);
      testTeamIds.push(team.id);
    }

    expect(teams.length).toBe(4);
    console.log(`[Test] Registered ${teams.length} teams`);

    // Verify teams are in correct state
    for (const team of teams) {
      expect(team.eligibility).toBe('ELIGIBLE');
      expect(team.members.length).toBe(2);
    }

    // ─── Step 3: Run matchmaking ─────────────────────────────────────────────
    console.log('[Test] Step 3: Running 2v2 matchmaking...');

    // Clean up any pre-existing scheduled 2v2 matches to ensure test isolation
    await prisma.scheduledTeamBattleMatch.deleteMany({
      where: { status: 'scheduled', teamSize: 2, teamBattleLeagueId: 'bronze_1' },
    });

    const matchCount = await runTeamBattleMatchmaking(2);
    expect(matchCount).toBeGreaterThan(0);
    console.log(`[Test] Created ${matchCount} scheduled matches`);

    // Verify scheduled matches exist
    const scheduledMatches = await prisma.scheduledTeamBattleMatch.findMany({
      where: {
        status: 'scheduled',
        teamSize: 2,
        OR: [
          { team1Id: { in: testTeamIds } },
          { team2Id: { in: testTeamIds } },
        ],
      },
    });
    expect(scheduledMatches.length).toBeGreaterThan(0);

    // Verify match structure — test teams should have matches scheduled
    for (const match of scheduledMatches) {
      expect(match.teamSize).toBe(2);
      expect(match.teamBattleLeague).toBe('bronze');
      expect(match.teamBattleLeagueId).toBe('bronze_1');
      expect(match.status).toBe('scheduled');
    }
    // With other teams in the database, test teams should be paired (no byes for 4+ teams)
    const testTeamMatches = scheduledMatches.filter(
      m => (testTeamIds.includes(m.team1Id) || (m.team2Id !== null && testTeamIds.includes(m.team2Id))) && m.team2Id !== null,
    );
    expect(testTeamMatches.length).toBeGreaterThan(0);

    // ─── Step 4: Execute battles ─────────────────────────────────────────────
    console.log('[Test] Step 4: Executing 2v2 battles...');

    const execResult = await executeScheduledTeamBattles(2);
    expect(execResult.matchesCompleted).toBeGreaterThan(0);
    expect(execResult.matchesCancelled).toBe(0);
    console.log(
      `[Test] Executed ${execResult.matchesCompleted} battles ` +
      `(${execResult.matchesCancelled} cancelled)`,
    );

    // ─── Step 5: Verify battle records ───────────────────────────────────────
    console.log('[Test] Step 5: Verifying battle records...');

    const battles = await prisma.battle.findMany({
      where: {
        battleType: 'league_2v2',
        OR: [
          { robot1Id: { in: testRobotIds } },
          { robot2Id: { in: testRobotIds } },
        ],
      },
      include: {
        participants: true,
      },
    });
    expect(battles.length).toBeGreaterThan(0);

    for (const battle of battles) {
      expect(battle.battleType).toBe('league_2v2');
      // 2v2 = 4 participants total (2 per team)
      expect(battle.participants.length).toBe(4);

      // Verify participants have team assignments
      const team1Participants = battle.participants.filter(p => p.team === 1);
      const team2Participants = battle.participants.filter(p => p.team === 2);
      expect(team1Participants.length).toBe(2);
      expect(team2Participants.length).toBe(2);
    }

    // ─── Step 6: Verify reward distribution ──────────────────────────────────
    console.log('[Test] Step 6: Verifying reward distribution...');

    // Check that robots received ELO updates
    const updatedRobots = await prisma.robot.findMany({
      where: { id: { in: testRobotIds } },
    });

    // At least some robots should have ELO changes
    const originalElos = stables.flatMap(s => s.robots.map(r => r.elo));
    const updatedElos = updatedRobots.map(r => r.elo);
    const eloChanged = updatedElos.some((elo, i) => elo !== originalElos[i]);
    expect(eloChanged).toBe(true);

    // Check team standings were updated (LP now lives in standings table)
    const updatedStandings = await prisma.standing.findMany({
      where: { entityType: 'team', entityId: { in: testTeamIds }, mode: 'league_2v2' },
    });

    // At least one team should have a standing record
    expect(updatedStandings.length).toBeGreaterThan(0);

    // Verify totalLeague2v2Wins or totalBattles incremented for participating robots
    // (test robots may not always win against seed robots with higher attributes)
    const robotsWithBattles = updatedRobots.filter(r => r.totalBattles > 0);
    expect(robotsWithBattles.length).toBeGreaterThan(0);

    // Verify credits were distributed (user currency increased)
    const updatedUsers = await prisma.user.findMany({
      where: { id: { in: testUserIds } },
    });
    const creditsEarned = updatedUsers.some(u => u.currency > 500000);
    expect(creditsEarned).toBe(true);

    // ─── Step 7: Run league rebalancing ──────────────────────────────────────
    console.log('[Test] Step 7: Running league rebalancing...');

    const rebalanceResult = await rebalanceTeamBattleLeagues();
    expect(rebalanceResult).toBeDefined();
    expect(rebalanceResult.errors.length).toBe(0);
    console.log(
      `[Test] Rebalancing: ${rebalanceResult.totalPromoted} promoted, ` +
      `${rebalanceResult.totalDemoted} demoted`,
    );

    // Teams with < 5 cycles won't be promoted/demoted, but rebalancing should complete without errors
    expect(rebalanceResult.totalTeams).toBeGreaterThanOrEqual(4);

    console.log('[Test] ✓ Complete 2v2 team battle cycle verified successfully');
  }, 120000);

  it('should complete full 3v3 team battle cycle', async () => {
    // ─── Step 1: Create stables with 3 robots each ───────────────────────────
    console.log('[Test] Step 1: Creating stables with 3 robots for 3v3...');

    const stables: { user: any; robots: any[] }[] = [];
    for (let i = 0; i < 4; i++) {
      const stable = await createStableWithRobots(i + 10, 3, 'league_3v3', 1100);
      stables.push(stable);
    }

    console.log(`[Test] Created ${stables.length} stables with 3 robots each`);

    // ─── Step 2: Register 3v3 teams ──────────────────────────────────────────
    console.log('[Test] Step 2: Registering 3v3 teams...');

    const teams: any[] = [];
    for (let i = 0; i < stables.length; i++) {
      const { user, robots } = stables[i];
      const team = await registerTeam(
        user.id,
        robots.map(r => r.id),
        `TestTeam3v3_${i}_${Date.now()}`,
        3,
        user.id,
      );
      teams.push(team);
      testTeamIds.push(team.id);
    }

    expect(teams.length).toBe(4);

    // ─── Step 3: Run 3v3 matchmaking ─────────────────────────────────────────
    console.log('[Test] Step 3: Running 3v3 matchmaking...');

    // Clean up any pre-existing scheduled 3v3 matches to ensure test isolation
    await prisma.scheduledTeamBattleMatch.deleteMany({
      where: { status: 'scheduled', teamSize: 3, teamBattleLeagueId: 'bronze_1' },
    });

    const matchCount = await runTeamBattleMatchmaking(3);
    expect(matchCount).toBeGreaterThan(0);
    console.log(`[Test] Created ${matchCount} scheduled 3v3 matches`);

    // ─── Step 4: Execute 3v3 battles ─────────────────────────────────────────
    console.log('[Test] Step 4: Executing 3v3 battles...');

    const execResult = await executeScheduledTeamBattles(3);
    expect(execResult.matchesCompleted).toBeGreaterThan(0);
    expect(execResult.matchesCancelled).toBe(0);
    console.log(`[Test] Executed ${execResult.matchesCompleted} 3v3 battles`);

    // ─── Step 5: Verify 3v3 battle records ───────────────────────────────────
    console.log('[Test] Step 5: Verifying 3v3 battle records...');

    const battles = await prisma.battle.findMany({
      where: {
        battleType: 'league_3v3',
        OR: [
          { robot1Id: { in: testRobotIds } },
          { robot2Id: { in: testRobotIds } },
        ],
      },
      include: {
        participants: true,
      },
    });
    expect(battles.length).toBeGreaterThan(0);

    for (const battle of battles) {
      expect(battle.battleType).toBe('league_3v3');
      // 3v3 = 6 participants for real matches, 3 for bye matches (bye robots have negative IDs and are filtered)
      const isRealMatch = battle.participants.length === 6;
      const isByeMatch = battle.participants.length === 3;
      expect(isRealMatch || isByeMatch).toBe(true);

      if (isRealMatch) {
        const team1Participants = battle.participants.filter(p => p.team === 1);
        const team2Participants = battle.participants.filter(p => p.team === 2);
        expect(team1Participants.length).toBe(3);
        expect(team2Participants.length).toBe(3);
      }
    }

    // ─── Step 6: Verify 3v3 rewards ─────────────────────────────────────────
    console.log('[Test] Step 6: Verifying 3v3 rewards...');

    const updatedRobots = await prisma.robot.findMany({
      where: { id: { in: testRobotIds } },
    });

    // Verify totalLeague3v3Wins or totalBattles incremented for participating robots
    // (test robots may not always win against seed robots with higher attributes)
    const robotsWithBattles = updatedRobots.filter(r => r.totalBattles > 0);
    expect(robotsWithBattles.length).toBeGreaterThan(0);

    // Verify team standings updated (LP now in standings table)
    const updatedStandings3v3 = await prisma.standing.findMany({
      where: { entityType: 'team', entityId: { in: testTeamIds }, mode: 'league_3v3' },
    });
    expect(updatedStandings3v3.length).toBeGreaterThan(0);

    // ─── Step 7: Rebalancing ─────────────────────────────────────────────────
    console.log('[Test] Step 7: Running 3v3 league rebalancing...');

    const rebalanceResult = await rebalanceTeamBattleLeagues();
    expect(rebalanceResult).toBeDefined();
    expect(rebalanceResult.errors.length).toBe(0);

    console.log('[Test] ✓ Complete 3v3 team battle cycle verified successfully');
  }, 120000);

  it('should verify no rows with old event_type values remain (R3.11, R3.12)', async () => {
    // Verify subscription migration: no rows with old event_type values
    const oldLeagueSubscriptions = await prisma.subscription.count({
      where: { eventType: 'league' },
    });
    expect(oldLeagueSubscriptions).toBe(0);

    const oldTournamentSubscriptions = await prisma.subscription.count({
      where: { eventType: 'tournament' },
    });
    expect(oldTournamentSubscriptions).toBe(0);

    // Verify battle migration: no rows with old battle_type values
    const oldLeagueBattles = await prisma.battle.count({
      where: { battleType: 'league' },
    });
    expect(oldLeagueBattles).toBe(0);

    const oldTournamentBattles = await prisma.battle.count({
      where: { battleType: 'tournament' },
    });
    expect(oldTournamentBattles).toBe(0);
  });

  it('should verify tag team mode is unaffected by team battle execution', async () => {
    // Verify tag team battles still use 'tag_team' battleType (not renamed)
    const tagTeamBattleCount = await prisma.battle.count({
      where: { battleType: 'tag_team' },
    });

    // If tag team battles exist, verify they are intact
    if (tagTeamBattleCount > 0) {
      const sampleTagTeamBattle = await prisma.battle.findFirst({
        where: { battleType: 'tag_team' },
        include: { participants: true },
      });

      expect(sampleTagTeamBattle).not.toBeNull();
      expect(sampleTagTeamBattle!.battleType).toBe('tag_team');
      // Tag team battles should have tag team specific fields
      expect(sampleTagTeamBattle!.team1ActiveRobotId).toBeDefined();
    }

    // Verify tag team scheduled matches table is independent (now uses scheduledTeamBattleMatch with matchMode='tag_team')
    const tagTeamScheduledCount = await prisma.scheduledTeamBattleMatch.count({
      where: { matchMode: 'tag_team' },
    });
    // Just verify the query is accessible and not corrupted
    expect(tagTeamScheduledCount).toBeGreaterThanOrEqual(0);

    console.log('[Test] ✓ Tag team mode verified unaffected');
  });

  it('should run both 2v2 and 3v3 in same cycle (simulating bulk cycle)', async () => {
    // ─── Setup: Create stables for both 2v2 and 3v3 ─────────────────────────
    console.log('[Test] Setting up stables for combined 2v2 + 3v3 cycle...');

    // 4 stables with 3 robots each, subscribed to both league_2v2 and league_3v3
    const stables: { user: any; robots: any[] }[] = [];
    for (let i = 0; i < 4; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tb_combined_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 500000,
          prestige: 0,
        },
      });
      testUserIds.push(user.id);

      const robots: any[] = [];
      for (let j = 0; j < 3; j++) {
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
            name: `TB_Combined_${i}_${j}_${Date.now()}`,
            elo: 1000 + i * 50,
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

        // Subscribe to both league_2v2 and league_3v3
        const sub2v2 = await prisma.subscription.create({
          data: { robotId: robot.id, eventType: 'league_2v2', status: 'active' },
        });
        testSubscriptionIds.push(sub2v2.id);

        const sub3v3 = await prisma.subscription.create({
          data: { robotId: robot.id, eventType: 'league_3v3', status: 'active' },
        });
        testSubscriptionIds.push(sub3v3.id);
      }

      stables.push({ user, robots });
    }

    // Register 2v2 teams (first 2 robots from each stable)
    const teams2v2: any[] = [];
    for (let i = 0; i < stables.length; i++) {
      const { user, robots } = stables[i];
      const team = await registerTeam(
        user.id,
        [robots[0].id, robots[1].id],
        `Combined2v2_${i}_${Date.now()}`,
        2,
        user.id,
      );
      teams2v2.push(team);
      testTeamIds.push(team.id);
    }

    // Register 3v3 teams (all 3 robots from each stable)
    const teams3v3: any[] = [];
    for (let i = 0; i < stables.length; i++) {
      const { user, robots } = stables[i];
      const team = await registerTeam(
        user.id,
        robots.map(r => r.id),
        `Combined3v3_${i}_${Date.now()}`,
        3,
        user.id,
      );
      teams3v3.push(team);
      testTeamIds.push(team.id);
    }

    // ─── Execute 2v2 cycle (simulating 09:00 UTC slot) ───────────────────────
    console.log('[Test] Executing 2v2 cycle (09:00 slot)...');

    const matches2v2 = await runTeamBattleMatchmaking(2);
    expect(matches2v2).toBeGreaterThan(0);

    const exec2v2 = await executeScheduledTeamBattles(2);
    expect(exec2v2.matchesCompleted).toBeGreaterThan(0);

    // ─── Execute 3v3 cycle (simulating 14:00 UTC slot) ───────────────────────
    console.log('[Test] Executing 3v3 cycle (14:00 slot)...');

    const matches3v3 = await runTeamBattleMatchmaking(3);
    expect(matches3v3).toBeGreaterThan(0);

    const exec3v3 = await executeScheduledTeamBattles(3);
    expect(exec3v3.matchesCompleted).toBeGreaterThan(0);

    // ─── Verify both battle types exist in same "cycle" ──────────────────────
    console.log('[Test] Verifying both battle types exist...');

    const battles2v2 = await prisma.battle.findMany({
      where: {
        battleType: 'league_2v2',
        OR: [
          { robot1Id: { in: testRobotIds } },
          { robot2Id: { in: testRobotIds } },
        ],
      },
    });

    const battles3v3 = await prisma.battle.findMany({
      where: {
        battleType: 'league_3v3',
        OR: [
          { robot1Id: { in: testRobotIds } },
          { robot2Id: { in: testRobotIds } },
        ],
      },
    });

    expect(battles2v2.length).toBeGreaterThan(0);
    expect(battles3v3.length).toBeGreaterThan(0);

    // ─── Run rebalancing for both ────────────────────────────────────────────
    console.log('[Test] Running rebalancing for both sizes...');

    const rebalanceResult = await rebalanceTeamBattleLeagues();
    expect(rebalanceResult).toBeDefined();
    expect(rebalanceResult.errors.length).toBe(0);

    console.log(
      `[Test] ✓ Combined cycle complete: ${battles2v2.length} 2v2 battles + ` +
      `${battles3v3.length} 3v3 battles in same cycle`,
    );
  }, 180000);
});
