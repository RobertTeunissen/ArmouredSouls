import * as fc from 'fast-check';
import prisma from '../src/lib/prisma';
import {
  assignTagTeamLeagueInstance,
  getInstancesForTier,
  MAX_TEAMS_PER_INSTANCE,
  TAG_TEAM_LEAGUE_TIERS,
  TagTeamLeagueTier,
  createTagTeamWithInstanceAssignment,
} from '../src/services/tagTeamLeagueInstanceService';


// Test configuration
const NUM_RUNS = 20;

describe('Tag Team League Instance - Property Tests', () => {
  let testStableId: number;
  let testRobotIds: number[] = [];
  let testTeamIds: number[] = [];

  beforeAll(async () => {
    // Create a test stable
    const stable = await prisma.user.create({
      data: {
        username: `pbt_instance_${Date.now()}`,
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

  beforeEach(async () => {
    // Clean up ALL tag teams in ALL tiers to ensure test isolation
    // This is necessary because getInstancesForTier counts ALL teams globally
    await prisma.tagTeam.deleteMany({});
  });

  afterEach(async () => {
    // Clean up ALL teams and robots for this test stable (not just tracked ones)
    // This ensures we start fresh even if previous tests failed
    await prisma.tagTeam.deleteMany({
      where: { stableId: testStableId },
    });
    await prisma.robot.deleteMany({
      where: { userId: testStableId },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: testStableId },
    });

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
    leagueId?: string
  ) {
    const robot1 = await createTestRobot();
    const robot2 = await createTestRobot();

    let team;
    if (leagueId) {
      // If leagueId is explicitly provided, use it directly (for specific test cases)
      team = await prisma.tagTeam.create({
        data: {
          stableId: testStableId,
          activeRobotId: robot1.id,
          reserveRobotId: robot2.id,
          tagTeamLeague: league,
          tagTeamLeagueId: leagueId,
          tagTeamLeaguePoints: 0,
          cyclesInTagTeamLeague: 0,
        },
      });
    } else {
      // Use the new createTagTeamWithInstanceAssignment function for proper concurrency control
      team = await createTagTeamWithInstanceAssignment(
        {
          stableId: testStableId,
          activeRobotId: robot1.id,
          reserveRobotId: robot2.id,
          tagTeamLeaguePoints: 0,
          cyclesInTagTeamLeague: 0,
        },
        league as TagTeamLeagueTier
      );
    }

    testTeamIds.push(team.id);
    return team;
  }

  describe('Property 21: League Instance Capacity', () => {
    /**
     * **Validates: Requirements 6.7, 6.8**
     * 
     * For any tag team league instance, the number of teams should never exceed 50,
     * and when the 51st team would be added, a new instance should be created.
     */
    test('no instance ever exceeds maximum capacity of 50 teams', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a number of teams to create (up to 60 to test overflow)
          fc.integer({ min: 1, max: 60 }),
          // Generate a league tier
          fc.constantFrom(...TAG_TEAM_LEAGUE_TIERS),
          async (numTeams, tier) => {
            // Clean up ALL teams in this tier before this iteration
            await prisma.tagTeam.deleteMany({
              where: { tagTeamLeague: tier },
            });

            // Create the specified number of teams
            const createdTeams = [];
            for (let i = 0; i < numTeams; i++) {
              const team = await createTestTeam(tier);
              createdTeams.push(team);
            }

            // Get all instances for this tier
            const instances = await getInstancesForTier(tier);

            // Property: No instance should have more than MAX_TEAMS_PER_INSTANCE teams
            for (const instance of instances) {
              expect(instance.currentTeams).toBeLessThanOrEqual(MAX_TEAMS_PER_INSTANCE);
            }

            // Property: Total teams across all instances should equal numTeams
            const totalTeams = instances.reduce((sum, inst) => sum + inst.currentTeams, 0);
            expect(totalTeams).toBe(numTeams);
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test('new instance is created when 51st team would be added', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a league tier
          fc.constantFrom(...TAG_TEAM_LEAGUE_TIERS),
          async (tier) => {
            // Clean up ALL teams in this tier before this iteration
            await prisma.tagTeam.deleteMany({
              where: { tagTeamLeague: tier },
            });

            // Create exactly 50 teams (fill first instance)
            for (let i = 0; i < 50; i++) {
              await createTestTeam(tier);
            }

            // Verify we have exactly 1 instance with 50 teams
            let instances = await getInstancesForTier(tier);
            expect(instances.length).toBe(1);
            expect(instances[0].currentTeams).toBe(50);
            expect(instances[0].isFull).toBe(true);

            // Create the 51st team
            const team51 = await createTestTeam(tier);

            // Property: A new instance should have been created
            instances = await getInstancesForTier(tier);
            expect(instances.length).toBe(2);

            // Property: The 51st team should be in the second instance
            expect(team51.tagTeamLeagueId).toBe(`${tier}_2`);

            // Property: First instance should still have 50 teams
            const firstInstance = instances.find(i => i.instanceNumber === 1);
            expect(firstInstance!.currentTeams).toBe(50);

            // Property: Second instance should have 1 team
            const secondInstance = instances.find(i => i.instanceNumber === 2);
            expect(secondInstance!.currentTeams).toBe(1);
          }
        ),
        { numRuns: 20 } // Reduced runs since this creates many teams
      );
    });

    test('instance assignment distributes teams correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a number of teams between 51 and 150 (to test multiple instances)
          fc.integer({ min: 51, max: 150 }),
          fc.constantFrom(...TAG_TEAM_LEAGUE_TIERS),
          async (numTeams, tier) => {
            // Clean up ALL teams in this tier before this iteration
            await prisma.tagTeam.deleteMany({
              where: { tagTeamLeague: tier },
            });

            // Create the specified number of teams
            for (let i = 0; i < numTeams; i++) {
              await createTestTeam(tier);
            }

            // Get all instances for this tier
            const instances = await getInstancesForTier(tier);

            // Property: Each instance should have at most MAX_TEAMS_PER_INSTANCE teams
            for (const instance of instances) {
              expect(instance.currentTeams).toBeLessThanOrEqual(MAX_TEAMS_PER_INSTANCE);
            }

            // Property: We should have the correct number of instances
            const expectedInstances = Math.ceil(numTeams / MAX_TEAMS_PER_INSTANCE);
            expect(instances.length).toBe(expectedInstances);

            // Property: All instances except possibly the last should be full or near full
            for (let i = 0; i < instances.length - 1; i++) {
              expect(instances[i].currentTeams).toBe(MAX_TEAMS_PER_INSTANCE);
            }

            // Property: Last instance should have the remainder
            const lastInstance = instances[instances.length - 1];
            const expectedLastInstanceTeams = numTeams % MAX_TEAMS_PER_INSTANCE || MAX_TEAMS_PER_INSTANCE;
            expect(lastInstance.currentTeams).toBe(expectedLastInstanceTeams);
          }
        ),
        { numRuns: 20 } // Reduced runs since this creates many teams
      );
    });

    test('instance capacity is enforced across all league tiers', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate teams for multiple tiers
          fc.array(
            fc.record({
              tier: fc.constantFrom(...TAG_TEAM_LEAGUE_TIERS),
              numTeams: fc.integer({ min: 1, max: 75 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          async (tierConfigs) => {
            // Clean up ALL teams before this iteration
            await prisma.tagTeam.deleteMany({});

            // Create teams for each tier configuration
            for (const config of tierConfigs) {
              for (let i = 0; i < config.numTeams; i++) {
                await createTestTeam(config.tier);
              }
            }

            // Verify capacity for each tier
            for (const config of tierConfigs) {
              const instances = await getInstancesForTier(config.tier as TagTeamLeagueTier);

              // Property: No instance in any tier should exceed capacity
              for (const instance of instances) {
                expect(instance.currentTeams).toBeLessThanOrEqual(MAX_TEAMS_PER_INSTANCE);
              }

              // Property: Total teams should match what we created
              const totalTeams = instances.reduce((sum, inst) => sum + inst.currentTeams, 0);
              expect(totalTeams).toBe(config.numTeams);
            }
          }
        ),
        { numRuns: 15 } // Reduced runs since this creates many teams across tiers
      );
    });

    test('assignTagTeamLeagueInstance never returns a full instance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TAG_TEAM_LEAGUE_TIERS),
          fc.integer({ min: 0, max: 100 }),
          async (tier, numExistingTeams) => {
            // Create existing teams
            for (let i = 0; i < numExistingTeams; i++) {
              await createTestTeam(tier);
            }

            // Get the assigned instance for a new team
            const assignedLeagueId = await assignTagTeamLeagueInstance(tier);

            // Count teams in the assigned instance
            const teamsInInstance = await prisma.tagTeam.count({
              where: {
                tagTeamLeague: tier,
                tagTeamLeagueId: assignedLeagueId,
              },
            });

            // Property: Assigned instance should have room for at least one more team
            expect(teamsInInstance).toBeLessThan(MAX_TEAMS_PER_INSTANCE);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('instance numbers are sequential and start at 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TAG_TEAM_LEAGUE_TIERS),
          fc.integer({ min: 1, max: 120 }),
          async (tier, numTeams) => {
            // Create teams
            for (let i = 0; i < numTeams; i++) {
              await createTestTeam(tier);
            }

            // Get instances
            const instances = await getInstancesForTier(tier);

            // Property: Instance numbers should start at 1
            expect(instances[0].instanceNumber).toBe(1);

            // Property: Instance numbers should be sequential
            for (let i = 0; i < instances.length; i++) {
              expect(instances[i].instanceNumber).toBe(i + 1);
            }

            // Property: League IDs should match the pattern tier_number
            for (const instance of instances) {
              expect(instance.leagueId).toBe(`${tier}_${instance.instanceNumber}`);
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    test('capacity enforcement works with concurrent team creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...TAG_TEAM_LEAGUE_TIERS),
          fc.integer({ min: 45, max: 55 }), // Around the boundary
          async (tier, numTeams) => {
            // Clean up ALL teams in this tier before this iteration
            await prisma.tagTeam.deleteMany({
              where: { tagTeamLeague: tier },
            });

            // Create teams concurrently (simulating real-world scenario)
            const teamPromises = [];
            for (let i = 0; i < numTeams; i++) {
              teamPromises.push(createTestTeam(tier));
            }
            await Promise.all(teamPromises);

            // Get instances
            const instances = await getInstancesForTier(tier);

            // Property: No instance should exceed capacity even with concurrent creation
            for (const instance of instances) {
              expect(instance.currentTeams).toBeLessThanOrEqual(MAX_TEAMS_PER_INSTANCE);
            }

            // Property: All teams should be accounted for
            const totalTeams = instances.reduce((sum, inst) => sum + inst.currentTeams, 0);
            expect(totalTeams).toBe(numTeams);
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
