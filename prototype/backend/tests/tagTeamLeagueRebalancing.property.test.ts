import * as fc from 'fast-check';
import prisma from '../src/lib/prisma';
import {
  promoteTeam,
  demoteTeam,
  TAG_TEAM_LEAGUE_TIERS,
  TagTeamLeagueTier,
} from '../src/services/tagTeamLeagueRebalancingService';


// Test configuration
const NUM_RUNS = 20;

describe('Tag Team League Rebalancing - Property Tests', () => {
  let testStableId: number;
  let testRobotIds: number[] = [];
  let testTeamIds: number[] = [];

  beforeAll(async () => {
    // Create a test stable
    const stable = await prisma.user.create({
      data: {
        username: `pbt_rebalance_${Date.now()}`,
        passwordHash: 'test',
        currency: 10000,
      },
    });
    testStableId = stable.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testTeamIds.length > 0) {
      await prisma.tagTeam.deleteMany({
        where: { id: { in: testTeamIds } },
      });
    }
    if (testRobotIds.length > 0) {
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }
    if (testStableId) {
      await prisma.user.delete({
        where: { id: testStableId },
      });
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up teams and robots after each test
    if (testTeamIds.length > 0) {
      await prisma.tagTeam.deleteMany({
        where: { id: { in: testTeamIds } },
      });
    }
    if (testRobotIds.length > 0) {
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    testTeamIds = [];
    testRobotIds = [];
  });

  /**
   * Helper function to create a test robot
   */
  async function createTestRobot(elo: number = 1000) {
    // Get a weapon for the robot
    const weapon = await prisma.weapon.findFirst();
    const weaponInv = await prisma.weaponInventory.create({
      data: { userId: testStableId, weaponId: weapon!.id },
    });

    const robot = await prisma.robot.create({
      data: {
        name: `TestRobot_${Date.now()}_${Math.random()}`,
        userId: testStableId,
        currentHP: 100,
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
        yieldThreshold: 30,
        elo,
        hullIntegrity: 10.0,
        loadoutType: 'single',
        mainWeaponId: weaponInv.id,
      },
    });
    testRobotIds.push(robot.id);
    return robot;
  }

  /**
   * Helper function to create a test tag team
   */
  async function createTestTeam(
    league: string = 'bronze',
    leaguePoints: number = 0,
    cyclesInLeague: number = 0
  ) {
    const robot1 = await createTestRobot();
    const robot2 = await createTestRobot();

    const team = await prisma.tagTeam.create({
      data: {
        stableId: testStableId,
        activeRobotId: robot1.id,
        reserveRobotId: robot2.id,
        tagTeamLeague: league,
        tagTeamLeagueId: `${league}_1`,
        tagTeamLeaguePoints: leaguePoints,
        cyclesInTagTeamLeague: cyclesInLeague,
      },
    });
    testTeamIds.push(team.id);
    return team;
  }

  describe('Property 20: Tier Change Resets', () => {
    /**
     * **Validates: Requirements 6.5, 6.6**
     * 
     * For any team that is promoted or demoted, both the tag team league points
     * and cycles counter should be reset to 0.
     */
    test('promotion resets league points and cycles to 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial league tier (not champion, since champion can't be promoted)
          fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond'),
          // Generate initial league points (any positive value)
          fc.integer({ min: 1, max: 200 }),
          // Generate initial cycles counter (any positive value)
          fc.integer({ min: 1, max: 50 }),
          async (initialLeague, initialPoints, initialCycles) => {
            // Create a team with the generated initial values
            const team = await createTestTeam(initialLeague, initialPoints, initialCycles);

            // Verify initial state
            expect(team.tagTeamLeaguePoints).toBe(initialPoints);
            expect(team.cyclesInTagTeamLeague).toBe(initialCycles);

            // Promote the team
            await promoteTeam(team);

            // Retrieve the updated team
            const updatedTeam = await prisma.tagTeam.findUnique({
              where: { id: team.id },
            });

            // Property: League points must be reset to 0
            expect(updatedTeam!.tagTeamLeaguePoints).toBe(0);

            // Property: Cycles counter must be reset to 0
            expect(updatedTeam!.cyclesInTagTeamLeague).toBe(0);

            // Property: Team should be in the next tier up
            const currentIndex = TAG_TEAM_LEAGUE_TIERS.indexOf(initialLeague as TagTeamLeagueTier);
            const expectedNewTier = TAG_TEAM_LEAGUE_TIERS[currentIndex + 1];
            expect(updatedTeam!.tagTeamLeague).toBe(expectedNewTier);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('demotion resets league points and cycles to 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate initial league tier (not bronze, since bronze can't be demoted)
          fc.constantFrom('silver', 'gold', 'platinum', 'diamond', 'champion'),
          // Generate initial league points (any positive value)
          fc.integer({ min: 1, max: 200 }),
          // Generate initial cycles counter (any positive value)
          fc.integer({ min: 1, max: 50 }),
          async (initialLeague, initialPoints, initialCycles) => {
            // Create a team with the generated initial values
            const team = await createTestTeam(initialLeague, initialPoints, initialCycles);

            // Verify initial state
            expect(team.tagTeamLeaguePoints).toBe(initialPoints);
            expect(team.cyclesInTagTeamLeague).toBe(initialCycles);

            // Demote the team
            await demoteTeam(team);

            // Retrieve the updated team
            const updatedTeam = await prisma.tagTeam.findUnique({
              where: { id: team.id },
            });

            // Property: League points must be reset to 0
            expect(updatedTeam!.tagTeamLeaguePoints).toBe(0);

            // Property: Cycles counter must be reset to 0
            expect(updatedTeam!.cyclesInTagTeamLeague).toBe(0);

            // Property: Team should be in the next tier down
            const currentIndex = TAG_TEAM_LEAGUE_TIERS.indexOf(initialLeague as TagTeamLeagueTier);
            const expectedNewTier = TAG_TEAM_LEAGUE_TIERS[currentIndex - 1];
            expect(updatedTeam!.tagTeamLeague).toBe(expectedNewTier);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('tier change resets work across all valid tier transitions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a tier transition (promotion or demotion)
          fc.oneof(
            // Promotion transitions
            fc.record({
              action: fc.constant('promote' as const),
              tier: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond'),
            }),
            // Demotion transitions
            fc.record({
              action: fc.constant('demote' as const),
              tier: fc.constantFrom('silver', 'gold', 'platinum', 'diamond', 'champion'),
            })
          ),
          // Generate initial values
          fc.integer({ min: 0, max: 300 }), // league points
          fc.integer({ min: 0, max: 100 }), // cycles
          async (transition, leaguePoints, cycles) => {
            // Create a team with the generated values
            const team = await createTestTeam(transition.tier, leaguePoints, cycles);

            // Perform the tier change
            if (transition.action === 'promote') {
              await promoteTeam(team);
            } else {
              await demoteTeam(team);
            }

            // Retrieve the updated team
            const updatedTeam = await prisma.tagTeam.findUnique({
              where: { id: team.id },
            });

            // Property: Both league points and cycles must be 0 after any tier change
            expect(updatedTeam!.tagTeamLeaguePoints).toBe(0);
            expect(updatedTeam!.cyclesInTagTeamLeague).toBe(0);

            // Property: Team should have moved to a different tier
            expect(updatedTeam!.tagTeamLeague).not.toBe(transition.tier);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('reset applies regardless of initial values magnitude', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Test with extreme values
          fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond'),
          fc.integer({ min: 0, max: 10000 }), // Very high league points
          fc.integer({ min: 0, max: 1000 }), // Very high cycles
          async (tier, points, cycles) => {
            // Create a team with extreme values
            const team = await createTestTeam(tier, points, cycles);

            // Promote the team
            await promoteTeam(team);

            // Retrieve the updated team
            const updatedTeam = await prisma.tagTeam.findUnique({
              where: { id: team.id },
            });

            // Property: Reset should work regardless of how large the initial values were
            expect(updatedTeam!.tagTeamLeaguePoints).toBe(0);
            expect(updatedTeam!.cyclesInTagTeamLeague).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('reset applies even when initial values are already 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond'),
          async (tier) => {
            // Create a team with 0 points and 0 cycles
            const team = await createTestTeam(tier, 0, 0);

            // Promote the team
            await promoteTeam(team);

            // Retrieve the updated team
            const updatedTeam = await prisma.tagTeam.findUnique({
              where: { id: team.id },
            });

            // Property: Reset should still set values to 0 (idempotent)
            expect(updatedTeam!.tagTeamLeaguePoints).toBe(0);
            expect(updatedTeam!.cyclesInTagTeamLeague).toBe(0);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
