/**
 * Two-Robot Specialist Tag Team Generation Test
 * Verifies that tag teams are automatically created for Two-Robot Specialist archetype users
 */

import prisma from '../src/lib/prisma';
import { generateBattleReadyUsers } from '../src/utils/userGeneration';


describe('Two-Robot Specialist Tag Team Generation', () => {
  beforeAll(async () => {
    await prisma.$connect();
    
    // Ensure weapons exist
    let practiceSword = await prisma.weapon.findFirst({
      where: { name: 'Practice Sword' },
    });

    if (!practiceSword) {
      await prisma.weapon.create({
        data: {
          name: 'Practice Sword',
          weaponType: 'melee',
          baseDamage: 10,
          cooldown: 3,
          cost: 0,
          handsRequired: 'one',
          damageType: 'melee',
          loadoutType: 'any',
          description: 'A basic training weapon',
        },
      });
    }
  });

  afterEach(async () => {
    // Clean up archetype users and their data after each test
    const archetypeUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'archetype_' } },
      select: { id: true },
    });
    
    const userIds = archetypeUsers.map(u => u.id);
    
    if (userIds.length > 0) {
      const robots = await prisma.robot.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      const robotIds = robots.map(r => r.id);
      
      if (robotIds.length > 0) {
        await prisma.tagTeamMatch.deleteMany({
          where: {
            OR: [
              { team1: { stableId: { in: userIds } } },
              { team2: { stableId: { in: userIds } } },
            ],
          },
        });
        await prisma.tagTeam.deleteMany({
          where: { stableId: { in: userIds } },
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
        await prisma.scheduledMatch.deleteMany({
          where: {
            OR: [
              { robot1Id: { in: robotIds } },
              { robot2Id: { in: robotIds } },
            ],
          },
        });
      }
      
      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.facility.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.robot.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create tag team for Two-Robot Specialist archetype (cycle 4, position 9)', async () => {
    // Cycle 4 creates 4 users at positions 6, 7, 8, 9
    // Position 9 is Two-Robot Specialist
    const result = await generateBattleReadyUsers(4);

    expect(result.usersCreated).toBe(4);

    // Find the Two-Robot Specialist user
    const twoRobotUser = await prisma.user.findFirst({
      where: {
        username: { startsWith: 'archetype_two_robot_4' },
      },
      include: {
        robots: true,
        tagTeams: {
          include: {
            activeRobot: true,
            reserveRobot: true,
          },
        },
      },
    });

    expect(twoRobotUser).not.toBeNull();
    expect(twoRobotUser!.robots.length).toBe(2);
    expect(twoRobotUser!.tagTeams.length).toBe(1);

    const tagTeam = twoRobotUser!.tagTeams[0];
    expect(tagTeam.stableId).toBe(twoRobotUser!.id);
    expect(tagTeam.activeRobotId).toBe(twoRobotUser!.robots[0].id);
    expect(tagTeam.reserveRobotId).toBe(twoRobotUser!.robots[1].id);
    expect(tagTeam.tagTeamLeague).toBe('bronze');
    expect(tagTeam.tagTeamLeagueId).toBe('bronze_1');
  });

  it('should create tag team for Two-Robot Specialist in cycle 1 (position 9 wraps to cycle 10)', async () => {
    // Cycle 10 creates 10 users at positions 36-45
    // Position 36 % 14 = 8 (Facility Investor)
    // Position 37 % 14 = 9 (Two-Robot Specialist)
    const result = await generateBattleReadyUsers(10);

    expect(result.usersCreated).toBe(10);

    // Find the Two-Robot Specialist user
    const twoRobotUser = await prisma.user.findFirst({
      where: {
        username: { startsWith: 'archetype_two_robot_10' },
      },
      include: {
        robots: true,
        tagTeams: true,
      },
    });

    expect(twoRobotUser).not.toBeNull();
    expect(twoRobotUser!.robots.length).toBe(2);
    expect(twoRobotUser!.tagTeams.length).toBe(1);
  });

  it('should not create tag teams for single-robot archetypes', async () => {
    // Cycle 1 creates 1 user at position 0 (Tank Fortress - single robot)
    const result = await generateBattleReadyUsers(1);

    expect(result.usersCreated).toBe(1);

    const tankUser = await prisma.user.findFirst({
      where: {
        username: { startsWith: 'archetype_tank_fortress_1' },
      },
      include: {
        robots: true,
        tagTeams: true,
      },
    });

    expect(tankUser).not.toBeNull();
    expect(tankUser!.robots.length).toBe(1);
    expect(tankUser!.tagTeams.length).toBe(0); // No tag team for single-robot archetype
  });

  it('should create tag teams with correct robot assignments', async () => {
    // Cycle 4 to get Two-Robot Specialist at position 9
    await generateBattleReadyUsers(4);

    const twoRobotUser = await prisma.user.findFirst({
      where: {
        username: { startsWith: 'archetype_two_robot_4' },
      },
      include: {
        robots: {
          orderBy: {
            id: 'asc',
          },
        },
        tagTeams: {
          include: {
            activeRobot: true,
            reserveRobot: true,
          },
        },
      },
    });

    expect(twoRobotUser).not.toBeNull();

    const tagTeam = twoRobotUser!.tagTeams[0];
    const robots = twoRobotUser!.robots;

    // Active robot should be Specialist Alpha (offensive, single loadout)
    expect(tagTeam.activeRobot.name).toContain('Specialist Alpha');
    expect(tagTeam.activeRobot.loadoutType).toBe('single');
    expect(tagTeam.activeRobot.stance).toBe('offensive');

    // Reserve robot should be Specialist Beta (defensive, weapon+shield loadout)
    expect(tagTeam.reserveRobot.name).toContain('Specialist Beta');
    expect(tagTeam.reserveRobot.loadoutType).toBe('weapon_shield');
    expect(tagTeam.reserveRobot.stance).toBe('defensive');
  });
});
