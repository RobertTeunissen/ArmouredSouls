/**
 * Two-Robot Specialist Tag Team Generation Test
 * Verifies that tag teams are automatically created for Two-Robot Specialist archetype users
 */

import { PrismaClient } from '@prisma/client';
import { generateBattleReadyUsers } from '../src/utils/userGeneration';

const prisma = new PrismaClient();

describe('Two-Robot Specialist Tag Team Generation', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.tagTeam.deleteMany();
    await prisma.scheduledMatch.deleteMany();
    await prisma.battle.deleteMany();
    await prisma.weaponInventory.deleteMany();
    await prisma.robot.deleteMany();
    await prisma.facility.deleteMany();
    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'archetype_',
        },
      },
    });

    // Ensure weapons exist
    const practiceSword = await prisma.weapon.findFirst({
      where: { name: 'Practice Sword' },
    });

    if (!practiceSword) {
      throw new Error('Practice Sword weapon not found. Run seed first.');
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
        username: 'archetype_two_robot_4',
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
    // Clean up previous test data
    await prisma.tagTeam.deleteMany();
    await prisma.robot.deleteMany();
    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'archetype_',
        },
      },
    });

    // Cycle 10 creates 10 users at positions 36-45
    // Position 36 % 14 = 8 (Facility Investor)
    // Position 37 % 14 = 9 (Two-Robot Specialist)
    const result = await generateBattleReadyUsers(10);

    expect(result.usersCreated).toBe(10);

    // Find the Two-Robot Specialist user
    const twoRobotUser = await prisma.user.findFirst({
      where: {
        username: 'archetype_two_robot_10',
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
    // Clean up previous test data
    await prisma.tagTeam.deleteMany();
    await prisma.robot.deleteMany();
    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'archetype_',
        },
      },
    });

    // Cycle 1 creates 1 user at position 0 (Tank Fortress - single robot)
    const result = await generateBattleReadyUsers(1);

    expect(result.usersCreated).toBe(1);

    const tankUser = await prisma.user.findFirst({
      where: {
        username: 'archetype_tank_fortress_1',
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
    // Clean up previous test data
    await prisma.tagTeam.deleteMany();
    await prisma.robot.deleteMany();
    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'archetype_',
        },
      },
    });

    // Cycle 4 to get Two-Robot Specialist at position 9
    await generateBattleReadyUsers(4);

    const twoRobotUser = await prisma.user.findFirst({
      where: {
        username: 'archetype_two_robot_4',
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
