/**
 * Integration Test: Tag Team League Rebalancing
 *
 * Tests league rebalancing with varying league points using the TeamBattle model.
 *
 * This test verifies:
 * - Top 10% of eligible teams are promoted (minimum 5 cycles in tier, per-tier LP threshold)
 * - Bottom 10% of eligible teams are demoted (minimum 5 cycles in tier)
 * - Teams with < 5 cycles are not eligible for promotion or demotion
 * - A tier below `MIN_TEAMS_FOR_REBALANCING` moves nobody
 *
 * ─── Why this suite was rewritten (Spec #51) ─────────────────────────────────
 *
 * Every verification in it had become vacuous, and two were contradictory.
 *
 * Spec #40 moved tier, league instance, LP and `cyclesInTier` out of `TeamBattle` and
 * into `standings`. The queries here were written when those were columns, so they read
 * `prisma.teamBattle.findMany({ where: { id: { in: teamIds } } })` with a tier predicate
 * that no longer compiled — and the predicate was simply dropped rather than moved. What
 * was left counts every team the test created, whatever tier it ended in.
 *
 * The result was a suite that could not pass under any behaviour: the same unfiltered
 * 20-row query was asserted to equal 2 (`promotedTeams`) and 18 (`remainingBronzeTeams`)
 * in a single test. It reported "Received: 20" against both, which reads like a
 * rebalancing defect and is in fact a test that stopped asking about tiers at all.
 *
 * Two fixture facts also had to be established rather than assumed, because both gate
 * the engine and neither was ever written to the database:
 *
 *  - `cyclesInTier` — `leagueEngine` counts only entities with at least
 *    `MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING` (5) as eligible, and takes 10% of the
 *    ELIGIBLE count, not of the tier total.
 *  - The destination-cohort rule — `leagueEngine` holds promotions entirely when the
 *    destination tier is empty and there are fewer than `MIN_COHORT_FOR_NEW_TIER` (3)
 *    candidates. That is why the promotion test uses 30 teams and not 20: 10% of 20 is 2
 *    candidates, which is below the cohort floor, so a 20-team fixture promotes nobody
 *    and tests the cohort rule by accident instead of the 10% rule on purpose.
 */
import prisma from '../../src/lib/prisma';
import { rebalanceTagTeamLeagues } from '../../src/services/tag-team/tagTeamLeagueRebalancingService';
import { enterTeamStanding } from '../helpers/standings';

/** Teams in the promotion fixture. 10% of 30 is 3, which clears the cohort floor of 3. */
const PROMOTION_FIXTURE_TEAMS = 30;

interface CreatedUser { id: number }
interface CreatedRobot { id: number }
interface CreatedTeam { id: number }

/**
 * Count the teams among `teamIds` currently sitting in `tier`.
 *
 * This is the query the assertions below lost: tier is a `standings` column, so a tier
 * question cannot be asked of `teamBattle` at all any more.
 */
async function countTeamsInTier(teamIds: number[], tier: string): Promise<number> {
  return prisma.standing.count({
    where: {
      mode: 'tag_team',
      entityType: 'team',
      entityId: { in: teamIds },
      tier,
    },
  });
}

/** The tier a single team is currently in, or null when it holds no tag team standing. */
async function tierOfTeam(teamId: number): Promise<string | null> {
  const standing = await prisma.standing.findUnique({
    where: {
      entityType_entityId_mode: { entityType: 'team', entityId: teamId, mode: 'tag_team' },
    },
    select: { tier: true },
  });
  return standing?.tier ?? null;
}

describe('Tag Team League Rebalancing Integration Test', () => {
  const testUsers: CreatedUser[] = [];
  const testRobots: CreatedRobot[] = [];
  let testTeams: CreatedTeam[] = [];
  let weaponId: number;

  beforeAll(async () => {
    await prisma.$connect();

    const weapon = await prisma.weapon.findFirst();
    if (!weapon) {
      throw new Error('No weapons found. Run seed first.');
    }
    weaponId = weapon.id;

    // `rebalanceTagTeamLeagues` operates on every tag_team standing in the database, not
    // only on this suite's rows, so leftovers from another suite in the same run would
    // change the eligible counts these assertions depend on.
    await prisma.standing.deleteMany({ where: { mode: 'tag_team' } });

    for (let i = 0; i < PROMOTION_FIXTURE_TEAMS; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_rebalance_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
        },
      });
      testUsers.push(user);

      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: user.id, weaponId, pricePaid: 0 },
        });
        const robot = await prisma.robot.create({
          data: {
            userId: user.id,
            name: `Rebalance_Robot_${i}_${j}_${Date.now()}`,
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
      }
    }
  });

  afterEach(async () => {
    // Standings are polymorphic and have no foreign key to `team_battles`, so deleting
    // teams does not delete their standings. Every test here rebalances the whole
    // tag_team competition, so a leftover row changes the next test's eligible count.
    await prisma.standing.deleteMany({ where: { mode: 'tag_team' } });

    if (testTeams.length > 0) {
      await prisma.teamBattleMember.deleteMany({
        where: { teamId: { in: testTeams.map((t) => t.id) } },
      });
      await prisma.teamBattle.deleteMany({
        where: { id: { in: testTeams.map((t) => t.id) } },
      });
      testTeams = [];
    }
  });

  afterAll(async () => {
    await prisma.standing.deleteMany({ where: { mode: 'tag_team' } });
    await prisma.robot.deleteMany({ where: { id: { in: testRobots.map((r) => r.id) } } });
    await prisma.weaponInventory.deleteMany({ where: { userId: { in: testUsers.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: testUsers.map((u) => u.id) } } });
    await prisma.$disconnect();
  });

  it('should promote top 10% and demote bottom 10% with varying league points', async () => {
    // Step 1: 30 teams in bronze_1, all eligible, with distinct LP above the bronze
    // promotion threshold of 25 so the top-10% slice is deterministic.
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const team = await prisma.teamBattle.create({
        data: {
          stableId: user.id,
          teamSize: 2,
          teamName: `Rebalance Team ${i}`,
          members: {
            create: [
              { robotId: testRobots[i * 2].id, slotIndex: 0 },
              { robotId: testRobots[i * 2 + 1].id, slotIndex: 1 },
            ],
          },
        },
      });
      testTeams.push(team);

      await enterTeamStanding(team.id, 'tag_team', {
        tier: 'bronze',
        leagueInstanceId: 'bronze_1',
        leaguePoints: 30 + i,
        cyclesInTier: 5,
      });
    }
    expect(testTeams.length).toBe(PROMOTION_FIXTURE_TEAMS);

    const teamIds = testTeams.map((t) => t.id);
    expect(await countTeamsInTier(teamIds, 'bronze')).toBe(PROMOTION_FIXTURE_TEAMS);

    // Step 2: Run rebalancing
    const rebalanceResult = await rebalanceTagTeamLeagues();

    // Step 3: Top 10% of 30 eligible teams = 3, all of which clear the 25 LP threshold.
    const expectedPromotions = 3;
    expect(rebalanceResult.totalPromoted).toBe(expectedPromotions);
    expect(await countTeamsInTier(teamIds, 'silver')).toBe(expectedPromotions);

    // Step 4: Bronze is the lowest tier, so nothing can be demoted out of it.
    expect(rebalanceResult.totalDemoted).toBe(0);

    // Step 5: The rest stay in bronze.
    expect(await countTeamsInTier(teamIds, 'bronze')).toBe(
      PROMOTION_FIXTURE_TEAMS - expectedPromotions,
    );

    // The three promoted are the three highest-LP teams, which are the last created.
    const highestLp = teamIds.slice(-expectedPromotions);
    for (const teamId of highestLp) {
      expect(await tierOfTeam(teamId)).toBe('silver');
    }
  });

  it('should not promote/demote teams with < 5 cycles in tier', async () => {
    const user = await prisma.user.create({
      data: {
        username: `tagteam_newteam_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 100000,
      },
    });

    const robots: CreatedRobot[] = [];
    for (let i = 0; i < 2; i++) {
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: user.id, weaponId, pricePaid: 0 },
      });
      robots.push(
        await prisma.robot.create({
          data: {
            userId: user.id,
            name: `NewTeam_Robot_${i}_${Date.now()}`,
            elo: 1000,
            currentHP: 100,
            maxHP: 100,
            currentShield: 20,
            maxShield: 20,
            yieldThreshold: 20,
            loadoutType: 'single',
            mainWeaponId: weaponInv.id,
          },
        }),
      );
    }

    const newTeam = await prisma.teamBattle.create({
      data: {
        stableId: user.id,
        teamSize: 2,
        teamName: 'New Team Test',
        members: {
          create: [
            { robotId: robots[0].id, slotIndex: 0 },
            { robotId: robots[1].id, slotIndex: 1 },
          ],
        },
      },
    });

    // High LP, but only 3 cycles in tier — below the 5-cycle eligibility floor.
    await enterTeamStanding(newTeam.id, 'tag_team', {
      tier: 'bronze',
      leagueInstanceId: 'bronze_1',
      leaguePoints: 500,
      cyclesInTier: 3,
    });

    const result = await rebalanceTagTeamLeagues();

    // The team is ineligible, so it is the only team in the competition and nothing moves.
    expect(result.totalPromoted).toBe(0);
    expect(result.totalDemoted).toBe(0);
    // Still in bronze, and its cycle counter is untouched — a move would reset it to 0.
    expect(await tierOfTeam(newTeam.id)).toBe('bronze');
    const standing = await prisma.standing.findUnique({
      where: {
        entityType_entityId_mode: { entityType: 'team', entityId: newTeam.id, mode: 'tag_team' },
      },
    });
    expect(standing?.cyclesInTier).toBe(3);
    expect(standing?.leaguePoints).toBe(500);

    await prisma.standing.deleteMany({ where: { mode: 'tag_team', entityId: newTeam.id } });
    await prisma.teamBattleMember.deleteMany({ where: { teamId: newTeam.id } });
    await prisma.teamBattle.deleteMany({ where: { id: newTeam.id } });
    await prisma.robot.deleteMany({ where: { id: { in: robots.map((r) => r.id) } } });
    await prisma.weaponInventory.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it('should handle demotion from silver to bronze', async () => {
    const users: CreatedUser[] = [];
    const robots: CreatedRobot[] = [];
    const teams: CreatedTeam[] = [];

    for (let i = 0; i < 10; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_silver_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
        },
      });
      users.push(user);

      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: user.id, weaponId, pricePaid: 0 },
        });
        robots.push(
          await prisma.robot.create({
            data: {
              userId: user.id,
              name: `Silver_Robot_${i}_${j}_${Date.now()}`,
              elo: 1000,
              currentHP: 100,
              maxHP: 100,
              currentShield: 20,
              maxShield: 20,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weaponInv.id,
            },
          }),
        );
      }

      const team = await prisma.teamBattle.create({
        data: {
          stableId: user.id,
          teamSize: 2,
          teamName: `Silver Team ${i}`,
          members: {
            create: [
              { robotId: robots[i * 2].id, slotIndex: 0 },
              { robotId: robots[i * 2 + 1].id, slotIndex: 1 },
            ],
          },
        },
      });
      teams.push(team);

      // Distinct LP well below the silver promotion threshold of 50, so this fixture
      // exercises demotion only. Team 0 holds the fewest points and is the one that goes.
      await enterTeamStanding(team.id, 'tag_team', {
        tier: 'silver',
        leagueInstanceId: 'silver_1',
        leaguePoints: 5 + i,
        cyclesInTier: 5,
      });
    }

    const teamIds = teams.map((t) => t.id);
    const rebalanceResult = await rebalanceTagTeamLeagues();

    // Bottom 10% of 10 eligible teams = 1.
    const expectedDemotions = 1;
    expect(rebalanceResult.totalDemoted).toBe(expectedDemotions);
    expect(rebalanceResult.totalPromoted).toBe(0); // none reach 50 LP
    expect(await countTeamsInTier(teamIds, 'bronze')).toBe(expectedDemotions);
    expect(await countTeamsInTier(teamIds, 'silver')).toBe(teams.length - expectedDemotions);
    // The lowest-LP team is the one demoted.
    expect(await tierOfTeam(teamIds[0])).toBe('bronze');

    await prisma.standing.deleteMany({ where: { mode: 'tag_team', entityId: { in: teamIds } } });
    await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.robot.deleteMany({ where: { id: { in: robots.map((r) => r.id) } } });
    await prisma.weaponInventory.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });

  /**
   * Renamed from "minimum team count for rebalancing (< 10 teams)". There is no minimum
   * of 10: `MIN_TEAMS_FOR_REBALANCING` is 4, so a 5-team tier is above the floor and is
   * processed. What actually holds the teams in place is the percentage flooring —
   * `Math.floor(5 * 0.10)` is 0 — which is a different rule with a different boundary,
   * and the old name pointed a reader at the wrong one.
   */
  it('should move nobody when 10% of the tier floors to zero', async () => {
    const users: CreatedUser[] = [];
    const robots: CreatedRobot[] = [];
    const teams: CreatedTeam[] = [];

    for (let i = 0; i < 5; i++) {
      const user = await prisma.user.create({
        data: {
          username: `tagteam_gold_user_${i}_${Date.now()}`,
          passwordHash: 'test_hash',
          currency: 100000,
        },
      });
      users.push(user);

      for (let j = 0; j < 2; j++) {
        const weaponInv = await prisma.weaponInventory.create({
          data: { userId: user.id, weaponId, pricePaid: 0 },
        });
        robots.push(
          await prisma.robot.create({
            data: {
              userId: user.id,
              name: `Gold_Robot_${i}_${j}_${Date.now()}`,
              elo: 1000,
              currentHP: 100,
              maxHP: 100,
              currentShield: 20,
              maxShield: 20,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weaponInv.id,
            },
          }),
        );
      }

      const team = await prisma.teamBattle.create({
        data: {
          stableId: user.id,
          teamSize: 2,
          teamName: `Gold Team ${i}`,
          members: {
            create: [
              { robotId: robots[i * 2].id, slotIndex: 0 },
              { robotId: robots[i * 2 + 1].id, slotIndex: 1 },
            ],
          },
        },
      });
      teams.push(team);

      // Eligible on cycles, and above the gold threshold of 75, so nothing but the
      // percentage floor prevents a promotion.
      await enterTeamStanding(team.id, 'tag_team', {
        tier: 'gold',
        leagueInstanceId: 'gold_1',
        leaguePoints: 100 + i,
        cyclesInTier: 5,
      });
    }

    const teamIds = teams.map((t) => t.id);
    const result = await rebalanceTagTeamLeagues();

    expect(result.totalPromoted).toBe(0);
    expect(result.totalDemoted).toBe(0);
    expect(await countTeamsInTier(teamIds, 'gold')).toBe(teams.length);
    expect(await countTeamsInTier(teamIds, 'platinum')).toBe(0);
    expect(await countTeamsInTier(teamIds, 'silver')).toBe(0);

    await prisma.standing.deleteMany({ where: { mode: 'tag_team', entityId: { in: teamIds } } });
    await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.robot.deleteMany({ where: { id: { in: robots.map((r) => r.id) } } });
    await prisma.weaponInventory.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  });
});
