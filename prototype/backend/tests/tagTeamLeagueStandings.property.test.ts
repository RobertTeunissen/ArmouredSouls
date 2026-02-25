import { Robot } from '@prisma/client';
import prisma from '../src/lib/prisma';
import * as fc from 'fast-check';
import { createTeam, getTeamById } from '../src/services/tagTeamService';


/**
 * Property-Based Test for Separate League Standings
 * Feature: tag-team-matches, Property 34: Separate League Standings
 * 
 * **Validates: Requirements 11.6**
 * 
 * Property: For any robot, their 1v1 league standings and tag team league standings
 * should be maintained independently. Changes to a robot's 1v1 league (currentLeague,
 * leagueId, leaguePoints) should not affect the tag team's league standings
 * (tagTeamLeague, tagTeamLeagueId, tagTeamLeaguePoints), and vice versa.
 */

describe('Tag Team League Standings Property Tests', () => {
  let testUserId: number;
  let weaponId: number;

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: `pbt_standings_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 1000000,
      },
    });
    testUserId = testUser.id;

    // Get a weapon for testing
    const weapon = await prisma.weapon.findFirst();
    weaponId = weapon!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tagTeam.deleteMany({
      where: { stableId: testUserId },
    });
    await prisma.robot.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up teams and robots after each test
    await prisma.tagTeam.deleteMany({
      where: { stableId: testUserId },
    });
    await prisma.robot.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.weaponInventory.deleteMany({
      where: { userId: testUserId },
    });
  });

  /**
   * **Validates: Requirements 11.6**
   * 
   * Property: Robot 1v1 league standings and tag team league standings are independent.
   * Updating a robot's 1v1 league should not affect the tag team's league standings.
   */
  it('should maintain independent 1v1 and tag team league standings', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate league configurations
        fc.record({
          // Robot 1v1 league data
          robot1v1League: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          robot1v1LeaguePoints: fc.integer({ min: 0, max: 100 }),
          // Tag team league data (should be independent)
          tagTeamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          tagTeamLeaguePoints: fc.integer({ min: 0, max: 100 }),
          // Changes to apply
          new1v1League: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          new1v1LeaguePoints: fc.integer({ min: 0, max: 100 }),
        }),
        async (config) => {
          // Create weapon inventory
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId, weaponId },
          });

          // Create two battle-ready robots with specific 1v1 league standings
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId,
              name: `PBT_LS1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
              // Set 1v1 league standings
              currentLeague: config.robot1v1League,
              leagueId: `${config.robot1v1League}_1`,
              leaguePoints: config.robot1v1LeaguePoints,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId,
              name: `PBT_LS2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
              // Set 1v1 league standings
              currentLeague: config.robot1v1League,
              leagueId: `${config.robot1v1League}_1`,
              leaguePoints: config.robot1v1LeaguePoints,
            },
          });

          // Create a tag team with specific tag team league standings
          const teamResult = await createTeam(testUserId, robot1.id, robot2.id);
          expect(teamResult.success).toBe(true);
          expect(teamResult.team).toBeDefined();

          const teamId = teamResult.team!.id;

          // Update the tag team's league standings
          await prisma.tagTeam.update({
            where: { id: teamId },
            data: {
              tagTeamLeague: config.tagTeamLeague,
              tagTeamLeagueId: `${config.tagTeamLeague}_1`,
              tagTeamLeaguePoints: config.tagTeamLeaguePoints,
            },
          });

          // Get initial state
          const initialTeam = await getTeamById(teamId);
          const initialRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
          const initialRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });

          expect(initialTeam).not.toBeNull();
          expect(initialRobot1).not.toBeNull();
          expect(initialRobot2).not.toBeNull();

          // Property 1: Initial state should have independent league standings
          expect(initialRobot1!.currentLeague).toBe(config.robot1v1League);
          expect(initialRobot1!.leaguePoints).toBe(config.robot1v1LeaguePoints);
          expect(initialTeam!.tagTeamLeague).toBe(config.tagTeamLeague);
          expect(initialTeam!.tagTeamLeaguePoints).toBe(config.tagTeamLeaguePoints);

          // Update robot's 1v1 league standings
          await prisma.robot.update({
            where: { id: robot1.id },
            data: {
              currentLeague: config.new1v1League,
              leagueId: `${config.new1v1League}_1`,
              leaguePoints: config.new1v1LeaguePoints,
            },
          });

          // Get updated state
          const updatedTeam = await getTeamById(teamId);
          const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });

          expect(updatedTeam).not.toBeNull();
          expect(updatedRobot1).not.toBeNull();

          // Property 2: Robot's 1v1 league standings should be updated
          expect(updatedRobot1!.currentLeague).toBe(config.new1v1League);
          expect(updatedRobot1!.leaguePoints).toBe(config.new1v1LeaguePoints);

          // Property 3: Tag team's league standings should remain unchanged
          expect(updatedTeam!.tagTeamLeague).toBe(config.tagTeamLeague);
          expect(updatedTeam!.tagTeamLeaguePoints).toBe(config.tagTeamLeaguePoints);
          expect(updatedTeam!.tagTeamLeagueId).toBe(`${config.tagTeamLeague}_1`);

          // Clean up
          await prisma.tagTeam.deleteMany({ where: { id: teamId } });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id] } },
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 11.6**
   * 
   * Property: Tag team league changes don't affect robot 1v1 league standings.
   * Updating a tag team's league should not affect the robots' 1v1 league standings.
   */
  it('should not affect robot 1v1 standings when tag team league changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate league configurations
        fc.record({
          // Robot 1v1 league data
          robot1v1League: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          robot1v1LeaguePoints: fc.integer({ min: 0, max: 100 }),
          // Initial tag team league data
          initialTagTeamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          initialTagTeamLeaguePoints: fc.integer({ min: 0, max: 100 }),
          // New tag team league data
          newTagTeamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          newTagTeamLeaguePoints: fc.integer({ min: 0, max: 100 }),
        }),
        async (config) => {
          // Create weapon inventory
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId, weaponId },
          });

          // Create two battle-ready robots with specific 1v1 league standings
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId,
              name: `PBT_TL1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
              // Set 1v1 league standings
              currentLeague: config.robot1v1League,
              leagueId: `${config.robot1v1League}_1`,
              leaguePoints: config.robot1v1LeaguePoints,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId,
              name: `PBT_TL2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
              // Set 1v1 league standings
              currentLeague: config.robot1v1League,
              leagueId: `${config.robot1v1League}_1`,
              leaguePoints: config.robot1v1LeaguePoints,
            },
          });

          // Create a tag team
          const teamResult = await createTeam(testUserId, robot1.id, robot2.id);
          expect(teamResult.success).toBe(true);
          expect(teamResult.team).toBeDefined();

          const teamId = teamResult.team!.id;

          // Set initial tag team league standings
          await prisma.tagTeam.update({
            where: { id: teamId },
            data: {
              tagTeamLeague: config.initialTagTeamLeague,
              tagTeamLeagueId: `${config.initialTagTeamLeague}_1`,
              tagTeamLeaguePoints: config.initialTagTeamLeaguePoints,
            },
          });

          // Get initial robot state
          const initialRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
          const initialRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });

          expect(initialRobot1).not.toBeNull();
          expect(initialRobot2).not.toBeNull();

          // Update tag team's league standings
          await prisma.tagTeam.update({
            where: { id: teamId },
            data: {
              tagTeamLeague: config.newTagTeamLeague,
              tagTeamLeagueId: `${config.newTagTeamLeague}_1`,
              tagTeamLeaguePoints: config.newTagTeamLeaguePoints,
            },
          });

          // Get updated state
          const updatedTeam = await getTeamById(teamId);
          const updatedRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
          const updatedRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });

          expect(updatedTeam).not.toBeNull();
          expect(updatedRobot1).not.toBeNull();
          expect(updatedRobot2).not.toBeNull();

          // Property 1: Tag team's league standings should be updated
          expect(updatedTeam!.tagTeamLeague).toBe(config.newTagTeamLeague);
          expect(updatedTeam!.tagTeamLeaguePoints).toBe(config.newTagTeamLeaguePoints);
          expect(updatedTeam!.tagTeamLeagueId).toBe(`${config.newTagTeamLeague}_1`);

          // Property 2: Both robots' 1v1 league standings should remain unchanged
          expect(updatedRobot1!.currentLeague).toBe(config.robot1v1League);
          expect(updatedRobot1!.leaguePoints).toBe(config.robot1v1LeaguePoints);
          expect(updatedRobot1!.leagueId).toBe(`${config.robot1v1League}_1`);

          expect(updatedRobot2!.currentLeague).toBe(config.robot1v1League);
          expect(updatedRobot2!.leaguePoints).toBe(config.robot1v1LeaguePoints);
          expect(updatedRobot2!.leagueId).toBe(`${config.robot1v1League}_1`);

          // Clean up
          await prisma.tagTeam.deleteMany({ where: { id: teamId } });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id] } },
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 11.6**
   * 
   * Property: Robots can have different 1v1 league standings while being in the same tag team.
   * The tag team's league standings are independent of individual robot standings.
   */
  it('should allow robots with different 1v1 leagues to be in the same tag team', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different league configurations for each robot
        fc.record({
          robot1League: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          robot1LeaguePoints: fc.integer({ min: 0, max: 100 }),
          robot2League: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          robot2LeaguePoints: fc.integer({ min: 0, max: 100 }),
          tagTeamLeague: fc.constantFrom('bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'),
          tagTeamLeaguePoints: fc.integer({ min: 0, max: 100 }),
        }),
        async (config) => {
          // Create weapon inventory
          const weapon1Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId, weaponId },
          });
          const weapon2Inv = await prisma.weaponInventory.create({
            data: { userId: testUserId, weaponId },
          });

          // Create two robots with different 1v1 league standings
          const robot1 = await prisma.robot.create({
            data: {
              userId: testUserId,
              name: `PBT_DL1_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weapon1Inv.id,
              currentLeague: config.robot1League,
              leagueId: `${config.robot1League}_1`,
              leaguePoints: config.robot1LeaguePoints,
            },
          });

          const robot2 = await prisma.robot.create({
            data: {
              userId: testUserId,
              name: `PBT_DL2_${Math.random().toString(36).substring(7)}`,
              hullIntegrity: 10.0,
              currentHP: 100,
              maxHP: 100,
              currentShield: 0,
              maxShield: 0,
              yieldThreshold: 20,
              loadoutType: 'single',
              mainWeaponId: weapon2Inv.id,
              currentLeague: config.robot2League,
              leagueId: `${config.robot2League}_1`,
              leaguePoints: config.robot2LeaguePoints,
            },
          });

          // Create a tag team
          const teamResult = await createTeam(testUserId, robot1.id, robot2.id);
          expect(teamResult.success).toBe(true);
          expect(teamResult.team).toBeDefined();

          const teamId = teamResult.team!.id;

          // Set tag team league standings
          await prisma.tagTeam.update({
            where: { id: teamId },
            data: {
              tagTeamLeague: config.tagTeamLeague,
              tagTeamLeagueId: `${config.tagTeamLeague}_1`,
              tagTeamLeaguePoints: config.tagTeamLeaguePoints,
            },
          });

          // Get final state
          const team = await getTeamById(teamId);
          const finalRobot1 = await prisma.robot.findUnique({ where: { id: robot1.id } });
          const finalRobot2 = await prisma.robot.findUnique({ where: { id: robot2.id } });

          expect(team).not.toBeNull();
          expect(finalRobot1).not.toBeNull();
          expect(finalRobot2).not.toBeNull();

          // Property 1: Each robot maintains its own 1v1 league standings
          expect(finalRobot1!.currentLeague).toBe(config.robot1League);
          expect(finalRobot1!.leaguePoints).toBe(config.robot1LeaguePoints);
          expect(finalRobot2!.currentLeague).toBe(config.robot2League);
          expect(finalRobot2!.leaguePoints).toBe(config.robot2LeaguePoints);

          // Property 2: Tag team has its own independent league standings
          expect(team!.tagTeamLeague).toBe(config.tagTeamLeague);
          expect(team!.tagTeamLeaguePoints).toBe(config.tagTeamLeaguePoints);

          // Property 3: Tag team league can be different from both robots' 1v1 leagues
          // (This is implicitly tested by the random generation, but we verify the data exists)
          expect(team!.tagTeamLeague).toBeDefined();
          expect(finalRobot1!.currentLeague).toBeDefined();
          expect(finalRobot2!.currentLeague).toBeDefined();

          // Clean up
          await prisma.tagTeam.deleteMany({ where: { id: teamId } });
          await prisma.robot.deleteMany({
            where: { id: { in: [robot1.id, robot2.id] } },
          });
          await prisma.weaponInventory.deleteMany({
            where: { id: { in: [weapon1Inv.id, weapon2Inv.id] } },
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});
