/**
 * Tag Team Generation Tests (Tiered Stable System)
 *
 * Verifies that tag teams are automatically created for multi-robot stables
 * (WimpBot with 3 robots, AverageBot with 2 robots) and skipped for
 * single-robot stables (ExpertBot with 1 robot).
 *
 * Requirements: 9.8, 10.8
 */

import prisma from '../src/lib/prisma';
import { generateBattleReadyUsers } from '../src/utils/userGeneration';
import fc from 'fast-check';

/**
 * Cleanup helper: removes all auto-generated users and their associated data.
 * Targets usernames starting with 'auto_' (auto_wimpbot_*, auto_averagebot_*, auto_expertbot_*).
 */
async function cleanupAutoUsers(): Promise<void> {
  const autoUsers = await prisma.user.findMany({
    where: { username: { startsWith: 'auto_' } },
    select: { id: true },
  });
  const userIds = autoUsers.map((u) => u.id);
  if (userIds.length === 0) return;

  const robots = await prisma.robot.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const robotIds = robots.map((r) => r.id);

  if (robotIds.length > 0) {
    const tagTeamIds = (
      await prisma.tagTeam.findMany({
        where: {
          OR: [
            { activeRobotId: { in: robotIds } },
            { reserveRobotId: { in: robotIds } },
          ],
        },
        select: { id: true },
      })
    ).map((t) => t.id);

    if (tagTeamIds.length > 0) {
      await prisma.scheduledTagTeamMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: tagTeamIds } },
            { team2Id: { in: tagTeamIds } },
          ],
        },
      });
    }

    await prisma.tagTeam.deleteMany({
      where: {
        OR: [
          { activeRobotId: { in: robotIds } },
          { reserveRobotId: { in: robotIds } },
        ],
      },
    });
    await prisma.battleParticipant.deleteMany({
      where: { robotId: { in: robotIds } },
    });
    await prisma.battle.deleteMany({
      where: {
        OR: [
          { robot1Id: { in: robotIds } },
          { robot2Id: { in: robotIds } },
        ],
      },
    });
    await prisma.scheduledLeagueMatch.deleteMany({
      where: {
        OR: [
          { robot1Id: { in: robotIds } },
          { robot2Id: { in: robotIds } },
        ],
      },
    });
  }

  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.facility.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('Tag Team Generation (Tiered Stable System)', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupAutoUsers();
  });

  afterEach(async () => {
    await cleanupAutoUsers();
  });

  it('should create tag team for WimpBot stables (3 robots)', async () => {
    // Cycle 3: 1 WimpBot + 1 AverageBot + 1 ExpertBot
    await generateBattleReadyUsers(3);

    const wimpBotUser = await prisma.user.findFirst({
      where: { username: { startsWith: 'auto_wimpbot_' } },
      include: {
        robots: true,
        tagTeams: true,
      },
    });

    expect(wimpBotUser).not.toBeNull();
    expect(wimpBotUser!.robots).toHaveLength(3);
    expect(wimpBotUser!.tagTeams).toHaveLength(1);
  });

  it('should create tag team for AverageBot stables (2 robots)', async () => {
    // Cycle 3: 1 WimpBot + 1 AverageBot + 1 ExpertBot
    await generateBattleReadyUsers(3);

    const averageBotUser = await prisma.user.findFirst({
      where: { username: { startsWith: 'auto_averagebot_' } },
      include: {
        robots: true,
        tagTeams: true,
      },
    });

    expect(averageBotUser).not.toBeNull();
    expect(averageBotUser!.robots).toHaveLength(2);
    expect(averageBotUser!.tagTeams).toHaveLength(1);
  });

  it('should not create tag team for ExpertBot stables (1 robot)', async () => {
    // Cycle 3: 1 WimpBot + 1 AverageBot + 1 ExpertBot
    await generateBattleReadyUsers(3);

    const expertBotUser = await prisma.user.findFirst({
      where: { username: { startsWith: 'auto_expertbot_' } },
      include: {
        robots: true,
        tagTeams: true,
      },
    });

    expect(expertBotUser).not.toBeNull();
    expect(expertBotUser!.robots).toHaveLength(1);
    expect(expertBotUser!.tagTeams).toHaveLength(0);
  });

  it('should assign tag team to bronze league', async () => {
    await generateBattleReadyUsers(3);

    const wimpBotUser = await prisma.user.findFirst({
      where: { username: { startsWith: 'auto_wimpbot_' } },
      include: { tagTeams: true },
    });

    expect(wimpBotUser).not.toBeNull();
    expect(wimpBotUser!.tagTeams).toHaveLength(1);

    const tagTeam = wimpBotUser!.tagTeams[0];
    expect(tagTeam.tagTeamLeague).toBe('bronze');
    expect(tagTeam.tagTeamLeagueId).toMatch(/^bronze_\d+$/);
  });

  it('should use first 2 robots for WimpBot tag team', async () => {
    await generateBattleReadyUsers(3);

    const wimpBotUser = await prisma.user.findFirst({
      where: { username: { startsWith: 'auto_wimpbot_' } },
      include: {
        robots: { orderBy: { id: 'asc' } },
        tagTeams: true,
      },
    });

    expect(wimpBotUser).not.toBeNull();
    expect(wimpBotUser!.robots).toHaveLength(3);
    expect(wimpBotUser!.tagTeams).toHaveLength(1);

    const tagTeam = wimpBotUser!.tagTeams[0];
    const robotIds = wimpBotUser!.robots.map((r) => r.id);

    // activeRobotId and reserveRobotId should both be from this user's robots
    expect(robotIds).toContain(tagTeam.activeRobotId);
    expect(robotIds).toContain(tagTeam.reserveRobotId);

    // They should be the first two robots created (by id order)
    expect(tagTeam.activeRobotId).toBe(wimpBotUser!.robots[0].id);
    expect(tagTeam.reserveRobotId).toBe(wimpBotUser!.robots[1].id);
  });

  it('should report correct tagTeamsCreated count', async () => {
    // Cycle 3: 1 WimpBot (tag team) + 1 AverageBot (tag team) + 1 ExpertBot (no tag team) = 2
    const result = await generateBattleReadyUsers(3);

    expect(result.tagTeamsCreated).toBe(2);
  });

  /**
   * Property-Based Tests for Tag Team Generation
   *
   * These tests verify universal properties that should hold across all valid
   * cycle numbers. Each test uses fast-check to generate random inputs and
   * verify the property holds.
   */
  describe('Property-Based Tests', () => {
    /**
     * Property 9: Tag teams are created for multi-robot stables
     * **Validates: Requirements 9.8, 10.8**
     *
     * For any generated stable with 2 or more robots (WimpBot and AverageBot tiers),
     * exactly one TagTeam record should exist linking two robots from that stable.
     * For ExpertBot stables (1 robot), no TagTeam should exist.
     *
     * Additionally verifies:
     * - Tag teams are assigned to bronze league
     * - Tag team robots belong to the same user
     * - WimpBot tag teams use the first 2 robots (by creation order)
     */
    it('Property 9: Tag teams are created for multi-robot stables', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 9 }), async (cycleNumber) => {
          await cleanupAutoUsers();

          const result = await generateBattleReadyUsers(cycleNumber);

          // Get all generated users with their robots and tag teams
          const wimpBotUsers = await prisma.user.findMany({
            where: { username: { startsWith: 'auto_wimpbot_' } },
            include: {
              robots: { orderBy: { id: 'asc' } },
              tagTeams: true,
            },
          });

          const averageBotUsers = await prisma.user.findMany({
            where: { username: { startsWith: 'auto_averagebot_' } },
            include: {
              robots: { orderBy: { id: 'asc' } },
              tagTeams: true,
            },
          });

          const expertBotUsers = await prisma.user.findMany({
            where: { username: { startsWith: 'auto_expertbot_' } },
            include: {
              robots: { orderBy: { id: 'asc' } },
              tagTeams: true,
            },
          });

          // WimpBot stables (3 robots) should have exactly 1 tag team
          for (const user of wimpBotUsers) {
            expect(user.robots).toHaveLength(3);
            expect(user.tagTeams).toHaveLength(1);

            const tagTeam = user.tagTeams[0];
            const robotIds = user.robots.map((r) => r.id);

            // Tag team robots should belong to this user
            expect(robotIds).toContain(tagTeam.activeRobotId);
            expect(robotIds).toContain(tagTeam.reserveRobotId);

            // Tag team should use first 2 robots (by id order)
            expect(tagTeam.activeRobotId).toBe(user.robots[0].id);
            expect(tagTeam.reserveRobotId).toBe(user.robots[1].id);

            // Tag team should be assigned to bronze league
            expect(tagTeam.tagTeamLeague).toBe('bronze');
            expect(tagTeam.tagTeamLeagueId).toMatch(/^bronze_\d+$/);
          }

          // AverageBot stables (2 robots) should have exactly 1 tag team
          for (const user of averageBotUsers) {
            expect(user.robots).toHaveLength(2);
            expect(user.tagTeams).toHaveLength(1);

            const tagTeam = user.tagTeams[0];
            const robotIds = user.robots.map((r) => r.id);

            // Tag team robots should belong to this user
            expect(robotIds).toContain(tagTeam.activeRobotId);
            expect(robotIds).toContain(tagTeam.reserveRobotId);

            // Tag team should use both robots
            expect(tagTeam.activeRobotId).toBe(user.robots[0].id);
            expect(tagTeam.reserveRobotId).toBe(user.robots[1].id);

            // Tag team should be assigned to bronze league
            expect(tagTeam.tagTeamLeague).toBe('bronze');
            expect(tagTeam.tagTeamLeagueId).toMatch(/^bronze_\d+$/);
          }

          // ExpertBot stables (1 robot) should have NO tag team
          for (const user of expertBotUsers) {
            expect(user.robots).toHaveLength(1);
            expect(user.tagTeams).toHaveLength(0);
          }

          // Verify tagTeamsCreated count matches WimpBot + AverageBot count
          const expectedTagTeams = wimpBotUsers.length + averageBotUsers.length;
          expect(result.tagTeamsCreated).toBe(expectedTagTeams);

          await cleanupAutoUsers();
        }),
        { numRuns: 5 }
      );
    }, 120000);
  });
});
