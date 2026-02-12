import { PrismaClient } from '@prisma/client';
import {
  createTeam,
  validateTeam,
  getTeamById,
  getTeamsByStable,
  disbandTeam,
} from '../src/services/tagTeamService';

const prisma = new PrismaClient();

describe('TagTeamService', () => {
  let testUserId: number;
  let testRobot1Id: number;
  let testRobot2Id: number;
  let testRobot3Id: number;
  let testRobot4Id: number;
  let otherUserId: number;
  let otherRobotId: number;

  // Clean up teams after each test
  afterEach(async () => {
    await prisma.tagTeam.deleteMany({
      where: {
        OR: [{ stableId: testUserId }, { stableId: otherUserId }],
      },
    });
  });

  beforeAll(async () => {
    // Create test user
    const testUser = await prisma.user.create({
      data: {
        username: `tagteam_test_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 1000000,
      },
    });
    testUserId = testUser.id;

    // Create another user for cross-stable tests
    const otherUser = await prisma.user.create({
      data: {
        username: `tagteam_other_user_${Date.now()}`,
        passwordHash: 'test_hash',
        currency: 1000000,
      },
    });
    otherUserId = otherUser.id;

    // Create test weapons
    const weapon = await prisma.weapon.findFirst();
    const weaponId = weapon!.id;

    // Add weapons to inventory
    const [weapon1, weapon2, weapon3, weapon4, weapon5] = await Promise.all([
      prisma.weaponInventory.create({
        data: { userId: testUserId, weaponId },
      }),
      prisma.weaponInventory.create({
        data: { userId: testUserId, weaponId },
      }),
      prisma.weaponInventory.create({
        data: { userId: testUserId, weaponId },
      }),
      prisma.weaponInventory.create({
        data: { userId: testUserId, weaponId },
      }),
      prisma.weaponInventory.create({
        data: { userId: otherUserId, weaponId },
      }),
    ]);

    // Create test robots (all battle-ready)
    const robot1 = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: `TagTeam_Robot1_${Date.now()}`,
        hullIntegrity: 10.0,
        currentHP: 100,
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
        yieldThreshold: 10,
        loadoutType: 'single',
        mainWeaponId: weapon1.id,
      },
    });
    testRobot1Id = robot1.id;

    const robot2 = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: `TagTeam_Robot2_${Date.now()}`,
        hullIntegrity: 10.0,
        currentHP: 100,
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
        yieldThreshold: 10,
        loadoutType: 'single',
        mainWeaponId: weapon2.id,
      },
    });
    testRobot2Id = robot2.id;

    const robot3 = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: `TagTeam_Robot3_${Date.now()}`,
        hullIntegrity: 10.0,
        currentHP: 100,
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
        yieldThreshold: 10,
        loadoutType: 'single',
        mainWeaponId: weapon3.id,
      },
    });
    testRobot3Id = robot3.id;

    const robot4 = await prisma.robot.create({
      data: {
        userId: testUserId,
        name: `TagTeam_Robot4_${Date.now()}`,
        hullIntegrity: 10.0,
        currentHP: 100, // Battle ready
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
        yieldThreshold: 10,
        loadoutType: 'single',
        mainWeaponId: weapon4.id,
      },
    });
    testRobot4Id = robot4.id;

    const otherRobot = await prisma.robot.create({
      data: {
        userId: otherUserId,
        name: `TagTeam_OtherRobot_${Date.now()}`,
        hullIntegrity: 10.0,
        currentHP: 100,
        maxHP: 100,
        currentShield: 0,
        maxShield: 0,
        yieldThreshold: 10,
        loadoutType: 'single',
        mainWeaponId: weapon5.id,
      },
    });
    otherRobotId = otherRobot.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.tagTeam.deleteMany({
      where: {
        OR: [{ stableId: testUserId }, { stableId: otherUserId }],
      },
    });
    await prisma.robot.deleteMany({
      where: {
        OR: [{ userId: testUserId }, { userId: otherUserId }],
      },
    });
    await prisma.weaponInventory.deleteMany({
      where: {
        OR: [{ userId: testUserId }, { userId: otherUserId }],
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [testUserId, otherUserId] },
      },
    });
    await prisma.$disconnect();
  });

  describe('validateTeam', () => {
    it('should validate a team with two ready robots from same stable', async () => {
      const result = await validateTeam(testRobot1Id, testRobot2Id);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject robots from different stables', async () => {
      const result = await validateTeam(testRobot1Id, otherRobotId);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Robots must be from the same stable');
    });

    it('should reject team with unready robot (low HP)', async () => {
      // Create a robot with low HP for this test
      const weapon = await prisma.weapon.findFirst();
      const weaponInv = await prisma.weaponInventory.create({
        data: { userId: testUserId, weaponId: weapon!.id },
      });
      
      const unreadyRobot = await prisma.robot.create({
        data: {
          userId: testUserId,
          name: `TagTeam_UnreadyRobot_${Date.now()}`,
          hullIntegrity: 10.0,
          currentHP: 50, // Low HP - not battle ready
          maxHP: 100,
          currentShield: 0,
          maxShield: 0,
          yieldThreshold: 10,
          loadoutType: 'single',
          mainWeaponId: weaponInv.id,
        },
      });

      const result = await validateTeam(testRobot1Id, unreadyRobot.id);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Reserve robot not ready'))).toBe(true);

      // Clean up
      await prisma.robot.delete({ where: { id: unreadyRobot.id } });
      await prisma.weaponInventory.delete({ where: { id: weaponInv.id } });
    });

    it('should reject duplicate teams', async () => {
      // Create a team first
      const createResult = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult.success).toBe(true);

      // Try to create the same team again
      const result = await validateTeam(testRobot1Id, testRobot2Id);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A team with these robots already exists');
    });

    it('should reject duplicate teams in reverse order', async () => {
      // Create a team
      const createResult = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult.success).toBe(true);

      // Try to create the same team with reversed positions
      const result = await validateTeam(testRobot2Id, testRobot1Id);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A team with these robots already exists');
    });

    it('should enforce roster limit (max teams = roster size / 2)', async () => {
      // We have 4 robots, so max 2 teams
      // Create 2 teams
      const team1 = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(team1.success).toBe(true);
      
      const team2 = await createTeam(testUserId, testRobot3Id, testRobot4Id);
      expect(team2.success).toBe(true);

      // Try to create a third team (should fail)
      const result = await validateTeam(testRobot1Id, testRobot3Id);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Maximum number of teams reached'))).toBe(true);
    });
  });

  describe('createTeam', () => {
    it('should create a valid team', async () => {
      const result = await createTeam(testUserId, testRobot1Id, testRobot2Id);

      expect(result.success).toBe(true);
      expect(result.team).toBeDefined();
      expect(result.team!.stableId).toBe(testUserId);
      expect(result.team!.activeRobotId).toBe(testRobot1Id);
      expect(result.team!.reserveRobotId).toBe(testRobot2Id);
      expect(result.team!.tagTeamLeague).toBe('bronze');
      expect(result.team!.tagTeamLeagueId).toBe('bronze_1');
      expect(result.team!.tagTeamLeaguePoints).toBe(0);
      expect(result.team!.cyclesInTagTeamLeague).toBe(0);
    });

    // Requirement 6.2: New teams placed in Bronze league
    it('should place new teams in Bronze league with initial values', async () => {
      const result = await createTeam(testUserId, testRobot1Id, testRobot2Id);

      expect(result.success).toBe(true);
      expect(result.team).toBeDefined();
      
      // Verify initial placement in Bronze league (bronze_1 instance)
      expect(result.team!.tagTeamLeague).toBe('bronze');
      expect(result.team!.tagTeamLeagueId).toBe('bronze_1');
      
      // Verify initial league points set to 0
      expect(result.team!.tagTeamLeaguePoints).toBe(0);
      
      // Verify cycles counter set to 0
      expect(result.team!.cyclesInTagTeamLeague).toBe(0);
      
      // Verify initial statistics
      expect(result.team!.totalTagTeamWins).toBe(0);
      expect(result.team!.totalTagTeamLosses).toBe(0);
      expect(result.team!.totalTagTeamDraws).toBe(0);
    });

    it('should return errors for invalid team', async () => {
      const result = await createTeam(testUserId, testRobot1Id, otherRobotId);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject team creation if user does not own robots', async () => {
      const result = await createTeam(otherUserId, testRobot1Id, testRobot2Id);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('You do not own these robots');
    });
  });

  describe('getTeamById', () => {
    it('should retrieve a team by ID', async () => {
      const createResult = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult.success).toBe(true);
      const teamId = createResult.team!.id;

      const team = await getTeamById(teamId);

      expect(team).toBeDefined();
      expect(team!.id).toBe(teamId);
      expect(team!.activeRobotId).toBe(testRobot1Id);
      expect(team!.reserveRobotId).toBe(testRobot2Id);
    });

    it('should include robot details in response', async () => {
      const createResult = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult.success).toBe(true);
      const teamId = createResult.team!.id;

      const team = await getTeamById(teamId);

      expect(team).toBeDefined();
      // Verify robot details are included (Requirement 9.2)
      expect(team!.activeRobot).toBeDefined();
      expect(team!.activeRobot.id).toBe(testRobot1Id);
      expect(team!.activeRobot.name).toBeDefined();
      expect(team!.activeRobot.currentHP).toBeDefined();
      expect(team!.activeRobot.elo).toBeDefined();
      
      expect(team!.reserveRobot).toBeDefined();
      expect(team!.reserveRobot.id).toBe(testRobot2Id);
      expect(team!.reserveRobot.name).toBeDefined();
      expect(team!.reserveRobot.currentHP).toBeDefined();
      expect(team!.reserveRobot.elo).toBeDefined();
    });

    it('should return null for non-existent team', async () => {
      const team = await getTeamById(999999);
      expect(team).toBeNull();
    });
  });

  describe('getTeamsByStable', () => {
    it('should retrieve all teams for a stable', async () => {
      const team1 = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(team1.success).toBe(true);
      
      const team2 = await createTeam(testUserId, testRobot3Id, testRobot4Id);
      expect(team2.success).toBe(true);

      const teams = await getTeamsByStable(testUserId);

      expect(teams.length).toBe(2);
      const teamIds = teams.map(t => t.id);
      expect(teamIds).toContain(team1.team!.id);
      expect(teamIds).toContain(team2.team!.id);
    });

    it('should include robot details for all teams', async () => {
      const team1 = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(team1.success).toBe(true);
      
      const team2 = await createTeam(testUserId, testRobot3Id, testRobot4Id);
      expect(team2.success).toBe(true);

      const teams = await getTeamsByStable(testUserId);

      expect(teams.length).toBe(2);
      
      // Verify robot details are included for all teams (Requirement 9.1, 9.2)
      teams.forEach(team => {
        expect(team.activeRobot).toBeDefined();
        expect(team.activeRobot.name).toBeDefined();
        expect(team.activeRobot.currentHP).toBeDefined();
        expect(team.activeRobot.elo).toBeDefined();
        
        expect(team.reserveRobot).toBeDefined();
        expect(team.reserveRobot.name).toBeDefined();
        expect(team.reserveRobot.currentHP).toBeDefined();
        expect(team.reserveRobot.elo).toBeDefined();
      });
    });

    it('should return empty array for stable with no teams', async () => {
      const teams = await getTeamsByStable(otherUserId);
      expect(teams).toEqual([]);
    });
  });

  describe('disbandTeam', () => {
    it('should disband a team', async () => {
      const createResult = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult.success).toBe(true);
      const teamId = createResult.team!.id;

      const result = await disbandTeam(teamId, testUserId);
      expect(result).toBe(true);

      // Verify team is deleted
      const team = await getTeamById(teamId);
      expect(team).toBeNull();
    });

    it('should reject disbanding team from wrong stable', async () => {
      const createResult = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult.success).toBe(true);
      const teamId = createResult.team!.id;

      const result = await disbandTeam(teamId, otherUserId);
      expect(result).toBe(false);

      // Verify team still exists
      const team = await getTeamById(teamId);
      expect(team).not.toBeNull();
    });

    it('should return false for non-existent team', async () => {
      const result = await disbandTeam(999999, testUserId);
      expect(result).toBe(false);
    });

    it('should make robots available for new teams after disbanding', async () => {
      // Create a team with robot1 and robot2
      const createResult1 = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult1.success).toBe(true);
      const teamId = createResult1.team!.id;

      // Verify we cannot create another team with the same robots
      const createResult2 = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult2.success).toBe(false);
      expect(createResult2.errors).toContain('A team with these robots already exists');

      // Disband the team
      const disbandResult = await disbandTeam(teamId, testUserId);
      expect(disbandResult).toBe(true);

      // Verify we can now create a new team with the same robots
      const createResult3 = await createTeam(testUserId, testRobot1Id, testRobot2Id);
      expect(createResult3.success).toBe(true);
      expect(createResult3.team).toBeDefined();
      expect(createResult3.team!.activeRobotId).toBe(testRobot1Id);
      expect(createResult3.team!.reserveRobotId).toBe(testRobot2Id);
    });
  });
});
