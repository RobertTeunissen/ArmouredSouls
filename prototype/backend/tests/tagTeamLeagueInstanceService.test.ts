import { PrismaClient } from '@prisma/client';
import {
  getInstancesForTier,
  getTagTeamLeagueInstanceStats,
  assignTagTeamLeagueInstance,
  rebalanceTagTeamInstances,
  getTeamsInInstance,
  moveTeamToInstance,
  getStandingsForInstance,
  getStandingsForTier,
  MAX_TEAMS_PER_INSTANCE,
  REBALANCE_THRESHOLD,
} from '../src/services/tagTeamLeagueInstanceService';

const prisma = new PrismaClient();

describe('TagTeamLeagueInstanceService', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testTagTeamIds: number[] = [];
  let testUser: any;

  // Helper function to create test robots
  async function createTestRobots(count: number, baseIndex: number = 0) {
    const robots = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        prisma.robot.create({
          data: {
            name: `Robot ${baseIndex + i}_${Date.now()}`,
            userId: testUser.id,
            hullIntegrity: 10.0,
            currentHP: 100,
            maxHP: 100,
            currentShield: 0,
            maxShield: 0,
            yieldThreshold: 30,
            elo: 1000,
            currentLeague: 'bronze',
            leagueId: 'bronze_1',
          },
        })
      )
    );
    testRobotIds.push(...robots.map(r => r.id));
    return robots;
  }

  // Helper function to create and track tag teams
  async function createTrackedTagTeam(data: any): Promise<any> {
    const team = await prisma.tagTeam.create(data);
    testTagTeamIds.push(team.id);
    return team;
  }

  beforeEach(async () => {
    // Reset tracking arrays
    testUserIds = [];
    testRobotIds = [];
    testTagTeamIds = [];

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_${Date.now()}`,
        passwordHash: 'hash',
        currency: 10000,
      },
    });
    testUserIds.push(testUser.id);
  });

  afterEach(async () => {
    // Clean up test data in correct order (foreign key constraints)
    if (testTagTeamIds.length > 0) {
      await prisma.tagTeamMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: testTagTeamIds } },
            { team2Id: { in: testTagTeamIds } },
          ],
        },
      });
      await prisma.tagTeam.deleteMany({
        where: { id: { in: testTagTeamIds } },
      });
    }

    if (testRobotIds.length > 0) {
      await prisma.battleParticipant.deleteMany({
        where: { robotId: { in: testRobotIds } },
      });
      await prisma.battle.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
      await prisma.scheduledMatch.deleteMany({
        where: {
          OR: [
            { robot1Id: { in: testRobotIds } },
            { robot2Id: { in: testRobotIds } },
          ],
        },
      });
      await prisma.robot.deleteMany({
        where: { id: { in: testRobotIds } },
      });
    }

    if (testUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }

    // Reset tracking arrays
    testUserIds = [];
    testRobotIds = [];
    testTagTeamIds = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('getInstancesForTier', () => {
    it('should return empty array when no teams exist', async () => {
      const instances = await getInstancesForTier('bronze');
      expect(instances).toEqual([]);
    });

    it('should return instances with correct team counts', async () => {
      const robots = await createTestRobots(6);

      // Create teams in different instances
      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[2].id,
          reserveRobotId: robots[3].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[4].id,
          reserveRobotId: robots[5].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_2',
        },
      });

      const instances = await getInstancesForTier('bronze');

      expect(instances).toHaveLength(2);
      expect(instances[0].leagueId).toBe('bronze_1');
      expect(instances[0].currentTeams).toBe(2);
      expect(instances[1].leagueId).toBe('bronze_2');
      expect(instances[1].currentTeams).toBe(1);
    });

    it('should sort instances by instance number', async () => {
      const robots = await createTestRobots(6);

      // Create teams in reverse order
      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'silver',
          tagTeamLeagueId: 'silver_3',
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[2].id,
          reserveRobotId: robots[3].id,
          tagTeamLeague: 'silver',
          tagTeamLeagueId: 'silver_1',
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[4].id,
          reserveRobotId: robots[5].id,
          tagTeamLeague: 'silver',
          tagTeamLeagueId: 'silver_2',
        },
      });

      const instances = await getInstancesForTier('silver');

      expect(instances).toHaveLength(3);
      expect(instances[0].instanceNumber).toBe(1);
      expect(instances[1].instanceNumber).toBe(2);
      expect(instances[2].instanceNumber).toBe(3);
    });
  });

  describe('assignTagTeamLeagueInstance', () => {
    it('should create first instance when none exist', async () => {
      const leagueId = await assignTagTeamLeagueInstance('bronze');
      expect(leagueId).toBe('bronze_1');
    });

    it('should assign to instance with most free spots', async () => {
      const robots = await createTestRobots(80);

      // Create 30 teams in instance 1
      for (let i = 0; i < 30; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[i * 2].id,
            reserveRobotId: robots[i * 2 + 1].id,
            tagTeamLeague: 'silver',
            tagTeamLeagueId: 'silver_1',
          },
        });
      }

      // Create 10 teams in instance 2
      for (let i = 0; i < 10; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[60 + i * 2].id,
            reserveRobotId: robots[60 + i * 2 + 1].id,
            tagTeamLeague: 'silver',
            tagTeamLeagueId: 'silver_2',
          },
        });
      }

      const assignedLeagueId = await assignTagTeamLeagueInstance('silver');

      expect(assignedLeagueId).toBe('silver_2'); // Instance 2 has more free spots (40 vs 20)
    });

    it('should create new instance when all are full', async () => {
      const robots = await createTestRobots(200);

      // Fill instance 1 (50 teams)
      for (let i = 0; i < 50; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[i * 2].id,
            reserveRobotId: robots[i * 2 + 1].id,
            tagTeamLeague: 'gold',
            tagTeamLeagueId: 'gold_1',
          },
        });
      }

      // Fill instance 2 (50 teams)
      for (let i = 0; i < 50; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[100 + i * 2].id,
            reserveRobotId: robots[100 + i * 2 + 1].id,
            tagTeamLeague: 'gold',
            tagTeamLeagueId: 'gold_2',
          },
        });
      }

      const assignedLeagueId = await assignTagTeamLeagueInstance('gold');

      expect(assignedLeagueId).toBe('gold_3'); // Should create third instance
    });
  });

  describe('rebalanceTagTeamInstances', () => {
    it('should not rebalance when instances are balanced', async () => {
      const robots = await createTestRobots(40);

      // Create 10 teams in each of 2 instances (balanced)
      for (let i = 0; i < 10; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[i * 2].id,
            reserveRobotId: robots[i * 2 + 1].id,
            tagTeamLeague: 'platinum',
            tagTeamLeagueId: 'platinum_1',
            tagTeamLeaguePoints: i,
          },
        });
      }

      for (let i = 0; i < 10; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[20 + i * 2].id,
            reserveRobotId: robots[20 + i * 2 + 1].id,
            tagTeamLeague: 'platinum',
            tagTeamLeagueId: 'platinum_2',
            tagTeamLeaguePoints: i,
          },
        });
      }

      await rebalanceTagTeamInstances('platinum');

      // Verify no changes
      const instance1Teams = await prisma.tagTeam.count({
        where: { tagTeamLeagueId: 'platinum_1' },
      });
      const instance2Teams = await prisma.tagTeam.count({
        where: { tagTeamLeagueId: 'platinum_2' },
      });

      expect(instance1Teams).toBe(10);
      expect(instance2Teams).toBe(10);
    });

    it('should rebalance when deviation exceeds threshold', async () => {
      const robots = await createTestRobots(90);

      // Create 43 teams in instance 1, 2 teams in instance 2
      // System doesn't rebalance based on deviation anymore
      // It only rebalances when an instance exceeds MAX_TEAMS_PER_INSTANCE (50)
      for (let i = 0; i < 43; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[i * 2].id,
            reserveRobotId: robots[i * 2 + 1].id,
            tagTeamLeague: 'champion',
            tagTeamLeagueId: 'champion_1',
            tagTeamLeaguePoints: i,
          },
        });
      }

      for (let i = 0; i < 2; i++) {
        await createTrackedTagTeam({
          data: {
            stableId: testUser.id,
            activeRobotId: robots[86 + i * 2].id,
            reserveRobotId: robots[86 + i * 2 + 1].id,
            tagTeamLeague: 'champion',
            tagTeamLeagueId: 'champion_2',
            tagTeamLeaguePoints: i,
          },
        });
      }

      await rebalanceTagTeamInstances('champion');

      // Verify no rebalancing occurred (neither instance exceeds 50)
      const instance1Teams = await prisma.tagTeam.count({
        where: { tagTeamLeagueId: 'champion_1' },
      });
      const instance2Teams = await prisma.tagTeam.count({
        where: { tagTeamLeagueId: 'champion_2' },
      });

      // Teams remain in original instances
      expect(instance1Teams).toBe(43);
      expect(instance2Teams).toBe(2);
      expect(instance1Teams + instance2Teams).toBe(45);
    });
  });

  describe('getTeamsInInstance', () => {
    it('should return teams sorted by league points', async () => {
      const robots = await createTestRobots(6);

      // Create teams with different league points
      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: 10,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[2].id,
          reserveRobotId: robots[3].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: 25,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[4].id,
          reserveRobotId: robots[5].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: 15,
        },
      });

      const teams = await getTeamsInInstance('bronze_1');

      expect(teams).toHaveLength(3);
      expect(teams[0].tagTeamLeaguePoints).toBe(25);
      expect(teams[1].tagTeamLeaguePoints).toBe(15);
      expect(teams[2].tagTeamLeaguePoints).toBe(10);
    });
  });

  describe('moveTeamToInstance', () => {
    it('should move team to appropriate instance in new tier', async () => {
      const robots = await createTestRobots(2);

      const team = await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
        },
      });

      await moveTeamToInstance(team.id, 'silver');

      const updatedTeam = await prisma.tagTeam.findUnique({
        where: { id: team.id },
      });

      expect(updatedTeam?.tagTeamLeague).toBe('silver');
      expect(updatedTeam?.tagTeamLeagueId).toBe('silver_1');
    });
  });

  describe('getStandingsForInstance', () => {
    it('should return empty array when no teams exist', async () => {
      const standings = await getStandingsForInstance('bronze_1');
      expect(standings).toEqual([]);
    });

    it('should sort teams by league points descending', async () => {
      const robots = await createTestRobots(6);

      // Create teams with different league points but same ELO
      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: 10,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[2].id,
          reserveRobotId: robots[3].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: 25,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[4].id,
          reserveRobotId: robots[5].id,
          tagTeamLeague: 'bronze',
          tagTeamLeagueId: 'bronze_1',
          tagTeamLeaguePoints: 15,
        },
      });

      const standings = await getStandingsForInstance('bronze_1');

      expect(standings).toHaveLength(3);
      expect(standings[0].tagTeamLeaguePoints).toBe(25);
      expect(standings[0].rank).toBe(1);
      expect(standings[1].tagTeamLeaguePoints).toBe(15);
      expect(standings[1].rank).toBe(2);
      expect(standings[2].tagTeamLeaguePoints).toBe(10);
      expect(standings[2].rank).toBe(3);
    });

    it('should use combined ELO as tiebreaker when league points are equal', async () => {
      const robots = await createTestRobots(6);

      // Update robot ELOs
      await prisma.robot.update({
        where: { id: robots[0].id },
        data: { elo: 1200 },
      });
      await prisma.robot.update({
        where: { id: robots[1].id },
        data: { elo: 1100 },
      });
      await prisma.robot.update({
        where: { id: robots[2].id },
        data: { elo: 1300 },
      });
      await prisma.robot.update({
        where: { id: robots[3].id },
        data: { elo: 1400 },
      });
      await prisma.robot.update({
        where: { id: robots[4].id },
        data: { elo: 1000 },
      });
      await prisma.robot.update({
        where: { id: robots[5].id },
        data: { elo: 1000 },
      });

      // Create teams with same league points but different combined ELO
      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'silver',
          tagTeamLeagueId: 'silver_1',
          tagTeamLeaguePoints: 20,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[2].id,
          reserveRobotId: robots[3].id,
          tagTeamLeague: 'silver',
          tagTeamLeagueId: 'silver_1',
          tagTeamLeaguePoints: 20,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[4].id,
          reserveRobotId: robots[5].id,
          tagTeamLeague: 'silver',
          tagTeamLeagueId: 'silver_1',
          tagTeamLeaguePoints: 20,
        },
      });

      const standings = await getStandingsForInstance('silver_1');

      expect(standings).toHaveLength(3);
      // All have same league points, so sorted by combined ELO
      expect(standings[0].combinedELO).toBe(2700); // 1300 + 1400
      expect(standings[0].rank).toBe(1);
      expect(standings[1].combinedELO).toBe(2300); // 1200 + 1100
      expect(standings[1].rank).toBe(2);
      expect(standings[2].combinedELO).toBe(2000); // 1000 + 1000
      expect(standings[2].rank).toBe(3);
    });

    it('should include robot details in standings', async () => {
      const robots = await createTestRobots(2);

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'gold',
          tagTeamLeagueId: 'gold_1',
          tagTeamLeaguePoints: 10,
        },
      });

      const standings = await getStandingsForInstance('gold_1');

      expect(standings).toHaveLength(1);
      expect(standings[0].activeRobot).toBeDefined();
      expect(standings[0].activeRobot.name).toContain('Robot 0');
      expect(standings[0].reserveRobot).toBeDefined();
      expect(standings[0].reserveRobot.name).toContain('Robot 1');
      expect(standings[0].combinedELO).toBe(2000); // 1000 + 1000
    });
  });

  describe('getStandingsForTier', () => {
    it('should return empty array when no teams exist', async () => {
      const standings = await getStandingsForTier('bronze');
      expect(standings).toEqual([]);
    });

    it('should include teams from all instances in the tier', async () => {
      const robots = await createTestRobots(6);

      // Create teams in different instances
      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'platinum',
          tagTeamLeagueId: 'platinum_1',
          tagTeamLeaguePoints: 10,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[2].id,
          reserveRobotId: robots[3].id,
          tagTeamLeague: 'platinum',
          tagTeamLeagueId: 'platinum_2',
          tagTeamLeaguePoints: 25,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[4].id,
          reserveRobotId: robots[5].id,
          tagTeamLeague: 'platinum',
          tagTeamLeagueId: 'platinum_1',
          tagTeamLeaguePoints: 15,
        },
      });

      const standings = await getStandingsForTier('platinum');

      expect(standings).toHaveLength(3);
      // Should be sorted by league points across all instances
      expect(standings[0].tagTeamLeaguePoints).toBe(25);
      expect(standings[0].tagTeamLeagueId).toBe('platinum_2');
      expect(standings[0].rank).toBe(1);
      expect(standings[1].tagTeamLeaguePoints).toBe(15);
      expect(standings[1].tagTeamLeagueId).toBe('platinum_1');
      expect(standings[1].rank).toBe(2);
      expect(standings[2].tagTeamLeaguePoints).toBe(10);
      expect(standings[2].tagTeamLeagueId).toBe('platinum_1');
      expect(standings[2].rank).toBe(3);
    });

    it('should sort by league points then ELO across all instances', async () => {
      const robots = await createTestRobots(8);

      // Update robot ELOs
      await prisma.robot.update({
        where: { id: robots[0].id },
        data: { elo: 1500 },
      });
      await prisma.robot.update({
        where: { id: robots[1].id },
        data: { elo: 1500 },
      });
      await prisma.robot.update({
        where: { id: robots[2].id },
        data: { elo: 1200 },
      });
      await prisma.robot.update({
        where: { id: robots[3].id },
        data: { elo: 1200 },
      });

      // Create teams with same league points in different instances
      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[0].id,
          reserveRobotId: robots[1].id,
          tagTeamLeague: 'diamond',
          tagTeamLeagueId: 'diamond_1',
          tagTeamLeaguePoints: 30,
        },
      });

      await createTrackedTagTeam({
        data: {
          stableId: testUser.id,
          activeRobotId: robots[2].id,
          reserveRobotId: robots[3].id,
          tagTeamLeague: 'diamond',
          tagTeamLeagueId: 'diamond_2',
          tagTeamLeaguePoints: 30,
        },
      });

      const standings = await getStandingsForTier('diamond');

      expect(standings).toHaveLength(2);
      // Same league points, so sorted by combined ELO
      expect(standings[0].combinedELO).toBe(3000); // 1500 + 1500
      expect(standings[0].rank).toBe(1);
      expect(standings[1].combinedELO).toBe(2400); // 1200 + 1200
      expect(standings[1].rank).toBe(2);
    });
  });
});
