import prisma from '../src/lib/prisma';


describe('Tag Team Model Integration Tests', () => {
  let testUserIds: number[] = [];
  let testRobotIds: number[] = [];
  let testTeamIds: number[] = [];
  let testUserId: number;
  let testRobot1Id: number;
  let testRobot2Id: number;

  beforeAll(async () => {
    await prisma.$connect();
    
    // Create a test user
    const user = await prisma.user.create({
      data: {
        username: `tagteam_test_${Date.now()}`,
        passwordHash: 'test_hash',
        role: 'user',
      },
    });
    testUserId = user.id;
    testUserIds.push(user.id);

    // Create two test robots
    const robot1 = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: 'Test Robot 1',
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
      },
    });
    testRobot1Id = robot1.id;
    testRobotIds.push(robot1.id);

    const robot2 = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: 'Test Robot 2',
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
      },
    });
    testRobot2Id = robot2.id;
    testRobotIds.push(robot2.id);
  });

  afterEach(async () => {
    // Clean up teams created in tests
    if (testTeamIds.length > 0) {
      await prisma.tagTeamMatch.deleteMany({
        where: {
          OR: [
            { team1Id: { in: testTeamIds } },
            { team2Id: { in: testTeamIds } },
          ],
        },
      });
      await prisma.tagTeam.deleteMany({
        where: { id: { in: testTeamIds } },
      });
      testTeamIds = [];
    }
  });

  afterAll(async () => {
    // Clean up test data - tag teams first, then robots
    if (testRobotIds.length > 0) {
      await prisma.tagTeam.deleteMany({
        where: {
          OR: [
            { activeRobotId: { in: testRobotIds } },
            { reserveRobotId: { in: testRobotIds } },
          ],
        },
      });
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
      await prisma.weaponInventory.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.facility.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
      });
    }
    
    await prisma.$disconnect();
  });

  describe('TagTeam Creation', () => {
    it('should create a tag team with valid data', async () => {
      const tagTeam = await prisma.tagTeam.create({
        data: {
          stableId: testUserId,
          activeRobotId: testRobot1Id,
          reserveRobotId: testRobot2Id,
        },
      });
      testTeamIds.push(tagTeam.id);

      expect(tagTeam).toBeDefined();
      expect(tagTeam.id).toBeDefined();
      expect(tagTeam.stableId).toBe(testUserId);
      expect(tagTeam.activeRobotId).toBe(testRobot1Id);
      expect(tagTeam.reserveRobotId).toBe(testRobot2Id);
      expect(tagTeam.tagTeamLeague).toBe('bronze');
      expect(tagTeam.tagTeamLeagueId).toBe('bronze_1');
      expect(tagTeam.tagTeamLeaguePoints).toBe(0);
      expect(tagTeam.cyclesInTagTeamLeague).toBe(0);
      expect(tagTeam.totalTagTeamWins).toBe(0);
      expect(tagTeam.totalTagTeamLosses).toBe(0);
      expect(tagTeam.totalTagTeamDraws).toBe(0);
    });

    it('should retrieve tag team with relations', async () => {
      // Create a team first (afterEach cleans up between tests)
      const created = await prisma.tagTeam.create({
        data: {
          stableId: testUserId,
          activeRobotId: testRobot1Id,
          reserveRobotId: testRobot2Id,
        },
      });
      testTeamIds.push(created.id);

      const tagTeam = await prisma.tagTeam.findFirst({
        where: { id: created.id },
        include: {
          stable: true,
          activeRobot: true,
          reserveRobot: true,
        },
      });

      expect(tagTeam).toBeDefined();
      expect(tagTeam?.stable.id).toBe(testUserId);
      expect(tagTeam?.activeRobot.id).toBe(testRobot1Id);
      expect(tagTeam?.reserveRobot.id).toBe(testRobot2Id);
    });

    it('should prevent duplicate robot pairs', async () => {
      // Create the first team
      const first = await prisma.tagTeam.create({
        data: {
          stableId: testUserId,
          activeRobotId: testRobot1Id,
          reserveRobotId: testRobot2Id,
        },
      });
      testTeamIds.push(first.id);

      // Try to create a team with the same robot pair - should fail on unique constraint
      await expect(
        prisma.tagTeam.create({
          data: {
            stableId: testUserId,
            activeRobotId: testRobot1Id,
            reserveRobotId: testRobot2Id,
          },
        })
      ).rejects.toThrow();
    });

    it('should update tag team statistics', async () => {
      const tagTeam = await prisma.tagTeam.findFirst({
        where: { stableId: testUserId },
      });

      const updated = await prisma.tagTeam.update({
        where: { id: tagTeam!.id },
        data: {
          totalTagTeamWins: 5,
          totalTagTeamLosses: 2,
          tagTeamLeaguePoints: 13,
        },
      });

      expect(updated.totalTagTeamWins).toBe(5);
      expect(updated.totalTagTeamLosses).toBe(2);
      expect(updated.tagTeamLeaguePoints).toBe(13);
    });
  });

  describe('TagTeamMatch Creation', () => {
    let tagTeam1Id: number;
    let tagTeam2Id: number;
    let testUser2Id: number;
    let testRobot3Id: number;
    let testRobot4Id: number;

    beforeAll(async () => {
      // Create second user and robots for team 2
      const user2 = await prisma.user.create({
        data: {
          username: `tagteam_test2_${Date.now()}`,
          passwordHash: 'test_hash',
          role: 'user',
        },
      });
      testUser2Id = user2.id;

      const robot3 = await prisma.robot.create({
        data: {
          userId: testUser2Id,
          name: 'Test Robot 3',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });
      testRobot3Id = robot3.id;

      const robot4 = await prisma.robot.create({
        data: {
          userId: testUser2Id,
          name: 'Test Robot 4',
          currentHP: 100,
          maxHP: 100,
          currentShield: 20,
          maxShield: 20,
        },
      });
      testRobot4Id = robot4.id;

      // Get team 1
      const team1 = await prisma.tagTeam.findFirst({
        where: { stableId: testUserId },
      });
      tagTeam1Id = team1!.id;

      // Create team 2
      const team2 = await prisma.tagTeam.create({
        data: {
          stableId: testUser2Id,
          activeRobotId: testRobot3Id,
          reserveRobotId: testRobot4Id,
        },
      });
      tagTeam2Id = team2.id;
    });

    afterAll(async () => {
      // Clean up
      await prisma.tagTeamMatch.deleteMany({
        where: {
          OR: [{ team1Id: tagTeam1Id }, { team2Id: tagTeam2Id }],
        },
      });
      await prisma.tagTeam.deleteMany({
        where: { stableId: testUser2Id },
      });
      await prisma.robot.deleteMany({
        where: { userId: testUser2Id },
      });
      await prisma.user.delete({
        where: { id: testUser2Id },
      });
    });

    it('should create a tag team match', async () => {
      const match = await prisma.tagTeamMatch.create({
        data: {
          team1Id: tagTeam1Id,
          team2Id: tagTeam2Id,
          tagTeamLeague: 'bronze',
          scheduledFor: new Date(),
        },
      });

      expect(match).toBeDefined();
      expect(match.id).toBeDefined();
      expect(match.team1Id).toBe(tagTeam1Id);
      expect(match.team2Id).toBe(tagTeam2Id);
      expect(match.tagTeamLeague).toBe('bronze');
      expect(match.status).toBe('scheduled');
      expect(match.battleId).toBeNull();
    });

    it('should retrieve match with team relations', async () => {
      const match = await prisma.tagTeamMatch.findFirst({
        where: { team1Id: tagTeam1Id },
        include: {
          team1: {
            include: {
              activeRobot: true,
              reserveRobot: true,
            },
          },
          team2: {
            include: {
              activeRobot: true,
              reserveRobot: true,
            },
          },
        },
      });

      expect(match).toBeDefined();
      expect(match?.team1.activeRobot.id).toBe(testRobot1Id);
      expect(match?.team1.reserveRobot.id).toBe(testRobot2Id);
      expect(match?.team2!.activeRobot.id).toBe(testRobot3Id);
      expect(match?.team2!.reserveRobot.id).toBe(testRobot4Id);
    });

    it('should update match status', async () => {
      const match = await prisma.tagTeamMatch.findFirst({
        where: { team1Id: tagTeam1Id },
      });

      const updated = await prisma.tagTeamMatch.update({
        where: { id: match!.id },
        data: { status: 'completed' },
      });

      expect(updated.status).toBe('completed');
    });
  });

  describe('Robot Tag Team Statistics', () => {
    it('should update robot tag team statistics', async () => {
      const robot = await prisma.robot.update({
        where: { id: testRobot1Id },
        data: {
          totalTagTeamBattles: 10,
          totalTagTeamWins: 6,
          totalTagTeamLosses: 3,
          totalTagTeamDraws: 1,
          timesTaggedIn: 0,
          timesTaggedOut: 5,
        },
      });

      expect(robot.totalTagTeamBattles).toBe(10);
      expect(robot.totalTagTeamWins).toBe(6);
      expect(robot.totalTagTeamLosses).toBe(3);
      expect(robot.totalTagTeamDraws).toBe(1);
      expect(robot.timesTaggedIn).toBe(0);
      expect(robot.timesTaggedOut).toBe(5);
    });
  });
});
